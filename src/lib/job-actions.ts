"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { UTApi } from "uploadthing/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { z } from "zod";
import {
  companySchema,
  customerSchema,
  jobSchema,
  rensaKundFalt,
  ROT_BARA_PRIVAT,
  type JobInput,
  type CustomerInput,
  type CompanyInput,
} from "./job-schema";

/** Första valideringsfelet som ett svenskt meddelande till användaren. */
function forstaFel(error: z.ZodError) {
  return error.issues[0]?.message ?? "Ogiltiga uppgifter";
}

const utapi = new UTApi();
const DEFAULT_COMPANY_NAME = "Mitt företag";

type JobWithRelations = Prisma.JobGetPayload<{
  include: {
    artiklar: true;
    resor: true;
    arbetspass: true;
    images: true;
    customer: true;
    ovrigaKostnader: true;
  };
}>;

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

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
type AuthError = { ok: false; error: string };

async function requireCompany(): Promise<CompanyCtx | AuthError> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Inte inloggad" };
  const company = await getOrCreateCompany(session.user.id);
  return { company };
}

async function requireExistingCompany(): Promise<CompanyCtx | AuthError> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Inte inloggad" };
  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!company) return { ok: false, error: "Inget företag hittat" };
  return { company };
}

async function requireSession(): Promise<{ userId: string } | AuthError> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Inte inloggad" };
  return { userId: session.user.id };
}

function mapCustomer(c: NonNullable<JobWithRelations["customer"]>) {
  return {
    id: c.id,
    companyId: c.companyId,
    typ: c.typ as "privat" | "foretag",
    namn: c.namn,
    adress: c.adress,
    postnummer: c.postnummer,
    ort: c.ort,
    telefon: c.telefon,
    epost: c.epost,
    personnummer: c.personnummer,
    foretagsnamn: c.foretagsnamn,
    kontaktperson: c.kontaktperson,
    orgNummer: c.orgNummer,
    fastighetsbeteckning: c.fastighetsbeteckning,
    lagenhetsnummer: c.lagenhetsnummer,
    bostadsrattsforening: c.bostadsrattsforening,
    skapad: c.createdAt.toISOString(),
  };
}

/**
 * Uppföljningsdatum till databasen. Inget datum om bocken är av eller om
 * datumet är tomt. Att datumet finns på riktigt har jobSchema redan
 * kontrollerat (z.iso.date) – anropa bara med data som gått genom schemat.
 */
function foljUppDatumTillDb(data: JobInput): Date | null {
  if (!data.foljUpp || !data.foljUppDatum) return null;
  return new Date(data.foljUppDatum);
}

function mapJob(j: JobWithRelations) {
  return {
    id: j.id,
    customerId: j.customerId ?? undefined,
    customer: j.customer ? mapCustomer(j.customer) : null,
    rotAvdrag: j.rotAvdrag,
    fakturanummer: j.fakturanummer ?? undefined,
    timpris: j.timpris,
    milersattning: j.milersattning,
    fastPris: j.fastPris ?? undefined,
    fastPrisArbete: j.fastPrisArbete ?? undefined,
    pagaende: j.pagaende,
    utfort: j.utfort,
    fakturerat: j.fakturerat,
    betalt: j.betalt,
    foljUpp: j.foljUpp,
    foljUppDatum: j.foljUppDatum?.toISOString().slice(0, 10) ?? "",
    anteckningar: j.anteckningar,
    utfortArbete: j.utfortArbete,
    planeratArbete: j.planeratArbete,
    internaAnteckningar: j.internaAnteckningar,
    artiklar: j.artiklar.map((a) => ({
      id: a.id,
      namn: a.namn,
      artikelnr: a.artikelnr,
      aterforsaljare: a.aterforsaljare,
      inkopspris: a.inkopspris,
      pris: a.pris,
      antal: a.antal,
      enhet: a.enhet ?? "",
    })),
    resor: j.resor.map((r) => ({
      id: r.id,
      datum: r.datum.toISOString().slice(0, 10),
      stracka: r.stracka,
    })),
    arbetstider: j.arbetspass.map((w) => ({
      id: w.id,
      datum: w.datum.toISOString().slice(0, 10),
      timmar: w.timmar,
    })),
    ovrigaKostnader: j.ovrigaKostnader.map((k) => ({
      id: k.id,
      beskrivning: k.beskrivning,
      pris: k.pris,
    })),
    bilder: j.images.map((img) => ({
      url: img.url,
      key: img.key,
    })),
    skapad: j.skapad.toISOString(),
  };
}

function ids<T extends { id?: string }>(rows: T[]) {
  return rows.flatMap((row) => (row.id ? [row.id] : []));
}

