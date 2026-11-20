import { laggTillDagar } from "./datum";
import {
  beräknaFaktura,
  kundensNamn,
  MOMS_PROCENT,
  ROT_PROCENT,
  rotBostad,
  type CompanyInput,
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
// databasen har den form de fick när de sparades. Ändras formen på riktigt:
// höj `version` och hantera de gamla.

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
  kund: {
    typ: "privat" | "foretag";
    /** Redan framtaget med kundensNamn() */
    namn: string;
    kontaktperson: string;
    adress: string;
    postnummer: string;
    ort: string;
    epost: string;
    telefon: string;
    personnummer: string;
    /** rotBostad(), t.ex. "Fastighet: Berga 1:23" */
    rotBostad: string;
  } | null;
  rotAvdrag: boolean;
  fastPris: boolean;
  /** Fast pris där arbetsdelen är angiven – visas som "varav arbetskostnad" */
  visaArbetskostnad: boolean;
  utfortArbete: string;
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

/** Belopp på fakturan, alltid med två decimaler: "1 234,50 kr". */
export function fakturaKr(n: number): string {
  return (
    n
      .toLocaleString("sv-SE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      // sv-SE skriver minus som U+2212, som PDF:ens standardtypsnitt saknar
      // (syns vid negativ öresutjämning)
      .replace("−", "-") + " kr"
  );
}

/** À-pris på en fakturarad – arbetstid och resor visas per timme/km. */
export function fakturaAPris(rad: FakturaRad): string {
  const perEnhet = rad.typ === "arbete" || rad.typ === "resa";
  return fakturaKr(rad.aPris) + (perEnhet ? `/${rad.enhet}` : "");
}

/**
 * Säljarens momsregistreringsnummer. Saknas det räknas det fram ur
 * organisationsnumret (SE + org.nr + 01).
 */
export function saljarensMomsNummer(saljare: FakturaData["saljare"]): string {
  return (
    saljare.momsNummer || `SE${saljare.orgNummer.replace("-", "")}01`
  );
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
  const f = beräknaFaktura(job);
  const kund = job.customer;
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
    kund: kund
      ? {
          typ: kund.typ,
          namn: kundensNamn(kund),
          kontaktperson: kund.typ === "foretag" ? (kund.kontaktperson ?? "") : "",
          adress: kund.adress ?? "",
          postnummer: kund.postnummer ?? "",
          ort: kund.ort ?? "",
          epost: kund.epost ?? "",
          telefon: kund.telefon ?? "",
          personnummer: kund.personnummer ?? "",
          rotBostad: rotBostad(kund),
        }
      : null,
    rotAvdrag: job.rotAvdrag,
    fastPris: arFastPris,
    visaArbetskostnad: arFastPris && job.fastPrisArbete != null,
    utfortArbete: job.utfortArbete ?? "",
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
