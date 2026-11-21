import { z } from "zod";

// ============================================================
// Personnummer och momsregistreringsnummer
// ============================================================

/** Luhn-algoritmen (kontrollsiffran i personnummer och org.nr). */
function luhnStammer(siffror: string): boolean {
  let summa = 0;
  for (let i = 0; i < siffror.length; i++) {
    let n = Number(siffror[siffror.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    summa += n;
  }
  return summa % 10 === 0;
}

/**
 * Ett personnummer som ÅÅÅÅMMDD-XXXX, ÅÅMMDD-XXXX (med eller utan streck
 * eller +) med rätt kontrollsiffra. Månad och dag kontrolleras grovt – dag
 * 61–91 är samordningsnummer.
 */
export function arGiltigtPersonnummer(pnr: string): boolean {
  const m = pnr.trim().match(/^(\d{2})?(\d{2})(\d{2})(\d{2})[-+ ]?(\d{4})$/);
  if (!m) return false;
  const [, , ar, manad, dag, sista] = m;
  const mm = Number(manad);
  const dd = Number(dag);
  if (mm < 1 || mm > 12) return false;
  if (!((dd >= 1 && dd <= 31) || (dd >= 61 && dd <= 91))) return false;
  return luhnStammer(`${ar}${manad}${dag}${sista}`);
}

/** Ett svenskt organisationsnummer, NNNNNN-NNNN, med rätt kontrollsiffra. */
export function arGiltigtOrgNummer(nr: string): boolean {
  const siffror = nr.replace(/[-\s]/g, "");
  return /^\d{10}$/.test(siffror) && luhnStammer(siffror);
}

/** "se 556677-8899 01" → "SE556677889901". */
export function normaliseraMomsNummer(nr: string): string {
  return nr.replace(/[\s-]/g, "").toUpperCase();
}

/** Svenskt momsregistreringsnummer: SE + tio siffror + 01. */
export function arGiltigtMomsNummer(nr: string): boolean {
  return /^SE\d{10}01$/.test(normaliseraMomsNummer(nr));
}

const MOMSNR_FEL = "Momsreg.nr skrivs SE + tio siffror + 01, t.ex. SE556677889901";

const momsNummerFalt = z
  .string()
  .trim()
  .max(30)
  .transform(normaliseraMomsNummer)
  .refine((v) => v === "" || arGiltigtMomsNummer(v), MOMSNR_FEL);

// ============================================================
// Kund-schema
// ============================================================

export const customerSchema = z
  .object({
  typ: z.enum(["privat", "foretag"]).default("privat"),
  namn: z.string().trim().min(1, "Namn krävs").max(120),
  adress: z.string().trim().max(200).optional().default(""),
  postnummer: z.string().trim().max(10).optional().default(""),
  ort: z.string().trim().max(100).optional().default(""),
  telefon: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+\-\s()]*$/, "Endast siffror och + - ( ) tillåtna")
    .optional()
    .default(""),
  epost: z
    .email({ error: "Ogiltig e-post" })
    .trim()
    .max(200)
    .optional()
    .or(z.literal("")),
  personnummer: z
    .string()
    .trim()
    .max(30)
    .refine(
      (v) => v === "" || arGiltigtPersonnummer(v),
      "Personnumret stämmer inte – kontrollera siffrorna (ÅÅÅÅMMDD-XXXX)",
    )
    .optional()
    .default(""),
  foretagsnamn: z.string().trim().max(120).optional().default(""),
  kontaktperson: z.string().trim().max(120).optional().default(""),
  orgNummer: z.string().trim().max(30).optional().default(""),
  fastighetsbeteckning: z.string().trim().max(120).optional().default(""),
  lagenhetsnummer: z.string().trim().max(30).optional().default(""),
  bostadsrattsforening: z.string().trim().max(120).optional().default(""),
  brfOrgNummer: z
    .string()
    .trim()
    .max(30)
    .refine(
      (v) => v === "" || arGiltigtOrgNummer(v),
      "Organisationsnumret stämmer inte (NNNNNN-NNNN)",
    )
    .optional()
    .default(""),
  omvandByggmoms: z.boolean().optional().default(false),
  momsNummer: momsNummerFalt.optional().default(""),
  })
  .refine((d) => !(d.typ === "foretag" && d.omvandByggmoms && !d.momsNummer), {
    message: "Omvänd byggmoms kräver kundens momsregistreringsnummer",
    path: ["momsNummer"],
  });

