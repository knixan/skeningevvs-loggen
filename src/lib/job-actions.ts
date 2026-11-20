"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { UTApi } from "uploadthing/server";
import { prisma } from "./prisma";
import { z } from "zod";
import {
  companySchema,
  customerSchema,
  jobSchema,
  kronorTillOre,
  rensaKundFalt,
  ROT_BARA_PRIVAT,
  type JobInput,
  type CustomerInput,
  type CompanyInput,
} from "./job-schema";
import { idagISverige } from "./datum";
import { skapaFakturaData } from "./faktura";
import { getJobs, JOBB_MED_RADER, mapJob } from "./queries";
import {
  forstaFel,
  medFelhantering,
  requireCompany,
  requireExistingCompany,
  requireSession,
  type Fel,
} from "./server-hjalp";

// Bara skrivningar här. Varje export blir en anropbar endpoint – läsningar
// ligger i queries.ts (utom "Ladda fler", se laddaFlerJobb).

const utapi = new UTApi();

/**
 * Uppföljningsdatum till databasen. Inget datum om bocken är av eller om
 * datumet är tomt. Att datumet finns på riktigt har jobSchema redan
 * kontrollerat (z.iso.date) – anropa bara med data som gått genom schemat.
 */
function foljUppDatumTillDb(data: JobInput): Date | null {
  if (!data.foljUpp || !data.foljUppDatum) return null;
  return new Date(data.foljUppDatum);
}

function ids<T extends { id?: string }>(rows: T[]) {
  return rows.flatMap((row) => (row.id ? [row.id] : []));
}

// ============================================================
// FÖRETAGSUPPGIFTER
// ============================================================

export async function updateCompanySettings(data: CompanyInput) {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;

  const parsed = companySchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: forstaFel(parsed.error) };
  const d = parsed.data;

  const { company } = ctx;
  const felmeddelande = "Kunde inte spara företagsuppgifterna. Försök igen.";

  // Hindra att nästa fakturanummer flyttas bakåt förbi ett nummer som redan
  // är utfärdat – annars kan två fakturor få samma nummer. Både jobben och de
  // sparade fakturorna räknas: en sparad faktura finns kvar även om jobbet
  // tas bort.
  const hogsta = await medFelhantering(felmeddelande, () =>
    Promise.all([
      prisma.job.aggregate({
        where: { companyId: company.id },
        _max: { fakturanummer: true },
      }),
      prisma.faktura.aggregate({
        where: { companyId: company.id },
        _max: { fakturanummer: true },
      }),
    ]),
  );
  if (!hogsta.ok) return hogsta;
  const [jobb, fakturor] = hogsta.data;
  const hogstaUtfardade = Math.max(
    jobb._max.fakturanummer ?? 0,
    fakturor._max.fakturanummer ?? 0,
  );
  if (d.nastaFakturanummer <= hogstaUtfardade) {
    return {
      ok: false,
      error: `Nästa fakturanummer måste vara högre än det senast utfärdade fakturanumret (${hogstaUtfardade}).`,
    };
  }

  const sparat = await medFelhantering(felmeddelande, () =>
    prisma.company.update({
      where: { id: company.id },
      data: {
        name: d.name,
        orgNummer: d.orgNummer,
        adress: d.adress,
        postnummer: d.postnummer,
        ort: d.ort,
        telefon: d.telefon,
        epost: d.epost,
        fSkatt: d.fSkatt,
        momsNummer: d.momsNummer,
        bankgiro: d.bankgiro,
        plusgiro: d.plusgiro,
        swish: d.swish,
        nastaFakturanummer: d.nastaFakturanummer,
        forfallodagar: d.forfallodagar,
        drojsmalsranta: d.drojsmalsranta,
        fakturatext: d.fakturatext,
      },
    }),
  );
  if (!sparat.ok) return sparat;

  revalidatePath("/mina-sidor");
  revalidatePath("/mina-sidor/foretag");
  return { ok: true as const };
}

