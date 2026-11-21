import { mottagare, type Mottagare } from "./faktura";
import {
  beräknaFaktura,
  MOMS_PROCENT,
  offertPrisunderlag,
  ROT_PROCENT,
  type CompanyInput,
  type FakturaRad,
  type Offert,
} from "./job-schema";

// ============================================================
// Offertens innehåll
// ============================================================
//
// Allt som står på en offert, färdigräknat – samma idé som FakturaData.
// Utskriften och PDF:en ritar bara upp det här och räknar aldrig själva.
//
// En offert är inget bokföringsunderlag och sparas inte som ögonblicksbild:
// den byggs av offertens aktuella uppgifter varje gång den visas.

export type OffertData = {
  offertnummer: number;
  /** YYYY-MM-DD */
  offertdatum: string;
  /** YYYY-MM-DD, sista dagen offerten gäller */
  giltigTill: string;
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
  };
  kund: Mottagare | null;
  rotAvdrag: boolean;
  /** Omvänd byggmoms – ingen moms, köparen redovisar */
  omvandMoms: boolean;
  fastPris: boolean;
  /** Fast pris där arbetsdelen är angiven – visas som "varav arbetskostnad" */
  visaArbetskostnad: boolean;
  beskrivning: string;
  villkor: string;
  rader: FakturaRad[];
  summa: {
    exklMoms: number;
    arbetskostnad: number;
    moms: number;
    totalInklMoms: number;
    rotUnderlag: number;
    rotAvdrag: number;
    oresutjamning: number;
    attBetala: number;
  };
  satser: { momsProcent: number; rotProcent: number };
};

/** Företagsuppgifterna som behövs för en offert. */
export type OffertForetag = Pick<
  CompanyInput,
  | "name"
  | "orgNummer"
  | "adress"
  | "postnummer"
  | "ort"
  | "telefon"
  | "epost"
  | "fSkatt"
  | "momsNummer"
>;

/** Tid och resor på en offert är uppskattningar – det ska synas på raden. */
function offertRad(rad: FakturaRad): FakturaRad {
  if (rad.typ === "arbete") {
    return { ...rad, beskrivning: "Arbetstid (beräknad)" };
  }
  if (rad.typ === "resa") {
    return { ...rad, beskrivning: "Resor / milersättning (beräknad)" };
  }
  return rad;
}

export function skapaOffertData(
  offert: Offert,
  foretag: OffertForetag,
): OffertData {
  const f = beräknaFaktura(offertPrisunderlag(offert));
  const arFastPris = offert.fastPris != null;

  return {
    offertnummer: offert.offertnummer,
    offertdatum: offert.offertdatum,
    giltigTill: offert.giltigTill,
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
    },
    kund: mottagare(offert.customer),
    rotAvdrag: f.rotAvdrag > 0,
    omvandMoms: f.omvandMoms,
    fastPris: arFastPris,
    visaArbetskostnad: arFastPris && offert.fastPrisArbete != null,
    beskrivning: offert.beskrivning,
    villkor: offert.villkor,
    rader: f.rader.map(offertRad),
    summa: {
      exklMoms: f.exklMoms,
      arbetskostnad: f.arbetskostnad,
      moms: f.moms,
      totalInklMoms: f.totalInklMoms,
      rotUnderlag: f.rotUnderlag,
      rotAvdrag: f.rotAvdrag,
      oresutjamning: f.oresutjamning,
      attBetala: f.attBetala,
    },
    satser: { momsProcent: MOMS_PROCENT, rotProcent: ROT_PROCENT },
  };
}
