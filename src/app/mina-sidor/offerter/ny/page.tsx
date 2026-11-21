import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server-hjalp";
import { idagISverige, laggTillDagar } from "@/lib/datum";
import { OFFERT_GILTIG_DAGAR } from "@/lib/job-schema";
import { getCustomers, getSenastePriser } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import NyOffertKlient from "@/components/minasidor/offert/ny-offert-klient";

export default function NyOffertPage() {
  return (
    <Sida>
      <Suspense
        fallback={<SidLaddar />}
      >
        <NyOffertInnehall />
      </Suspense>
    </Sida>
  );
}

async function NyOffertInnehall() {
  const session = await getSession();
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
      <SidHuvud
        titel="Ny offert"
        tillbaka={{ href: "/mina-sidor/offerter", text: "Offerter" }}
      />
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
