// Påhittade testkunder och testjobb för utveckling.
//
//   npm run testdata          – lägger in testdatan (tar först bort gammal testdata)
//   npm run testdata:ta-bort  – tar bort all testdata
//
// Allt som skriptet skapar har id som börjar på "testdata-", så borttagningen
// rör aldrig riktiga kunder eller jobb. Ta bort testdatan innan appen används
// på riktigt.
//
// Testdatan visar bland annat:
// - statistik över förra året och i år (utfärdade fakturor, en kreditfaktura,
//   obetalda och ett jobb som är markerat fakturerat utan faktura),
// - ROT-taket: Anders går över taket med köksjobbet, Erik kommer nära,
// - omvänd byggmoms: Östgöta Bygg (med momsreg.nr) och Vadstena Tak & Plåt
//   (utan – fakturan kan inte utfärdas),
// - riktiga artiklar ur Ahlsells prislista (AHL nedan). En rad i Eriks
//   badrum är köpt på Bauhaus, för att visa en annan återförsäljare.
//
// Personerna och företagen är påhittade:
// - personnummer och org.nummer har med flit fel kontrollsiffra, så de kan
//   inte tillhöra någon,
// - telefonnummer ligger i PTS serie för fiktion (070-174 06 05 – 99),
// - e-post går till example.com, som är reserverad för exempel.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createJiti } from "jiti";

// Fakturorna byggs med appens egen kod (TypeScript), via jiti
const jiti = createJiti(import.meta.url);
const { skapaFakturaData, skapaKreditfaktura } = await jiti.import("../src/lib/faktura.ts");
const { kronorTillOre, ROT_TAK_KR, utprisMedPaslag } = await jiti.import("../src/lib/job-schema.ts");

const PREFIX = "testdata-";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ------------------------------------------------------------
// Hjälpfunktioner
// ------------------------------------------------------------

/** Luhn-kontrollsiffra för 9 siffror (som för personnummer/org.nummer). */
function luhn(nio) {
  let summa = 0;
  [...nio].forEach((siffra, i) => {
    let n = Number(siffra) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    summa += n;
  });
  return (10 - (summa % 10)) % 10;
}

/** Nummer med medvetet FEL kontrollsiffra – kan aldrig vara ett riktigt. */
function felKontrollsiffra(nio) {
  return (luhn(nio) + 5) % 10;
}

/** "19620314", "482" → "19620314-482X" med ogiltig kontrollsiffra. */
function fejkPersonnummer(datum, nummer) {
  return `${datum}-${nummer}${felKontrollsiffra(datum.slice(2) + nummer)}`;
}

/** "559012", "345" → "559012-345X" med ogiltig kontrollsiffra. */
function fejkOrgNummer(forsta, nummer) {
  return `${forsta}-${nummer}${felKontrollsiffra(forsta + nummer)}`;
}

/** PTS fiktionsserie: 070-174 06 05 till 070-174 06 99. */
function fejkTelefon(n) {
  return `070-174 06 ${String(n).padStart(2, "0")}`;
}

/** Momsreg.nr för ett org.nummer: "559012-3456" → "SE559012345601". */
function momsNummerFor(orgNummer) {
  return `SE${orgNummer.replace("-", "")}01`;
}

const idag = new Date();

/** Lokalt datum → Date för @db.Date (UTC-midnatt samma dag). */
function somDbDatum(d) {
  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return new Date(s);
}

/** Datum (för @db.Date) n dagar från idag, lokal tid. */
function dag(n) {
  return somDbDatum(new Date(idag.getFullYear(), idag.getMonth(), idag.getDate() + n));
}

/** Datum (för @db.Date) m månader tillbaka, dag d i månaden – aldrig efter idag. */
function manad(m, d) {
  const t = new Date(idag.getFullYear(), idag.getMonth() - m, Math.min(d, 28));
  const nu = new Date(idag.getFullYear(), idag.getMonth(), idag.getDate());
  return somDbDatum(t > nu ? nu : t);
}

/**
 * Som manad(), men aldrig före 1 januari i år. ROT-taket gäller per år, så
 * jobben som ska fylla taket måste hamna i år även när skriptet körs i januari.
 */
function iAr(m, d) {
  const t = manad(m, d);
  const nyar = new Date(`${idag.getFullYear()}-01-01`);
  return t < nyar ? nyar : t;
}

/** @db.Date + n dagar. */
function plusDagar(datum, n) {
  return new Date(datum.getTime() + n * 86_400_000);
}

/** @db.Date → "YYYY-MM-DD". */
function iso(datum) {
  return datum.toISOString().slice(0, 10);
}

/** Tidpunkt n dagar tillbaka, kl. h – när jobbet "skapades". */
function skapad(n, h = 8) {
  return new Date(idag.getFullYear(), idag.getMonth(), idag.getDate() + n, h, 15);
}

/** Tidpunkt n dagar före ett @db.Date, kl. 08.15 lokal tid. */
function skapadFore(datum, n) {
  const d = plusDagar(datum, -n);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 15);
}

// Påslaget som föreslås i appen när en Ahlsell-artikel väljs (Inställningar)
const PASLAG = 30;

/**
 * En artikel ur den inlästa Ahlsell-prislistan (november 2026): artikelnummer,
 * benämning, enhet och nettopris (inköpspris) som de står där, och utpris med
 * PASLAG – samma rad som appen skapar när artikeln väljs i sökningen.
 * Returnerar en funktion som tar antalet: AHL.kopparror15(2.5).
 */
function ahlsell(artikelnr, benamning, inkopspris, enhet = "ST") {
  return (antal = 1) => ({
    namn: benamning,
    artikelnr,
    aterforsaljare: "Ahlsell",
    inkopspris,
    pris: utprisMedPaslag(inkopspris, PASLAG),
    antal,
    enhet,
  });
}