// ============================================================
// FÖRETAGSUPPGIFTER
// ============================================================

export async function getCompanySettings() {
  const session = await getSession();
  if (!session?.user) return null;

  const company = await getOrCreateCompany(session.user.id);

  return {
    id: company.id,
    name: company.name,
    orgNummer: company.orgNummer,
    adress: company.adress,
    postnummer: company.postnummer,
    ort: company.ort,
    telefon: company.telefon,
    epost: company.epost,
    fSkatt: company.fSkatt,
    momsNummer: company.momsNummer,
    bankgiro: company.bankgiro,
    plusgiro: company.plusgiro,
    swish: company.swish,
    logoUrl: company.logoUrl,
    logoKey: company.logoKey,
    nastaFakturanummer: company.nastaFakturanummer,
    forfallodagar: company.forfallodagar,
    drojsmalsranta: company.drojsmalsranta,
    fakturatext: company.fakturatext,
  };
}

export async function updateCompanySettings(data: CompanyInput) {
  const ctx = await requireCompany();
  if ("error" in ctx) return ctx;

  const parsed = companySchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter",
    };
  }
  const d = parsed.data;

  const { company } = ctx;

  // Hindra att nästa fakturanummer flyttas bakåt förbi ett nummer som redan
  // är utfärdat till ett jobb – annars kan två fakturor få samma nummer.
  const { _max } = await prisma.job.aggregate({
    where: { companyId: company.id },
    _max: { fakturanummer: true },
  });
  const hogstaUtfardade = _max.fakturanummer ?? 0;
  if (d.nastaFakturanummer <= hogstaUtfardade) {
    return {
      ok: false,
      error: `Nästa fakturanummer måste vara högre än det senast utfärdade fakturanumret (${hogstaUtfardade}).`,
    };
  }

  await prisma.company.update({
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
  });

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

  if (company.logoKey && company.logoKey !== logo?.key) {
    try {
      await utapi.deleteFiles(company.logoKey);
    } catch (err) {
      console.error("Kunde inte radera gammal logotyp:", err);
    }
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      logoUrl: logo?.url ?? "",
      logoKey: logo?.key ?? "",
    },
  });

  revalidatePath("/mina-sidor");
  revalidatePath("/mina-sidor/foretag");
  return { ok: true as const };
}

// ============================================================
// KUNDREGISTER
// ============================================================

export async function getCustomers() {
  const session = await getSession();
  if (!session?.user) return [];

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!company) return [];

  const customers = await prisma.customer.findMany({
    where: { companyId: company.id },
    orderBy: { namn: "asc" },
  });

  return customers.map(mapCustomer);
}

export async function getCustomer(id: string) {
  const session = await getSession();
  if (!session?.user) return null;

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!company) return null;

  const c = await prisma.customer.findFirst({
    where: { id, companyId: company.id },
  });
  if (!c) return null;

  return mapCustomer(c);
}

/** Validerar kunddata på servern och gör om den till databasfält. */
function kundTillDb(
  data: unknown,
): { ok: true; data: Omit<Prisma.CustomerCreateInput, "company"> } | {
  ok: false;
  error: string;
} {
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

  try {
    const customer = await prisma.customer.create({
      data: { ...kund.data, companyId: company.id },
    });
    revalidatePath("/mina-sidor/kunder");
    return { ok: true as const, id: customer.id };
  } catch (err) {
    console.error("Kunde inte skapa kund:", err);
    return { ok: false, error: "Kunde inte spara kunden. Försök igen." };
  }
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

  try {
    await prisma.customer.update({ where: { id }, data: kund.data });
  } catch (err) {
    console.error("Kunde inte uppdatera kund:", err);
    return { ok: false, error: "Kunde inte spara kunden. Försök igen." };
  }

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

  // Fakturan hämtar mottagaren från kunden. Tas kunden bort skulle en redan
  // utfärdad faktura sakna mottagare om den skrivs ut igen.
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

  try {
    // Kundens jobb kopplas loss (customerId = null) av onDelete: SetNull
    await prisma.customer.delete({ where: { id } });
  } catch (err) {
    console.error("Kunde inte ta bort kund:", err);
    return { ok: false, error: "Kunde inte ta bort kunden. Försök igen." };
  }

  revalidatePath("/mina-sidor/kunder");
  revalidatePath("/mina-sidor");
  return { ok: true as const };
}

// ============================================================
// JOBB
// ============================================================

const JOBS_PER_PAGE = 50;

