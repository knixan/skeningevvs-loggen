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
  type JobInput,
  type CustomerInput,
  type CompanyInput,
} from "./job-schema";
import { idagISverige } from "./datum";
import {
  fakturaFel,
  skapaFakturaData,
  skapaKreditfaktura,
  type FakturaData,
} from "./faktura";
import {
  fastPrisArbeteTillDb,
  foljUppDatumTillDb,
  nyttJobbTillDb,
} from "./jobb-db";
import { tolkaJobbFilter, tolkaJobbSok } from "./jobb-filter";
import {
  GALLANDE_FAKTURA,
  getJobs,
  JOBB_MED_RADER,
  mapCustomer,
  mapJob,
} from "./queries";
import {
  forstaFel,
  idSchema,
  kontrolleraKund,
  medFelhantering,
  requireCompany,
  requireExistingCompany,
  requireSession,
  type Fel,
} from "./server-hjalp";

// Bara skrivningar här. Varje export blir en anropbar endpoint – läsningar
// ligger i queries.ts (utom "Ladda fler", se laddaFlerJobb).
//
// Varje databasanrop går genom medFelhantering, så att ett databasfel blir
// ett felmeddelande och inte felsidan (som tömmer formuläret).

const utapi = new UTApi();

function ids<T extends { id?: string }>(rows: T[]) {
  return rows.flatMap((row) => (row.id ? [row.id] : []));
}

// ============================================================
// UPPLADDADE FILER
// ============================================================

const filSchema = z.object({
  url: z.string().max(500),
  key: z.string().min(1).max(200),
});
const bilderSchema = z.array(filSchema).max(100);

type Fil = { url: string; key: string };

/**
 * Bara filer som företaget självt laddat upp (tabellen `uppladdning`) får
 * sparas. Adressen hämtas från databasen – klientens url används aldrig.
 * Returnerar filerna med rätt url, eller ett fel om någon nyckel är okänd.
 */
async function egnaUppladdningar(
  companyId: string,
  filer: Fil[],
): Promise<{ ok: true; data: Fil[] } | Fel> {
  if (filer.length === 0) return { ok: true, data: [] };
  const hamtade = await medFelhantering(
    "Kunde inte kontrollera bilderna. Försök igen.",
    () =>
      prisma.uppladdning.findMany({
        where: { companyId, key: { in: filer.map((f) => f.key) } },
        select: { key: true, url: true },
      }),
  );
  if (!hamtade.ok) return hamtade;
  const kanda = new Map(hamtade.data.map((u) => [u.key, u.url]));
  if (filer.some((f) => !kanda.has(f.key))) {
    return {
      ok: false,
      error: "En bild hittades inte bland dina uppladdningar. Ladda upp den igen.",
    };
  }
  return {
    ok: true,
    data: filer.map((f) => ({ key: f.key, url: kanda.get(f.key)! })),
  };
}

/** Raderar filer från UploadThing och ur `uppladdning`. Loggar fel – kastar aldrig. */
async function raderaFiler(companyId: string, keys: string[]) {
  if (keys.length === 0) return;
  try {
    await utapi.deleteFiles(keys);
    await prisma.uppladdning.deleteMany({
      where: { companyId, key: { in: keys } },
    });
  } catch (err) {
    console.error("Kunde inte radera filer från UploadThing:", err);
  }
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
  // tas bort, och en krediterad fakturas nummer finns bara i `faktura`.
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

export async function updateCompanyLogo(logo: Fil | null) {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const parsed = filSchema.nullable().safeParse(logo);
  if (!parsed.success) return { ok: false, error: "Ogiltig logotyp" };

  let ny: Fil | null = null;
  if (parsed.data && parsed.data.key !== company.logoKey) {
    const egen = await egnaUppladdningar(company.id, [parsed.data]);
    if (!egen.ok) return egen;
    ny = egen.data[0];
  } else if (parsed.data) {
    ny = { key: company.logoKey, url: company.logoUrl };
  }

  const sparat = await medFelhantering(
    "Kunde inte spara logotypen. Försök igen.",
    () =>
      prisma.$transaction([
        prisma.company.update({
          where: { id: company.id },
          data: { logoUrl: ny?.url ?? "", logoKey: ny?.key ?? "" },
        }),
        ...(ny
          ? [
              prisma.uppladdning.updateMany({
                where: { companyId: company.id, key: ny.key },
                data: { anvand: true },
              }),
            ]
          : []),
      ]),
  );
  if (!sparat.ok) return sparat;

  // Den gamla filen raderas först när databasen pekar på den nya – annars
  // skulle ett misslyckat sparande lämna företaget med en logotyp som inte
  // finns.
  if (company.logoKey && company.logoKey !== ny?.key) {
    await raderaFiler(company.id, [company.logoKey]);
  }

  revalidatePath("/mina-sidor");
  revalidatePath("/mina-sidor/foretag");
  return { ok: true as const, logo: ny };
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
      brfOrgNummer: d.brfOrgNummer ?? "",
      omvandByggmoms: Boolean(d.omvandByggmoms),
      momsNummer: d.momsNummer ?? "",
    },
  };
}