// Artiklarna som testdatan använder, ur Ahlsells prislista
const AHL = {
  // Toalett
  wcIfo: ahlsell("7856902", "IFÖ SIGN WC 6860 WC-STOL VITINB. S-LÅS MJUKSITS", 4185),
  wcAcoll: ahlsell("7856879", "A-COLLECTION WC-STOL 4, S-LÅS3/6L,HEL.CIST.EX.SITS,SKRUV", 2373.8),
  wcSitsSoftClose: ahlsell("7821789", "A-COLLECTION HÅRD WC-SITS MEDSOFT-CLOSE, UNIVERSAL, VIT", 619.44),
  wcAnslutning: ahlsell("2316847", "110MM PVC/PP/MA WC-ANSL. EXC.VIT MED WC-MANSCHETT OCH HUV", 99.45),
  wcAvstangning: ahlsell("7925943", "IFÖ AVSTÄNGNINGSVENTIL - WC-STOL , Z96721", 184.42),
  wcFixtur: ahlsell("8000297", "GEBERIT DUOFIX OMEGA WC FIXTUR12CM, HÖJD 82 CM, PEX ANSL", 4216.8),
  wcSkalVagg: ahlsell("7763329V", "LAUFEN PRO-N VÄGG WC-SKÅL.MED MJUK SITS", 2618.2),
  silikon: ahlsell("305103", "FOGMASSA SIKASIL-C OFFWHITE300ML BYGG O SANITETSSILIKON", 112.14),
  // Kök och diskmaskin
  koksblandareOras: ahlsell("8310554", "ORAS SAGA KÖKSBLANDARE 3934FHÖG PIP. MED DM AVST.", 1894.06),
  koksblandareGbg: ahlsell("8310776", "GBG KÖKSBLANDARE ATLANTIC MEDDM.AVST. HÖG PIP . KROM", 1938),
  koksblandareUtanDm: ahlsell("8310553", "ORAS SAGA KÖKSBLANDARE 3933FHÖG PIP. UTAN DM AVST.", 1414.74),
  kommodvattenlas: ahlsell("8074871", "CONTURA KOMMODVATTENLÅSM.FLEX SLANG & TM AVL.ANSL", 180.44),
  diskmaskinsventil: ahlsell("8543992", "FMM 2295-1501 KULVENTIL 15VINKEL MED VRED", 235.79),
  grenrorDiskmaskin: ahlsell("8082414", "32 GRENRÖR MED SLANG.ANSLINV.GG 32/40 FP 78500", 69.16),
  golvskyddDiskmaskin: ahlsell("8039039", "AQUATEAM+ GD60 MONTERADGOLVSKYDD/DISKMASKIN 60CM", 197.12),
  // Badrum och tvättstuga
  tvattstallsblandare: ahlsell("8275634", "TVÄTTSTÄLLSBLANDARE M.POP-UP1-GREPP A-COLL. AZUR IV ECO", 969.9),
  duschblandare: ahlsell("8351441", "GROHE GRT500 DUSCHBLANDARE150CC TERMOSTAT", 1830.18),
  handdukstork: ahlsell("8684456", "ARROW HJÄLMAREN HANDDUKSTORK8011", 2132),
  golvbrunn: ahlsell("7113928", "PURUS BRAGE 110 GOLVBRUNN AVPLAST", 514.08),
  golvbrunnssil: ahlsell("7133876", "JAFO HÅRSIL TILL GOLVBRUNNAR150MM, RF 2333", 264.2),
  tvattranna: ahlsell("7643000", "TVÄTTRÄNNA ROSTFR L=1200TR 120", 4704.7),
  rorgenomforing: ahlsell("2986206", "RÖRGENOMFÖRING FÖR RÖR UTANSKYDDSRÖR 15-32MM, PURMO", 21.18),
  // Rör, kopplingar och ventiler
  kopparror15: ahlsell("1752105", "15x1.0 KOPPARRÖR RAKT L=5MEN1057 R290", 100.97, "M"),
  kopparror22: ahlsell("1752108", "22x1,0 KOPPARRÖR RAKT L=5MEN1057 R290", 152.33, "M"),
  kopparror28: ahlsell("1752110", "28x1,2 KOPPARRÖR RAKT L=5MEN1057 R290", 234.43, "M"),
  klamring15: ahlsell("1926103", "15 KLÄMRINGSKOPPLING RAK CU-CUA-COLLECTION", 32.54),
  klamring22: ahlsell("1926105", "22 KLÄMRINGSKOPPLING RAK CU-CUA-COLLECTION", 58.94),
  pexRorIRor: ahlsell("2005158", "TAPPVATTEN RÖR-I-RÖR D16 L=50MSANIPEX CLASSIC 355447301", 40.61, "M"),
  fordelarskap: ahlsell("1881315", "LK FÖRDELARSKÅP UNI 350350 X 550 X 95", 1313.76),
  fordelare: ahlsell("1875807", "VATETTE FÖRDELARE 4-RÖRDY22xDY15(G15)", 199.04),
  avloppsror110: ahlsell("2832010", "110X2000 PP RÖR MED 1 MUFFNORDIC. PIPELIFE", 302.72),
  pemRor32: ahlsell("2522001", "32x3.0 PEM-RÖR SDR11 PN16L=50M PE100-RC BLÅ STRIPE", 25.8, "M"),
  dagvattenror110: ahlsell("19039484", "110x6M PEH DAGVATTENRÖR KZMED MUFF PBB.55", 568.89),
  kulventil22: ahlsell("5495066", "22 KULVENTIL AVI 1335S BLYFRIMÄSSING KLÄMRING PN16", 239.12),
  kulventil28: ahlsell("5495067", "28 KULVENTIL AVI 1335S BLYFRIMÄSSING KLÄMRING PN16", 352.28),
  rorisolering22: ahlsell("43801022", "AF/ARMAFLEX AF-1-022RÖRISOLERING 2M/ST", 54.72, "M"),
  rorisolering32: ahlsell("19058087", "RÖRSKÅL 800 MULTI 32-38/201000MM (25M/FRP)(225M/PALL)", 77.56, "M"),
  varmekabel: ahlsell("7066844", "VÄRMEKABEL DLC-120E, 3 M120W, FAS, NOLLA, JORD", 682.5),
  utekran: ahlsell("4315004", "FMM VATTENUTKASTARE 400MM NYFROSTSÄKER, BV, M-NYCKEL", 1078.99),
  // Varmvatten
  beredare100: ahlsell("6933444", "COMPACT 100CU, NIBEVARMVATTENBEREDARE", 13019.6),
  beredare200: ahlsell("6935106", "VARMVATTENBEREDAREOSO CUBIX C 200", 10260.8),
  beredare300: ahlsell("6935107", "VARMVATTENBEREDAREOSO CUBIX C 300", 11236),
  sakerhetsventil9bar: ahlsell("5075109", "SÄKERHETSVENTIL 1890-S PN109BAR/-10°C-+120°C", 144.76),
  sakerhetsventilVarme: ahlsell("5075094V", 'SÄKERHETSVENTIL 1895-S PN10G1/2"X15MM 2,5BAR/-10°C-+120°C', 139.12),
  blandningsventil22: ahlsell("4923580", "22 35-60GR BLANDNINGSVENTILESBE 8204  M KLÄMRINGSKOPPL", 692.24),
  vvcPump: ahlsell("5806000", "STAR Z-NOVA VVC-PUMP, WILO1x230V 50HZ UTAN KOPPLINGAR", 2690.64),
  // Värme
  cirkulationspump: ahlsell("5746873", "ALPHA1 GO 25-60 130CIRKULATIONSPUMP, GRUNDFOS", 4154.25),
  bergvarmepump: ahlsell("6249328", "F1245-8 CU NIBE VÄRMEPUMPMED VVB.", 73497.9),
  expansionskarl: ahlsell("5539340", "25 liter XP-Bas ExpansionskärlG20 förtryck 1,5bar -10-120°C", 390.66),
  koldbararsprit: ahlsell("74134240", "KÖLDBÄRARSPRIT KEMETYL 28%T-PRO KBS BIO 25L", 690.95),
  radiator: ahlsell("6733170M", "PC22-6012 PURMO COMPACT", 3150.1),
  termostatventil: ahlsell("4795815", "15 TERMOSTATVENTIL TRV3CALYPSO DN15 RAK", 231.86),
  golvvarmeror: ahlsell("2418238", "UPONOR COMFORT PIPE PLUS 17X2240M", 20.57, "M"),
  golvvarmefordelare4: ahlsell("2973152", "GOLVVÄRMEFÖRDELARE 4 SLINGORPURMO", 2331),
  golvvarmefordelare6: ahlsell("2973154", "GOLVVÄRMEFÖRDELARE 6 SLINGORPURMO", 3034),
  shuntgrupp: ahlsell("6247712", "SHUNTGRUPP 2 TBH, CTCDN20", 3010.8),
  rumstermostat: ahlsell("2417287", "LK RUMSTERMOSTAT S1", 425.86),
  // Storkök
  fettavskiljare: ahlsell("5644259", "ACO BOX CONCEPT FETT INNE NS2FETTAVSKILJARE MED TÄTA LOCK", 39642.9),
};

/** Arbetspass och resor flera dagar i följd från `start`. */
function flerDagar(start, timmarPerDag, stracka) {
  return {
    arbetspass: timmarPerDag.map((timmar, i) => ({ datum: plusDagar(start, i), timmar })),
    resor: stracka ? timmarPerDag.map((_, i) => ({ datum: plusDagar(start, i), stracka })) : [],
  };
}

/**
 * Ett avslutat och fakturerat jobb, för statistikens historik. Fakturan
 * utfärdas samma dag som arbetet (`datum`).
 */
function avslutat({ datum, timmar = 0, km = 0, artiklar = [], betalt = true, ...falt }) {
  return {
    skapad: skapadFore(datum, 6),
    utfort: true,
    fakturerat: true,
    betalt,
    artiklar,
    arbetspass: timmar ? [{ datum, timmar }] : [],
    resor: km ? [{ datum, stracka: km }] : [],
    faktura: plusDagar(datum, 0),
    ...falt,
  };
}

// ------------------------------------------------------------
// Kunder
// ------------------------------------------------------------

