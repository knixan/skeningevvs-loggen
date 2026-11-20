// Påhittade testkunder och testjobb för utveckling.
//
//   npm run testdata          – lägger in testdatan (tar först bort gammal testdata)
//   npm run testdata:ta-bort  – tar bort all testdata
//
// Allt som skriptet skapar har id som börjar på "testdata-", så borttagningen
// rör aldrig riktiga kunder eller jobb. Ta bort testdatan innan appen används
// på riktigt.
//
// Personerna och företagen är påhittade:
// - personnummer och org.nummer har med flit fel kontrollsiffra, så de kan
//   inte tillhöra någon,
// - telefonnummer ligger i PTS serie för fiktion (070-174 06 05 – 99),
// - e-post går till example.com, som är reserverad för exempel.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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

const idag = new Date();

/** Datum (för @db.Date) n dagar från idag, lokal tid. */
function dag(n) {
  const d = new Date(idag.getFullYear(), idag.getMonth(), idag.getDate() + n);
  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return new Date(s);
}

/** Tidpunkt n dagar tillbaka, kl. h – när jobbet "skapades". */
function skapad(n, h = 8) {
  return new Date(idag.getFullYear(), idag.getMonth(), idag.getDate() + n, h, 15);
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
];

// ------------------------------------------------------------
// Jobb – täcker alla statusar, ROT, fast pris, följ upp (passerad och
// kommande), övriga kostnader, meter-artiklar och ett jobb utan kund.
// ------------------------------------------------------------

const TIMPRIS = 650;
const MIL = 6.5; // kr/km

