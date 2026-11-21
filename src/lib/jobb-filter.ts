// Statusfiltren i jobblistan. Delas av servern (queries.ts filtrerar och
// räknar i databasen) och klienten (knapparna). Värdena står i adressen,
// t.ex. /mina-sidor?status=fakturerat&sok=berga – därför utan å, ä och ö.

export const JOBB_FILTER = [
  "alla",
  "ej-paborjat",
  "pagaende",
  "utfort",
  "folj-upp",
  "fakturerat",
  "betalt",
] as const;

export type JobbFilter = (typeof JOBB_FILTER)[number];

export const JOBB_FILTER_TEXT: Record<JobbFilter, string> = {
  alla: "Alla",
  "ej-paborjat": "Ej påbörjat",
  pagaende: "Pågående",
  utfort: "Utfört",
  "folj-upp": "Följ upp",
  fakturerat: "Fakturerat",
  betalt: "Betalt",
};

/** Ett värde från adressen → ett giltigt filter, annars "alla". */
export function tolkaJobbFilter(v: unknown): JobbFilter {
  return (JOBB_FILTER as readonly unknown[]).includes(v)
    ? (v as JobbFilter)
    : "alla";
}

/** Sökordet från adressen, trimmat och begränsat. */
export function tolkaJobbSok(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 100) : "";
}

export type JobbRaknare = Record<JobbFilter, number>;

// Sorteringen i jobblistan, t.ex. /mina-sidor?sortera=aldst. Görs i
// databasen (queries.ts), så att "Ladda fler" fortsätter i rätt ordning.
export const JOBB_SORTERING = ["nyast", "aldst"] as const;

export type JobbSortering = (typeof JOBB_SORTERING)[number];

export const JOBB_SORTERING_TEXT: Record<JobbSortering, string> = {
  nyast: "Nyast först",
  aldst: "Äldst först",
};

/** Ett värde från adressen → en giltig sortering, annars "nyast". */
export function tolkaJobbSortering(v: unknown): JobbSortering {
  return (JOBB_SORTERING as readonly unknown[]).includes(v)
    ? (v as JobbSortering)
    : "nyast";
}
