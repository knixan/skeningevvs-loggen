"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nyttJobbTillDb } from "./jobb-db";
import {
  formateraTal,
  jobSchema,
  offertSchema,
  type JobInput,
  type OffertInput,
} from "./job-schema";
import { prisma } from "./prisma";
import { mapOffert, OFFERT_MED_RADER } from "./queries";
import {
  forstaFel,
  kontrolleraKund,
  medFelhantering,
  requireCompany,
  requireExistingCompany,
  type Fel,
} from "./server-hjalp";

// Skrivningar för offerter. Varje export blir en anropbar endpoint –
// läsningarna ligger i queries.ts.

const idSchema = z.string().min(1).max(100);

/** Validerar offerten på servern och kontrollerar kunden. */
async function validera(
  companyId: string,
  input: unknown,
): Promise<{ ok: true; data: OffertInput } | Fel> {
  const parsed = offertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: forstaFel(parsed.error) };

  const kund = await medFelhantering(
    "Kunde inte kontrollera kunden. Försök igen.",
    () => kontrolleraKund(companyId, parsed.data),
  );
  if (!kund.ok) return kund;
  if (kund.data) return { ok: false, error: kund.data };

  return { ok: true, data: parsed.data };
}

/** Offertens egna fält till databasen (utan raderna). */
function offertTillDb(d: OffertInput) {
  return {
    customerId: d.customerId,
    status: d.status,
    offertdatum: new Date(d.offertdatum),
    giltigTill: new Date(d.giltigTill),
    rotAvdrag: d.rotAvdrag,
    timpris: d.timpris,
    milersattning: d.milersattning,
    beraknadeTimmar: d.beraknadeTimmar,
    beraknadStracka: d.beraknadStracka,
    fastPris: d.fastPris ?? null,
    // Arbetsdelen sparas bara när offerten har fast pris
    fastPrisArbete: d.fastPris != null ? (d.fastPrisArbete ?? null) : null,
    beskrivning: d.beskrivning,
    villkor: d.villkor,
    internaAnteckningar: d.internaAnteckningar,
  };
}

/** Raderna i den ordning de står i formuläret. */
function raderTillDb(d: OffertInput) {
  return {
    artiklar: d.artiklar.map((a, i) => ({
      ordning: i,
      namn: a.namn,
      artikelnr: a.artikelnr ?? "",
      aterforsaljare: a.aterforsaljare ?? "",
      inkopspris: a.inkopspris ?? 0,
      pris: a.pris,
      antal: a.antal,
      enhet: a.enhet ?? "",
    })),
    kostnader: d.ovrigaKostnader.map((k, i) => ({
      ordning: i,
      beskrivning: k.beskrivning,
      pris: k.pris,
    })),
  };
}

export async function createOffert(
  input: OffertInput,
): Promise<{ ok: true; id: string; nummer: number } | Fel> {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const giltig = await validera(company.id, input);
  if (!giltig.ok) return giltig;
  const d = giltig.data;
  const rader = raderTillDb(d);

  const sparat = await medFelhantering(
    "Kunde inte spara offerten. Försök igen.",
    () =>
      prisma.$transaction(async (tx) => {
        // Atomärt: räknar upp och returnerar det gamla värdet i en enda
        // SQL-sats, så att två offerter aldrig kan få samma nummer.
        const [reserverat] = await tx.$queryRaw<{ nummer: number }[]>`
          UPDATE company
          SET "nastaOffertnummer" = "nastaOffertnummer" + 1
          WHERE id = ${company.id}
          RETURNING "nastaOffertnummer" - 1 AS nummer
        `;
        if (!reserverat) throw new Error("Kunde inte reservera offertnummer");

        return tx.offert.create({
          data: {
            ...offertTillDb(d),
            companyId: company.id,
            offertnummer: reserverat.nummer,
            artiklar: { create: rader.artiklar },
            ovrigaKostnader: { create: rader.kostnader },
          },
          select: { id: true, offertnummer: true },
        });
      }),
  );
  if (!sparat.ok) return sparat;

  revalidatePath("/mina-sidor/offerter");
  return { ok: true, id: sparat.data.id, nummer: sparat.data.offertnummer };
}

export async function updateOffert(
  id: string,
  input: OffertInput,
): Promise<{ ok: true } | Fel> {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const offertId = idSchema.safeParse(id);
  if (!offertId.success) return { ok: false, error: "Offerten hittades inte" };

  const giltig = await validera(company.id, input);
  if (!giltig.ok) return giltig;
  const d = giltig.data;
  const rader = raderTillDb(d);

  const felmeddelande = "Kunde inte spara ändringarna. Försök igen.";
  const finns = await medFelhantering(felmeddelande, () =>
    prisma.offert.findFirst({
      where: { id: offertId.data, companyId: company.id },
      select: { id: true },
    }),
  );
  if (!finns.ok) return finns;
  if (!finns.data) return { ok: false, error: "Offerten hittades inte" };

  // Raderna byts ut i sin helhet. Allt sker i samma uppdatering, som Prisma
  // kör i en transaktion – antingen sparas allt eller inget.
  const sparat = await medFelhantering(felmeddelande, () =>
    prisma.offert.update({
      where: { id: offertId.data, companyId: company.id },
      data: {
        ...offertTillDb(d),
        artiklar: { deleteMany: {}, create: rader.artiklar },
        ovrigaKostnader: { deleteMany: {}, create: rader.kostnader },
      },
    }),
  );
  if (!sparat.ok) return sparat;

  revalidatePath("/mina-sidor/offerter");
  revalidatePath(`/mina-sidor/offerter/${offertId.data}/redigera`);
  revalidatePath(`/mina-sidor/offerter/${offertId.data}/skriv-ut`);
  return { ok: true };
}