const kunder = [
  {
    id: "lars",
    typ: "privat",
    namn: "Lars Bergqvist",
    adress: "Storgatan 14",
    postnummer: "596 30",
    ort: "Skänninge",
    telefon: fejkTelefon(5),
    epost: "lars.bergqvist@example.com",
    personnummer: fejkPersonnummer("19620314", "482"),
    fastighetsbeteckning: "Skänninge Kvarnen 3:7",
  },
  {
    id: "maria",
    typ: "privat",
    namn: "Maria Holmén",
    adress: "Ågatan 8",
    postnummer: "595 30",
    ort: "Mjölby",
    telefon: fejkTelefon(6),
    epost: "maria.holmen@example.com",
    personnummer: fejkPersonnummer("19880921", "246"),
    lagenhetsnummer: "1102",
    bostadsrattsforening: "Brf Svanen i Mjölby",
    brfOrgNummer: fejkOrgNummer("769618", "552"),
  },
  {
    id: "erik",
    typ: "privat",
    namn: "Erik Sjölander",
    adress: "Vätterviksvägen 22",
    postnummer: "592 32",
    ort: "Vadstena",
    telefon: fejkTelefon(7),
    epost: "erik.sjolander@example.com",
    personnummer: fejkPersonnummer("19750605", "113"),
    fastighetsbeteckning: "Vadstena Strandängen 2:14",
  },
  {
    id: "gunilla",
    typ: "privat",
    namn: "Gunilla Fransson",
    adress: "Prästgårdsgatan 3",
    postnummer: "596 31",
    ort: "Skänninge",
    telefon: fejkTelefon(8),
    personnummer: fejkPersonnummer("19480117", "328"),
    fastighetsbeteckning: "Skänninge Prästgården 1:4",
  },
  {
    id: "johan",
    typ: "privat",
    namn: "Johan Ek",
    adress: "Lindvägen 41",
    postnummer: "591 46",
    ort: "Motala",
    telefon: fejkTelefon(9),
    epost: "johan.ek@example.com",
  },
  {
    id: "fatima",
    typ: "privat",
    namn: "Fatima Rahimi",
    adress: "Kungsgatan 19",
    postnummer: "595 31",
    ort: "Mjölby",
    telefon: fejkTelefon(10),
    epost: "fatima.rahimi@example.com",
  },
  {
    id: "perolof",
    typ: "privat",
    namn: "Per-Olof Lund",
    adress: "Hagebyhöga Norrgård",
    postnummer: "592 93",
    ort: "Vadstena",
    telefon: fejkTelefon(11),
    personnummer: fejkPersonnummer("19570828", "571"),
    fastighetsbeteckning: "Hagebyhöga 5:2",
  },
  {
    id: "sofia",
    typ: "privat",
    namn: "Sofia Lindqvist",
    adress: "Björkvägen 7",
    postnummer: "595 41",
    ort: "Mjölby",
    telefon: fejkTelefon(12),
  },
  {
    id: "brf",
    typ: "foretag",
    namn: "Kent Aronsson",
    foretagsnamn: "Brf Lindblomman",
    kontaktperson: "Kent Aronsson (ordförande)",
    orgNummer: fejkOrgNummer("769612", "408"),
    adress: "Lindgatan 2",
    postnummer: "596 32",
    ort: "Skänninge",
    telefon: fejkTelefon(13),
    epost: "styrelsen.lindblomman@example.com",
  },
  {
    id: "bageri",
    typ: "foretag",
    namn: "Helena Björk",
    foretagsnamn: "Skänninge Kvarnbageri AB",
    kontaktperson: "Helena Björk",
    orgNummer: fejkOrgNummer("559214", "736"),
    adress: "Kvarngatan 5",
    postnummer: "596 34",
    ort: "Skänninge",
    telefon: fejkTelefon(14),
    epost: "helena@example.com",
  },
  {
    id: "fastigheter",
    typ: "foretag",
    namn: "Mats Wallin",
    foretagsnamn: "Kvarnbäckens Fastigheter AB",
    kontaktperson: "Mats Wallin",
    orgNummer: fejkOrgNummer("556877", "215"),
    adress: "Box 118",
    postnummer: "595 22",
    ort: "Mjölby",
    telefon: fejkTelefon(15),
    epost: "forvaltning@example.com",
  },
  {
    id: "pensionat",
    typ: "foretag",
    namn: "Lena Åkesson",
    foretagsnamn: "Pensionat Udden i Vadstena AB",
    kontaktperson: "Lena Åkesson",
    orgNummer: fejkOrgNummer("559341", "620"),
    adress: "Uddenvägen 1",
    postnummer: "592 30",
    ort: "Vadstena",
    telefon: fejkTelefon(16),
    epost: "lena.akesson@example.com",
  },
  {
    // Har fått så mycket ROT i år att nästa jobb går över taket
    id: "anders",
    typ: "privat",
    namn: "Anders Wikström",
    adress: "Bergsätersvägen 12",
    postnummer: "591 52",
    ort: "Motala",
    telefon: fejkTelefon(17),
    epost: "anders.wikstrom@example.com",
    personnummer: fejkPersonnummer("19690402", "357"),
    fastighetsbeteckning: "Motala Bergsäter 4:12",
  },
  {
    // Omvänd byggmoms: byggfirma som anlitar VVS som underentreprenör
    id: "byggab",
    typ: "foretag",
    namn: "Robin Karlsson",
    foretagsnamn: "Östgöta Bygg & Renovering AB",
    kontaktperson: "Robin Karlsson (projektledare)",
    orgNummer: fejkOrgNummer("559187", "034"),
    adress: "Industrigatan 9",
    postnummer: "595 50",
    ort: "Mjölby",
    telefon: fejkTelefon(18),
    epost: "projekt@example.com",
    omvandByggmoms: true,
  },
  {
    // Omvänd byggmoms men momsreg.nr saknas – fakturan kan inte utfärdas
    id: "takab",
    typ: "foretag",
    namn: "Nils Hedberg",
    foretagsnamn: "Vadstena Tak & Plåt AB",
    kontaktperson: "Nils Hedberg",
    orgNummer: fejkOrgNummer("559402", "718"),
    adress: "Hamngatan 4",
    postnummer: "592 31",
    ort: "Vadstena",
    telefon: fejkTelefon(19),
    epost: "nils@example.com",
    omvandByggmoms: true,
  },
];

const byggab = kunder.find((k) => k.id === "byggab");
byggab.momsNummer = momsNummerFor(byggab.orgNummer);

// ------------------------------------------------------------
// Jobb – täcker alla statusar, ROT, fast pris, följ upp (passerad och
// kommande), övriga kostnader, meter-artiklar och ett jobb utan kund.
// ------------------------------------------------------------

const TIMPRIS = 650;
const MIL = 6.5; // kr/km

