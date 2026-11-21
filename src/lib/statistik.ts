import "server-only";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { idagISverige } from "./datum";
import {
  beräknaFaktura,
  jobbPrisunderlag,
  kronorTillOre,
  kundensNamn,
} from "./job-schema";
import { prisma } from "./prisma";
import { GALLANDE_FAKTURA, JOBB_MED_RADER, mapJob } from "./queries";
import { inloggatForetag } from "./server-hjalp";

// ============================================================
// STATISTIK
// ============================================================
//
// Läsningar för statistiksidan, med samma regler som queries.ts: bara för
// serverkomponenter, kräver inloggning, filtrerar alltid på companyId och
// skapar eller ändrar aldrig något.
//
// Vad som räknas:
// - Omsättning och ROT: utfärdade fakturor (tabellen `faktura`) efter
//   fakturadatum. Summorna är heltal i ören och summeras i databasen, så de
//   stämmer exakt mot fakturorna. Ett jobb som bara är markerat som fakturerat
//   har inget fakturadatum och räknas inte här – det räknas i `fakturaSaknas`.
//   Kreditfakturor har negativa summor och drar av i den månad de utfärdas.
//   Antalet fakturor räknar bara vanliga fakturor, inte kreditfakturor.
// - Obetalt: gäller just nu, inte en period. Fakturerade jobb som inte är
//   betalda – med gällande faktura det sparade beloppet att betala, annars
//   räknat med beräknaFaktura (samma formel som fakturan).
// - Nya jobb: när jobbet skapades, i svensk tid.
// - Timmar och km: arbetspassens och resornas datum.
//
// Allt grupperas per månad i databasen. Prisma kan inte gruppera på en del av
// ett datum, så de frågorna är skrivna i SQL med $queryRaw. Värdena skickas
// som parametrar (${…} i mallen), aldrig som text i frågan.

/** År och valfri månad (1–12). `manad: null` = hela året. */
export type Period = { ar: number; manad: number | null };

type SokParametrar = Record<string, string | string[] | undefined>;

// Ett ogiltigt värde i adressen (?ar=abc) ger standardvärdet i stället för fel
const sokSchema = z.object({
  ar: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  manad: z.coerce.number().int().min(1).max(12).optional().catch(undefined),
});

/** `?ar=2026&manad=3` → perioden. Utan år blir det innevarande år. */
export function tolkaPeriod(sok: SokParametrar, idag: string): Period {
  const forsta = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const p = sokSchema.parse({ ar: forsta(sok.ar), manad: forsta(sok.manad) });
  return { ar: p.ar ?? Number(idag.slice(0, 4)), manad: p.manad ?? null };
}

export type ManadStatistik = {
  /** 1–12 */
  manad: number;
  /** Utfärdade fakturor, exkl. moms */
  omsattningOre: number;
  rotOre: number;
  fakturor: number;
  fakturorMedRot: number;
  nyaJobb: number;
  timmar: number;
  km: number;
};

export type PeriodSumma = Omit<ManadStatistik, "manad">;

export type Statistik = Awaited<ReturnType<typeof räknaStatistik>>;

/** Statistiken för den inloggades företag, eller null utan företag. */
export async function getStatistik(period: Period) {
  const company = await inloggatForetag();
  if (!company) return null;
  return räknaStatistik(prisma, company.id, period, idagISverige());
}

// Tar databasen som argument, så att beräkningen kan provköras i en
// transaktion som rullas tillbaka.
type Db = Prisma.TransactionClient;

/** Första dagen i perioden och första dagen efter den, som YYYY-MM-DD. */
type Granser = { fran: string; till: string };

function periodGranser({ ar, manad }: Period): Granser {
  const tvaSiffror = (n: number) => String(n).padStart(2, "0");
  if (manad == null) return { fran: `${ar}-01-01`, till: `${ar + 1}-01-01` };
  return {
    fran: `${ar}-${tvaSiffror(manad)}-01`,
    till:
      manad === 12 ? `${ar + 1}-01-01` : `${ar}-${tvaSiffror(manad + 1)}-01`,
  };
}

