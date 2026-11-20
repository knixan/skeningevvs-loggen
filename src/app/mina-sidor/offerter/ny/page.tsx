import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { idagISverige, laggTillDagar } from "@/lib/datum";
import { OFFERT_GILTIG_DAGAR } from "@/lib/job-schema";
import { getCustomers, getSenastePriser } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import NyOffertKlient from "@/components/minasidor/offert/ny-offert-klient";

export default function NyOffertPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <Suspense
        fallback={<div className="animate-pulse h-8 w-48 bg-muted rounded" />}
      >
        <NyOffertInnehall />
      </Suspense>
    </main>
  );
}

async function NyOffertInnehall() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/logga-in");

  const [customers, company, priser] = await Promise.all([
    getCustomers(),
    prisma.company.findFirst({
      where: { ownerId: session.user.id },
      select: { materialPaslag: true },
    }),
    getSenastePriser(),
  ]);

  // Datum i svensk tid – servern går i UTC
  const idag = idagISverige();

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">Ny offert</h1>
      <NyOffertKlient
        customers={customers}
        materialPaslag={company?.materialPaslag ?? 0}
        defaultValues={{
          offertdatum: idag,
          giltigTill: laggTillDagar(idag, OFFERT_GILTIG_DAGAR),
          timpris: priser.timpris,
          milersattning: priser.milersattning,
        }}
      />
    </>
  );
}