const jobb = [
  {
    id: "vvb-lars",
    faktura: dag(-36),
    kund: "lars",
    skapad: skapad(-41),
    rotAvdrag: true,
    utfort: true,
    fakturerat: true,
    betalt: true,
    planeratArbete: "Byta varmvattenberedare i pannrummet, gamla läcker i botten.",
    utfortArbete:
      "Demonterat gammal beredare 200 l. Monterat ny 300 l med ny säkerhetsventil och blandningsventil. Provtryckt och kontrollerat.",
    artiklar: [
      AHL.beredare300(),
      AHL.sakerhetsventil9bar(),
      AHL.blandningsventil22(),
      AHL.kopparror22(3.5),
      AHL.klamring22(6),
    ],
    arbetspass: [
      { datum: dag(-38), timmar: 6 },
      { datum: dag(-37), timmar: 3.5 },
    ],
    resor: [
      { datum: dag(-38), stracka: 12 },
      { datum: dag(-37), stracka: 12 },
    ],
  },
  {
    id: "blandare-maria",
    kund: "maria",
    skapad: skapad(-6, 10),
    rotAvdrag: true,
    utfort: true,
    planeratArbete:
      "Köksblandaren droppar. Byta till blandare med diskmaskinsavstängning och ansluta kundens nya diskmaskin.",
    utfortArbete:
      "Bytt köksblandare och vattenlås. Anslutit diskmaskinen till blandarens avstängning och vattenlåsets avloppsanslutning. Lagt golvskydd under maskinen.",
    artiklar: [
      AHL.koksblandareOras(),
      AHL.kommodvattenlas(),
      AHL.golvskyddDiskmaskin(),
    ],
    arbetspass: [{ datum: dag(-4), timmar: 3 }],
    resor: [{ datum: dag(-4), stracka: 18 }],
  },
  {
    id: "badrum-erik",
    kund: "erik",
    skapad: skapad(-21, 7),
    rotAvdrag: true,
    pagaende: true,
    planeratArbete:
      "Badrumsrenovering: riva gammalt, flytta golvbrunn, nya rör i vägg, montera WC, handfat och duschblandare. Plattsättare kommer v. 49.",
    utfortArbete: "Rivning klar. Golvbrunn flyttad och ingjuten. Rördragning i vägg klar.",
    internaAnteckningar: "Plattsättare: Jonas, ring innan vi stänger väggen.",
    artiklar: [
      AHL.golvbrunn(),
      AHL.pexRorIRor(24),
      AHL.fordelarskap(),
      AHL.fordelare(),
      AHL.avloppsror110(3),
      { namn: "Vägghängd WC med fixtur", aterforsaljare: "Bauhaus", inkopspris: 4990, pris: 5990, antal: 1, enhet: "ST" },
    ],
    ovrigaKostnader: [
      { beskrivning: "Container för rivningsmassor", pris: 1850 },
      { beskrivning: "Hyra av bilningsmaskin, 1 dag", pris: 650 },
    ],
    arbetspass: [
      { datum: dag(-18), timmar: 8 },
      { datum: dag(-17), timmar: 7.5 },
      { datum: dag(-14), timmar: 6 },
      { datum: dag(-10), timmar: 8 },
      { datum: dag(-3), timmar: 4.5 },
    ],
    resor: [
      { datum: dag(-18), stracka: 26 },
      { datum: dag(-17), stracka: 26 },
      { datum: dag(-14), stracka: 26 },
      { datum: dag(-10), stracka: 26 },
      { datum: dag(-3), stracka: 26 },
    ],
  },
  {
    id: "avlopp-gunilla",
    faktura: dag(-30),
    kund: "gunilla",
    skapad: skapad(-33, 14),
    rotAvdrag: true,
    utfort: true,
    fakturerat: true,
    foljUpp: true,
    foljUppDatum: dag(-3),
    planeratArbete: "Stopp i avloppet från tvättstugan.",
    utfortArbete: "Spolat avloppsledning från tvättstuga till brunn. Bytt trasig rensbar golvbrunnssil.",
    internaAnteckningar: "Fakturan obetald – ring Gunilla och påminn.",
    artiklar: [
      AHL.golvbrunnssil(),
    ],
    arbetspass: [{ datum: dag(-31), timmar: 2.5 }],
    resor: [{ datum: dag(-31), stracka: 4 }],
  },
  {
    id: "golvvarme-johan",
    kund: "johan",
    skapad: skapad(-2, 16),
    foljUpp: true,
    foljUppDatum: dag(5),
    planeratArbete:
      "Offert vattenburen golvvärme i nybyggd tillbyggnad ca 35 m². Kunden vill ha pris med och utan ny shuntgrupp.",
    internaAnteckningar: "Mät upp på plats innan offert. Kunden jobbar dagtid, bäst efter kl. 16.",
  },
  {
    id: "wc-fatima",
    kund: "fatima",
    skapad: skapad(-1, 9),
    planeratArbete: "Byta toalettstol, gamla har spricka i foten. Kunden vill ha en med mjukstängande sits.",
  },
  {
    id: "vp-perolof",
    faktura: dag(-24),
    kund: "perolof",
    skapad: skapad(-27, 8),
    rotAvdrag: true,
    utfort: true,
    fakturerat: true,
    betalt: true,
    // Material 6 298,77 kr (5 400,53 + 898,24) + 4 120 kr arbete ≈ 10 420 kr.
    // ROT räknas bara på arbetet.
    fastPris: 10420,
    fastPrisArbete: 4120,
    planeratArbete: "Service av bergvärmepump och byte av cirkulationspump.",
    utfortArbete:
      "Service utförd: filter rengjorda, tryck kontrollerat, köldbärare påfylld. Bytt cirkulationspump på värmesidan.",
    artiklar: [
      AHL.cirkulationspump(),
      AHL.koldbararsprit(),
    ],
    arbetspass: [{ datum: dag(-25), timmar: 4 }],
    resor: [{ datum: dag(-25), stracka: 34 }],
  },
  {
    id: "frost-perolof",
    kund: "perolof",
    skapad: skapad(-8, 6),
    utfort: true,
    planeratArbete: "Frostsprängt vattenrör i stallet.",
    utfortArbete: "Bytt 2 m frostsprängt rör och isolerat ledningen. Monterat värmekabel.",
    internaAnteckningar: "Kunden vill ha fakturan efter nyår.",
    artiklar: [
      AHL.pemRor32(2),
      AHL.varmekabel(),
      AHL.rorisolering32(4),
    ],
    arbetspass: [{ datum: dag(-8), timmar: 3 }],
    resor: [{ datum: dag(-8), stracka: 34 }],
  },
  {
    id: "diskmaskin-sofia",
    kund: "sofia",
    skapad: skapad(-3, 11),
    pagaende: true,
    planeratArbete: "Installera diskmaskin, dra nytt kallvatten och avlopp till ny plats i köket.",
    utfortArbete: "Kallvatten framdraget. Väntar på att köksbänken monteras.",
    artiklar: [
      AHL.diskmaskinsventil(),
      AHL.grenrorDiskmaskin(),
      AHL.golvskyddDiskmaskin(),
      AHL.kopparror15(2.5),
    ],
    arbetspass: [{ datum: dag(-2), timmar: 1.5 }],
    resor: [{ datum: dag(-2), stracka: 16 }],
  },
  {
    id: "ventiler-brf",
    kund: "brf",
    skapad: skapad(-12, 7),
    pagaende: true,
    foljUpp: true,
    foljUppDatum: dag(10),
    planeratArbete: "Byta avstängningsventiler i trapphus A, B och C. Vatten stängs av kl. 9–12, styrelsen aviserar.",
    utfortArbete: "Trapphus A och B klara.",
    internaAnteckningar: "Boka in trapphus C med Kent – han vill ha lapp i trapphuset en vecka innan.",
    artiklar: [
      AHL.kulventil28(8),
      AHL.kulventil22(12),
      AHL.kopparror28(6),
    ],
    arbetspass: [
      { datum: dag(-9), timmar: 7 },
      { datum: dag(-5), timmar: 6.5 },
    ],
    resor: [
      { datum: dag(-9), stracka: 3 },
      { datum: dag(-5), stracka: 3 },
    ],
  },
  {
    id: "undercentral-brf",
    faktura: dag(-57),
    kund: "brf",
    skapad: skapad(-60, 9),
    utfort: true,
    fakturerat: true,
    betalt: true,
    planeratArbete: "Årlig service av fjärrvärmens undercentral.",
    utfortArbete: "Service utförd. Bytt säkerhetsventil på värmesidan. Inga anmärkningar.",
    artiklar: [
      AHL.sakerhetsventilVarme(),
    ],
    arbetspass: [{ datum: dag(-58), timmar: 3 }],
    resor: [{ datum: dag(-58), stracka: 3 }],
  },
  {
    id: "fettavskiljare-bageri",
    kund: "bageri",
    skapad: skapad(-4, 13),
    foljUpp: true,
    foljUppDatum: dag(2),
    planeratArbete: "Ny fettavskiljare enligt kommunens krav. Kräver bygganmälan – kunden fixar den.",
    internaAnteckningar: "Kolla leveranstid på avskiljaren innan vi lovar datum.",
  },
  {
    id: "lacka-fastigheter",
    faktura: dag(-14),
    kund: "fastigheter",
    skapad: skapad(-15, 8),
    utfort: true,
    fakturerat: true,
    planeratArbete: "Läckage från lägenhet 3 ner i lägenhet 1, Storgatan 31.",
    utfortArbete: "Lokaliserat läcka i rörgenomföring i badrum lgh 3. Bytt genomföring och tätat. Fuktmätt – torkas av försäkringsbolaget.",
    artiklar: [
      AHL.rorgenomforing(2),
      AHL.silikon(),
    ],
    ovrigaKostnader: [{ beskrivning: "Jourtillägg kväll", pris: 950 }],
    arbetspass: [{ datum: dag(-15), timmar: 2.75 }],
    resor: [{ datum: dag(-15), stracka: 22 }],
  },
  {
    id: "blandare-pensionat",
    kund: "pensionat",
    skapad: skapad(-9, 8),
    pagaende: true,
    // Material 21 840,60 kr + arbete ca 11 700 kr (18 h)
    fastPris: 33500,
    planeratArbete: "Byta tvättställsblandare och duschblandare i 6 rum. Fast pris enligt offert.",
    utfortArbete: "Rum 1–4 klara.",
    artiklar: [
      AHL.tvattstallsblandare(6),
      AHL.duschblandare(6),
    ],
    arbetspass: [
      { datum: dag(-7), timmar: 7 },
      { datum: dag(-6), timmar: 5 },
    ],
    resor: [
      { datum: dag(-7), stracka: 28 },
      { datum: dag(-6), stracka: 28 },
    ],
  },
  {
    id: "jour-utan-kund",
    kund: null,
    skapad: skapad(-11, 21),
    utfort: true,
    planeratArbete: "Jour: vattenläcka i källare.",
    utfortArbete: "Stängt av huvudkran och bytt sprucken koppling.",
    anteckningar: "Kunden ej registrerad – lägg upp kund innan fakturering.",
    artiklar: [
      AHL.klamring15(2),
    ],
    arbetspass: [{ datum: dag(-11), timmar: 1.5 }],
    resor: [{ datum: dag(-11), stracka: 9 }],
  },
  {
    // Markerat fakturerat utan utfärdad faktura – statistiken räknar det inte
    id: "manuell-bageri",
    kund: "bageri",
    skapad: skapad(-50, 9),
    utfort: true,
    fakturerat: true,
    planeratArbete: "Byte av varmvattenberedare i bageriets disk.",
    utfortArbete: "Bytt beredare 100 l.",
    anteckningar: "Fakturerad för hand i Excel innan appen fanns.",
    artiklar: [AHL.beredare100()],
    arbetspass: [{ datum: dag(-48), timmar: 3 }],
    resor: [{ datum: dag(-48), stracka: 4 }],
  },

  // ---------- ROT-taket ----------
  // Anders har i år fått 16 575 + 24 000 = 40 575 kr i ROT. Köksjobbet ger
  // 10 725 kr till → 51 300 kr, över taket på 50 000 kr: varningen syns i
  // jobbformuläret och på fakturasidan.
  {
    id: "badrum-anders",
    kund: "anders",
    skapad: skapadFore(iAr(7, 6), 10),
    rotAvdrag: true,
    utfort: true,
    fakturerat: true,
    betalt: true,
    planeratArbete: "Totalrenovering av badrum på övervåningen, VVS-delen.",
    utfortArbete:
      "Rivit gammalt, nya tappvattenrör och avlopp i vägg, ny golvbrunn, monterat WC, tvättställ, duschblandare och handdukstork.",
    artiklar: [
      AHL.golvbrunn(),
      AHL.pexRorIRor(30),
      AHL.fordelarskap(),
      AHL.fordelare(),
      AHL.wcFixtur(),
      AHL.wcSkalVagg(),
      AHL.duschblandare(),
      AHL.handdukstork(),
    ],
    ...flerDagar(iAr(7, 6), [8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5], 22),
    faktura: plusDagar(iAr(7, 6), 10),
  },
  {
    id: "bergvarme-anders",
    kund: "anders",
    skapad: skapadFore(iAr(3, 12), 20),
    rotAvdrag: true,
    utfort: true,
    fakturerat: true,
    betalt: true,
    // Material 103 629,29 kr + 64 000 kr arbete ≈ 167 630 kr
    fastPris: 167630,
    // ROT: 64 000 × 1,25 × 30 % = 24 000 kr
    fastPrisArbete: 64000,
    planeratArbete: "Byte från oljepanna till bergvärme. Borrning görs av annan firma.",
    utfortArbete:
      "Demonterat oljepanna. Installerat bergvärmepump 8 kW med inbyggd beredare, anslutit kollektor och värmesystem. Injusterat och provkört.",
    artiklar: [
      AHL.bergvarmepump(),
      AHL.expansionskarl(),
      AHL.koldbararsprit(3),
      AHL.kopparror28(10),
      AHL.kulventil28(4),
    ],
    ...flerDagar(iAr(3, 12), [9, 9, 8, 6], 22),
    faktura: plusDagar(iAr(3, 12), 4),
  },
  {
    id: "kok-anders",
    kund: "anders",
    skapad: skapad(-20, 7),
    rotAvdrag: true,
    utfort: true,
    planeratArbete: "VVS till nytt kök och flytt av tvättstugan till källaren.",
    utfortArbete:
      "Dragit nya rör till kök, anslutit diskbänk och diskmaskin. Flyttat tvättmaskin, ny golvbrunn och tvättränna i källaren.",
    internaAnteckningar: "Kunden är nära ROT-taket – prata om att dela avdraget med frun.",
    artiklar: [
      AHL.koksblandareGbg(),
      AHL.kommodvattenlas(),
      AHL.golvskyddDiskmaskin(),
      AHL.golvbrunn(),
      AHL.tvattranna(),
      AHL.pexRorIRor(18),
    ],
    // 44 h × 650 × 1,25 × 30 % = 10 725 kr ROT
    ...flerDagar(dag(-14), [8, 9, 9, 9, 9], 22),
  },
  {
    // Erik: 33 000 kr i ROT i år + badrumsjobbet (34 h, 8 287,50 kr) → nära taket
    id: "radiatorer-erik",
    kund: "erik",
    skapad: skapadFore(iAr(5, 14), 15),
    rotAvdrag: true,
    utfort: true,
    fakturerat: true,
    betalt: true,
    // Material 42 062,89 kr + 88 000 kr arbete ≈ 130 060 kr
    fastPris: 130060,
    // ROT: 88 000 × 1,25 × 30 % = 33 000 kr
    fastPrisArbete: 88000,
    planeratArbete: "Byte av alla radiatorer och nya rör i hela huset.",
    utfortArbete:
      "Bytt 9 radiatorer med termostatventiler, dragit nya rör i hela huset, spolat och injusterat systemet.",
    artiklar: [
      AHL.radiator(9),
      AHL.termostatventil(9),
      AHL.kopparror15(19),
    ],
    ...flerDagar(iAr(5, 14), [8, 8, 8, 8, 8], 26),
    faktura: plusDagar(iAr(5, 14), 7),
  },

  // ---------- Omvänd byggmoms ----------
  {
    id: "ue-lagenheter-byggab",
    kund: "byggab",
    ...avslutat({
      datum: manad(11, 10),
      planeratArbete: "UE: VVS i 4 lägenheter, Hamngatan 12 i Mjölby.",
      utfortArbete: "Rördragning, golvbrunnar och montering av porslin i 4 lägenheter.",
      artiklar: [
        AHL.golvbrunn(4),
        AHL.wcFixtur(4),
        AHL.wcSkalVagg(4),
        AHL.pexRorIRor(80),
      ],
      ...flerDagar(manad(11, 10), [8, 8, 8, 8, 8], 30),
    }),
  },
  {
    id: "ue-radhus-byggab",
    kund: "byggab",
    ...avslutat({
      datum: manad(5, 12),
      planeratArbete: "UE: rördragning radhus etapp 2, 6 hus.",
      utfortArbete: "Tappvatten och avlopp i 6 radhus. Provtryckt.",
      artiklar: [
        AHL.fordelarskap(6),
        AHL.fordelare(6),
        AHL.pexRorIRor(140),
        AHL.avloppsror110(18),
      ],
      ...flerDagar(manad(5, 12), [8, 8, 8, 8, 8, 8, 8], 30),
    }),
  },
  {
    // Obetald och förfallen
    id: "ue-lokal-byggab",
    kund: "byggab",
    ...avslutat({
      datum: manad(1, 6),
      betalt: false,
      planeratArbete: "UE: VVS i ny lunchlokal, Tuna industriområde.",
      utfortArbete: "Diskbänk, diskmaskin, varmvattenberedare och två WC.",
      artiklar: [
        AHL.beredare100(),
        AHL.wcFixtur(2),
        AHL.wcSkalVagg(2),
        AHL.koksblandareOras(),
        AHL.kommodvattenlas(),
        AHL.golvskyddDiskmaskin(),
      ],
      ...flerDagar(manad(1, 6), [9, 9], 30),
    }),
  },
  {
    // Inte fakturerat än – förhandsgranskningen visar 0 kr moms
    id: "ue-villa-byggab",
    kund: "byggab",
    skapad: skapad(-10, 7),
    utfort: true,
    planeratArbete: "UE: VVS i nybyggd villa, Lillgatan 3 i Skänninge.",
    utfortArbete: "Komplett VVS-installation enligt ritning.",
    artiklar: [
      AHL.golvvarmeror(300),
      AHL.golvvarmefordelare6(),
      AHL.beredare200(),
    ],
    ...flerDagar(dag(-8), [8, 8, 8, 6], 16),
  },
  {
    // Omvänd byggmoms utan momsreg.nr – fakturan kan inte utfärdas
    id: "takavvattning-takab",
    kund: "takab",
    skapad: skapad(-6, 13),
    utfort: true,
    planeratArbete: "UE: anslutning av stuprör till dagvatten, Klosterområdet.",
    utfortArbete: "Anslutit 4 stuprör till dagvattenledning.",
    anteckningar: "Kundens momsreg.nr saknas – fråga Nils.",
    artiklar: [AHL.dagvattenror110(2)],
    arbetspass: [{ datum: dag(-5), timmar: 5 }],
    resor: [{ datum: dag(-5), stracka: 28 }],
  },

  // ---------- Kreditfaktura ----------
  {
    // Fakturerades först med 9 timmar för mycket, krediterades och
    // fakturerades på nytt.
    id: "pumpar-fastigheter",
    kund: "fastigheter",
    ...avslutat({
      datum: manad(2, 9),
      planeratArbete: "Byte av cirkulationspumpar i undercentralen, Storgatan 31.",
      utfortArbete: "Bytt två cirkulationspumpar och injusterat.",
      anteckningar: "Första fakturan hade 9 timmar för mycket – krediterad.",
      artiklar: [AHL.cirkulationspump(2)],
      ...flerDagar(manad(2, 9), [6, 6], 22),
    }),
    kreditering: { extraTimmar: 9, dagarEfter: 8 },
  },

  // ---------- Historik för statistiken (förra året och i år) ----------
  {
    id: "h-blandare-lars",
    kund: "lars",
    rotAvdrag: true,
    ...avslutat({
      datum: manad(16, 12),
      timmar: 2,
      km: 12,
      planeratArbete: "Byte av duschblandare.",
      utfortArbete: "Bytt duschblandare till termostatblandare.",
      artiklar: [AHL.duschblandare()],
    }),
  },
  {
    id: "h-disk-bageri",
    kund: "bageri",
    ...avslutat({
      datum: manad(15, 8),
      timmar: 3.5,
      km: 4,
      planeratArbete: "Stopp i avloppet från disken.",
      utfortArbete: "Spolat avlopp och bytt vattenlås.",
      artiklar: [AHL.kommodvattenlas(2)],
    }),
  },
  {
    id: "h-stam-fastigheter",
    kund: "fastigheter",
    ...avslutat({
      datum: manad(14, 20),
      planeratArbete: "Förberedelse inför stambyte, Storgatan 31.",
      utfortArbete: "Inventerat stammar, monterat nya avstängningsventiler i källaren.",
      artiklar: [AHL.kulventil28(6), AHL.kopparror28(8)],
      ...flerDagar(manad(14, 20), [8, 8], 22),
    }),
  },
  {
    id: "h-element-gunilla",
    kund: "gunilla",
    rotAvdrag: true,
    ...avslutat({
      datum: manad(13, 3),
      timmar: 4,
      km: 4,
      planeratArbete: "Byta element i vardagsrummet.",
      utfortArbete: "Bytt radiator och termostatventil.",
      artiklar: [AHL.radiator(), AHL.termostatventil()],
    }),
  },
  {
    id: "h-kok-pensionat",
    kund: "pensionat",
    ...avslutat({
      datum: manad(12, 15),
      timmar: 5,
      km: 28,
      planeratArbete: "Nya avstängningsventiler i köket.",
      utfortArbete: "Bytt 6 ventiler under diskbänkar och spis.",
      artiklar: [AHL.kulventil22(6)],
    }),
  },
  {
    id: "h-frusen-pensionat",
    kund: "pensionat",
    ...avslutat({
      datum: manad(10, 14),
      timmar: 3,
      km: 28,
      planeratArbete: "Frusen ledning i tvättstugan.",
      utfortArbete: "Tinat och isolerat ledningen.",
      artiklar: [AHL.rorisolering22(6)],
    }),
  },
  {
    id: "h-kallare-brf",
    kund: "brf",
    ...avslutat({
      datum: manad(9, 5),
      timmar: 6,
      km: 3,
      planeratArbete: "Läcka i källaren.",
      utfortArbete: "Bytt 1,5 m kopparrör och två kopplingar.",
      artiklar: [AHL.kopparror22(1.5), AHL.klamring22(2)],
    }),
  },
  {
    id: "h-wc-maria",
    kund: "maria",
    rotAvdrag: true,
    ...avslutat({
      datum: manad(9, 22),
      timmar: 3,
      km: 18,
      planeratArbete: "Byte av toalettstol.",
      utfortArbete: "Monterat ny toalettstol med ny WC-anslutning och avstängningsventil.",
      artiklar: [AHL.wcIfo(), AHL.wcAnslutning(), AHL.wcAvstangning(), AHL.silikon()],
    }),
  },
  {
    id: "h-beredare-fastigheter",
    kund: "fastigheter",
    ...avslutat({
      datum: manad(8, 11),
      timmar: 5,
      km: 22,
      planeratArbete: "Byte av varmvattenberedare i tvättstugan.",
      utfortArbete: "Bytt beredare 200 l.",
      artiklar: [AHL.beredare200()],
    }),
  },
  {
    id: "h-blandare-bageri",
    kund: "bageri",
    ...avslutat({
      datum: manad(6, 4),
      timmar: 4,
      km: 4,
      planeratArbete: "Byta blandare och vattenlås i disken.",
      utfortArbete: "Bytt två blandare och vattenlås.",
      artiklar: [AHL.koksblandareUtanDm(2)],
    }),
  },
  {
    id: "h-utekran-lars",
    kund: "lars",
    rotAvdrag: true,
    ...avslutat({
      datum: manad(4, 8),
      timmar: 2,
      km: 12,
      planeratArbete: "Frostfri utekran.",
      utfortArbete: "Monterat frostfri utekran på baksidan.",
      artiklar: [AHL.utekran()],
    }),
  },
  {
    id: "h-cirkpump-pensionat",
    kund: "pensionat",
    ...avslutat({
      datum: manad(1, 20),
      betalt: false,
      timmar: 3,
      km: 28,
      planeratArbete: "Varmvattencirkulationen fungerar dåligt.",
      utfortArbete: "Bytt VVC-pump.",
      artiklar: [AHL.vvcPump()],
    }),
  },
];

