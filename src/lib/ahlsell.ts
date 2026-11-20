import { z } from "zod";

// ============================================================
// Ahlsells prisfiler – tolkning och prisberäkning
// ============================================================
//
// Ahlsell levererar två textfiler (ANSI, fast kolumnbredd) under Mina sidor:
//
// 1. Beräkningsgrund – en rad per artikel med grundnettopris.
//    Spec: ahlsell.se/…/filspecifikation-berakningsgrund-ahlsell-250925.pdf
// 2. Avtalsfil – kundens rabatter per materialklass och nettopriser/rabatter
//    per artikel. Spec: ahlsell.se/…/filspecifikation-avtal-ahlsell-250925.pdf
//
// Nettopriset räknas exakt som Ahlsells egen Excel-kalkylator
// (ahlsell_prisberakning_i_excel_v220517, makrot RabattBeräkning):
//
//   1. Finns artikeln i avtalet med nettopris > 0 → det priset.
//   2. Annars en rabattsats, i den här ordningen:
//      a. specialrabatt på artikeln (eller på materialklassen om artikeln
//         saknas i avtalet),
//      b. kedjerabatt på materialklassen (om kedjerabattkod = J),
//      c. rabatt på materialklassen.
//      Nettopris = grundnettopris × (1 − rabattsats).
//
// Materialklassen matchas exakt (som MATCH(…;0) i Excel). Rabatter anges i
// tiondels procent (125 = 12,5 %), priser i ören.
//
// Filen tolkas i webbläsaren och skickas i delar till servern, eftersom en hel
// prislista är för stor för en enda förfrågan (Vercel tar max 4,5 MB).

/** En färdigberäknad artikel, så som den skickas till servern. */
export const ahlsellRadSchema = z.object({
  artikelnr: z.string().trim().min(1).max(20),
  benamning: z.string().trim().max(60),
  enhet: z.string().trim().max(3),
  materialklass: z.string().trim().max(6),
  lagerford: z.boolean(),
  bestallningsmultipel: z.number().min(0).max(100000),
  grundprisOre: z.number().int().min(0).max(1e11),
  nettoprisOre: z.number().int().min(0).max(1e11),
});

export type AhlsellRad = z.infer<typeof ahlsellRadSchema>;

/** Antal rader per anrop till servern (~150 byte/rad → långt under 1 MB). */
export const AHLSELL_DELSTORLEK = 2000;

/** Ahlsell skriver filerna i ANSI (Windows-1252) – inte UTF-8. */
export function avkodaAnsi(buffer: ArrayBuffer): string {
  return new TextDecoder("windows-1252").decode(buffer);
}

function rader(text: string): string[] {
  return text.split(/\r?\n/).filter((r) => r.trim() !== "");
}

/** Fält ur en rad med fast bredd. `start`/`slut` är 1-baserade byte som i specen. */
function falt(rad: string, start: number, slut: number): string {
  return rad.slice(start - 1, slut).trim();
}