export async function updateCompanyLogo(
  logo: { url: string; key: string } | null,
) {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const sparat = await medFelhantering(
    "Kunde inte spara logotypen. Försök igen.",
    () =>
      prisma.company.update({
        where: { id: company.id },
        data: {
          logoUrl: logo?.url ?? "",
          logoKey: logo?.key ?? "",
        },
      }),
  );
  if (!sparat.ok) return sparat;

  // Den gamla filen raderas först när databasen pekar på den nya – annars
  // skulle ett misslyckat sparande lämna företaget med en logotyp som inte
  // finns.
  if (company.logoKey && company.logoKey !== logo?.key) {
    try {
      await utapi.deleteFiles(company.logoKey);
    } catch (err) {
      console.error("Kunde inte radera gammal logotyp:", err);
    }
  }

  revalidatePath("/mina-sidor");
  revalidatePath("/mina-sidor/foretag");
  return { ok: true as const };
}

// ============================================================
// KUNDREGISTER
// ============================================================

/** Validerar kunddata på servern och gör om den till databasfält. */
function kundTillDb(
  data: unknown,
): { ok: true; data: Omit<Prisma.CustomerCreateInput, "company"> } | Fel {
  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: forstaFel(parsed.error) };
  const d = rensaKundFalt(parsed.data);
  return {
    ok: true,
    data: {
      typ: d.typ,
      namn: d.namn,
      adress: d.adress ?? "",
      postnummer: d.postnummer ?? "",
      ort: d.ort ?? "",
      telefon: d.telefon ?? "",
      epost: d.epost ?? "",
      personnummer: d.personnummer ?? "",
      foretagsnamn: d.foretagsnamn ?? "",
      kontaktperson: d.kontaktperson ?? "",
      orgNummer: d.orgNummer ?? "",
      fastighetsbeteckning: d.fastighetsbeteckning ?? "",
      lagenhetsnummer: d.lagenhetsnummer ?? "",
      bostadsrattsforening: d.bostadsrattsforening ?? "",
    },
  };
}

export async function createCustomer(data: CustomerInput) {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const kund = kundTillDb(data);
  if (!kund.ok) return kund;

  const sparat = await medFelhantering(
    "Kunde inte spara kunden. Försök igen.",
    () =>
      prisma.customer.create({
        data: { ...kund.data, companyId: company.id },
      }),
  );
  if (!sparat.ok) return sparat;

  revalidatePath("/mina-sidor/kunder");
  return { ok: true as const, id: sparat.data.id };
}

export async function updateCustomer(id: string, data: CustomerInput) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const kund = kundTillDb(data);
  if (!kund.ok) return kund;

  const existing = await prisma.customer.findFirst({
    where: { id, companyId: company.id },
  });
  if (!existing) return { ok: false, error: "Kund hittades inte" };

  const sparat = await medFelhantering(
    "Kunde inte spara kunden. Försök igen.",
    () => prisma.customer.update({ where: { id }, data: kund.data }),
  );
  if (!sparat.ok) return sparat;

  revalidatePath("/mina-sidor");
  revalidatePath("/mina-sidor/kunder");
  revalidatePath(`/mina-sidor/kunder/${id}/redigera`);
  return { ok: true as const };
}

export async function deleteCustomer(id: string) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const existing = await prisma.customer.findFirst({
    where: { id, companyId: company.id },
  });
  if (!existing) return { ok: false, error: "Kund hittades inte" };

  // Kunder med fakturerade jobb spärras. En utfärdad faktura har numera
  // kunduppgifterna sparade, men en förhandsgranskad (fakturerat utan
  // sparad faktura) hämtar fortfarande mottagaren från kunden.
  const fakturerade = await prisma.job.count({
    where: {
      customerId: id,
      OR: [{ fakturerat: true }, { fakturanummer: { not: null } }],
    },
  });
  if (fakturerade > 0) {
    return {
      ok: false,
      error: `Kunden har ${fakturerade} ${fakturerade === 1 ? "fakturerat jobb" : "fakturerade jobb"} och kan inte tas bort.`,
    };
  }

  // Kundens jobb kopplas loss (customerId = null) av onDelete: SetNull
  const borttagen = await medFelhantering(
    "Kunde inte ta bort kunden. Försök igen.",
    () => prisma.customer.delete({ where: { id } }),
  );
  if (!borttagen.ok) return borttagen;

  revalidatePath("/mina-sidor/kunder");
  revalidatePath("/mina-sidor");
  return { ok: true as const };
}

// ============================================================
// JOBB
// ============================================================