// ------------------------------------------------------------
// Offerter – alla statusar, ROT, fast pris, en som har gått ut, en till
// företagskund och en som redan har gjorts om till jobb.
//
// Testofferterna har nummer från 9001 och tar inget nummer ur företagets
// nummerserie, så att den första riktiga offerten fortfarande blir nr 1.
// ------------------------------------------------------------

const offerter = [
  {
    id: "golvvarme-johan",
    nummer: 9001,
    kund: "johan",
    status: "skickad",
    offertdatum: dag(-1),
    giltigTill: dag(29),
    rotAvdrag: true,
    beraknadeTimmar: 22,
    beraknadStracka: 78,
    beskrivning:
      "Vattenburen golvvärme i tillbyggnad ca 35 m². Läggning av golvvärmerör på isolering, ny fördelare med ställdon och anslutning till befintlig panna via ny shuntgrupp. Provtryckning och injustering.",
    villkor:
      "Gjutning och golvbeläggning ingår inte. Eventuella tilläggsarbeten debiteras löpande enligt timpris.",
    internaAnteckningar: "Utan shuntgrupp blir det ca 4 800 kr billigare – kunden funderar.",
    artiklar: [
      AHL.golvvarmeror(220),
      AHL.golvvarmefordelare4(),
      AHL.shuntgrupp(),
      AHL.rumstermostat(2),
    ],
  },
  {
    id: "wc-fatima",
    nummer: 9002,
    kund: "fatima",
    status: "utkast",
    offertdatum: dag(0),
    giltigTill: dag(30),
    rotAvdrag: true,
    // Material 4 406,03 kr (utpris) + arbete 3 400 kr ≈ 7 900 kr
    fastPris: 7900,
    // ROT räknas bara på arbetsdelen av det fasta priset
    fastPrisArbete: 3400,
    beskrivning:
      "Byte av toalettstol. Demontering och bortforsling av gammal toalett, montering av ny golvstående toalett med mjukstängande sits och ny anslutning till avlopp och kallvatten.",
    villkor: "Fast pris inklusive material.",
    artiklar: [
      AHL.wcAcoll(),
      AHL.wcSitsSoftClose(),
      AHL.wcAnslutning(),
      AHL.wcAvstangning(),
      AHL.silikon(),
    ],
  },
  {
    // Toalett, köksblandare och diskmaskin i samma offert, löpande räkning
    id: "kok-wc-gunilla",
    nummer: 9007,
    kund: "gunilla",
    status: "skickad",
    offertdatum: dag(-2),
    giltigTill: dag(28),
    rotAvdrag: true,
    beraknadeTimmar: 7,
    beraknadStracka: 8,
    beskrivning:
      "Byte av toalettstol i nedre WC med ny WC-anslutning och avstängningsventil. Ny köksblandare med diskmaskinsavstängning, nytt vattenlås med avloppsanslutning och installation av diskmaskin med golvskydd.",
    villkor:
      "Diskmaskinen köps av kunden. Arbetet debiteras löpande; beräknad tid är en uppskattning.",
    internaAnteckningar: "Gunilla vill helst ha det gjort före jul.",
    artiklar: [
      AHL.wcIfo(),
      AHL.wcAnslutning(),
      AHL.wcAvstangning(),
      AHL.silikon(),
      AHL.koksblandareOras(),
      AHL.kommodvattenlas(),
      AHL.golvskyddDiskmaskin(),
    ],
  },
  {
    id: "fettavskiljare-bageri",
    nummer: 9003,
    kund: "bageri",
    status: "skickad",
    // Har gått ut utan svar
    offertdatum: dag(-45),
    giltigTill: dag(-15),
    beraknadeTimmar: 16,
    beraknadStracka: 20,
    beskrivning:
      "Installation av fettavskiljare enligt kommunens krav, med anslutning till befintligt spillvatten från bageriets disk och degberedning.",
    villkor:
      "Bygganmälan görs av beställaren. Grävning och återfyllning ingår inte.",
    artiklar: [
      AHL.fettavskiljare(),
      AHL.avloppsror110(4),
    ],
    ovrigaKostnader: [{ beskrivning: "Frakt fettavskiljare", pris: 1450 }],
  },
  {
    id: "badrum-erik",
    nummer: 9004,
    kund: "erik",
    // Kunden tackade ja – jobbet finns bland testjobben
    jobb: "badrum-erik",
    status: "accepterad",
    offertdatum: dag(-30),
    giltigTill: dag(0),
    rotAvdrag: true,
    beraknadeTimmar: 36,
    beraknadStracka: 130,
    beskrivning:
      "Badrumsrenovering, VVS-delen: rivning av gammalt, flytt av golvbrunn, nya rör i vägg med fördelarskåp, montering av vägghängd WC, handfat och duschblandare.",
    villkor: "Plattsättning ingår inte och utförs av annan entreprenör.",
    artiklar: [
      AHL.golvbrunn(),
      AHL.pexRorIRor(24),
      AHL.fordelarskap(),
      AHL.fordelare(),
      { namn: "Vägghängd WC med fixtur", aterforsaljare: "Bauhaus", inkopspris: 4990, pris: 5990, antal: 1, enhet: "ST" },
    ],
    ovrigaKostnader: [{ beskrivning: "Container för rivningsmassor", pris: 1850 }],
  },
  {
    id: "varmepump-perolof",
    nummer: 9005,
    kund: "perolof",
    status: "avbojd",
    offertdatum: dag(-20),
    giltigTill: dag(10),
    rotAvdrag: true,
    fastPris: 94500,
    fastPrisArbete: 28000,
    beskrivning:
      "Byte av oljepanna mot luft/vatten-värmepump 12 kW med inomhusdel och 180 l varmvattenberedare. Demontering av oljepanna och oljetank ingår.",
    internaAnteckningar: "Kunden valde en annan firma – billigare men utan tanksanering.",
  },
  {
    // Omvänd byggmoms – offerten blir utan moms
    id: "ue-forskola-byggab",
    nummer: 9006,
    kund: "byggab",
    status: "skickad",
    offertdatum: dag(-3),
    giltigTill: dag(27),
    beraknadeTimmar: 120,
    beraknadStracka: 300,
    beskrivning:
      "UE: VVS-installation i ny förskola, Väderstad. Tappvatten, avlopp, golvvärme och anslutning av storköksutrustning.",
    villkor: "Omvänd betalningsskyldighet för byggtjänster gäller.",
    artiklar: [
      AHL.golvvarmeror(900),
      AHL.golvvarmefordelare6(3),
      AHL.wcFixtur(6),
      AHL.wcSkalVagg(6),
    ],
  },
];