const jobb = [
  {
    id: "vvb-lars",
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
      { namn: "Varmvattenberedare 300 l", artikelnr: "4417021", aterforsaljare: "Ahlsell", inkopspris: 9850, pris: 12800, antal: 1, enhet: "ST" },
      { namn: "Säkerhetsventil 9 bar 15 mm", artikelnr: "4420355", aterforsaljare: "Ahlsell", inkopspris: 245, pris: 340, antal: 1, enhet: "ST" },
      { namn: "Termostatisk blandningsventil 22 mm", artikelnr: "4421830", aterforsaljare: "Ahlsell", inkopspris: 1180, pris: 1590, antal: 1, enhet: "ST" },
      { namn: "Kopparrör 22 mm", artikelnr: "1203422", aterforsaljare: "Ahlsell", inkopspris: 89, pris: 125, antal: 3.5, enhet: "M" },
      { namn: "Klämringskoppling 22 mm", aterforsaljare: "Ahlsell", inkopspris: 48, pris: 69, antal: 6, enhet: "ST" },
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
    planeratArbete: "Köksblandaren droppar. Byta vattenlås under diskbänken samtidigt.",
    utfortArbete: "Bytt köksblandare och vattenlås. Kunden köpte blandaren själv.",
    anteckningar: "Kunden står för blandaren.",
    artiklar: [
      { namn: "Vattenlås diskbänk 32 mm", aterforsaljare: "Ahlsell", inkopspris: 185, pris: 259, antal: 1, enhet: "ST" },
      { namn: "Flexslang 10 mm 500 mm", aterforsaljare: "Ahlsell", inkopspris: 62.5, pris: 89, antal: 2, enhet: "ST" },
    ],
    arbetspass: [{ datum: dag(-4), timmar: 2.25 }],
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
      { namn: "Golvbrunn 110 mm med klämring", artikelnr: "6012774", aterforsaljare: "Ahlsell", inkopspris: 1420, pris: 1890, antal: 1, enhet: "ST" },
      { namn: "PEX-rör 15 mm i skyddsrör", aterforsaljare: "Ahlsell", inkopspris: 31, pris: 45, antal: 24, enhet: "M" },
      { namn: "Fördelarskåp med 4 utgångar", aterforsaljare: "Ahlsell", inkopspris: 2350, pris: 3150, antal: 1, enhet: "ST" },
      { namn: "Avloppsrör PP 110 mm", aterforsaljare: "Ahlsell", inkopspris: 118, pris: 165, antal: 4.5, enhet: "M" },
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
      { namn: "Sil till golvbrunn 150 mm", aterforsaljare: "Ahlsell", inkopspris: 135, pris: 195, antal: 1, enhet: "ST" },
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
    kund: "perolof",
    skapad: skapad(-27, 8),
    rotAvdrag: true,
    utfort: true,
    fakturerat: true,
    betalt: true,
    fastPris: 8500,
    planeratArbete: "Service av bergvärmepump och byte av cirkulationspump.",
    utfortArbete:
      "Service utförd: filter rengjorda, tryck kontrollerat, köldbärare påfylld. Bytt cirkulationspump på värmesidan.",
    artiklar: [
      { namn: "Cirkulationspump 25-60", artikelnr: "5530118", aterforsaljare: "Ahlsell", inkopspris: 2890, pris: 3790, antal: 1, enhet: "ST" },
      { namn: "Köldbärarvätska 10 l", aterforsaljare: "Ahlsell", inkopspris: 420, pris: 590, antal: 1, enhet: "ST" },
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
      { namn: "PEM-rör 32 mm", aterforsaljare: "Ahlsell", inkopspris: 28, pris: 42, antal: 2, enhet: "M" },
      { namn: "Värmekabel 4 m med termostat", aterforsaljare: "Ahlsell", inkopspris: 690, pris: 950, antal: 1, enhet: "ST" },
      { namn: "Rörisolering 32 mm", aterforsaljare: "Ahlsell", inkopspris: 39, pris: 55, antal: 4, enhet: "M" },
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
      { namn: "Diskmaskinsventil 15 mm", aterforsaljare: "Ahlsell", inkopspris: 165, pris: 235, antal: 1, enhet: "ST" },
      { namn: "Kopparrör 15 mm", aterforsaljare: "Ahlsell", inkopspris: 59, pris: 85, antal: 2.5, enhet: "M" },
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
      { namn: "Kulventil 28 mm", artikelnr: "4402128", aterforsaljare: "Ahlsell", inkopspris: 312, pris: 430, antal: 8, enhet: "ST" },
      { namn: "Kulventil 22 mm", artikelnr: "4402122", aterforsaljare: "Ahlsell", inkopspris: 198, pris: 275, antal: 12, enhet: "ST" },
      { namn: "Kopparrör 28 mm", aterforsaljare: "Ahlsell", inkopspris: 118, pris: 165, antal: 6, enhet: "M" },
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
    kund: "brf",
    skapad: skapad(-60, 9),
    utfort: true,
    fakturerat: true,
    betalt: true,
    planeratArbete: "Årlig service av fjärrvärmens undercentral.",
    utfortArbete: "Service utförd. Bytt packning på värmeväxlare. Inga anmärkningar.",
    artiklar: [
      { namn: "Packningssats värmeväxlare", aterforsaljare: "Ahlsell", inkopspris: 540, pris: 720, antal: 1, enhet: "ST" },
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
    kund: "fastigheter",
    skapad: skapad(-15, 8),
    utfort: true,
    fakturerat: true,
    planeratArbete: "Läckage från lägenhet 3 ner i lägenhet 1, Storgatan 31.",
    utfortArbete: "Lokaliserat läcka i rörgenomföring i badrum lgh 3. Bytt genomföring och tätat. Fuktmätt – torkas av försäkringsbolaget.",
    artiklar: [
      { namn: "Rörgenomföring våtrum 15 mm", aterforsaljare: "Ahlsell", inkopspris: 89, pris: 129, antal: 2, enhet: "ST" },
      { namn: "Våtrumssilikon", aterforsaljare: "Ahlsell", inkopspris: 95, pris: 139, antal: 1, enhet: "ST" },
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
    fastPris: 18400,
    planeratArbete: "Byta tvättställsblandare och duschset i 6 rum. Fast pris enligt offert.",
    utfortArbete: "Rum 1–4 klara.",
    artiklar: [
      { namn: "Tvättställsblandare", aterforsaljare: "Ahlsell", inkopspris: 890, pris: 1190, antal: 6, enhet: "ST" },
      { namn: "Duschset med termostatblandare", aterforsaljare: "Ahlsell", inkopspris: 1650, pris: 2190, antal: 6, enhet: "ST" },
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
      { namn: "Klämringskoppling 15 mm", aterforsaljare: "Ahlsell", inkopspris: 32, pris: 49, antal: 2, enhet: "ST" },
    ],
    arbetspass: [{ datum: dag(-11), timmar: 1.5 }],
    resor: [{ datum: dag(-11), stracka: 9 }],
  },
];

// ------------------------------------------------------------
// Körning
// ------------------------------------------------------------

async function taBortTestdata() {
  // Underrader (artiklar, resor, arbetspass …) följer med via onDelete: Cascade
  const j = await prisma.job.deleteMany({ where: { id: { startsWith: PREFIX } } });
  const k = await prisma.customer.deleteMany({ where: { id: { startsWith: PREFIX } } });
  return { jobb: j.count, kunder: k.count };
}

async function laggIn() {
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Inget företag i databasen. Logga in i appen en gång först.");
  }

  const borttaget = await taBortTestdata();
  if (borttaget.jobb || borttaget.kunder) {
    console.log(`Tog bort gammal testdata: ${borttaget.kunder} kunder, ${borttaget.jobb} jobb.`);
  }

  for (const k of kunder) {
    await prisma.customer.create({
      data: { ...k, id: PREFIX + "kund-" + k.id, companyId: company.id },
    });
  }

  for (const j of jobb) {
    const { id, kund, artiklar = [], resor = [], arbetspass = [], ovrigaKostnader = [], ...falt } = j;
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

  console.log(`Klart: ${kunder.length} testkunder och ${jobb.length} testjobb i "${company.name}".`);
}

try {
  if (process.argv.includes("--ta-bort")) {
    const r = await taBortTestdata();
    console.log(`Tog bort ${r.kunder} testkunder och ${r.jobb} testjobb.`);
  } else {
    await laggIn();
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
