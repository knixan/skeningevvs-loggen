import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server-hjalp";
import { prisma } from "@/lib/prisma";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import InstallningarKlient from "@/components/minasidor/installningar/installningar-klient";

export const metadata = { title: "Inställningar – Skeningevvs-loggen" };

export default function InstallningarPage() {
  return (
    <Sida>
      <Suspense
        fallback={<SidLaddar />}
      >
        <InstallningarInnehall />
      </Suspense>
    </Sida>
  );
}

async function InstallningarInnehall() {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  // Läses direkt här (inte via en server action) så att det inte blir en
  // anropbar endpoint. Skapar inget om företaget saknas.
  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    select: {
      ahlsellAntalArtiklar: true,
      ahlsellImporteradVid: true,
      ahlsellAvtalInlast: true,
      ahlsellAvtalSlutdatum: true,
      materialPaslag: true,
    },
  });

  return (
    <>
      <SidHuvud titel="Inställningar" beskrivning={session.user.email} />
      <InstallningarKlient
        ahlsell={{
          antalArtiklar: company?.ahlsellAntalArtiklar ?? 0,
          importeradVid: company?.ahlsellImporteradVid?.toISOString() ?? null,
          avtalInlast: company?.ahlsellAvtalInlast ?? false,
          avtalSlutdatum: company?.ahlsellAvtalSlutdatum ?? "",
          materialPaslag: company?.materialPaslag ?? 0,
        }}
      />
    </>
  );
}
