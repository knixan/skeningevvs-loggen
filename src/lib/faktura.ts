import { laggTillDagar } from "./datum";
import {
  arGiltigtMomsNummer,
  beräknaFaktura,
  harOmvandByggmoms,
  jobbPrisunderlag,
  kundensNamn,
  MOMS_PROCENT,
  ROT_PROCENT,
  rotBostad,
  rotUppgifterSomSaknas,
  type CompanyInput,
  type Customer,
  type FakturaRad,
  type Job,
} from "./job-schema";

// ============================================================
// Fakturans innehåll
// ============================================================
//
// Allt som står på en faktura, färdigräknat. När fakturan utfärdas sparas
// det här som en ögonblicksbild (tabellen `faktura`), och utskrift och PDF
// läser sedan bara därifrån. Ändras jobbet, kunden, företaget eller
// momssatsen efteråt påverkas inte en utfärdad faktura (bokföringslagen).
//
// Förhandsgranskningen byggs med samma funktion av dagens data, så att den
// ser ut exakt som fakturan kommer att göra.
//
// Logotypen är inte med: en gammal logotyp raderas från UploadThing när den
// byts, så en sparad adress skulle sluta fungera. Den hämtas alltid från
// företaget.
//
// Lägg bara till fält, ta aldrig bort eller döp om – gamla fakturor i
// databasen har den form de fick när de sparades. Nya fält är därför
// valfria (?) – en gammal faktura saknar dem. Ändras formen på riktigt: höj
// `version` och hantera de gamla.

export type FakturaData = {
  version: 1;
  /** null = förhandsgranskning av en faktura som inte är utfärdad */
  fakturanummer: number | null;
  /** YYYY-MM-DD */
  fakturadatum: string;
  /** YYYY-MM-DD */
  forfallodatum: string;
  saljare: {
    namn: string;
    orgNummer: string;
    adress: string;
    postnummer: string;
    ort: string;
    telefon: string;
    epost: string;
    fSkatt: boolean;
    momsNummer: string;
    bankgiro: string;
    plusgiro: string;
    swish: string;
    forfallodagar: number;
    drojsmalsranta: number;
    fakturatext: string;
  };
  /** null bara i en förhandsgranskning – en faktura kan inte utfärdas utan kund */
  kund: Mottagare | null;
  rotAvdrag: boolean;
  fastPris: boolean;
  /** Fast pris där arbetsdelen är angiven – visas som "varav arbetskostnad" */
  visaArbetskostnad: boolean;
  utfortArbete: string;
  /**
   * När arbetet utfördes: första och sista datum bland arbetspass och resor
   * (YYYY-MM-DD). null om jobbet saknar datum. Saknas i gamla fakturor.
   */
  utfortPeriod?: { fran: string; till: string } | null;
  /** Omvänd byggmoms – ingen moms, köparen redovisar. Saknas i gamla fakturor. */
  omvandMoms?: boolean;
  /**
   * Satt på en kreditfaktura: fakturan som krediteras. Beloppen är då
   * negativa. Saknas i gamla fakturor och i vanliga fakturor.
   */
  krediterar?: { fakturanummer: number; fakturadatum: string } | null;
  rader: FakturaRad[];
  summa: {
    exklMoms: number;
    arbetskostnad: number;
    moms: number;
    rotUnderlag: number;
    rotAvdrag: number;
    oresutjamning: number;
    attBetala: number;
  };
  satser: { momsProcent: number; rotProcent: number };
};

/** Mottagaren av en faktura eller offert, som den står på papperet. */
export type Mottagare = {
  typ: "privat" | "foretag";
  /** Redan framtaget med kundensNamn() */
  namn: string;
  kontaktperson: string;
  adress: string;
  postnummer: string;
  ort: string;
  epost: string;
  telefon: string;
  /** Bara med när ROT gäller – annars tom */
  personnummer: string;
  /** rotBostad(), t.ex. "Fastighet: Berga 1:23" */
  rotBostad: string;
  /** Köparens momsreg.nr, bara vid omvänd byggmoms. Saknas i gamla fakturor. */
  momsNummer?: string;
};

/**
 * Mottagaren som den står på papperet. Personnumret tas bara med när ROT
 * gäller – annars behövs det inte och ska inte sparas på fakturan.
 */
