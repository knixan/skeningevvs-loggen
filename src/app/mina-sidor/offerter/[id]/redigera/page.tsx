import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { getSession } from "@/lib/server-hjalp";
import { getCustomers, getOffert } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import RedigeraOffertKlient from "@/components/minasidor/offert/redigera-offert-klient";
import {
  InfoRuta,
  Sida,
  SidHuvud,
  SidLaddar,
} from "@/components/minasidor/sida";
import { SkapaJobbKnapp } from "@/components/minasidor/offert/offert-knappar";

export default function RedigeraOffertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Sida>
      <Suspense
        fallback={<SidLaddar />}
      >
        <RedigeraOffertInnehall params={params} />
      </Suspense>
    </Sida>
  );
}

async function RedigeraOffertInnehall({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const { id } = await params;
  const [offert, customers, company] = await Promise.all([
    getOffert(id),
    getCustomers(),
    prisma.company.findFirst({
      where: { ownerId: session.user.id },
      select: { materialPaslag: true },
    }),
  ]);

  if (!offert) notFound();

  return (
    <>
      <SidHuvud
        titel={`Redigera offert ${offert.offertnummer}`}
        tillbaka={{ href: "/mina-sidor/offerter", text: "Offerter" }}
        atgard={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/mina-sidor/offerter/${offert.id}/skriv-ut`}>
                <FileText className="h-4 w-4" />
                Visa offert
              </Link>
            </Button>
            <SkapaJobbKnapp
              offertId={offert.id}
              offertnummer={offert.offertnummer}
              jobId={offert.jobId}
            />
          </>
        }
      />
      {!offert.customerId && (
        <InfoRuta ton="varning">
          Kunden på offerten har tagits bort ur kundregistret. Välj en kund
          innan du sparar.
        </InfoRuta>
      )}
      <RedigeraOffertKlient
        offert={offert}
        customers={customers}
        materialPaslag={company?.materialPaslag ?? 0}
      />
    </>
  );
}