/** Skapar en kund. Returnerar kunden, så att jobbformuläret kan välja den direkt. */
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
  return {
    ok: true as const,
    id: sparat.data.id,
    kund: mapCustomer(sparat.data),
  };
}

export async function updateCustomer(id: string, data: CustomerInput) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const kundId = idSchema.safeParse(id);
  if (!kundId.success) return { ok: false, error: "Kund hittades inte" };

  const kund = kundTillDb(data);
  if (!kund.ok) return kund;

  const felmeddelande = "Kunde inte spara kunden. Försök igen.";
  // updateMany med companyId: ändrar bara en kund som tillhör företaget
  const sparat = await medFelhantering(felmeddelande, () =>
    prisma.customer.updateMany({
      where: { id: kundId.data, companyId: company.id },
      data: kund.data,
    }),
  );
  if (!sparat.ok) return sparat;
  if (sparat.data.count === 0) return { ok: false, error: "Kund hittades inte" };

  revalidatePath("/mina-sidor");
  revalidatePath("/mina-sidor/kunder");
  revalidatePath(`/mina-sidor/kunder/${kundId.data}/redigera`);
  return { ok: true as const };
}

export async function deleteCustomer(id: string) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const kundId = idSchema.safeParse(id);
  if (!kundId.success) return { ok: false, error: "Kund hittades inte" };

  const felmeddelande = "Kunde inte ta bort kunden. Försök igen.";
  const hamtat = await medFelhantering(felmeddelande, () =>
    Promise.all([
      prisma.customer.findFirst({
        where: { id: kundId.data, companyId: company.id },
        select: { id: true },
      }),
      // Kunder med fakturerade jobb spärras. En utfärdad faktura har
      // kunduppgifterna sparade, men en förhandsgranskad (fakturerat utan
      // sparad faktura) hämtar fortfarande mottagaren från kunden.
      prisma.job.count({
        where: {
          customerId: kundId.data,
          companyId: company.id,
          OR: [{ fakturerat: true }, { fakturanummer: { not: null } }],
        },
      }),
    ]),
  );
  if (!hamtat.ok) return hamtat;
  const [existing, fakturerade] = hamtat.data;
  if (!existing) return { ok: false, error: "Kund hittades inte" };
  if (fakturerade > 0) {
    return {
      ok: false,
      error: `Kunden har ${fakturerade} ${fakturerade === 1 ? "fakturerat jobb" : "fakturerade jobb"} och kan inte tas bort.`,
    };
  }

  // Kundens jobb kopplas loss (customerId = null) av onDelete: SetNull
  const borttagen = await medFelhantering(felmeddelande, () =>
    prisma.customer.delete({ where: { id: kundId.data } }),
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
 * "Ladda fler" i jobblistan, med samma filter och sökning som sidan. Den
 * enda läsningen som anropas från klienten, därför en action – övriga
 * läsningar ligger i queries.ts.
 */
export async function laddaFlerJobb(sokning: {
  cursor: string;
  filter?: string;
  sok?: string;
}) {
  const cursor = idSchema.safeParse(sokning?.cursor);
  if (!cursor.success) return { jobs: [], nextCursor: null };
  try {
    return await getJobs({
      cursor: cursor.data,
      filter: tolkaJobbFilter(sokning.filter),
      sok: tolkaJobbSok(sokning.sok),
    });
  } catch (err) {
    console.error("Kunde inte ladda fler jobb:", err);
    return { jobs: [], nextCursor: cursor.data, error: "Kunde inte ladda fler jobb. Försök igen." };
  }
}

export async function createJob(input: JobInput, bilder: Fil[] = []) {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: forstaFel(parsed.error) };
  const data = parsed.data;

  const bilderParsed = bilderSchema.safeParse(bilder);
  if (!bilderParsed.success) return { ok: false, error: "Ogiltiga bilder" };
  const egna = await egnaUppladdningar(company.id, bilderParsed.data);
  if (!egna.ok) return egna;

  const kundFel = await kontrolleraKund(company.id, data);
  if (kundFel) return { ok: false, error: kundFel };

  const sparat = await medFelhantering(
    "Kunde inte spara jobbet. Försök igen.",
    () =>
      prisma.$transaction([
        prisma.job.create({
          data: nyttJobbTillDb(company.id, data, egna.data),
        }),
        prisma.uppladdning.updateMany({
          where: {
            companyId: company.id,
            key: { in: egna.data.map((b) => b.key) },
          },
          data: { anvand: true },
        }),
      ]),
  );
  if (!sparat.ok) return sparat;

  revalidatePath("/mina-sidor");
  return { ok: true as const };
}

