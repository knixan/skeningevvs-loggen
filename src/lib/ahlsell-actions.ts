"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { AHLSELL_DELSTORLEK, ahlsellRadSchema } from "./ahlsell";

type Fel = { ok: false; error: string };

// Läser bara – skapar aldrig företaget (det görs av getOrCreateCompany i
// job-actions.ts när användaren sparar något).
async function requireExistingCompany() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Inte inloggad" } as Fel;
  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!company) {
    return {
      ok: false,
      error: "Spara företagsuppgifterna först",
    } as Fel;
  }
  return { company };
}

const importIdSchema = z.uuid();

// ============================================================
// INLÄSNING AV PRISLISTA
// ============================================================
//
// 1. paborjaAhlsellImport → nytt importId
// 2. sparaAhlsellDel × n  → rader sparas med det importId:t (inte aktiva än)
// 3. slutforAhlsellImport → företaget pekar om till nya importId:t i ett
//    enda UPDATE, sedan raderas den gamla listan.
// Avbryts inläsningen syns den halvfärdiga listan aldrig, och den städas
// bort nästa gång en inläsning påbörjas.

export async function paborjaAhlsellImport() {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  try {
    await prisma.ahlsellArtikel.deleteMany({
      where: {
        companyId: company.id,
        ...(company.ahlsellImportId
          ? { importId: { not: company.ahlsellImportId } }
          : {}),
      },
    });
  } catch {
    return { ok: false as const, error: "Kunde inte förbereda inläsningen" };
  }

  return { ok: true as const, importId: crypto.randomUUID() };
}

export async function sparaAhlsellDel(importId: string, rader: unknown) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const id = importIdSchema.safeParse(importId);
  const parsed = z
    .array(ahlsellRadSchema)
    .min(1)
    .max(AHLSELL_DELSTORLEK)
    .safeParse(rader);
  if (!id.success || !parsed.success) {
    return { ok: false as const, error: "Ogiltiga rader i prislistan" };
  }
  if (id.data === company.ahlsellImportId) {
    return { ok: false as const, error: "Inläsningen är redan avslutad" };
  }

  try {
    await prisma.ahlsellArtikel.createMany({
      data: parsed.data.map((r) => ({
        ...r,
        companyId: company.id,
        importId: id.data,
      })),
    });
  } catch {
    return { ok: false as const, error: "Kunde inte spara artiklarna" };
  }

  return { ok: true as const };
}

const slutforSchema = z.object({
  avtalInlast: z.boolean(),
  avtalSlutdatum: z
    .string()
    .regex(/^(\d{6})?$/)
    .default(""),
});

export async function slutforAhlsellImport(
  importId: string,
  info: z.input<typeof slutforSchema>,
) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const id = importIdSchema.safeParse(importId);
  const meta = slutforSchema.safeParse(info);
  if (!id.success || !meta.success) {
    return { ok: false as const, error: "Ogiltig inläsning" };
  }

  try {
    const antal = await prisma.ahlsellArtikel.count({
      where: { companyId: company.id, importId: id.data },
    });
    if (antal === 0) {
      return { ok: false as const, error: "Inga artiklar lästes in" };
    }

    await prisma.company.update({
      where: { id: company.id },
      data: {
        ahlsellImportId: id.data,
        ahlsellImporteradVid: new Date(),
        ahlsellAntalArtiklar: antal,
        ahlsellAvtalInlast: meta.data.avtalInlast,
        ahlsellAvtalSlutdatum: meta.data.avtalSlutdatum,
      },
    });
  } catch {
    return { ok: false as const, error: "Kunde inte aktivera prislistan" };
  }

  // Den nya listan är redan aktiv. Misslyckas städningen ligger de gamla
  // raderna kvar osynliga och rensas vid nästa inläsning.
  try {
    await prisma.ahlsellArtikel.deleteMany({
      where: { companyId: company.id, importId: { not: id.data } },
    });
  } catch {}

  revalidatePath("/mina-sidor/installningar");
  return { ok: true as const };
}

// ============================================================
// NYTT AVTAL PÅ BEFINTLIG PRISLISTA
// ============================================================
//
// Grundpriserna ligger redan sparade, så ett nytt avtal kan läsas in utan
// att beräkningsgrunden väljs igen. Klienten hämtar den aktiva listan i delar,
// räknar om nettopriserna med det nya avtalet och sparar resultatet som en ny
// inläsning (paborja → sparaDel → slutfor). Den gamla listan gäller tills den
// nya är klar.

