import { prisma } from "@/lib/prisma";
import { inloggatForetag } from "@/lib/server-hjalp";
import { kundensNamn } from "@/lib/job-schema";
import { csvFil } from "../csv";

// Kundregistret som CSV. En läsning: kräver inloggning och ändrar ingenting.

export async function GET() {
  const company = await inloggatForetag();
  if (!company) return new Response("Inte inloggad", { status: 401 });

  const kunder = await prisma.customer.findMany({
    where: { companyId: company.id },
    orderBy: { namn: "asc" },
  });

  const rader = kunder.map((k) => [
    kundensNamn({ ...k, typ: k.typ as "privat" | "foretag" }),
    k.typ === "foretag" ? "Företag" : "Privat",
    k.typ === "foretag" ? k.namn : "",
    k.kontaktperson,
    k.typ === "foretag" ? k.orgNummer : "",
    k.personnummer,
    k.adress,
    k.postnummer,
    k.ort,
    k.telefon,
    k.epost,
    k.fastighetsbeteckning,
    k.bostadsrattsforening,
    k.brfOrgNummer,
    k.lagenhetsnummer,
    k.omvandByggmoms ? "Ja" : "Nej",
    k.momsNummer,
  ]);

  return csvFil(
    "kundregister.csv",
    [
      "Namn",
      "Typ",
      "Kontaktnamn",
      "Kontaktperson",
      "Org.nr",
      "Personnummer",
      "Adress",
      "Postnummer",
      "Ort",
      "Telefon",
      "E-post",
      "Fastighetsbeteckning",
      "Bostadsrättsförening",
      "BRF org.nr",
      "Lägenhetsnummer",
      "Omvänd byggmoms",
      "Momsreg.nr",
    ],
    rader,
  );
}
