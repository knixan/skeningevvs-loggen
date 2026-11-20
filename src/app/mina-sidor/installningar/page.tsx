import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InstallningarKlient from "@/components/minasidor/installningar/installningar-klient";

export const metadata = { title: "Inställningar – Skeningevvs-loggen" };

export default function InstallningarPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <Suspense
        fallback={<div className="animate-pulse h-8 w-48 bg-muted rounded" />}
      >
        <InstallningarInnehall />
      </Suspense>
    </main>
  );
}

async function InstallningarInnehall() {
  const session = await auth.api.getSession({ headers: await headers() });
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Inställningar</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {session.user.email}
        </p>
      </div>
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