// ------------------------------------------------------------
// Körning
// ------------------------------------------------------------

async function taBortTestdata() {
  // Testofferter och offerter som gjorts i appen till testkunder. Tas bort
  // före kunderna – annars blir de kvar utan kund (onDelete: SetNull).
  const o = await prisma.offert.deleteMany({
    where: {
      OR: [
        { id: { startsWith: PREFIX } },
        { customerId: { startsWith: PREFIX } },
      ],
    },
  });
  // Fakturor som utfärdats på testjobb i appen. Tas bort först – annars blir
  // de kvar utan jobb och kund (onDelete: SetNull). Fakturanumren återanvänds
  // inte: nästa fakturanummer i företagsuppgifterna ändras inte.
  const f = await prisma.faktura.deleteMany({
    where: {
      OR: [
        { jobId: { startsWith: PREFIX } },
        { customerId: { startsWith: PREFIX } },
      ],
    },
  });
  // Underrader (artiklar, resor, arbetspass …) följer med via onDelete: Cascade
  const j = await prisma.job.deleteMany({ where: { id: { startsWith: PREFIX } } });
  const k = await prisma.customer.deleteMany({ where: { id: { startsWith: PREFIX } } });
  return { fakturor: f.count, offerter: o.count, jobb: j.count, kunder: k.count };
}