export async function updateJob(id: string, input: JobInput, bilder: Fil[] = []) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const jobbId = idSchema.safeParse(id);
  if (!jobbId.success) return { ok: false, error: "Jobb hittades inte" };

  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: forstaFel(parsed.error) };
  const data = parsed.data;

  const bilderParsed = bilderSchema.safeParse(bilder);
  if (!bilderParsed.success) return { ok: false, error: "Ogiltiga bilder" };

  const hamtat = await medFelhantering(
    "Kunde inte hämta jobbet. Försök igen.",
    () =>
      prisma.job.findFirst({
        where: { id: jobbId.data, companyId: company.id },
        include: {
          artiklar: true,
          resor: true,
          arbetspass: true,
          images: true,
          ovrigaKostnader: true,
          fakturor: { where: GALLANDE_FAKTURA, select: { fakturanummer: true } },
        },
      }),
  );
  if (!hamtat.ok) return hamtat;
  const existing = hamtat.data;
  if (!existing) return { ok: false, error: "Jobb hittades inte" };

  const kundFel = await kontrolleraKund(company.id, data);
  if (kundFel) return { ok: false, error: kundFel };

  // Ett jobb med en gällande faktura förblir fakturerat, vad klienten än
  // skickar – annars försvinner fakturan ur Obetalt i statistiken. Fakturan
  // kan bara tas ut med en kreditfaktura.
  const harGallandeFaktura = existing.fakturor.length > 0;
  const fakturerat = harGallandeFaktura || data.fakturerat;
  const betalt = data.betalt && fakturerat;

  const existingImageKeys = existing.images.map((i) => i.key);
  const newImageKeys = bilderParsed.data.map((b) => b.key);
  const toDelete = existingImageKeys.filter((k) => !newImageKeys.includes(k));

  // Bilder som redan finns på jobbet behåller sin adress. Nya måste vara
  // företagets egna uppladdningar.
  const nyaBilder = await egnaUppladdningar(
    company.id,
    bilderParsed.data.filter((b) => !existingImageKeys.includes(b.key)),
  );
  if (!nyaBilder.ok) return nyaBilder;

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

  const jid = jobbId.data;
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
                  jobId: jid,
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
                  jobId: jid,
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
                data: { jobId: jid, datum: new Date(w.datum), timmar: w.timmar },
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
                data: { jobId: jid, beskrivning: k.beskrivning, pris: k.pris },
              }),
        ),
        // Bilder
        prisma.jobImage.deleteMany({
          where: { jobId: jid, key: { in: toDelete } },
        }),
        ...nyaBilder.data.map((b) =>
          prisma.jobImage.create({
            data: { jobId: jid, url: b.url, key: b.key },
          }),
        ),
        prisma.uppladdning.updateMany({
          where: {
            companyId: company.id,
            key: { in: nyaBilder.data.map((b) => b.key) },
          },
          data: { anvand: true },
        }),
        // Jobb-uppdatering
        prisma.job.update({
          where: { id: jid },
          data: {
            customerId: data.customerId || null,
            rotAvdrag: data.rotAvdrag,
            timpris: data.timpris ?? 0,
            milersattning: data.milersattning ?? 0,
            fastPris: data.fastPris ?? null,
            fastPrisArbete: fastPrisArbeteTillDb(data),
            pagaende: data.pagaende,
            utfort: data.utfort,
            fakturerat,
            betalt,
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

  // Filerna raderas först när databasen har sparats
  await raderaFiler(company.id, toDelete);

  revalidatePath("/mina-sidor");
  revalidatePath(`/mina-sidor/jobb/${jid}/redigera`);
  return { ok: true as const };
}

/**
 * Tar bort ett jobb. Ett jobb som har fakturerats kan inte tas bort: fakturor
 * och deras underlag ska sparas i sju år (bokföringslagen).
 */
export async function deleteJob(id: string) {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const jobbId = idSchema.safeParse(id);
  if (!jobbId.success) return { ok: false, error: "Jobb hittades inte" };

  const felmeddelande = "Kunde inte ta bort jobbet. Försök igen.";
  const hamtat = await medFelhantering(felmeddelande, () =>
    prisma.job.findFirst({
      where: { id: jobbId.data, companyId: company.id },
      select: {
        fakturerat: true,
        fakturanummer: true,
        images: { select: { key: true } },
        _count: { select: { fakturor: true } },
      },
    }),
  );
  if (!hamtat.ok) return hamtat;
  const job = hamtat.data;
  if (!job) return { ok: false, error: "Jobb hittades inte" };

  if (job.fakturanummer != null || job._count.fakturor > 0) {
    return {
      ok: false,
      error:
        "Jobbet har en utfärdad faktura och kan inte tas bort – fakturor och underlag ska sparas i sju år.",
    };
  }
  if (job.fakturerat) {
    return {
      ok: false,
      error:
        "Jobbet är markerat som fakturerat. Bocka ur Fakturerat först om det inte har fakturerats på riktigt.",
    };
  }

  const borttaget = await medFelhantering(felmeddelande, () =>
    prisma.job.delete({ where: { id: jobbId.data } }),
  );
  if (!borttaget.ok) return borttaget;

  await raderaFiler(
    company.id,
    job.images.map((i) => i.key),
  );

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

  const felmeddelande = "Kunde inte ta bort kontot. Försök igen.";
  const hamtat = await medFelhantering(felmeddelande, () =>
    prisma.company.findFirst({
      where: { ownerId: userId },
      select: { uppladdningar: { select: { key: true } } },
    }),
  );
  if (!hamtat.ok) return hamtat;
  // Alla registrerade filer: jobbilder, logotyp och osparade uppladdningar
  const keys = hamtat.data?.uppladdningar.map((u) => u.key) ?? [];

  const borttaget = await medFelhantering(felmeddelande, () =>
    prisma.user.delete({ where: { id: userId } }),
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

/** Nästa fakturanummer, atomärt: räknar upp och returnerar det gamla värdet. */
async function reserveraFakturanummer(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<number> {
  // En enda SQL-sats – två samtidiga anrop kan aldrig få samma nummer.
  // Gör aldrig om till "läs, räkna +1, skriv" i separata steg.
  const result = await tx.$queryRaw<[{ nummer: number }]>`
    UPDATE company
    SET "nastaFakturanummer" = "nastaFakturanummer" + 1
    WHERE id = ${companyId}
    RETURNING "nastaFakturanummer" - 1 AS nummer
  `;
  const nummer = result[0]?.nummer;
  if (nummer == null) throw new Error("Kunde inte reservera fakturanummer");
  return nummer;
}

function fakturaRad(
  companyId: string,
  faktura: FakturaData & { fakturanummer: number },
  koppling: { jobId: string | null; customerId: string | null; krediterarId?: string },
): Prisma.FakturaUncheckedCreateInput {
  return {
    companyId,
    jobId: koppling.jobId,
    customerId: koppling.customerId,
    krediterarId: koppling.krediterarId ?? null,
    fakturanummer: faktura.fakturanummer,
    fakturadatum: new Date(faktura.fakturadatum),
    forfallodatum: new Date(faktura.forfallodatum),
    exklMomsOre: kronorTillOre(faktura.summa.exklMoms),
    momsOre: kronorTillOre(faktura.summa.moms),
    rotAvdragOre: kronorTillOre(faktura.summa.rotAvdrag),
    attBetalaOre: kronorTillOre(faktura.summa.attBetala),
    innehall: faktura as unknown as Prisma.InputJsonValue,
  };
}

/**
 * Utfärdar fakturan för ett jobb, allt i en transaktion:
 * 1. delar ut nästa fakturanummer (ett jobb som redan har ett behåller det),
 * 2. markerar jobbet som fakturerat,
 * 3. sparar fakturan som den ser ut nu (tabellen `faktura`, se lib/faktura.ts).
 *
 * Har jobbet redan en gällande faktura händer ingenting. Fakturor som saknar
 * lagkrävda uppgifter (fakturaFel) stoppas. Anropas bara från knappen
 * "Utfärda faktura" – att öppna fakturasidan får aldrig dela ut ett nummer
 * (en läsning ändrar inget).
 */
export async function utfardaFaktura(
  jobId: string,
): Promise<{ ok: true; nummer: number } | Fel> {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const id = idSchema.safeParse(jobId);
  if (!id.success) return { ok: false, error: "Jobb hittades inte" };

  const utfall = await medFelhantering(
    "Kunde inte utfärda fakturan. Försök igen.",
    () =>
      prisma.$transaction(
        async (tx): Promise<{ nummer: number } | { fel: string }> => {
          // Lås jobbraden (FOR UPDATE) innan vi läser något. Utan detta kan
          // två samtidiga anrop för samma jobb (t.ex. två öppna flikar) båda
          // se att fakturan saknas och dela ut två nummer.
          const rader = await tx.$queryRaw<{ fakturanummer: number | null }[]>`
            SELECT "fakturanummer" FROM job
            WHERE id = ${id.data} AND "companyId" = ${company.id}
            FOR UPDATE
          `;
          const jobb = rader[0];
          if (!jobb) return { fel: "Jobb hittades inte" };

          const sparad = await tx.faktura.findFirst({
            where: { jobId: id.data, ...GALLANDE_FAKTURA },
            select: { fakturanummer: true },
          });
          if (sparad) return { nummer: sparad.fakturanummer };

          const jobbet = mapJob(
            await tx.job.findUniqueOrThrow({
              where: { id: id.data },
              include: JOBB_MED_RADER,
            }),
          );
          const foretaget = await tx.company.findUniqueOrThrow({
            where: { id: company.id },
          });

          // Samma kontroll som förhandsgranskningen visar
          const fel = fakturaFel(jobbet, foretaget);
          if (fel.length > 0) return { fel: fel.join(" ") };

          // Jobb som fick ett nummer innan fakturor sparades behåller det och
          // får nu sin sparade faktura.
          const nummer =
            jobb.fakturanummer ?? (await reserveraFakturanummer(tx, company.id));

          const faktura = skapaFakturaData(jobbet, foretaget, {
            fakturanummer: nummer,
            fakturadatum: idagISverige(),
          });

          await tx.job.update({
            where: { id: id.data },
            data: { fakturanummer: nummer, fakturerat: true },
          });
          await tx.faktura.create({
            data: fakturaRad(
              company.id,
              { ...faktura, fakturanummer: nummer },
              { jobId: id.data, customerId: jobbet.customerId ?? null },
            ),
          });
          return { nummer };
        },
        { timeout: 15_000 },
      ),
  );
  if (!utfall.ok) return utfall;
  if ("fel" in utfall.data) return { ok: false, error: utfall.data.fel };

  revalidatePath("/mina-sidor");
  revalidatePath("/mina-sidor/fakturor");
  revalidatePath(`/mina-sidor/jobb/${id.data}/skriv-ut`);
  return { ok: true, nummer: utfall.data.nummer };
}

/**
 * Krediterar en utfärdad faktura, allt i en transaktion:
 * 1. låser fakturan, så att den inte kan krediteras två gånger,
 * 2. delar ut nästa fakturanummer till kreditfakturan,
 * 3. sparar kreditfakturan – originalet med negativa belopp,
 * 4. gör jobbet ofakturerat, så att det kan faktureras på nytt.
 *
 * Originalet ändras aldrig.
 */
export async function krediteraFaktura(
  fakturaId: string,
): Promise<{ ok: true; nummer: number; id: string } | Fel> {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const id = idSchema.safeParse(fakturaId);
  if (!id.success) return { ok: false, error: "Fakturan hittades inte" };

  const utfall = await medFelhantering(
    "Kunde inte kreditera fakturan. Försök igen.",
    () =>
      prisma.$transaction(
        async (
          tx,
        ): Promise<{ nummer: number; id: string; jobId: string | null } | { fel: string }> => {
          const rader = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM faktura
            WHERE id = ${id.data} AND "companyId" = ${company.id}
            FOR UPDATE
          `;
          if (!rader[0]) return { fel: "Fakturan hittades inte" };

          const original = await tx.faktura.findUniqueOrThrow({
            where: { id: id.data },
            include: { krediteradAv: { select: { id: true } } },
          });
          if (original.krediterarId) {
            return { fel: "En kreditfaktura kan inte krediteras." };
          }
          if (original.krediteradAv) {
            return { fel: "Fakturan är redan krediterad." };
          }

          const nummer = await reserveraFakturanummer(tx, company.id);
          const kredit = skapaKreditfaktura(
            original.innehall as unknown as FakturaData,
            { fakturanummer: nummer, fakturadatum: idagISverige() },
          );

          // Summorna i ören tas från originalet med ombytt tecken, så att
          // faktura + kreditfaktura blir exakt 0 i statistiken.
          const skapad = await tx.faktura.create({
            data: {
              ...fakturaRad(
                company.id,
                { ...kredit, fakturanummer: nummer },
                {
                  jobId: original.jobId,
                  customerId: original.customerId,
                  krediterarId: original.id,
                },
              ),
              exklMomsOre: -original.exklMomsOre,
              momsOre: -original.momsOre,
              rotAvdragOre: -original.rotAvdragOre,
              attBetalaOre: -original.attBetalaOre,
            },
          });

          if (original.jobId) {
            await tx.job.updateMany({
              where: { id: original.jobId, companyId: company.id },
              data: { fakturanummer: null, fakturerat: false, betalt: false },
            });
          }
          return { nummer, id: skapad.id, jobId: original.jobId };
        },
        { timeout: 15_000 },
      ),
  );
  if (!utfall.ok) return utfall;
  if ("fel" in utfall.data) return { ok: false, error: utfall.data.fel };

  revalidatePath("/mina-sidor");
  revalidatePath("/mina-sidor/fakturor");
  if (utfall.data.jobId) {
    revalidatePath(`/mina-sidor/jobb/${utfall.data.jobId}/skriv-ut`);
  }
  return { ok: true, nummer: utfall.data.nummer, id: utfall.data.id };
}

// ============================================================
// BILDER
// ============================================================

/**
 * Raderar en nyss uppladdad bild som tas bort i formuläret innan jobbet
 * sparats. Bara företagets egna, osparade uppladdningar får raderas – aldrig
 * en bild som sparats på ett jobb eller en logotyp (de raderas av updateJob
 * och updateCompanyLogo när databasen har sparats).
 */
export async function deleteUploadedImage(key: string) {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const nyckel = z.string().min(1).max(200).safeParse(key);
  if (!nyckel.success) return { ok: false, error: "Otillåten åtgärd" };

  const hamtat = await medFelhantering(
    "Kunde inte radera bilden.",
    () =>
      Promise.all([
        prisma.uppladdning.findFirst({
          where: { key: nyckel.data, companyId: company.id },
          select: { anvand: true },
        }),
        prisma.jobImage.count({ where: { key: nyckel.data } }),
      ]),
  );
  if (!hamtat.ok) return hamtat;
  const [uppladdning, somJobbild] = hamtat.data;
  if (
    !uppladdning ||
    uppladdning.anvand ||
    somJobbild > 0 ||
    nyckel.data === company.logoKey
  ) {
    return { ok: false, error: "Otillåten åtgärd" };
  }

  try {
    await utapi.deleteFiles(nyckel.data);
    await prisma.uppladdning.delete({ where: { key: nyckel.data } });
  } catch (err) {
    console.error("Kunde inte radera bild från UploadThing:", err);
    return { ok: false, error: "Kunde inte radera bilden" };
  }

  return { ok: true as const };
}
