import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { getCustomers, getOffert } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import RedigeraOffertKlient from "@/components/minasidor/offert/redigera-offert-klient";
import { SkapaJobbKnapp } from "@/components/minasidor/offert/offert-knappar";

export default function RedigeraOffertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <Suspense
        fallback={<div className="animate-pulse h-8 w-48 bg-muted rounded" />}
      >
        <RedigeraOffertInnehall params={params} />
      </Suspense>
    </main>
  );
}

async function RedigeraOffertInnehall({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">
          Redigera offert {offert.offertnummer}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/mina-sidor/offerter/${offert.id}/skriv-ut`} target="_blank">
              <FileText className="h-4 w-4" />
              Visa offert
            </Link>
          </Button>
          <SkapaJobbKnapp
            offertId={offert.id}
            offertnummer={offert.offertnummer}
            jobId={offert.jobId}
          />
        </div>
      </div>
      {!offert.customerId && (
        <p className="mb-6 rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Kunden på offerten har tagits bort ur kundregistret. Välj en kund
          innan du sparar.
        </p>
      )}
      <RedigeraOffertKlient
        offert={offert}
        customers={customers}
        materialPaslag={company?.materialPaslag ?? 0}
      />
    </>
  );
}
