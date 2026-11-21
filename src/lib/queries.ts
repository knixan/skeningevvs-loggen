import "server-only";

import type { Prisma } from "@prisma/client";
import type { FakturaData } from "./faktura";
import type { JobbFilter, JobbRaknare } from "./jobb-filter";
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
  // Har jobbet någon utfärdad faktura (även krediterad)? Då kan det inte tas bort.
  _count: { select: { fakturor: true } },
} satisfies Prisma.JobInclude;

/**
 * En faktura som gäller: en vanlig faktura (inte en kreditfaktura) som inte
 * har krediterats. Ett jobb har högst en.
 */
export const GALLANDE_FAKTURA = {
  krediterarId: null,
  krediteradAv: { is: null },
} satisfies Prisma.FakturaWhereInput;

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
    brfOrgNummer: c.brfOrgNummer,
    omvandByggmoms: c.omvandByggmoms,
    momsNummer: c.momsNummer,
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
    harFaktura: j._count.fakturor > 0,
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

/** Statusfiltret som ett villkor i databasen. */
function statusVillkor(filter: JobbFilter): Prisma.JobWhereInput {
  switch (filter) {
    case "ej-paborjat":
      return { pagaende: false, utfort: false };
    case "pagaende":
      return { pagaende: true, utfort: false };
    case "utfort":
      return { utfort: true };
    case "folj-upp":
      return { foljUpp: true };
    case "fakturerat":
      return { fakturerat: true };
    case "betalt":
      return { betalt: true };
    default:
      return {};
  }
}

/** Sökningen i jobblistan: kundens namn och adress, jobbets texter och fakturanummer. */
function sokVillkor(sok: string): Prisma.JobWhereInput {
  if (!sok) return {};
  const s = { contains: sok, mode: "insensitive" as const };
  const nummer = /^\d{1,9}$/.test(sok) ? Number(sok) : null;
  return {
    OR: [
      { customer: { is: { namn: s } } },
      { customer: { is: { foretagsnamn: s } } },
      { customer: { is: { adress: s } } },
      { customer: { is: { ort: s } } },
      { utfortArbete: s },
      { planeratArbete: s },
      { anteckningar: s },
      { internaAnteckningar: s },
      ...(nummer != null ? [{ fakturanummer: nummer }] : []),
    ],
  };
}

export type JobbSokning = {
  filter?: JobbFilter;
  sok?: string;
  /** id på sista jobbet som redan visas ("Ladda fler") */
  cursor?: string;
};

/**
 * En sida jobb. Filtrering och sökning görs i databasen, så att de gäller
 * alla jobb – inte bara de som redan laddats.
 */