async function laggIn() {
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Inget företag i databasen. Logga in i appen en gång först.");
  }

  const borttaget = await taBortTestdata();
  if (borttaget.jobb || borttaget.kunder || borttaget.fakturor || borttaget.offerter) {
    console.log(`Tog bort gammal testdata: ${borttaget.kunder} kunder, ${borttaget.jobb} jobb, ${borttaget.offerter} offerter, ${borttaget.fakturor} fakturor.`);
  }

  for (const k of kunder) {
    await prisma.customer.create({
      data: { ...k, id: PREFIX + "kund-" + k.id, companyId: company.id },
    });
  }

  for (const j of jobb) {
    const { id, kund, artiklar = [], resor = [], arbetspass = [], ovrigaKostnader = [], ...falt } = j;
    // Fakturorna skapas efter jobben (utfardaTestfakturor) – inga kolumner på jobbet
    delete falt.faktura;
    delete falt.kreditering;
    await prisma.job.create({
      data: {
        ...falt,
        id: PREFIX + "jobb-" + id,
        companyId: company.id,
        customerId: kund ? PREFIX + "kund-" + kund : null,
        timpris: TIMPRIS,
        milersattning: MIL,
        artiklar: { create: artiklar },
        resor: { create: resor },
        arbetspass: { create: arbetspass },
        ovrigaKostnader: { create: ovrigaKostnader },
      },
    });
  }

  for (const o of offerter) {
    const { id, nummer, kund, jobb: jobbId, artiklar = [], ovrigaKostnader = [], ...falt } = o;
    await prisma.offert.create({
      data: {
        ...falt,
        id: PREFIX + "offert-" + id,
        companyId: company.id,
        offertnummer: nummer,
        customerId: PREFIX + "kund-" + kund,
        jobId: jobbId ? PREFIX + "jobb-" + jobbId : null,
        timpris: TIMPRIS,
        milersattning: MIL,
        artiklar: { create: artiklar.map((a, i) => ({ ...a, ordning: i })) },
        ovrigaKostnader: { create: ovrigaKostnader.map((k, i) => ({ ...k, ordning: i })) },
      },
    });
  }

  const fakturor = await utfardaTestfakturor(company);

  console.log(`Klart: ${kunder.length} testkunder, ${jobb.length} testjobb, ${offerter.length} testofferter och ${fakturor.antal} testfakturor (nr ${fakturor.forsta}–${fakturor.sista}) i "${company.name}".`);
  console.log(`\nROT på utfärdade fakturor i år (tak ${ROT_TAK_KR} kr per person):`);
  for (const [namn, kr] of Object.entries(fakturor.rotIAr)) {
    console.log(`  ${namn}: ${kr.toLocaleString("sv-SE")} kr`);
  }
}

