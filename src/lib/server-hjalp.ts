import "server-only";

import { headers } from "next/headers";
import type { z } from "zod";
import { auth } from "./auth";
import { prisma } from "./prisma";

// Gemensamt för server actions och läsningar: inloggning, företaget och
// felhantering. Filen har inte "use server" – inget här blir en endpoint.

const DEFAULT_COMPANY_NAME = "Mitt företag";

export type Fel = { ok: false; error: string };

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Den inloggades företag, eller null. Skapar aldrig något. */
export async function inloggatForetag() {
  const session = await getSession();
  if (!session?.user) return null;
  return prisma.company.findFirst({ where: { ownerId: session.user.id } });
}

/** Bara för skrivningar – en läsning får aldrig skapa företaget. */
async function getOrCreateCompany(userId: string) {
  const existing = await prisma.company.findFirst({
    where: { ownerId: userId },
  });
  if (existing) return existing;

  try {
    return await prisma.company.create({
      data: { name: DEFAULT_COMPANY_NAME, ownerId: userId },
    });
  } catch (err) {
    // Om ett samtidigt anrop redan hann skapa företaget (unikt ownerId),
    // hämta det istället för att låta krascha.
    const isUniqueConstraintError =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "P2002";
    if (isUniqueConstraintError) {
      const company = await prisma.company.findFirst({
        where: { ownerId: userId },
      });
      if (company) return company;
    }
    throw err;
  }
}

type CompanyCtx = { company: Awaited<ReturnType<typeof getOrCreateCompany>> };

/** För skrivningar: skapar företaget om det saknas. */
export async function requireCompany(): Promise<CompanyCtx | Fel> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Inte inloggad" };
  try {
    return { company: await getOrCreateCompany(session.user.id) };
  } catch (err) {
    console.error("Kunde inte hämta eller skapa företaget:", err);
    return { ok: false, error: "Kunde inte hämta företaget. Försök igen." };
  }
}

export async function requireExistingCompany(): Promise<CompanyCtx | Fel> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Inte inloggad" };
  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!company) return { ok: false, error: "Inget företag hittat" };
  return { company };
}

export async function requireSession(): Promise<{ userId: string } | Fel> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Inte inloggad" };
  return { userId: session.user.id };
}

/** Första valideringsfelet som ett svenskt meddelande till användaren. */
export function forstaFel(error: z.ZodError) {
  return error.issues[0]?.message ?? "Ogiltiga uppgifter";
}

/**
 * Kör en databasåtgärd och fångar fel. Felet loggas, och användaren får
 * meddelandet i stället för felsidan:
 *
 *   const sparat = await medFelhantering(
 *     "Kunde inte spara kunden. Försök igen.",
 *     () => prisma.customer.update(...),
 *   );
 *   if (!sparat.ok) return sparat;
 */
export async function medFelhantering<T>(
  meddelande: string,
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | Fel> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    console.error(meddelande, err);
    return { ok: false, error: meddelande };
  }
}