export async function räknaStatistik(
  db: Db,
  companyId: string,
  period: Period,
  /** Dagens datum i Sverige, YYYY-MM-DD */
  idag: string,
) {
  const [manader, arsvis, forstaAr, kunder, status, obetalt, fakturaSaknas] =
    await Promise.all([
      perManad(db, companyId, periodGranser({ ar: period.ar, manad: null })),
      omsattningPerAr(db, companyId),
      forstaAret(db, companyId),
      toppKunder(db, companyId, periodGranser(period)),
      jobbPerStatus(db, companyId),
      obetaltJustNu(db, companyId, idag),
      // Jobb som är fakturerade utan utfärdad faktura saknar fakturadatum
      db.job.count({
        where: { companyId, fakturerat: true, fakturor: { none: GALLANDE_FAKTURA } },
      }),
    ]);

  const valda =
    period.manad == null
      ? manader
      : manader.filter((m) => m.manad === period.manad);

  const innevarandeAr = Number(idag.slice(0, 4));

  return {
    period,
    innevarandeAr,
    forstaAr: Math.min(forstaAr ?? innevarandeAr, innevarandeAr),
    /** Alla tolv månader i det valda året – diagrammet visar hela året */
    manader,
    /** Den valda perioden: en månad eller hela året */
    summa: summera(valda),
    /** Hela det valda året, för månadstabellens summarad */
    arsSumma: summera(manader),
    arsvis,
    toppKunder: kunder,
    status,
    obetalt,
    fakturaSaknas,
  };
}

function summera(manader: ManadStatistik[]): PeriodSumma {
  const tom: PeriodSumma = {
    omsattningOre: 0,
    rotOre: 0,
    fakturor: 0,
    fakturorMedRot: 0,
    nyaJobb: 0,
    timmar: 0,
    km: 0,
  };
  return manader.reduce(
    (s, m) => ({
      omsattningOre: s.omsattningOre + m.omsattningOre,
      rotOre: s.rotOre + m.rotOre,
      fakturor: s.fakturor + m.fakturor,
      fakturorMedRot: s.fakturorMedRot + m.fakturorMedRot,
      nyaJobb: s.nyaJobb + m.nyaJobb,
      timmar: s.timmar + m.timmar,
      km: s.km + m.km,
    }),
    tom,
  );
}

// ------------------------------------------------------------
// Per månad
// ------------------------------------------------------------
//
// COUNT ger bigint och SUM av heltal ger bigint/numeric i PostgreSQL, som
// Prisma lämnar som BigInt/Decimal. ::int och ::float8 gör dem till vanliga
// tal. Ören som float8 är exakta upp till 2^53 (90 000 miljarder kr).

