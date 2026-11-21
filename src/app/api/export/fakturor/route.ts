import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { inloggatForetag } from "@/lib/server-hjalp";
import type { FakturaData } from "@/lib/faktura";
import { csvFil, oreTillText } from "../csv";

// Fakturorna som CSV, ett år eller alla (?ar=2026 / ?ar=alla). En läsning:
// kräver inloggning, filtrerar på företaget och ändrar ingenting.

export async function GET(request: NextRequest) {
  const company = await inloggatForetag();
  if (!company) return new Response("Inte inloggad", { status: 401 });

  const arParam = request.nextUrl.searchParams.get("ar") ?? "alla";
  const ar = /^\d{4}$/.test(arParam) ? Number(arParam) : null;
  if (arParam !== "alla" && ar == null) {
    return new Response("Ogiltigt år", { status: 400 });
  }

  const fakturor = await prisma.faktura.findMany({
    where: {
      companyId: company.id,
      ...(ar != null
        ? {
            fakturadatum: {
              gte: new Date(`${ar}-01-01`),
              lt: new Date(`${ar + 1}-01-01`),
            },
          }
        : {}),
    },
    orderBy: { fakturanummer: "asc" },
    include: {
      krediterar: { select: { fakturanummer: true } },
      job: { select: { betalt: true } },
    },
  });

  const rader = fakturor.map((f) => {
    const data = f.innehall as unknown as FakturaData;
    return [
      String(f.fakturanummer),
      f.krediterarId ? "Kreditfaktura" : "Faktura",
      f.krediterar ? String(f.krediterar.fakturanummer) : "",
      f.fakturadatum.toISOString().slice(0, 10),
      f.forfallodatum.toISOString().slice(0, 10),
      data.kund?.namn ?? "",
      data.kund?.typ === "foretag" ? "Företag" : "Privat",
      oreTillText(f.exklMomsOre),
      oreTillText(f.momsOre),
      oreTillText(f.rotAvdragOre),
      oreTillText(f.attBetalaOre),
      data.omvandMoms ? "Ja" : "Nej",
      f.job ? (f.job.betalt ? "Ja" : "Nej") : "",
    ];
  });

  return csvFil(
    `fakturor-${ar ?? "alla"}.csv`,
    [
      "Fakturanummer",
      "Typ",
      "Krediterar faktura",
      "Fakturadatum",
      "Förfallodatum",
      "Kund",
      "Kundtyp",
      "Exkl. moms",
      "Moms",
      "ROT-avdrag",
      "Att betala",
      "Omvänd byggmoms",
      "Betald",
    ],
    rader,
  );
}