export async function getJobs(cursor?: string) {
  const session = await getSession();
  if (!session?.user) return { jobs: [], nextCursor: null };

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!company) return { jobs: [], nextCursor: null };

  const items = await prisma.job.findMany({
    where: { companyId: company.id },
    include: {
      artiklar: true,
      resor: true,
      arbetspass: true,
      images: true,
      customer: true,
      ovrigaKostnader: true,
    },
    // id som andra sorteringsnyckel: jobb med exakt samma tid måste ändå få en
    // fast ordning, annars kan "Ladda fler" hoppa över eller upprepa jobb.
    orderBy: [{ skapad: "desc" }, { id: "desc" }],
    take: JOBS_PER_PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > JOBS_PER_PAGE;
  if (hasMore) items.pop();

  return {
    jobs: items.map(mapJob),
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

export async function getJob(id: string) {
  const session = await getSession();
  if (!session?.user) return null;

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!company) return null;

  const j = await prisma.job.findFirst({
    where: { id, companyId: company.id },
    include: {
      artiklar: true,
      resor: true,
      arbetspass: true,
      images: true,
      customer: true,
      ovrigaKostnader: true,
    },
  });
  if (!j) return null;

  return mapJob(j);
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

  try {
    await skapaJobb(company.id, data, bilder);
  } catch (err) {
    console.error("Kunde inte skapa jobb:", err);
    return { ok: false, error: "Kunde inte spara jobbet. Försök igen." };
  }

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

  try {
    await prisma.$transaction([
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
              data: { jobId: id, datum: new Date(r.datum), stracka: r.stracka },
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
    ]);
  } catch (err) {
    console.error("Kunde inte uppdatera jobb:", err);
    return {
      ok: false,
      error: "Kunde inte spara ändringarna. Ladda om sidan och försök igen.",
    };
  }

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

  await prisma.job.delete({ where: { id } });

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

  await prisma.user.delete({ where: { id: userId } });

  if (keys.length > 0) {
    try {
      await utapi.deleteFiles(keys);
    } catch (err) {
      console.error("Kunde inte radera filer vid kontoborttagning:", err);
    }
  }

  return { ok: true as const };
}

/**
 * Utfärdar fakturan för ett jobb: delar ut nästa fakturanummer och markerar
 * jobbet som fakturerat, i samma transaktion. Ett jobb som redan har ett
 * nummer behåller det. Anropas bara från knappen "Utfärda faktura" – att
 * öppna fakturasidan får aldrig dela ut ett nummer (en läsning ändrar inget).
 */
export async function utfardaFaktura(
  jobId: string,
): Promise<{ ok: true; nummer: number } | { ok: false; error: string }> {
  const ctx = await requireExistingCompany();
  if ("error" in ctx) return ctx;
  const { company } = ctx;

  const id = z.string().min(1).safeParse(jobId);
  if (!id.success) return { ok: false, error: "Jobb hittades inte" };

  try {
    const utfall = await prisma.$transaction(
      async (tx): Promise<{ nummer: number } | { fel: string }> => {
        // Lås jobbraden (FOR UPDATE) innan vi läser fakturanummer. Utan detta
        // kan två samtidiga anrop för samma jobb (t.ex. två öppna flikar)
        // båda läsa fakturanummer som null och tilldela olika nummer.
        const rader = await tx.$queryRaw<
          { fakturanummer: number | null; customerId: string | null }[]
        >`
          SELECT "fakturanummer", "customerId" FROM job
          WHERE id = ${id.data} AND "companyId" = ${company.id}
          FOR UPDATE
        `;
        const jobb = rader[0];
        if (!jobb) return { fel: "Jobb hittades inte" };
        if (jobb.fakturanummer != null) return { nummer: jobb.fakturanummer };
        if (!jobb.customerId) {
          return { fel: "Välj en kund på jobbet innan fakturan utfärdas." };
        }

        // Atomärt: räknar upp och returnerar gamla värdet i en enda SQL-sats,
        // vilket förhindrar race conditions vid parallella anrop.
        const result = await tx.$queryRaw<[{ nummer: number }]>`
          UPDATE company
          SET "nastaFakturanummer" = "nastaFakturanummer" + 1
          WHERE id = ${company.id}
          RETURNING "nastaFakturanummer" - 1 AS nummer
        `;
        const n = result[0]?.nummer;
        if (n == null) throw new Error("Kunde inte reservera fakturanummer");

        await tx.job.update({
          where: { id: id.data },
          data: { fakturanummer: n, fakturerat: true },
        });
        return { nummer: n };
      },
    );
    if ("fel" in utfall) return { ok: false, error: utfall.fel };

    revalidatePath("/mina-sidor");
    revalidatePath(`/mina-sidor/jobb/${id.data}/skriv-ut`);
    return { ok: true, nummer: utfall.nummer };
  } catch (err) {
    console.error("Kunde inte utfärda faktura:", err);
    return { ok: false, error: "Kunde inte utfärda fakturan. Försök igen." };
  }
}

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