async function perManad(
  db: Db,
  companyId: string,
  { fran, till }: Granser,
): Promise<ManadStatistik[]> {
  const [fakturor, jobb, timmar, km] = await Promise.all([
    db.$queryRaw<
      {
        manad: number;
        antal: number;
        exkl: number;
        rot: number;
        medrot: number;
      }[]
    >`
      SELECT EXTRACT(MONTH FROM "fakturadatum")::int AS manad,
             (COUNT(*) FILTER (WHERE "krediterarId" IS NULL))::int AS antal,
             SUM("exklMomsOre")::float8 AS exkl,
             SUM("rotAvdragOre")::float8 AS rot,
             (COUNT(*) FILTER (WHERE "rotAvdragOre" > 0))::int AS medrot
      FROM "faktura"
      WHERE "companyId" = ${companyId}
        AND "fakturadatum" >= ${fran}::date
        AND "fakturadatum" < ${till}::date
      GROUP BY 1`,
    // skapad är en tidpunkt i UTC – ett jobb som skapas kl. 00.30 den 1 mars
    // i Sverige är skapat den 28 februari i UTC.
    db.$queryRaw<{ manad: number; antal: number }[]>`
      SELECT EXTRACT(MONTH FROM lokal)::int AS manad, COUNT(*)::int AS antal
      FROM (
        SELECT ("skapad" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Stockholm' AS lokal
        FROM "job"
        WHERE "companyId" = ${companyId}
      ) j
      WHERE lokal >= ${fran}::timestamp AND lokal < ${till}::timestamp
      GROUP BY 1`,
    db.$queryRaw<{ manad: number; summa: number }[]>`
      SELECT EXTRACT(MONTH FROM a."datum")::int AS manad,
             SUM(a."timmar")::float8 AS summa
      FROM "work_session" a
      JOIN "job" j ON j."id" = a."jobId"
      WHERE j."companyId" = ${companyId}
        AND a."datum" >= ${fran}::date
        AND a."datum" < ${till}::date
      GROUP BY 1`,
    db.$queryRaw<{ manad: number; summa: number }[]>`
      SELECT EXTRACT(MONTH FROM r."datum")::int AS manad,
             SUM(r."stracka")::float8 AS summa
      FROM "trip" r
      JOIN "job" j ON j."id" = r."jobId"
      WHERE j."companyId" = ${companyId}
        AND r."datum" >= ${fran}::date
        AND r."datum" < ${till}::date
      GROUP BY 1`,
  ]);

  // Månader utan rader finns inte i svaret – de blir 0
  return Array.from({ length: 12 }, (_, i) => {
    const manad = i + 1;
    const f = fakturor.find((r) => r.manad === manad);
    return {
      manad,
      omsattningOre: f?.exkl ?? 0,
      rotOre: f?.rot ?? 0,
      fakturor: f?.antal ?? 0,
      fakturorMedRot: f?.medrot ?? 0,
      nyaJobb: jobb.find((r) => r.manad === manad)?.antal ?? 0,
      timmar: timmar.find((r) => r.manad === manad)?.summa ?? 0,
      km: km.find((r) => r.manad === manad)?.summa ?? 0,
    };
  });
}

// ------------------------------------------------------------
// Per år och första året
// ------------------------------------------------------------

/** Utfärdade fakturor per år, senaste året först. Bara år med fakturor. */
async function omsattningPerAr(db: Db, companyId: string) {
  const rader = await db.$queryRaw<
    { ar: number; antal: number; exkl: number; rot: number }[]
  >`
    SELECT EXTRACT(YEAR FROM "fakturadatum")::int AS ar,
           (COUNT(*) FILTER (WHERE "krediterarId" IS NULL))::int AS antal,
           SUM("exklMomsOre")::float8 AS exkl,
           SUM("rotAvdragOre")::float8 AS rot
    FROM "faktura"
    WHERE "companyId" = ${companyId}
    GROUP BY 1
    ORDER BY 1 DESC`;

  return rader.map((r) => ({
    ar: r.ar,
    omsattningOre: r.exkl,
    rotOre: r.rot,
    fakturor: r.antal,
  }));
}

/** Året då det första jobbet skapades eller första fakturan utfärdades. */
async function forstaAret(db: Db, companyId: string) {
  // LEAST hoppar över NULL – saknas fakturor används bara jobben
  const [rad] = await db.$queryRaw<{ ar: number | null }[]>`
    SELECT EXTRACT(YEAR FROM LEAST(
      (SELECT MIN("fakturadatum") FROM "faktura" WHERE "companyId" = ${companyId}),
      (SELECT MIN((("skapad" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Stockholm')::date)
         FROM "job" WHERE "companyId" = ${companyId})
    ))::int AS ar`;
  return rad?.ar ?? null;
}

// ------------------------------------------------------------
// Kunder
// ------------------------------------------------------------

const ANTAL_TOPPKUNDER = 5;