export type CustomerInput = z.infer<typeof customerSchema>;

export type Customer = CustomerInput & {
  id: string;
  companyId: string;
  skapad: string;
};

/**
 * Kundens namn som det visas överallt (listor, översikt, faktura):
 * företagsnamnet för företagskunder, annars personens namn. Använd alltid
 * den här – kolla aldrig bara `foretagsnamn || namn`, för en kund som bytt
 * typ kan ha ett gammalt företagsnamn kvar.
 */
export function kundensNamn(
  kund?: Pick<CustomerInput, "typ" | "namn" | "foretagsnamn"> | null,
): string {
  if (!kund) return "";
  const foretag = kund.typ === "foretag" ? (kund.foretagsnamn ?? "").trim() : "";
  return foretag || kund.namn.trim();
}

/**
 * Bostadsuppgifterna som ROT-avdraget kräver, t.ex. "Fastighet: Berga 1:23"
 * eller "BRF: Brf Solrosen · Lgh: 1101". Tom sträng om inget är ifyllt.
 */
export function rotBostad(
  kund?: Pick<
    CustomerInput,
    | "fastighetsbeteckning"
    | "bostadsrattsforening"
    | "lagenhetsnummer"
    | "brfOrgNummer"
  > | null,
): string {
  if (!kund) return "";
  const brf = [
    kund.bostadsrattsforening,
    kund.brfOrgNummer && `org.nr ${kund.brfOrgNummer}`,
  ]
    .filter(Boolean)
    .join(", ");
  return [
    kund.fastighetsbeteckning && `Fastighet: ${kund.fastighetsbeteckning}`,
    brf && `BRF: ${brf}`,
    kund.lagenhetsnummer && `Lgh: ${kund.lagenhetsnummer}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Rensar fält som inte hör till kundtypen, så att t.ex. ett personnummer inte
 * ligger kvar osynligt på en företagskund efter att typen bytts.
 */
export function rensaKundFalt(data: CustomerInput): CustomerInput {
  return data.typ === "foretag"
    ? { ...data, personnummer: "" }
    : {
        ...data,
        foretagsnamn: "",
        kontaktperson: "",
        orgNummer: "",
        omvandByggmoms: false,
        momsNummer: "",
      };
}

/**
 * Omvänd byggmoms gäller för kunden: ett företag som självt säljer
 * byggtjänster. Då blir fakturan utan moms (köparen redovisar momsen).
 */
export function harOmvandByggmoms(
  kund?: Pick<CustomerInput, "typ" | "omvandByggmoms"> | null,
): boolean {
  return kund?.typ === "foretag" && Boolean(kund.omvandByggmoms);
}

/**
 * Det som saknas för att Skatteverket ska betala ut ROT-avdraget: köparens
 * personnummer, och fastighetsbeteckning eller – för en bostadsrätt –
 * föreningens organisationsnummer och lägenhetsnumret. Tom lista = komplett.
 */
export function rotUppgifterSomSaknas(
  kund?: Pick<
    CustomerInput,
    | "typ"
    | "personnummer"
    | "fastighetsbeteckning"
    | "lagenhetsnummer"
    | "brfOrgNummer"
  > | null,
): string[] {
  if (!kund) return ["kund"];
  if (kund.typ === "foretag") return [];
  const saknas: string[] = [];
  if (!kund.personnummer) saknas.push("personnummer");
  else if (!arGiltigtPersonnummer(kund.personnummer))
    saknas.push("ett giltigt personnummer");
  const harFastighet = Boolean(kund.fastighetsbeteckning?.trim());
  const harBrf =
    Boolean(kund.brfOrgNummer?.trim()) && Boolean(kund.lagenhetsnummer?.trim());
  if (!harFastighet && !harBrf) {
    saknas.push(
      "fastighetsbeteckning (eller för bostadsrätt: föreningens org.nr och lägenhetsnummer)",
    );
  }
  return saknas;
}

/** Tal med svensk decimalkomma och högst två decimaler, t.ex. "7,5". */
export function formateraTal(n: number): string {
  return n.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}

/** Belopp i kronor med ören bara när de finns, t.ex. "1 250 kr", "12,50 kr". */
export function formateraKr(n: number): string {
  return n.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// ============================================================
// Jobb-schema
// ============================================================
//
// Alla felmeddelanden står på svenska här – zod:s egna är engelska. Ett
// nummerfält som lämnas tomt blir NaN i formuläret, och då visas
// meddelandet i `error` ("Ange …").

const högstTecken = (n: number) => `Högst ${n} tecken`;

/** Tal som inte får vara negativt, med svenska felmeddelanden. */
function belopp(saknas: string, negativt: string) {
  return z.coerce.number({ error: saknas }).min(0, negativt);
}

export const articleSchema = z.object({
  id: z.string().optional(),
  namn: z.string().trim().min(1, "Namn krävs").max(120, högstTecken(120)),
  artikelnr: z.string().trim().max(50, högstTecken(50)).optional().default(""),
  aterforsaljare: z
    .string()
    .trim()
    .max(120, högstTecken(120))
    .optional()
    .default(""),
  inkopspris: belopp("Ange inköpspris", "Inköpspris får inte vara negativt")
    .optional()
    .default(0),
  pris: belopp("Ange utpris", "Pris får inte vara negativt"),
  // Decimaler tillåtna – rör och kabel köps per meter
  antal: z.coerce
    .number({ error: "Ange antal" })
    .positive("Måste vara större än 0")
    .default(1),
  enhet: z.string().trim().max(10, högstTecken(10)).optional().default(""),
  // Bara ett hjälpfält i formuläret för att räkna fram utpriset – sparas
  // aldrig. Jobbet sparar utpriset (`pris`) så att en faktura inte ändras om
  // påslaget i inställningarna ändras senare. NaN = tomt fält.
  paslag: z.union([z.number(), z.nan()]).optional(),
});

/** Utpris i kronor: inköpspris + påslag i procent, avrundat till ören. */
export function utprisMedPaslag(inkopspris: number, paslagProcent: number) {
  return Math.round(inkopspris * (1 + paslagProcent / 100) * 100) / 100;
}

/** Påslaget i procent (en decimal) som ett utpris motsvarar, eller undefined. */
export function beräknaPaslag(inkopspris: number, utpris: number) {
  if (!(inkopspris > 0) || !(utpris > 0)) return undefined;
  return Math.round((utpris / inkopspris - 1) * 1000) / 10;
}

/** "2,5 m", "3 st" – enhet saknas = styck. */
export function formateraAntal(antal: number, enhet?: string) {
  const e = (enhet ?? "").trim().toLowerCase() || "st";
  return `${antal.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} ${e}`;
}

// YYYY-MM-DD som måste vara ett datum som finns. Det räcker inte att kolla
// formatet: new Date("2026-02-31") ger inget fel utan blir tyst 3 mars.
const datumSchema = z
  .string()
  .min(1, "Datum krävs")
  .pipe(z.iso.date({ error: "Ogiltigt datum" }));

export const resaSchema = z.object({
  id: z.string().optional(),
  datum: datumSchema,
  stracka: belopp("Ange sträcka", "Sträcka får inte vara negativ"),
});

export const arbetstidSchema = z.object({
  id: z.string().optional(),
  datum: datumSchema,
  timmar: belopp("Ange timmar", "Timmar får inte vara negativt"),
});

export const ovrigKostnadSchema = z.object({
  id: z.string().optional(),
  beskrivning: z
    .string()
    .trim()
    .min(1, "Beskrivning krävs")
    .max(200, högstTecken(200)),
  pris: belopp("Ange pris", "Pris får inte vara negativt"),
});

/** Felmeddelande när ROT väljs för en företagskund (kontrolleras på servern). */
export const ROT_BARA_PRIVAT =
  "ROT-avdrag gäller bara privatpersoner – bocka ur ROT eller byt kund.";

// Regler för fast pris – gemensamma för jobb och offerter.
type FastPrisFalt = {
  rotAvdrag: boolean;
  fastPris?: number;
  fastPrisArbete?: number;
};

/** ROT räknas bara på arbete – med fast pris måste arbetsdelen anges. */
const rotKraverArbetskostnad = {
  regel: (d: FastPrisFalt) =>
    !(d.rotAvdrag && d.fastPris != null && d.fastPrisArbete == null),
  fel: {
    message:
      "Ange hur mycket av det fasta priset som är arbete – ROT räknas bara på arbetskostnaden",
    path: ["fastPrisArbete"],
  },
};

const arbetskostnadInomFastPris = {
  regel: (d: FastPrisFalt) =>
    d.fastPris == null ||
    d.fastPrisArbete == null ||
    d.fastPrisArbete <= d.fastPris,
  fel: {
    message: "Arbetskostnaden kan inte vara högre än det fasta priset",
    path: ["fastPrisArbete"],
  },
};

const fastPrisFalt = {
  fastPris: belopp(
    "Ange fast pris",
    "Fast pris får inte vara negativt",
  ).optional(),
  // Hur mycket av det fasta priset som är arbete (exkl. moms). ROT räknas
  // bara på arbete som står på fakturan – med fast pris är det den här.
  fastPrisArbete: belopp(
    "Ange arbetskostnaden",
    "Arbetskostnaden får inte vara negativ",
  ).optional(),
};

export const jobSchema = z
  .object({
    customerId: z.string().optional(),

    timpris: belopp("Ange timpris", "Timpris får inte vara negativt").default(
      0,
    ),
    milersattning: belopp(
      "Ange milersättning",
      "Milersättning får inte vara negativ",
    ).default(0),

    rotAvdrag: z.boolean().default(false),
    pagaende: z.boolean().default(false),
    utfort: z.boolean().default(false),
    fakturerat: z.boolean().default(false),
    betalt: z.boolean().default(false),

    foljUpp: z.boolean().default(false),
    // Tom sträng = inget datum valt (så skickar <input type="date"> ett tomt fält)
    foljUppDatum: z
      .iso.date({ error: "Ogiltigt datum" })
      .optional()
      .or(z.literal("")),

    artiklar: z.array(articleSchema).default([]),
    resor: z.array(resaSchema).default([]),
    arbetstider: z.array(arbetstidSchema).default([]),
    ovrigaKostnader: z.array(ovrigKostnadSchema).default([]),

    anteckningar: z.string().max(2000, högstTecken(2000)).optional().default(""),
    utfortArbete: z.string().max(2000, högstTecken(2000)).optional().default(""),
    planeratArbete: z
      .string()
      .max(2000, högstTecken(2000))
      .optional()
      .default(""),
    internaAnteckningar: z
      .string()
      .max(2000, högstTecken(2000))
      .optional()
      .default(""),

    bilder: z.array(z.object({ url: z.string(), key: z.string() })).default([]),

    ...fastPrisFalt,
  })
  .refine((data) => !(data.betalt && !data.fakturerat), {
    message: "Kan inte markera som betalt utan att ha fakturerat",
    path: ["betalt"],
  })
  .refine(rotKraverArbetskostnad.regel, rotKraverArbetskostnad.fel)
  .refine(arbetskostnadInomFastPris.regel, arbetskostnadInomFastPris.fel);

export type JobInput = z.infer<typeof jobSchema>;

export type Job = JobInput & {
  id: string;
  skapad: string;
  fakturanummer?: number;
  /** Jobbet har minst en utfärdad faktura (även krediterad) */
  harFaktura?: boolean;
  customer?: Customer | null;
};

/**
 * Varningen om ROT-taket, eller null. `tidigare` = ROT kunden redan fått på
 * andra fakturor samma år, `detta` = ROT på det här jobbet.
 */
export function rotTakVarning(tidigare: number, detta: number): string | null {
  const totalt = avrundaTillOre(tidigare + detta);
  if (detta <= 0 || totalt <= ROT_TAK_KR * 0.8) return null;
  const kr = (n: number) => formateraKr(n);
  const forut =
    tidigare > 0
      ? `Kunden har redan fått ${kr(tidigare)} i ROT på era fakturor i år. `
      : "";
  if (totalt > ROT_TAK_KR) {
    return `${forut}Med det här jobbet blir det ${kr(totalt)} – över taket på ${kr(ROT_TAK_KR)} per person och år. Det som överstiger taket får kunden betala själv, om inte två personer delar på avdraget.`;
  }
  return `${forut}Med det här jobbet blir det ${kr(totalt)} – nära taket på ${kr(ROT_TAK_KR)} per person och år. Kunden kan också ha fått ROT från andra hantverkare.`;
}

// ============================================================
// Offert-schema
// ============================================================

export const OFFERT_STATUSAR = [
  "utkast",
  "skickad",
  "accepterad",
  "avbojd",
] as const;
export type OffertStatus = (typeof OFFERT_STATUSAR)[number];

export const OFFERT_STATUS_TEXT: Record<OffertStatus, string> = {
  utkast: "Utkast",
  skickad: "Skickad",
  accepterad: "Accepterad",
  avbojd: "Avböjd",
};

/** Hur många dagar en ny offert gäller, som förslag i formuläret. */
export const OFFERT_GILTIG_DAGAR = 30;

export const offertSchema = z
  .object({
    // En offert utan mottagare går inte att skicka
    customerId: z.string({ error: "Välj en kund" }).min(1, "Välj en kund"),
    status: z.enum(OFFERT_STATUSAR).default("utkast"),
    offertdatum: datumSchema,
    giltigTill: datumSchema,

    timpris: belopp("Ange timpris", "Timpris får inte vara negativt").default(
      0,
    ),
    milersattning: belopp(
      "Ange milersättning",
      "Milersättning får inte vara negativ",
    ).default(0),
    // Uppskattningar – blir inte loggad tid när offerten görs om till jobb
    beraknadeTimmar: belopp(
      "Ange timmar",
      "Timmar får inte vara negativt",
    ).default(0),
    beraknadStracka: belopp(
      "Ange sträcka",
      "Sträcka får inte vara negativ",
    ).default(0),
    rotAvdrag: z.boolean().default(false),

    artiklar: z.array(articleSchema).default([]),
    ovrigaKostnader: z.array(ovrigKostnadSchema).default([]),

    beskrivning: z.string().max(2000, högstTecken(2000)).default(""),
    villkor: z.string().max(2000, högstTecken(2000)).default(""),
    internaAnteckningar: z.string().max(2000, högstTecken(2000)).default(""),

    ...fastPrisFalt,
  })
  // YYYY-MM-DD kan jämföras som text
  .refine((d) => d.giltigTill >= d.offertdatum, {
    message: "Offerten kan inte sluta gälla före offertdatumet",
    path: ["giltigTill"],
  })
  .refine(rotKraverArbetskostnad.regel, rotKraverArbetskostnad.fel)
  .refine(arbetskostnadInomFastPris.regel, arbetskostnadInomFastPris.fel);

export type OffertInput = z.infer<typeof offertSchema>;

export type Offert = OffertInput & {
  id: string;
  offertnummer: number;
  /** Jobbet som skapades från offerten, om kunden tackat ja */
  jobId?: string;
  skapad: string;
  customer?: Customer | null;
};

export const companySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Företagsnamn krävs")
    .max(120, "Företagsnamnet är för långt"),
  orgNummer: z.string().trim().max(30).default(""),
  adress: z.string().trim().max(200).default(""),
  postnummer: z.string().trim().max(10).default(""),
  ort: z.string().trim().max(100).default(""),
  telefon: z.string().trim().max(30).default(""),
  epost: z.string().trim().max(200).default(""),
  fSkatt: z.boolean().default(false),
  // Krävs för att utfärda en faktura (kontrolleras i fakturaFel). Räknas
  // aldrig fram ur org.nr – det blir fel för en enskild firma.
  momsNummer: momsNummerFalt.default(""),
  bankgiro: z.string().trim().max(30).default(""),
  plusgiro: z.string().trim().max(30).default(""),
  swish: z.string().trim().max(30).default(""),
  nastaFakturanummer: z.coerce.number().int().min(1).default(1),
  forfallodagar: z.coerce.number().int().min(0).default(30),
  drojsmalsranta: z.coerce.number().min(0).default(0),
  fakturatext: z.string().max(1000).default(""),
});

export type CompanyInput = z.infer<typeof companySchema>;

// ============================================================
// Beräkningar
// ============================================================
//
// Alla belopp avrundas till ören där de räknas fram, så att det som står på
// fakturan alltid går jämnt upp: raderna summerar till "exkl. moms", och
// exkl. moms + moms − ROT + öresutjämning är exakt "att betala".

/**
 * Avrundar ett belopp till hela ören, halva uppåt (bort från noll).
 *
 * Flyttal kan inte lagra alla decimaltal exakt: 1,005 är egentligen
 * 1,00499999… och 1,005 * 100 blir 100,49999… som Math.round avrundar nedåt.
 * toPrecision(12) tar bort det bruset innan avrundningen.
 */
export function avrundaTillOre(n: number): number {
  const ore = Math.round(Number((Math.abs(n) * 100).toPrecision(12)));
  if (ore === 0) return 0;
  return n < 0 ? -ore / 100 : ore / 100;
}

/** Kronor → ören som heltal, t.ex. 1234.5 → 123450. */
export function kronorTillOre(kr: number): number {
  return Math.round(avrundaTillOre(kr) * 100);
}

/** Radbelopp i kronor: à-pris × antal, avrundat till ören. */
export function radBelopp(pris: number, antal: number): number {
  return avrundaTillOre(pris * antal);
}

function summa(belopp: number[]): number {
  return avrundaTillOre(belopp.reduce((sum, b) => sum + b, 0));
}

/**
 * Det som beräkningarna behöver. Ett jobb (JobInput) passar direkt – en
 * offert görs om med offertPrisunderlag, så att båda räknas med samma formel.
 */
export type Prisunderlag = Pick<
  JobInput,
  | "artiklar"
  | "ovrigaKostnader"
  | "timpris"
  | "milersattning"
  | "rotAvdrag"
  | "fastPris"
  | "fastPrisArbete"
> & {
  arbetstider: { timmar: number }[];
  resor: { stracka: number }[];
  /**
   * Omvänd byggmoms (kunden redovisar momsen): ingen moms och inget ROT.
   * Kommer från kunden – se harOmvandByggmoms och jobbPrisunderlag.
   */
  omvandMoms?: boolean;
};

/** Ett jobb som underlag till beräkningarna, med kundens momsregel. */
export function jobbPrisunderlag(
  job: Omit<Prisunderlag, "omvandMoms"> & {
    customer?: Pick<CustomerInput, "typ" | "omvandByggmoms"> | null;
  },
): Prisunderlag {
  return { ...job, omvandMoms: harOmvandByggmoms(job.customer) };
}

/**
 * Offertens priser som underlag till beräkningarna. Den beräknade
 * arbetstiden och körsträckan blir varsin rad, precis som loggad tid på ett
 * jobb – så räknas offerten exakt som en faktura på samma underlag.
 */
export function offertPrisunderlag(
  offert: OffertInput & {
    customer?: Pick<CustomerInput, "typ" | "omvandByggmoms"> | null;
  },
): Prisunderlag {
  return {
    omvandMoms: harOmvandByggmoms(offert.customer),
    artiklar: offert.artiklar,
    ovrigaKostnader: offert.ovrigaKostnader,
    timpris: offert.timpris,
    milersattning: offert.milersattning,
    arbetstider:
      offert.beraknadeTimmar > 0 ? [{ timmar: offert.beraknadeTimmar }] : [],
    resor:
      offert.beraknadStracka > 0 ? [{ stracka: offert.beraknadStracka }] : [],
    rotAvdrag: offert.rotAvdrag,
    fastPris: offert.fastPris,
    fastPrisArbete: offert.fastPrisArbete,
  };
}

export function beräknaSummering(job: Prisunderlag) {
  const artiklarSum = summa(job.artiklar.map((a) => radBelopp(a.pris, a.antal)));
  // Bara för egen uppföljning – inköpspriset syns aldrig för kunden
  const artiklarInkopSum = summa(
    job.artiklar.map((a) => radBelopp(a.inkopspris || 0, a.antal)),
  );
  const artiklarMarginal = avrundaTillOre(artiklarSum - artiklarInkopSum);
  const ovrigaSum = summa(
    (job.ovrigaKostnader ?? []).map((k) => avrundaTillOre(k.pris)),
  );
  const totalTimmar = job.arbetstider.reduce((sum, a) => sum + a.timmar, 0);
  const totalStracka = job.resor.reduce((sum, r) => sum + r.stracka, 0);
  const antalResor = job.resor.length;

  const timpris = job.timpris ?? 0;
  const milersattning = job.milersattning ?? 0;
  const arbetstidSum = radBelopp(timpris, totalTimmar);
  const resorSum = radBelopp(milersattning, totalStracka);
  const totalExklMoms = summa([artiklarSum, ovrigaSum, arbetstidSum, resorSum]);

  return {
    artiklarSum,
    artiklarInkopSum,
    artiklarMarginal,
    ovrigaSum,
    totalTimmar,
    totalStracka,
    antalResor,
    timpris,
    milersattning,
    arbetstidSum,
    resorSum,
    totalExklMoms,
  };
}

/** Momssats i procent. Används både i beräkningen och i fakturatexten. */
export const MOMS_PROCENT = 25;
/** ROT-avdrag i procent av arbetskostnaden inkl. moms (30 % år 2026). */
export const ROT_PROCENT = 30;
/**
 * Högsta ROT-avdrag per person och år i kronor (2026). ROT och RUT får
 * tillsammans vara högst 75 000 kr. Appen ser bara sina egna fakturor och vet
 * inte hur flera ägare delar på avdraget – därför bara en varning.
 */
export const ROT_TAK_KR = 50_000;

/** En rad på fakturan, färdigräknad – vyerna ritar bara upp den. */
export type FakturaRad = {
  /** Styr bara visningen, t.ex. att à-priset för arbetstid visas per timme. */
  typ: "artikel" | "kostnad" | "arbete" | "resa";
  beskrivning: string;
  /** Artikelnummer och återförsäljare, tom för andra rader. */
  detalj: string;
  antal: number;
  /** "st", "m", "h", "km" … */
  enhet: string;
  aPris: number;
  belopp: number;
};

function fakturaRader(
  job: Prisunderlag,
  summary: ReturnType<typeof beräknaSummering>,
): FakturaRad[] {
  const rader: FakturaRad[] = [
    ...job.artiklar.map((a) => ({
      typ: "artikel" as const,
      beskrivning: a.namn,
      detalj: [a.artikelnr, a.aterforsaljare].filter(Boolean).join(" · "),
      antal: a.antal,
      enhet: (a.enhet ?? "").trim().toLowerCase() || "st",
      aPris: a.pris,
      belopp: radBelopp(a.pris, a.antal),
    })),
    ...(job.ovrigaKostnader ?? []).map((k) => ({
      typ: "kostnad" as const,
      beskrivning: k.beskrivning,
      detalj: "",
      antal: 1,
      enhet: "st",
      aPris: k.pris,
      belopp: avrundaTillOre(k.pris),
    })),
  ];
  if (summary.totalTimmar > 0 && summary.timpris > 0) {
    rader.push({
      typ: "arbete",
      beskrivning: "Arbetstid",
      detalj: "",
      antal: summary.totalTimmar,
      enhet: "h",
      aPris: summary.timpris,
      belopp: summary.arbetstidSum,
    });
  }
  if (summary.totalStracka > 0 && summary.milersattning > 0) {
    rader.push({
      typ: "resa",
      beskrivning: "Resor / milersättning",
      detalj: "",
      antal: summary.totalStracka,
      enhet: "km",
      aPris: summary.milersattning,
      belopp: summary.resorSum,
    });
  }
  return rader;
}

// Delad fakturaberäkning (rader, moms, ROT-avdrag, att betala) så att PDF:en,
// utskriftsvyn och formuläret alltid visar samma summor för samma jobb.
// Offerter räknas med samma funktion, via offertPrisunderlag.
export function beräknaFaktura(job: Prisunderlag) {
  const summary = beräknaSummering(job);
  const arFastPris = job.fastPris != null;

  // Med fast pris står inga rader på fakturan – bara det fasta priset.
  const rader = arFastPris ? [] : fakturaRader(job, summary);
  const exklMoms = arFastPris
    ? avrundaTillOre(job.fastPris ?? 0)
    : summary.totalExklMoms;
  // Omvänd byggmoms: köparen redovisar momsen, fakturan har ingen
  const omvandMoms = Boolean(job.omvandMoms);
  const moms = omvandMoms
    ? 0
    : avrundaTillOre(exklMoms * (MOMS_PROCENT / 100));
  const totalInklMoms = avrundaTillOre(exklMoms + moms);

  // ROT räknas bara på arbete som står på fakturan: den löpande arbetstiden,
  // eller – med fast pris – den del av priset som angetts som arbete.
  // Loggade timmar på ett fast pris-jobb står inte på fakturan och räknas inte.
  // ROT gäller bara privatpersoner, aldrig med omvänd byggmoms.
  const arbetskostnad = arFastPris
    ? avrundaTillOre(job.fastPrisArbete ?? 0)
    : summary.arbetstidSum;
  const rotUnderlag = job.rotAvdrag && !omvandMoms
    ? avrundaTillOre(arbetskostnad * (1 + MOMS_PROCENT / 100))
    : 0;
  const rotAvdrag = avrundaTillOre(rotUnderlag * (ROT_PROCENT / 100));

  // Att betala avrundas till hela kronor. Skillnaden står som öresutjämning,
  // så att raderna i summeringen går jämnt upp.
  const attBetalaExakt = avrundaTillOre(totalInklMoms - rotAvdrag);
  const attBetala = Math.round(attBetalaExakt);
  const oresutjamning = avrundaTillOre(attBetala - attBetalaExakt);

  return {
    summary,
    rader,
    omvandMoms,
    exklMoms,
    moms,
    totalInklMoms,
    arbetskostnad,
    rotUnderlag,
    rotAvdrag,
    oresutjamning,
    attBetala,
  };
}
