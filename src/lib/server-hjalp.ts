import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "./auth";
import { ROT_BARA_PRIVAT } from "./job-schema";
import { prisma } from "./prisma";

// Gemensamt för server actions och läsningar: inloggning, företaget och
// felhantering. Filen har inte "use server" – inget här blir en endpoint.

const DEFAULT_COMPANY_NAME = "Mitt företag";

export type Fel = { ok: false; error: string };

/**
 * Den inloggade sessionen. cache() gör att den bara slås upp en gång per
 * förfrågan, även om sidan och flera läsningar frågar efter den. Använd den
 * här i sidor i stället för att anropa auth.api.getSession själv.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Den inloggades företag, eller null. Skapar aldrig något. En gång per förfrågan. */
export const inloggatForetag = cache(async () => {
  const session = await getSession();
  if (!session?.user) return null;
  return prisma.company.findFirst({ where: { ownerId: session.user.id } });
});

/** Ett id från klienten: en icke-tom sträng av rimlig längd. */
export const idSchema = z.string().min(1).max(100);

/** Bara för skrivningar – en läsning får aldrig skapa företaget. */
export async function getOrCreateCompany(userId: string) {
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
  try {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: "Inte inloggad" };
    return { company: await getOrCreateCompany(session.user.id) };
  } catch (err) {
    console.error("Kunde inte hämta eller skapa företaget:", err);
    return { ok: false, error: "Kunde inte hämta företaget. Försök igen." };
  }
}

export async function requireExistingCompany(): Promise<CompanyCtx | Fel> {
  try {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: "Inte inloggad" };
    const company = await prisma.company.findFirst({
      where: { ownerId: session.user.id },
    });
    if (!company) return { ok: false, error: "Inget företag hittat" };
    return { company };
  } catch (err) {
    console.error("Kunde inte hämta företaget:", err);
    return { ok: false, error: "Kunde inte hämta företaget. Försök igen." };
  }
}

export async function requireSession(): Promise<{ userId: string } | Fel> {
  try {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: "Inte inloggad" };
    return { userId: session.user.id };
  } catch (err) {
    console.error("Kunde inte hämta sessionen:", err);
    return { ok: false, error: "Kunde inte kontrollera inloggningen. Försök igen." };
  }
}

/**
 * Kunden på ett jobb eller en offert måste tillhöra företaget, och ROT går
 * bara att välja för privatpersoner. Returnerar ett felmeddelande, eller null
 * om allt stämmer.
 */
export async function kontrolleraKund(
  companyId: string,
  data: { customerId?: string; rotAvdrag: boolean },
) {
  if (!data.customerId) return null;
  const hamtad = await medFelhantering(
    "Kunde inte kontrollera kunden. Försök igen.",
    () =>
      prisma.customer.findFirst({
        where: { id: data.customerId, companyId },
        select: { typ: true },
      }),
  );
  if (!hamtad.ok) return hamtad.error;
  const customer = hamtad.data;
  if (!customer) return "Kund hittades inte";
  if (data.rotAvdrag && customer.typ === "foretag") return ROT_BARA_PRIVAT;
  return null;
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