export async function getJobs({
  filter = "alla",
  sok = "",
  cursor,
}: JobbSokning = {}) {
  const company = await inloggatForetag();
  if (!company) return { jobs: [], nextCursor: null };

  const items = await prisma.job.findMany({
    where: {
      companyId: company.id,
      ...statusVillkor(filter),
      ...sokVillkor(sok),
    },
    include: JOBB_MED_RADER,
    // id som sista sorteringsnyckel: jobb med exakt samma tid måste ändå få
    // en fast ordning, annars kan "Ladda fler" hoppa över eller upprepa jobb.
    // Följ upp: med datum först (tidigast överst), sedan de utan datum.
    orderBy: [
      ...(filter === "folj-upp"
        ? [{ foljUppDatum: { sort: "asc" as const, nulls: "last" as const } }]
        : []),
      { skapad: "desc" as const },
      { id: "desc" as const },
    ],
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

/**
 * Antal jobb per statusfilter, för knapparna i jobblistan. Räknas i
 * databasen över alla jobb som matchar sökningen.
 */
export async function getJobbRaknare(sok = ""): Promise<JobbRaknare> {
  const raknare: JobbRaknare = {
    alla: 0,
    "ej-paborjat": 0,
    pagaende: 0,
    utfort: 0,
    "folj-upp": 0,
    fakturerat: 0,
    betalt: 0,
  };
  const company = await inloggatForetag();
  if (!company) return raknare;

  const grupper = await prisma.job.groupBy({
    by: ["pagaende", "utfort", "fakturerat", "betalt", "foljUpp"],
    where: { companyId: company.id, ...sokVillkor(sok) },
    _count: { _all: true },
  });
  for (const g of grupper) {
    const n = g._count._all;
    raknare.alla += n;
    if (!g.pagaende && !g.utfort) raknare["ej-paborjat"] += n;
    if (g.pagaende && !g.utfort) raknare.pagaende += n;
    if (g.utfort) raknare.utfort += n;
    if (g.foljUpp) raknare["folj-upp"] += n;
    if (g.fakturerat) raknare.fakturerat += n;
    if (g.betalt) raknare.betalt += n;
  }
  return raknare;
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

// Innehållet skrivs bara av utfardaFaktura och krediteraFaktura, med
// skapaFakturaData/skapaKreditfaktura – se lib/faktura.ts.
function fakturaData(innehall: Prisma.JsonValue): FakturaData {
  return innehall as unknown as FakturaData;
}

/** Den gällande fakturan för ett jobb, eller null om ingen är utfärdad. */
export async function getFaktura(jobId: string) {
  const company = await inloggatForetag();
  if (!company) return null;

  const faktura = await prisma.faktura.findFirst({
    where: { jobId, companyId: company.id, ...GALLANDE_FAKTURA },
    orderBy: { utfardad: "desc" },
    select: { id: true, fakturanummer: true, innehall: true },
  });
  if (!faktura) return null;
  return {
    id: faktura.id,
    fakturanummer: faktura.fakturanummer,
    data: fakturaData(faktura.innehall),
  };
}

/** Antal krediterade fakturor på jobbet – visas som en hänvisning. */
export async function getKrediteradeFakturor(jobId: string) {
  const company = await inloggatForetag();
  if (!company) return 0;
  return prisma.faktura.count({
    where: {
      jobId,
      companyId: company.id,
      krediterarId: null,
      krediteradAv: { isNot: null },
    },
  });
}

/** En utfärdad faktura eller kreditfaktura med id, för fakturasidan. */
export async function getFakturaMedId(id: string) {
  const company = await inloggatForetag();
  if (!company) return null;

  const f = await prisma.faktura.findFirst({
    where: { id, companyId: company.id },
    select: {
      id: true,
      jobId: true,
      innehall: true,
      krediteradAv: { select: { id: true, fakturanummer: true } },
    },
  });
  if (!f) return null;
  return {
    id: f.id,
    jobId: f.jobId,
    data: fakturaData(f.innehall),
    krediteradAv: f.krediteradAv,
  };
}

/** Alla utfärdade fakturor och kreditfakturor ett år, senaste först. */
export async function getFakturor(ar: number) {
  const company = await inloggatForetag();
  if (!company) return [];

  const fakturor = await prisma.faktura.findMany({
    where: {
      companyId: company.id,
      fakturadatum: {
        gte: new Date(`${ar}-01-01`),
        lt: new Date(`${ar + 1}-01-01`),
      },
    },
    orderBy: { fakturanummer: "desc" },
    select: {
      id: true,
      jobId: true,
      fakturanummer: true,
      fakturadatum: true,
      forfallodatum: true,
      exklMomsOre: true,
      momsOre: true,
      rotAvdragOre: true,
      attBetalaOre: true,
      innehall: true,
      krediterarId: true,
      krediterar: { select: { fakturanummer: true } },
      krediteradAv: { select: { fakturanummer: true } },
      job: { select: { betalt: true } },
    },
  });

  return fakturor.map((f) => {
    const data = fakturaData(f.innehall);
    return {
      id: f.id,
      jobId: f.jobId,
      fakturanummer: f.fakturanummer,
      fakturadatum: f.fakturadatum.toISOString().slice(0, 10),
      forfallodatum: f.forfallodatum.toISOString().slice(0, 10),
      kund: data.kund?.namn ?? "",
      omvandMoms: Boolean(data.omvandMoms),
      exklMomsOre: f.exklMomsOre,
      momsOre: f.momsOre,
      rotAvdragOre: f.rotAvdragOre,
      attBetalaOre: f.attBetalaOre,
      arKredit: f.krediterarId != null,
      krediterarNummer: f.krediterar?.fakturanummer ?? null,
      krediteradAvNummer: f.krediteradAv?.fakturanummer ?? null,
      // Betalstatusen ligger på jobbet. null = jobbet är borttaget.
      betalt: f.job ? f.job.betalt : null,
    };
  });
}

export type FakturaListrad = Awaited<ReturnType<typeof getFakturor>>[number];

/** År som har fakturor, senaste först – för årsväljaren. */
export async function getFakturaAr(): Promise<number[]> {
  const company = await inloggatForetag();
  if (!company) return [];
  const rader = await prisma.$queryRaw<{ ar: number }[]>`
    SELECT DISTINCT EXTRACT(YEAR FROM "fakturadatum")::int AS ar
    FROM "faktura" WHERE "companyId" = ${company.id}
    ORDER BY 1 DESC`;
  return rader.map((r) => r.ar);
}

/**
 * ROT-avdrag som kunden redan fått på utfärdade fakturor ett år (efter
 * fakturadatum), i kronor. Kreditfakturor drar av. Jobbets egna fakturor
 * räknas inte – dess ROT räknas fram separat.
 */
export async function getRotIArPerKund(
  ar: number,
  uteslutJobId?: string,
): Promise<Record<string, number>> {
  const company = await inloggatForetag();
  if (!company) return {};
  const grupper = await prisma.faktura.groupBy({
    by: ["customerId"],
    where: {
      companyId: company.id,
      customerId: { not: null },
      fakturadatum: {
        gte: new Date(`${ar}-01-01`),
        lt: new Date(`${ar + 1}-01-01`),
      },
      ...(uteslutJobId
        ? { OR: [{ jobId: null }, { jobId: { not: uteslutJobId } }] }
        : {}),
    },
    _sum: { rotAvdragOre: true },
  });
  const perKund: Record<string, number> = {};
  for (const g of grupper) {
    const ore = g._sum.rotAvdragOre ?? 0;
    if (g.customerId && ore !== 0) perKund[g.customerId] = ore / 100;
  }
  return perKund;
}