/**
 * "Ladda fler" i jobblistan. Den enda läsningen som anropas från klienten,
 * därför en action – övriga läsningar ligger i queries.ts.
 */
export async function laddaFlerJobb(cursor: string) {
  const parsed = z.string().min(1).max(100).safeParse(cursor);
  if (!parsed.success) return { jobs: [], nextCursor: null };
  return getJobs(parsed.data);
}

export async function createJob(
  input: JobInput,
  bilder: { url: string; key: string }[] = [],
) {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: forstaFel(parsed.error) };
  const data = parsed.data;

  const kundFel = await kontrolleraKund(company.id, data);
  if (kundFel) return { ok: false, error: kundFel };

  const sparat = await medFelhantering(
    "Kunde inte spara jobbet. Försök igen.",
    () => skapaJobb(company.id, data, bilder),
  );
  if (!sparat.ok) return sparat;

  revalidatePath("/mina-sidor");
  return { ok: true as const };
}

/**
 * Kunden på ett jobb måste tillhöra företaget, och ROT går bara att välja för
 * privatpersoner. Returnerar ett felmeddelande, eller null om allt stämmer.
 */
async function kontrolleraKund(companyId: string, data: JobInput) {
  if (!data.customerId) return null;
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, companyId },
    select: { typ: true },
  });
  if (!customer) return "Kund hittades inte";
  if (data.rotAvdrag && customer.typ === "foretag") return ROT_BARA_PRIVAT;
  return null;
}

/** Arbetsdelen av ett fast pris sparas bara när jobbet har fast pris. */
function fastPrisArbeteTillDb(data: JobInput) {
  return data.fastPris != null ? (data.fastPrisArbete ?? null) : null;
}

function skapaJobb(
  companyId: string,
  data: JobInput,
  bilder: { url: string; key: string }[],
) {
  return prisma.job.create({
    data: {
      companyId,
      customerId: data.customerId || null,
      rotAvdrag: data.rotAvdrag,
      timpris: data.timpris ?? 0,
      milersattning: data.milersattning ?? 0,
      fastPris: data.fastPris ?? null,
      fastPrisArbete: fastPrisArbeteTillDb(data),
      pagaende: data.pagaende,
      utfort: data.utfort,
      fakturerat: data.fakturerat,
      betalt: data.betalt,
      foljUpp: Boolean(data.foljUpp),
      foljUppDatum: foljUppDatumTillDb(data),
      anteckningar: data.anteckningar ?? "",
      utfortArbete: data.utfortArbete ?? "",
      planeratArbete: data.planeratArbete ?? "",
      internaAnteckningar: data.internaAnteckningar ?? "",
      artiklar: {
        create: data.artiklar.map((a) => ({
          namn: a.namn,
          artikelnr: a.artikelnr ?? "",
          aterforsaljare: a.aterforsaljare ?? "",
          inkopspris: a.inkopspris ?? 0,
          pris: a.pris,
          antal: a.antal,
          enhet: a.enhet ?? "",
        })),
      },
      resor: {
        create: data.resor.map((r) => ({
          datum: new Date(r.datum),
          stracka: r.stracka,
        })),
      },
      arbetspass: {
        create: data.arbetstider.map((w) => ({
          datum: new Date(w.datum),
          timmar: w.timmar,
        })),
      },
      images: {
        create: bilder.map((b) => ({ url: b.url, key: b.key })),
      },
      ovrigaKostnader: {
        create: (data.ovrigaKostnader ?? []).map((k) => ({
          beskrivning: k.beskrivning,
          pris: k.pris,
        })),
      },
    },
  });
}