export function mottagare(
  kund: Customer | null | undefined,
  { medPersonnummer = false }: { medPersonnummer?: boolean } = {},
): Mottagare | null {
  if (!kund) return null;
  return {
    typ: kund.typ,
    namn: kundensNamn(kund),
    kontaktperson: kund.typ === "foretag" ? (kund.kontaktperson ?? "") : "",
    adress: kund.adress ?? "",
    postnummer: kund.postnummer ?? "",
    ort: kund.ort ?? "",
    epost: kund.epost ?? "",
    telefon: kund.telefon ?? "",
    personnummer: medPersonnummer ? (kund.personnummer ?? "") : "",
    rotBostad: rotBostad(kund),
    momsNummer: harOmvandByggmoms(kund) ? (kund.momsNummer ?? "") : "",
  };
}

/** Belopp på fakturan, alltid med två decimaler: "1 234,50 kr". */
export function fakturaKr(n: number): string {
  return (
    n
      .toLocaleString("sv-SE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      // sv-SE skriver minus som U+2212, som PDF:ens standardtypsnitt saknar
      // (syns vid negativ öresutjämning och på kreditfakturor)
      .replace("−", "-") + " kr"
  );
}

/** À-pris på en fakturarad – arbetstid och resor visas per timme/km. */
export function fakturaAPris(rad: FakturaRad): string {
  const perEnhet = rad.typ === "arbete" || rad.typ === "resa";
  return fakturaKr(rad.aPris) + (perEnhet ? `/${rad.enhet}` : "");
}

/**
 * Säljarens momsregistreringsnummer som det står på fakturan, eller tom
 * sträng.
 *
 * Nya fakturor kan inte utfärdas utan ifyllt momsreg.nr (fakturaFel). Gamla
 * fakturor utfärdades när numret räknades fram ur org.nr om det saknades –
 * de visas som förut, så att en utfärdad faktura inte ändras.
 */
export function saljarensMomsNummer(
  saljare: Pick<FakturaData["saljare"], "momsNummer" | "orgNummer" | "fSkatt">,
): string {
  if (saljare.momsNummer) return saljare.momsNummer;
  if (!saljare.fSkatt || !saljare.orgNummer) return "";
  return `SE${saljare.orgNummer.replace("-", "")}01`;
}

/** "2026-11-03" eller "2026-11-03 – 2026-11-14" */
export function formateraPeriod(period: { fran: string; till: string }) {
  return period.fran === period.till
    ? period.fran
    : `${period.fran} – ${period.till}`;
}

/** Första och sista datum bland arbetspass och resor, eller null. */
function utfortPeriod(job: Job): { fran: string; till: string } | null {
  const datum = [
    ...job.arbetstider.map((a) => a.datum),
    ...job.resor.map((r) => r.datum),
  ]
    .filter(Boolean)
    .sort();
  if (datum.length === 0) return null;
  return { fran: datum[0], till: datum[datum.length - 1] };
}

/** Företagsuppgifterna som behövs för en faktura. */
export type FakturaForetag = Omit<CompanyInput, "nastaFakturanummer">;

export function skapaFakturaData(
  job: Job,
  foretag: FakturaForetag,
  {
    fakturanummer,
    fakturadatum,
  }: { fakturanummer: number | null; fakturadatum: string },
): FakturaData {
  const f = beräknaFaktura(jobbPrisunderlag(job));
  const arFastPris = job.fastPris != null;

  return {
    version: 1,
    fakturanummer,
    fakturadatum,
    forfallodatum: laggTillDagar(fakturadatum, foretag.forfallodagar),
    saljare: {
      namn: foretag.name,
      orgNummer: foretag.orgNummer,
      adress: foretag.adress,
      postnummer: foretag.postnummer,
      ort: foretag.ort,
      telefon: foretag.telefon,
      epost: foretag.epost,
      fSkatt: foretag.fSkatt,
      momsNummer: foretag.momsNummer,
      bankgiro: foretag.bankgiro,
      plusgiro: foretag.plusgiro,
      swish: foretag.swish,
      forfallodagar: foretag.forfallodagar,
      drojsmalsranta: foretag.drojsmalsranta,
      fakturatext: foretag.fakturatext,
    },
    kund: mottagare(job.customer, { medPersonnummer: f.rotAvdrag > 0 }),
    rotAvdrag: f.rotAvdrag > 0,
    fastPris: arFastPris,
    visaArbetskostnad: arFastPris && job.fastPrisArbete != null,
    utfortArbete: job.utfortArbete ?? "",
    utfortPeriod: utfortPeriod(job),
    omvandMoms: f.omvandMoms,
    krediterar: null,
    rader: f.rader,
    summa: {
      exklMoms: f.exklMoms,
      arbetskostnad: f.arbetskostnad,
      moms: f.moms,
      rotUnderlag: f.rotUnderlag,
      rotAvdrag: f.rotAvdrag,
      oresutjamning: f.oresutjamning,
      attBetala: f.attBetala,
    },
    satser: { momsProcent: MOMS_PROCENT, rotProcent: ROT_PROCENT },
  };
}

/**
 * Det som hindrar att fakturan utfärdas, som meningar till användaren. Tom
 * lista = fakturan kan utfärdas. Samma kontroll görs på servern
 * (utfardaFaktura) och i förhandsgranskningen.
 *
 * En utfärdad faktura kan inte ändras, bara krediteras – därför stoppas
 * fakturor som Skatteverket eller kunden inte kan använda.
 */
export function fakturaFel(job: Job, foretag: FakturaForetag): string[] {
  const fel: string[] = [];
  const f = beräknaFaktura(jobbPrisunderlag(job));
  const kund = job.customer;

  if (!kund) {
    fel.push("Välj en kund på jobbet.");
  }
  if (!(f.exklMoms > 0)) {
    fel.push("Fakturan är på 0 kr – lägg till rader eller ett fast pris.");
  }
  if (!foretag.momsNummer) {
    fel.push(
      "Fyll i ert momsregistreringsnummer under Företagsuppgifter – det ska stå på fakturan.",
    );
  } else if (!arGiltigtMomsNummer(foretag.momsNummer)) {
    fel.push("Momsregistreringsnumret under Företagsuppgifter har fel format.");
  }
  if (job.fastPris != null && !(job.utfortArbete ?? "").trim()) {
    fel.push(
      "Med fast pris står inga rader på fakturan – beskriv vad som gjorts under Utfört arbete.",
    );
  }
  if (job.rotAvdrag && kund && kund.typ === "privat") {
    const saknas = rotUppgifterSomSaknas(kund);
    if (saknas.length > 0) {
      fel.push(`ROT-avdraget kräver kundens ${saknas.join(" och ")}.`);
    }
  }
  if (harOmvandByggmoms(kund) && !kund?.momsNummer) {
    fel.push("Omvänd byggmoms kräver kundens momsregistreringsnummer.");
  }
  return fel;
}

/**
 * Kreditfakturan för en utfärdad faktura: samma innehåll med negativa belopp,
 * eget nummer och datum, och en hänvisning till originalet. Byggs av den
 * sparade fakturan – inte av jobbet – så att den tar ut originalet exakt.
 */
export function skapaKreditfaktura(
  original: FakturaData,
  {
    fakturanummer,
    fakturadatum,
  }: { fakturanummer: number; fakturadatum: string },
): FakturaData {
  if (original.fakturanummer == null) {
    throw new Error("Bara en utfärdad faktura kan krediteras");
  }
  const minus = (n: number) => (n === 0 ? 0 : -n);
  return {
    ...original,
    fakturanummer,
    fakturadatum,
    // Inget att betala in – ett eventuellt överskott betalas tillbaka
    forfallodatum: fakturadatum,
    krediterar: {
      fakturanummer: original.fakturanummer,
      fakturadatum: original.fakturadatum,
    },
    rader: original.rader.map((rad) => ({
      ...rad,
      antal: minus(rad.antal),
      belopp: minus(rad.belopp),
    })),
    summa: {
      exklMoms: minus(original.summa.exklMoms),
      arbetskostnad: minus(original.summa.arbetskostnad),
      moms: minus(original.summa.moms),
      rotUnderlag: minus(original.summa.rotUnderlag),
      rotAvdrag: minus(original.summa.rotAvdrag),
      oresutjamning: minus(original.summa.oresutjamning),
      attBetala: minus(original.summa.attBetala),
    },
  };
}