/** Kunderna med störst omsättning under perioden. */
async function toppKunder(db: Db, companyId: string, { fran, till }: Granser) {
  const grupper = await db.faktura.groupBy({
    by: ["customerId"],
    where: {
      companyId,
      // @db.Date jämförs mot UTC-midnatt, som new Date("YYYY-MM-DD") ger
      fakturadatum: { gte: new Date(fran), lt: new Date(till) },
    },
    _sum: { exklMomsOre: true },
    _count: { krediterarId: true, _all: true },
    orderBy: { _sum: { exklMomsOre: "desc" } },
    take: ANTAL_TOPPKUNDER,
  });

  const ids = grupper.flatMap((g) => (g.customerId ? [g.customerId] : []));
  const kunder = await db.customer.findMany({
    where: { companyId, id: { in: ids } },
    select: { id: true, typ: true, namn: true, foretagsnamn: true },
  });

  return grupper.map((g) => {
    const kund = kunder.find((k) => k.id === g.customerId);
    return {
      // Fakturor till kunder som tagits bort hamnar i samma grupp (null)
      customerId: g.customerId,
      namn: kund
        ? kundensNamn({ ...kund, typ: kund.typ as "privat" | "foretag" })
        : "Borttagen kund",
      omsattningOre: g._sum.exklMomsOre ?? 0,
      // _all räknar alla rader, krediterarId bara kreditfakturorna
      fakturor: g._count._all - (g._count.krediterarId ?? 0),
    };
  });
}

// ------------------------------------------------------------
// Just nu – påverkas inte av perioden
// ------------------------------------------------------------

/**
 * Alla jobb fördelade på var de är i flödet. Varje jobb räknas en gång, i
 * det senaste steget det har nått.
 */
async function jobbPerStatus(db: Db, companyId: string) {
  const grupper = await db.job.groupBy({
    by: ["pagaende", "utfort", "fakturerat", "betalt"],
    where: { companyId },
    _count: { _all: true },
  });

  const status = {
    ejPaborjade: 0,
    pagaende: 0,
    attFakturera: 0,
    obetalda: 0,
    betalda: 0,
  };
  for (const g of grupper) {
    const antal = g._count._all;
    if (g.betalt) status.betalda += antal;
    else if (g.fakturerat) status.obetalda += antal;
    else if (g.utfort) status.attFakturera += antal;
    else if (g.pagaende) status.pagaende += antal;
    else status.ejPaborjade += antal;
  }
  return status;
}

/** Fakturerade jobb som inte är betalda, och hur mycket kunderna ska betala. */
async function obetaltJustNu(db: Db, companyId: string, idag: string) {
  // Bara gällande fakturor – en krediterad faktura ska inte betalas
  const obetaldFaktura = {
    companyId,
    ...GALLANDE_FAKTURA,
    job: { is: { fakturerat: true, betalt: false } },
  } satisfies Prisma.FakturaWhereInput;

  const [utfardade, forfallna, utanFaktura] = await Promise.all([
    db.faktura.aggregate({
      where: obetaldFaktura,
      _sum: { attBetalaOre: true },
      _count: { _all: true },
    }),
    db.faktura.aggregate({
      // Förfallen dagen efter förfallodagen
      where: { ...obetaldFaktura, forfallodatum: { lt: new Date(idag) } },
      _sum: { attBetalaOre: true },
      _count: { _all: true },
    }),
    // Utan utfärdad faktura finns inget sparat belopp – det räknas fram
    db.job.findMany({
      where: {
        companyId,
        fakturerat: true,
        betalt: false,
        fakturor: { none: GALLANDE_FAKTURA },
      },
      include: JOBB_MED_RADER,
    }),
  ]);

  const utanFakturaOre = utanFaktura.reduce(
    (summa, j) => summa + kronorTillOre(beräknaFaktura(jobbPrisunderlag(mapJob(j))).attBetala),
    0,
  );

  return {
    antal: utfardade._count._all + utanFaktura.length,
    attBetalaOre: (utfardade._sum.attBetalaOre ?? 0) + utanFakturaOre,
    forfallna: forfallna._count._all,
    forfallnaOre: forfallna._sum.attBetalaOre ?? 0,
  };
}