export async function updateJob(
  id: string,
  input: JobInput,
  bilder: { url: string; key: string }[] = [],
) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: forstaFel(parsed.error) };
  const data = parsed.data;

  const existing = await prisma.job.findFirst({
    where: { id, companyId: company.id },
    include: {
      artiklar: true,
      resor: true,
      arbetspass: true,
      images: true,
      ovrigaKostnader: true,
    },
  });
  if (!existing) return { ok: false, error: "Jobb hittades inte" };

  const kundFel = await kontrolleraKund(company.id, data);
  if (kundFel) return { ok: false, error: kundFel };

  const existingImageKeys = existing.images.map((i) => i.key);
  const newImageKeys = bilder.map((b) => b.key);
  const toDelete = existingImageKeys.filter((k) => !newImageKeys.includes(k));

  const existingArtiklarIds = ids(existing.artiklar);
  const keepArtiklarIds = ids(data.artiklar);
  const deleteArtiklarIds = existingArtiklarIds.filter(
    (i) => !keepArtiklarIds.includes(i),
  );

  const existingResorIds = ids(existing.resor);
  const keepResorIds = ids(data.resor);
  const deleteResorIds = existingResorIds.filter(
    (i) => !keepResorIds.includes(i),
  );

  const existingArbetspassIds = ids(existing.arbetspass);
  const keepArbetspassIds = ids(data.arbetstider);
  const deleteArbetspassIds = existingArbetspassIds.filter(
    (i) => !keepArbetspassIds.includes(i),
  );

  const existingKostnaderIds = ids(existing.ovrigaKostnader);
  const keepKostnaderIds = ids(data.ovrigaKostnader ?? []);
  const deleteKostnaderIds = existingKostnaderIds.filter(
    (i) => !keepKostnaderIds.includes(i),
  );

  // Varje rad-id från klienten måste höra till just det här jobbet – annars
  // skulle man kunna ändra rader på ett annat jobb (eller ett annat företags).
  const främmandeRad =
    keepArtiklarIds.some((i) => !existingArtiklarIds.includes(i)) ||
    keepResorIds.some((i) => !existingResorIds.includes(i)) ||
    keepArbetspassIds.some((i) => !existingArbetspassIds.includes(i)) ||
    keepKostnaderIds.some((i) => !existingKostnaderIds.includes(i));
  if (främmandeRad) {
    return {
      ok: false,
      error: "Jobbet har ändrats sedan du öppnade det. Ladda om sidan.",
    };
  }

  const sparat = await medFelhantering(
    "Kunde inte spara ändringarna. Ladda om sidan och försök igen.",
    () =>
      prisma.$transaction([
        // Artiklar
        prisma.article.deleteMany({ where: { id: { in: deleteArtiklarIds } } }),
        ...data.artiklar.map((a) =>
          a.id
            ? prisma.article.update({
                where: { id: a.id },
                data: {
                  namn: a.namn,
                  artikelnr: a.artikelnr ?? "",
                  aterforsaljare: a.aterforsaljare ?? "",
                  inkopspris: a.inkopspris ?? 0,
                  pris: a.pris,
                  antal: a.antal,
                  enhet: a.enhet ?? "",
                },
              })
            : prisma.article.create({
                data: {
                  jobId: id,
                  namn: a.namn,
                  artikelnr: a.artikelnr ?? "",
                  aterforsaljare: a.aterforsaljare ?? "",
                  inkopspris: a.inkopspris ?? 0,
                  pris: a.pris,
                  antal: a.antal,
                  enhet: a.enhet ?? "",
                },
              }),
        ),
        // Resor
        prisma.trip.deleteMany({ where: { id: { in: deleteResorIds } } }),
        ...data.resor.map((r) =>
          r.id
            ? prisma.trip.update({
                where: { id: r.id },
                data: { datum: new Date(r.datum), stracka: r.stracka },
              })
            : prisma.trip.create({
                data: {
                  jobId: id,
                  datum: new Date(r.datum),
                  stracka: r.stracka,
                },
              }),
        ),
        // Arbetspass
        prisma.workSession.deleteMany({
          where: { id: { in: deleteArbetspassIds } },
        }),
        ...data.arbetstider.map((w) =>
          w.id
            ? prisma.workSession.update({
                where: { id: w.id },
                data: { datum: new Date(w.datum), timmar: w.timmar },
              })
            : prisma.workSession.create({
                data: { jobId: id, datum: new Date(w.datum), timmar: w.timmar },
              }),
        ),
        // Övriga kostnader
        prisma.ovrigKostnad.deleteMany({
          where: { id: { in: deleteKostnaderIds } },
        }),
        ...(data.ovrigaKostnader ?? []).map((k) =>
          k.id
            ? prisma.ovrigKostnad.update({
                where: { id: k.id },
                data: { beskrivning: k.beskrivning, pris: k.pris },
              })
            : prisma.ovrigKostnad.create({
                data: { jobId: id, beskrivning: k.beskrivning, pris: k.pris },
              }),
        ),
        // Bilder
        prisma.jobImage.deleteMany({
          where: { jobId: id, key: { in: toDelete } },
        }),
        ...bilder
          .filter((b) => !existingImageKeys.includes(b.key))
          .map((b) =>
            prisma.jobImage.create({
              data: { jobId: id, url: b.url, key: b.key },
            }),
          ),
        // Jobb-uppdatering
        prisma.job.update({
          where: { id },
          data: {
            customerId: data.customerId || null,
            rotAvdrag: data.rotAvdrag,
            timpris: data.timpris ?? 0,
            milersattning: data.milersattning ?? 0,
            fastPris: data.fastPris ?? null,
            fastPrisArbete: fastPrisArbeteTillDb(data),
            pagaende: data.pagaende,
            utfort: data.utfort,
            fakturerat: data.fakturerat,
            betalt: data.betalt,
            foljUpp: Boolean(data.foljUpp),
            foljUppDatum: foljUppDatumTillDb(data),
            anteckningar: data.anteckningar ?? "",
            utfortArbete: data.utfortArbete ?? "",
            planeratArbete: data.planeratArbete ?? "",
            internaAnteckningar: data.internaAnteckningar ?? "",
          },
        }),
      ]),
  );
  if (!sparat.ok) return sparat;

  if (toDelete.length > 0) {
    try {
      await utapi.deleteFiles(toDelete);
    } catch (err) {
      console.error("Kunde inte radera bilder från UploadThing:", err);
    }
  }

  revalidatePath("/mina-sidor");
  revalidatePath(`/mina-sidor/jobb/${id}/redigera`);
  return { ok: true as const };
}