function heltal(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Artikelnummer jämförs utan inledande nollor, ifall filerna fyller ut olika. */
export function artikelnyckel(artikelnr: string): string {
  return artikelnr.trim().replace(/^0+(?=.)/, "").toUpperCase();
}

// ------------------------------------------------------------
// Beräkningsgrund
// ------------------------------------------------------------

export type GrundRad = Omit<AhlsellRad, "nettoprisOre">;

export function tolkaBerakningsgrund(text: string): {
  artiklar: GrundRad[];
  felrader: number;
} {
  const artiklar: GrundRad[] = [];
  let felrader = 0;

  for (const rad of rader(text)) {
    const artikelnr = falt(rad, 1, 20);
    const prisText = falt(rad, 21, 32);
    // En rad utan artikelnummer eller med icke-numeriskt pris är inte en
    // artikelrad (t.ex. en rubrikrad) – hoppa över den.
    if (!artikelnr || !/^\d+$/.test(prisText)) {
      felrader++;
      continue;
    }
    const lagerfordTecken = falt(rad, 42, 42).toUpperCase();
    const multipel = heltal(falt(rad, 103, 109)) / 100;

    artiklar.push({
      artikelnr,
      grundprisOre: heltal(prisText),
      materialklass: falt(rad, 33, 38),
      enhet: falt(rad, 39, 41),
      lagerford: ["J", "Y", "1", "X"].includes(lagerfordTecken),
      benamning: falt(rad, 43, 102),
      bestallningsmultipel: multipel > 0 ? multipel : 1,
    });
  }

  return { artiklar, felrader };
}

// ------------------------------------------------------------
// Avtalsfil
// ------------------------------------------------------------

type AvtalRad = {
  kedjerabattkod: string;
  artikelnr: string;
  materialklass: string;
  rabatt: number; // tiondels procent
  specrabatt: number; // tiondels procent
  nettoprisOre: number;
  kedjerabatt: number; // tiondels procent
  slutdatum: string; // ÅÅMMDD
};

export type Avtal = {
  perArtikel: Map<string, AvtalRad>;
  perMaterialklass: Map<string, AvtalRad>;
  slutdatum: string;
  antalRader: number;
};

export function tolkaAvtalsfil(text: string): Avtal {
  const perArtikel = new Map<string, AvtalRad>();
  const perMaterialklass = new Map<string, AvtalRad>();
  let slutdatum = "";
  let antalRader = 0;

  for (const rad of rader(text)) {
    // Huvudraden (rad 1 per avtal) har kundnummer på byte 3 – avtalsraderna
    // har kedjerabattkod J/N där.
    const kod = rad.charAt(2).toUpperCase();
    if (kod !== "J" && kod !== "N") continue;

    const r: AvtalRad = {
      kedjerabattkod: kod,
      artikelnr: falt(rad, 11, 30),
      materialklass: falt(rad, 31, 36),
      rabatt: heltal(falt(rad, 37, 40)),
      specrabatt: heltal(falt(rad, 41, 44)),
      nettoprisOre: heltal(falt(rad, 45, 53)),
      kedjerabatt: heltal(falt(rad, 54, 57)),
      slutdatum: falt(rad, 88, 93),
    };
    antalRader++;
    if (!slutdatum && /^\d{6}$/.test(r.slutdatum) && r.slutdatum !== "000000") {
      slutdatum = r.slutdatum;
    }

    // Första träffen gäller, precis som MATCH i Excel.
    if (r.artikelnr) {
      const nyckel = artikelnyckel(r.artikelnr);
      if (!perArtikel.has(nyckel)) perArtikel.set(nyckel, r);
    } else if (r.materialklass) {
      if (!perMaterialklass.has(r.materialklass)) {
        perMaterialklass.set(r.materialklass, r);
      }
    }
  }

  return { perArtikel, perMaterialklass, slutdatum, antalRader };
}

// ------------------------------------------------------------
// Prisberäkning
// ------------------------------------------------------------

/** Rabattsats i tiondels procent enligt Ahlsells prioritetsordning. */
export function rabattsats(
  avtalArtikel: AvtalRad | undefined,
  avtalKlass: AvtalRad | undefined,
): number {
  const spec = avtalArtikel
    ? avtalArtikel.specrabatt
    : (avtalKlass?.specrabatt ?? 0);
  const kedje =
    avtalKlass?.kedjerabattkod === "J" ? avtalKlass.kedjerabatt : 0;
  const klass = avtalKlass?.rabatt ?? 0;

  if (spec > 0) return spec;
  if (kedje > 0) return kedje;
  return klass;
}

export function beraknaNettoprisOre(artikel: GrundRad, avtal?: Avtal): number {
  if (!avtal) return artikel.grundprisOre;

  const avtalArtikel = avtal.perArtikel.get(artikelnyckel(artikel.artikelnr));
  if (avtalArtikel && avtalArtikel.nettoprisOre > 0) {
    return avtalArtikel.nettoprisOre;
  }

  const avtalKlass = artikel.materialklass
    ? avtal.perMaterialklass.get(artikel.materialklass)
    : undefined;
  const sats = Math.min(1000, rabattsats(avtalArtikel, avtalKlass));
  return Math.round((artikel.grundprisOre * (1000 - sats)) / 1000);
}

export function beraknaPrislista(
  artiklar: GrundRad[],
  avtal?: Avtal,
): AhlsellRad[] {
  return artiklar.map((a) => ({
    ...a,
    nettoprisOre: beraknaNettoprisOre(a, avtal),
  }));
}

// ------------------------------------------------------------
// Visning
// ------------------------------------------------------------

/**
 * Materialklasser vars pris inte är fast (enligt Ahlsells filspecifikation):
 * kopparrör följer dagspris, stålrör/delar/flänsar justeras månads- eller
 * kvartalsvis.
 */
export function prisvarning(materialklass: string): string | null {
  const mk = materialklass.toUpperCase();
  const dagspris = [
    "C11", "C24", "C51", "C54",
    "PAA10", "PAA11", "PAA13", "PAA14", "PAA15", "PAB10",
  ];
  if (dagspris.some((k) => mk.startsWith(k))) return "Dagspris";
  if (/^PJ[A-L]/.test(mk)) return "Pris justeras periodvis";
  return null;
}

/** ÅÅMMDD → ÅÅÅÅ-MM-DD, eller tom sträng. */
export function formateraAvtalsdatum(yymmdd: string): string {
  if (!/^\d{6}$/.test(yymmdd)) return "";
  return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

/** Föreslaget utpris i kronor: inköpspris + påslag, avrundat till ören. */
export function foreslagetUtpris(inkopspris: number, paslagProcent: number) {
  return Math.round(inkopspris * (1 + paslagProcent / 100) * 100) / 100;
}
