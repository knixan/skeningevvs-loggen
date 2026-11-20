import "server-only";

import type { Prisma } from "@prisma/client";
import type { FakturaData } from "./faktura";
import {
  OFFERT_STATUSAR,
  type Offert,
  type OffertStatus,
} from "./job-schema";
import { prisma } from "./prisma";
import { inloggatForetag } from "./server-hjalp";

// ============================================================
// LÄSNINGAR
// ============================================================
//
// Bara för serverkomponenter. Filen har inte "use server", så funktionerna
// blir inga anropbara endpoints – och "server-only" stoppar bygget om någon
// importerar den från en klientkomponent. En läsning skapar eller ändrar
// aldrig något: utan inloggning eller företag blir svaret tomt/null.
//
// "Ladda fler" i jobblistan behöver en läsning från klienten – den går via
// action:en laddaFlerJobb i job-actions.ts.

export const JOBB_MED_RADER = {
  artiklar: true,
  resor: true,
  arbetspass: true,
  images: true,
  customer: true,
  ovrigaKostnader: true,
} satisfies Prisma.JobInclude;

type JobWithRelations = Prisma.JobGetPayload<{
  include: typeof JOBB_MED_RADER;
}>;

export function mapCustomer(c: NonNullable<JobWithRelations["customer"]>) {
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

export function mapJob(j: JobWithRelations) {
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

// ------------------------------------------------------------
// Företag
// ------------------------------------------------------------

/** null om användaren inte är inloggad eller inte har sparat något än. */
export async function getCompanySettings() {
  const company = await inloggatForetag();
  if (!company) return null;

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

// ------------------------------------------------------------
// Kunder
// ------------------------------------------------------------

export async function getCustomers() {
  const company = await inloggatForetag();
  if (!company) return [];

  const customers = await prisma.customer.findMany({
    where: { companyId: company.id },
    orderBy: { namn: "asc" },
  });

  return customers.map(mapCustomer);
}

export async function getCustomer(id: string) {
  const company = await inloggatForetag();
  if (!company) return null;

  const c = await prisma.customer.findFirst({
    where: { id, companyId: company.id },
  });
  if (!c) return null;

  return mapCustomer(c);
}

// ------------------------------------------------------------
// Jobb
// ------------------------------------------------------------

const JOBS_PER_PAGE = 50;

export async function getJobs(cursor?: string) {
  const company = await inloggatForetag();
  if (!company) return { jobs: [], nextCursor: null };

  const items = await prisma.job.findMany({
    where: { companyId: company.id },
    include: JOBB_MED_RADER,
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
  const company = await inloggatForetag();
  if (!company) return null;

  const j = await prisma.job.findFirst({
    where: { id, companyId: company.id },
    include: JOBB_MED_RADER,
  });
  if (!j) return null;

  return mapJob(j);
}

// ------------------------------------------------------------
// Offerter
// ------------------------------------------------------------

export const OFFERT_MED_RADER = {
  customer: true,
  artiklar: { orderBy: { ordning: "asc" } },
  ovrigaKostnader: { orderBy: { ordning: "asc" } },
} satisfies Prisma.OffertInclude;

type OffertWithRelations = Prisma.OffertGetPayload<{
  include: typeof OFFERT_MED_RADER;
}>;

function offertStatus(status: string): OffertStatus {
  return (OFFERT_STATUSAR as readonly string[]).includes(status)
    ? (status as OffertStatus)
    : "utkast";
}

export function mapOffert(o: OffertWithRelations): Offert {
  return {
    id: o.id,
    offertnummer: o.offertnummer,
    jobId: o.jobId ?? undefined,
    // Tom om kunden har tagits bort – då måste en ny väljas innan offerten sparas
    customerId: o.customerId ?? "",
    customer: o.customer ? mapCustomer(o.customer) : null,
    status: offertStatus(o.status),
    offertdatum: o.offertdatum.toISOString().slice(0, 10),
    giltigTill: o.giltigTill.toISOString().slice(0, 10),
    rotAvdrag: o.rotAvdrag,
    timpris: o.timpris,
    milersattning: o.milersattning,
    beraknadeTimmar: o.beraknadeTimmar,
    beraknadStracka: o.beraknadStracka,
    fastPris: o.fastPris ?? undefined,
    fastPrisArbete: o.fastPrisArbete ?? undefined,
    beskrivning: o.beskrivning,
    villkor: o.villkor,
    internaAnteckningar: o.internaAnteckningar,
    // Raderna byts ut i sin helhet när offerten sparas – id behövs inte
    artiklar: o.artiklar.map((a) => ({
      namn: a.namn,
      artikelnr: a.artikelnr,
      aterforsaljare: a.aterforsaljare,
      inkopspris: a.inkopspris,
      pris: a.pris,
      antal: a.antal,
      enhet: a.enhet,
    })),
    ovrigaKostnader: o.ovrigaKostnader.map((k) => ({
      beskrivning: k.beskrivning,
      pris: k.pris,
    })),
    skapad: o.skapad.toISOString(),
  };
}

/** Alla offerter, senaste först. En enmansfirma har inte fler än att de får plats. */
export async function getOfferter() {
  const company = await inloggatForetag();
  if (!company) return [];

  const offerter = await prisma.offert.findMany({
    where: { companyId: company.id },
    include: OFFERT_MED_RADER,
    orderBy: { offertnummer: "desc" },
  });

  return offerter.map(mapOffert);
}

export async function getOffert(id: string) {
  const company = await inloggatForetag();
  if (!company) return null;

  const o = await prisma.offert.findFirst({
    where: { id, companyId: company.id },
    include: OFFERT_MED_RADER,
  });
  if (!o) return null;

  return mapOffert(o);
}

/**
 * Förslag på timpris och milersättning till en ny offert: det som stod på
 * den senaste offerten, annars på det senaste jobbet med timpris.
 */
export async function getSenastePriser() {
  const company = await inloggatForetag();
  if (!company) return { timpris: 0, milersattning: 0 };

  const priser = { timpris: true, milersattning: true } as const;
  const senaste =
    (await prisma.offert.findFirst({
      where: { companyId: company.id, timpris: { gt: 0 } },
      orderBy: { skapad: "desc" },
      select: priser,
    })) ??
    (await prisma.job.findFirst({
      where: { companyId: company.id, timpris: { gt: 0 } },
      orderBy: { skapad: "desc" },
      select: priser,
    }));

  return senaste ?? { timpris: 0, milersattning: 0 };
}

// ------------------------------------------------------------
// Fakturor
// ------------------------------------------------------------

/** Den sparade fakturan för ett jobb, eller null om den inte är utfärdad. */
export async function getFaktura(jobId: string): Promise<FakturaData | null> {
  const company = await inloggatForetag();
  if (!company) return null;

  const faktura = await prisma.faktura.findFirst({
    where: { jobId, companyId: company.id },
    select: { innehall: true },
  });
  // Skrivs bara av utfardaFaktura, med skapaFakturaData – se lib/faktura.ts.
  return faktura ? (faktura.innehall as unknown as FakturaData) : null;
}