export async function deleteJob(id: string) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const job = await prisma.job.findFirst({
    where: { id, companyId: company.id },
    include: { images: true },
  });
  if (!job) return { ok: false, error: "Jobb hittades inte" };

  // En sparad faktura finns kvar (jobId sätts till null av onDelete: SetNull)
  const borttaget = await medFelhantering(
    "Kunde inte ta bort jobbet. Försök igen.",
    () => prisma.job.delete({ where: { id } }),
  );
  if (!borttaget.ok) return borttaget;

  if (job.images.length > 0) {
    try {
      await utapi.deleteFiles(job.images.map((i) => i.key));
    } catch (err) {
      console.error("Kunde inte radera jobbbilder:", err);
    }
  }

  revalidatePath("/mina-sidor");
  return { ok: true as const };
}

export async function deleteAccount(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const ctx = await requireSession();
  if ("error" in ctx) return ctx;
  const { userId } = ctx;

  const company = await prisma.company.findFirst({
    where: { ownerId: userId },
    select: {
      logoKey: true,
      jobs: { select: { images: { select: { key: true } } } },
    },
  });

  const keys: string[] = [];
  if (company?.logoKey) keys.push(company.logoKey);
  company?.jobs.forEach((job) =>
    job.images.forEach((img) => keys.push(img.key)),
  );

  const borttaget = await medFelhantering(
    "Kunde inte ta bort kontot. Försök igen.",
    () => prisma.user.delete({ where: { id: userId } }),
  );
  if (!borttaget.ok) return borttaget;

  if (keys.length > 0) {
    try {
      await utapi.deleteFiles(keys);
    } catch (err) {
      console.error("Kunde inte radera filer vid kontoborttagning:", err);
    }
  }

  return { ok: true as const };
}

// ============================================================
// FAKTURA
// ============================================================

/**
 * Utfärdar fakturan för ett jobb, allt i en transaktion:
 * 1. delar ut nästa fakturanummer (ett jobb som redan har ett behåller det),
 * 2. markerar jobbet som fakturerat,
 * 3. sparar fakturan som den ser ut nu (tabellen `faktura`, se lib/faktura.ts).
 *
 * Är fakturan redan sparad händer ingenting. Anropas bara från knappen
 * "Utfärda faktura" – att öppna fakturasidan får aldrig dela ut ett nummer
 * (en läsning ändrar inget).
 */