export async function deleteOffert(id: string): Promise<{ ok: true } | Fel> {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const offertId = idSchema.safeParse(id);
  if (!offertId.success) return { ok: false, error: "Offerten hittades inte" };

  // Ett jobb som skapats från offerten finns kvar
  const borttagen = await medFelhantering(
    "Kunde inte ta bort offerten. Försök igen.",
    () =>
      prisma.offert.deleteMany({
        where: { id: offertId.data, companyId: company.id },
      }),
  );
  if (!borttagen.ok) return borttagen;
  if (borttagen.data.count === 0) {
    return { ok: false, error: "Offerten hittades inte" };
  }

  revalidatePath("/mina-sidor/offerter");
  return { ok: true };
}

/**
 * "Gör om till jobb" när kunden har tackat ja. Skapar ett jobb med offertens
 * kund, priser och rader, och markerar offerten som accepterad – allt i en
 * transaktion. Har offerten redan ett jobb returneras det i stället.
 *
 * Den beräknade arbetstiden och körsträckan blir inte loggad tid på jobbet –
 * de står bara som en anteckning. Det riktiga loggas när jobbet görs.
 */
export async function skapaJobbFranOffert(
  id: string,
): Promise<{ ok: true; jobId: string } | Fel> {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const offertId = idSchema.safeParse(id);
  if (!offertId.success) return { ok: false, error: "Offerten hittades inte" };

  const utfall = await medFelhantering(
    "Kunde inte skapa jobbet. Försök igen.",
    () =>
      prisma.$transaction(
        async (tx): Promise<{ jobId: string } | { fel: string }> => {
          // Lås offertraden (FOR UPDATE) innan vi läser något. Utan detta kan
          // två snabba klick båda se att jobbet saknas och skapa två jobb.
          const last = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM offert
            WHERE id = ${offertId.data} AND "companyId" = ${company.id}
            FOR UPDATE
          `;
          if (last.length === 0) return { fel: "Offerten hittades inte" };

          const rad = await tx.offert.findUniqueOrThrow({
            where: { id: offertId.data },
            include: OFFERT_MED_RADER,
          });
          if (rad.jobId) return { jobId: rad.jobId };
          const offert = mapOffert(rad);

          const anteckning = [
            `Från offert ${offert.offertnummer}: beräknat ${formateraTal(offert.beraknadeTimmar)} h arbete och ${formateraTal(offert.beraknadStracka)} km resor.`,
            offert.internaAnteckningar,
          ]
            .filter(Boolean)
            .join("\n\n");

          const jobb: JobInput = {
            customerId: offert.customerId || undefined,
            rotAvdrag: offert.rotAvdrag,
            timpris: offert.timpris,
            milersattning: offert.milersattning,
            fastPris: offert.fastPris,
            fastPrisArbete: offert.fastPrisArbete,
            pagaende: false,
            utfort: false,
            fakturerat: false,
            betalt: false,
            foljUpp: false,
            foljUppDatum: "",
            planeratArbete: offert.beskrivning,
            internaAnteckningar: anteckning.slice(0, 2000),
            anteckningar: "",
            utfortArbete: "",
            artiklar: offert.artiklar,
            ovrigaKostnader: offert.ovrigaKostnader,
            arbetstider: [],
            resor: [],
            bilder: [],
          };
          // Samma kontroller som när ett jobb sparas från formuläret
          const parsed = jobSchema.safeParse(jobb);
          if (!parsed.success) return { fel: forstaFel(parsed.error) };
          const kundFel = await kontrolleraKund(company.id, parsed.data);
          if (kundFel) return { fel: kundFel };

          const nytt = await tx.job.create({
            data: nyttJobbTillDb(company.id, parsed.data, []),
            select: { id: true },
          });
          await tx.offert.update({
            where: { id: offertId.data },
            data: { jobId: nytt.id, status: "accepterad" },
          });
          return { jobId: nytt.id };
        },
        { timeout: 15_000 },
      ),
  );
  if (!utfall.ok) return utfall;
  if ("fel" in utfall.data) return { ok: false, error: utfall.data.fel };

  revalidatePath("/mina-sidor");
  revalidatePath("/mina-sidor/offerter");
  return { ok: true, jobId: utfall.data.jobId };
}