const hamtaSchema = z.object({
  importId: z.uuid().nullable(),
  efterId: z.string().max(40).nullable(),
});

export async function hamtaAhlsellGrundpriser(
  importId: string | null,
  efterId: string | null,
) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const parsed = hamtaSchema.safeParse({ importId, efterId });
  if (!parsed.success) {
    return { ok: false as const, error: "Ogiltig förfrågan" };
  }
  if (!company.ahlsellImportId) {
    return {
      ok: false as const,
      error: "Ingen prislista inläst – välj beräkningsgrunden också",
    };
  }
  // Första anropet låser fast vilken lista som läses; byts den mitt i
  // (t.ex. en inläsning i en annan flik) avbryts det i stället för att blanda.
  const aktiv = company.ahlsellImportId;
  if (parsed.data.importId && parsed.data.importId !== aktiv) {
    return {
      ok: false as const,
      error: "Prislistan ändrades under inläsningen. Försök igen.",
    };
  }

  try {
    const rader = await prisma.ahlsellArtikel.findMany({
      where: {
        companyId: company.id,
        importId: aktiv,
        ...(parsed.data.efterId ? { id: { gt: parsed.data.efterId } } : {}),
      },
      orderBy: { id: "asc" },
      take: AHLSELL_DELSTORLEK,
      select: {
        id: true,
        artikelnr: true,
        benamning: true,
        enhet: true,
        materialklass: true,
        lagerford: true,
        bestallningsmultipel: true,
        grundprisOre: true,
      },
    });
    return { ok: true as const, importId: aktiv, rader };
  } catch {
    return { ok: false as const, error: "Kunde inte läsa den sparade prislistan" };
  }
}

export async function rensaAhlsellPrislista() {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  try {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        ahlsellImportId: null,
        ahlsellImporteradVid: null,
        ahlsellAntalArtiklar: 0,
        ahlsellAvtalInlast: false,
        ahlsellAvtalSlutdatum: "",
      },
    });
    await prisma.ahlsellArtikel.deleteMany({
      where: { companyId: company.id },
    });
  } catch {
    return { ok: false as const, error: "Kunde inte ta bort prislistan" };
  }

  revalidatePath("/mina-sidor/installningar");
  return { ok: true as const };
}

export async function uppdateraMaterialPaslag(paslag: number) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;

  const parsed = z.number().min(0).max(1000).safeParse(paslag);
  if (!parsed.success) {
    return { ok: false as const, error: "Påslaget måste vara 0–1000 %" };
  }

  try {
    await prisma.company.update({
      where: { id: ctx.company.id },
      data: { materialPaslag: parsed.data },
    });
  } catch {
    return { ok: false as const, error: "Kunde inte spara påslaget" };
  }

  revalidatePath("/mina-sidor/installningar");
  return { ok: true as const };
}

// ============================================================
// SÖKNING
// ============================================================

export type AhlsellTraff = {
  id: string;
  artikelnr: string;
  benamning: string;
  enhet: string;
  materialklass: string;
  lagerford: boolean;
  bestallningsmultipel: number;
  nettoprisOre: number;
};

export async function sokAhlsellArtiklar(sokord: string): Promise<
  | Fel
  | {
      ok: true;
      harPrislista: boolean;
      paslag: number;
      traffar: AhlsellTraff[];
    }
> {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const ord = z
    .string()
    .max(100)
    .catch("")
    .parse(sokord)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  const svar = {
    ok: true as const,
    harPrislista: company.ahlsellImportId != null,
    paslag: company.materialPaslag,
    traffar: [] as AhlsellTraff[],
  };
  if (!company.ahlsellImportId || ord.length === 0) return svar;

  try {
    svar.traffar = await prisma.ahlsellArtikel.findMany({
      where: {
        companyId: company.id,
        importId: company.ahlsellImportId,
        // Varje sökord ska finnas i benämningen eller artikelnumret
        AND: ord.map((o) => ({
          OR: [
            { benamning: { contains: o, mode: "insensitive" as const } },
            { artikelnr: { startsWith: o, mode: "insensitive" as const } },
          ],
        })),
      },
      orderBy: [{ lagerford: "desc" }, { benamning: "asc" }],
      take: 25,
      select: {
        id: true,
        artikelnr: true,
        benamning: true,
        enhet: true,
        materialklass: true,
        lagerford: true,
        bestallningsmultipel: true,
        nettoprisOre: true,
      },
    });
  } catch {
    return { ok: false, error: "Sökningen misslyckades" };
  }

  return svar;
}