export async function utfardaFaktura(
  jobId: string,
): Promise<{ ok: true; nummer: number } | Fel> {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const id = z.string().min(1).safeParse(jobId);
  if (!id.success) return { ok: false, error: "Jobb hittades inte" };

  const utfall = await medFelhantering(
    "Kunde inte utfärda fakturan. Försök igen.",
    () =>
      prisma.$transaction(
        async (tx): Promise<{ nummer: number } | { fel: string }> => {
          // Lås jobbraden (FOR UPDATE) innan vi läser något. Utan detta kan
          // två samtidiga anrop för samma jobb (t.ex. två öppna flikar) båda
          // se att fakturan saknas och dela ut två nummer.
          const rader = await tx.$queryRaw<
            { fakturanummer: number | null; customerId: string | null }[]
          >`
            SELECT "fakturanummer", "customerId" FROM job
            WHERE id = ${id.data} AND "companyId" = ${company.id}
            FOR UPDATE
          `;
          const jobb = rader[0];
          if (!jobb) return { fel: "Jobb hittades inte" };

          const sparad = await tx.faktura.findUnique({
            where: { jobId: id.data },
            select: { fakturanummer: true },
          });
          if (sparad) return { nummer: sparad.fakturanummer };

          if (!jobb.customerId) {
            return { fel: "Välj en kund på jobbet innan fakturan utfärdas." };
          }

          // Jobb som fick ett nummer innan fakturor sparades behåller det och
          // får nu sin sparade faktura.
          let nummer = jobb.fakturanummer;
          if (nummer == null) {
            // Atomärt: räknar upp och returnerar gamla värdet i en enda
            // SQL-sats, vilket förhindrar race conditions vid parallella anrop.
            const result = await tx.$queryRaw<[{ nummer: number }]>`
              UPDATE company
              SET "nastaFakturanummer" = "nastaFakturanummer" + 1
              WHERE id = ${company.id}
              RETURNING "nastaFakturanummer" - 1 AS nummer
            `;
            nummer = result[0]?.nummer ?? null;
            if (nummer == null) {
              throw new Error("Kunde inte reservera fakturanummer");
            }
          }

          const jobbet = await tx.job.findUniqueOrThrow({
            where: { id: id.data },
            include: JOBB_MED_RADER,
          });
          const foretaget = await tx.company.findUniqueOrThrow({
            where: { id: company.id },
          });
          const faktura = skapaFakturaData(mapJob(jobbet), foretaget, {
            fakturanummer: nummer,
            fakturadatum: idagISverige(),
          });

          await tx.job.update({
            where: { id: id.data },
            data: { fakturanummer: nummer, fakturerat: true },
          });
          await tx.faktura.create({
            data: {
              companyId: company.id,
              jobId: id.data,
              customerId: jobbet.customerId,
              fakturanummer: nummer,
              fakturadatum: new Date(faktura.fakturadatum),
              forfallodatum: new Date(faktura.forfallodatum),
              exklMomsOre: kronorTillOre(faktura.summa.exklMoms),
              momsOre: kronorTillOre(faktura.summa.moms),
              rotAvdragOre: kronorTillOre(faktura.summa.rotAvdrag),
              attBetalaOre: kronorTillOre(faktura.summa.attBetala),
              innehall: faktura,
            },
          });
          return { nummer };
        },
        { timeout: 15_000 },
      ),
  );
  if (!utfall.ok) return utfall;
  if ("fel" in utfall.data) return { ok: false, error: utfall.data.fel };

  revalidatePath("/mina-sidor");
  revalidatePath(`/mina-sidor/jobb/${id.data}/skriv-ut`);
  return { ok: true, nummer: utfall.data.nummer };
}

// ============================================================
// BILDER
// ============================================================

export async function deleteUploadedImage(key: string) {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  // Om nyckeln redan är sparad som en jobbild måste den tillhöra det egna
  // företaget – annars går det inte att radera. Nyuppladdade bilder som
  // ännu inte sparats på ett jobb finns inte i tabellen och tillåts, eftersom
  // nyckeln bara kan komma från den inloggade sessionens egen uppladdning.
  const existingImage = await prisma.jobImage.findFirst({
    where: { key },
    select: { job: { select: { companyId: true } } },
  });
  if (existingImage && existingImage.job.companyId !== company.id) {
    return { ok: false, error: "Otillåten åtgärd" };
  }

  try {
    await utapi.deleteFiles(key);
  } catch (err) {
    console.error("Kunde inte radera bild från UploadThing:", err);
    return { ok: false, error: "Kunde inte radera bilden" };
  }

  return { ok: true as const };
}