// ------------------------------------------------------------
// Fakturor
//
// Statistiken och ROT-taket räknar bara på utfärdade fakturor, så de
// fakturerade testjobben får riktiga sparade fakturor. De byggs med appens
// egna funktioner (skapaFakturaData, skapaKreditfaktura) – samma belopp som
// om de utfärdats i appen.
//
// Numren tas ur företagets riktiga nummerserie (ett block, i en sats) och
// delas ut i datumordning. Höga testnummer skulle göra att "Nästa
// fakturanummer" inte går att spara under Företag. När testdatan tas bort
// kan nästa fakturanummer sättas tillbaka där.
// ------------------------------------------------------------

/** Ett jobb ur databasen i den form som lib/faktura.ts vill ha (som mapJob). */
function somJob(j) {
  return {
    ...j,
    customerId: j.customerId ?? undefined,
    fastPris: j.fastPris ?? undefined,
    fastPrisArbete: j.fastPrisArbete ?? undefined,
    artiklar: j.artiklar.map((a) => ({ ...a, enhet: a.enhet ?? "" })),
    resor: j.resor.map((r) => ({ ...r, datum: iso(r.datum) })),
    arbetstider: j.arbetspass.map((w) => ({ ...w, datum: iso(w.datum) })),
    skapad: j.skapad.toISOString(),
  };
}

function fakturaRad(companyId, data, koppling, id) {
  return {
    id,
    companyId,
    jobId: koppling.jobId,
    customerId: koppling.customerId,
    krediterarId: koppling.krediterarId ?? null,
    fakturanummer: data.fakturanummer,
    fakturadatum: new Date(data.fakturadatum),
    forfallodatum: new Date(data.forfallodatum),
    utfardad: new Date(`${data.fakturadatum}T09:00:00`),
    exklMomsOre: kronorTillOre(data.summa.exklMoms),
    momsOre: kronorTillOre(data.summa.moms),
    rotAvdragOre: kronorTillOre(data.summa.rotAvdrag),
    attBetalaOre: kronorTillOre(data.summa.attBetala),
    innehall: data,
  };
}

async function utfardaTestfakturor(company) {
  const senast = dag(0);
  const tidigast = (d) => iso(d > senast ? senast : d);

  // Vad som ska utfärdas, i den ordning det hände
  const handelser = [];
  for (const j of jobb) {
    if (!j.faktura) continue;
    const jobId = PREFIX + "jobb-" + j.id;
    const dbJobb = await prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      include: { artiklar: true, resor: true, arbetspass: true, ovrigaKostnader: true, customer: true },
    });
    const job = somJob(dbJobb);
    const fakturaId = PREFIX + "faktura-" + j.id;

    if (j.kreditering) {
      // Första fakturan hade för många timmar
      const fel = {
        ...job,
        arbetstider: [...job.arbetstider, { datum: iso(j.faktura), timmar: j.kreditering.extraTimmar }],
      };
      const kreditdatum = tidigast(plusDagar(j.faktura, j.kreditering.dagarEfter));
      handelser.push(
        { datum: tidigast(j.faktura), typ: "faktura", id: fakturaId + "-fel", job: fel },
        { datum: kreditdatum, typ: "kredit", id: fakturaId + "-kredit", original: fakturaId + "-fel", job },
        { datum: kreditdatum, typ: "faktura", id: fakturaId, job },
      );
    } else {
      handelser.push({ datum: tidigast(j.faktura), typ: "faktura", id: fakturaId, job });
    }
  }
  handelser.sort((a, b) => a.datum.localeCompare(b.datum)); // stabil – kreditfakturan före den nya

  return prisma.$transaction(
    async (tx) => {
      // Reservera hela blocket i en sats – samma princip som appens reserveraFakturanummer
      const [{ forsta }] = await tx.$queryRaw`
        UPDATE company
        SET "nastaFakturanummer" = "nastaFakturanummer" + ${handelser.length}
        WHERE id = ${company.id}
        RETURNING "nastaFakturanummer" - ${handelser.length} AS forsta
      `;

      const sparade = new Map();
      const rotIAr = {};
      const iAr = String(idag.getFullYear());

      for (const [i, h] of handelser.entries()) {
        const nummer = forsta + i;
        const koppling = { jobId: h.job.id, customerId: h.job.customerId ?? null };
        let rad;
        if (h.typ === "kredit") {
          const original = sparade.get(h.original);
          const data = skapaKreditfaktura(original.innehall, { fakturanummer: nummer, fakturadatum: h.datum });
          rad = {
            ...fakturaRad(company.id, data, { ...koppling, krediterarId: original.id }, h.id),
            // Som i krediteraFaktura: originalets ören med ombytt tecken
            exklMomsOre: -original.exklMomsOre,
            momsOre: -original.momsOre,
            rotAvdragOre: -original.rotAvdragOre,
            attBetalaOre: -original.attBetalaOre,
          };
        } else {
          const data = skapaFakturaData(h.job, company, { fakturanummer: nummer, fakturadatum: h.datum });
          rad = fakturaRad(company.id, data, koppling, h.id);
          // Jobbet bär numret på sin gällande faktura
          await tx.job.update({ where: { id: h.job.id }, data: { fakturanummer: nummer } });
        }
        await tx.faktura.create({ data: rad });
        sparade.set(h.id, rad);

        if (h.datum.startsWith(iAr) && rad.rotAvdragOre !== 0 && h.job.customer) {
          const namn = h.job.customer.namn;
          rotIAr[namn] = (rotIAr[namn] ?? 0) + rad.rotAvdragOre / 100;
        }
      }
      return { antal: handelser.length, forsta, sista: forsta + handelser.length - 1, rotIAr };
    },
    { timeout: 60_000 },
  );
}

try {
  if (process.argv.includes("--ta-bort")) {
    const r = await taBortTestdata();
    console.log(`Tog bort ${r.kunder} testkunder, ${r.jobb} testjobb, ${r.offerter} testofferter och ${r.fakturor} testfakturor.`);
    if (r.fakturor) {
      // Testfakturorna tog nummer ur den riktiga serien – säg vad den kan sättas tillbaka till
      const company = await prisma.company.findFirst();
      const [jobbMax, fakturaMax] = await Promise.all([
        prisma.job.aggregate({ where: { companyId: company.id }, _max: { fakturanummer: true } }),
        prisma.faktura.aggregate({ where: { companyId: company.id }, _max: { fakturanummer: true } }),
      ]);
      const lagsta = Math.max(jobbMax._max.fakturanummer ?? 0, fakturaMax._max.fakturanummer ?? 0) + 1;
      if (lagsta < company.nastaFakturanummer) {
        console.log(`Nästa fakturanummer är ${company.nastaFakturanummer}. Utan testdatan kan det sättas till ${lagsta} under Företag.`);
      }
    }
  } else {
    await laggIn();
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
