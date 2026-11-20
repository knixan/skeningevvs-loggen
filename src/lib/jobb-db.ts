import "server-only";

import type { Prisma } from "@prisma/client";
import type { JobInput } from "./job-schema";

// Hur ett validerat jobb sparas i databasen. Delas av createJob/updateJob och
// skapaJobbFranOffert, så att ett jobb alltid sparas med samma fält – oavsett
// om det skapas från formuläret eller från en offert. Filen har inte
// "use server": funktionerna här blir inga endpoints.

/**
 * Uppföljningsdatum till databasen. Inget datum om bocken är av eller om
 * datumet är tomt. Att datumet finns på riktigt har jobSchema redan
 * kontrollerat (z.iso.date) – anropa bara med data som gått genom schemat.
 */
export function foljUppDatumTillDb(data: JobInput): Date | null {
  if (!data.foljUpp || !data.foljUppDatum) return null;
  return new Date(data.foljUppDatum);
}

/** Arbetsdelen av ett fast pris sparas bara när jobbet har fast pris. */
export function fastPrisArbeteTillDb(data: JobInput) {
  return data.fastPris != null ? (data.fastPrisArbete ?? null) : null;
}

/** Ett nytt jobb med alla underrader. Anropa bara med data som gått genom jobSchema. */
export function nyttJobbTillDb(
  companyId: string,
  data: JobInput,
  bilder: { url: string; key: string }[],
): Prisma.JobUncheckedCreateInput {
  return {
    companyId,
    customerId: data.customerId || null,
    rotAvdrag: data.rotAvdrag,
    timpris: data.timpris ?? 0,
    milersattning: data.milersattning ?? 0,
    fastPris: data.fastPris ?? null,
    fastPrisArbete: fastPrisArbeteTillDb(data),
    pagaende: data.pagaende,
    utfort: data.utfort,
    fakturerat: data.fakturerat,
    betalt: data.betalt,
    foljUpp: Boolean(data.foljUpp),
    foljUppDatum: foljUppDatumTillDb(data),
    anteckningar: data.anteckningar ?? "",
    utfortArbete: data.utfortArbete ?? "",
    planeratArbete: data.planeratArbete ?? "",
    internaAnteckningar: data.internaAnteckningar ?? "",
    artiklar: {
      create: data.artiklar.map((a) => ({
        namn: a.namn,
        artikelnr: a.artikelnr ?? "",
        aterforsaljare: a.aterforsaljare ?? "",
        inkopspris: a.inkopspris ?? 0,
        pris: a.pris,
        antal: a.antal,
        enhet: a.enhet ?? "",
      })),
    },
    resor: {
      create: data.resor.map((r) => ({
        datum: new Date(r.datum),
        stracka: r.stracka,
      })),
    },
    arbetspass: {
      create: data.arbetstider.map((w) => ({
        datum: new Date(w.datum),
        timmar: w.timmar,
      })),
    },
    images: {
      create: bilder.map((b) => ({ url: b.url, key: b.key })),
    },
    ovrigaKostnader: {
      create: (data.ovrigaKostnader ?? []).map((k) => ({
        beskrivning: k.beskrivning,
        pris: k.pris,
      })),
    },
  };
}
