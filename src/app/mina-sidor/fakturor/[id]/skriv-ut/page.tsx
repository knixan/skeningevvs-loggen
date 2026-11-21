import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getCompanySettings, getFakturaMedId } from "@/lib/queries";
import { getSession } from "@/lib/server-hjalp";
import SkrivUtKlient from "@/components/minasidor/faktura/skriv-ut-klient";

// En utfärdad faktura eller kreditfaktura, precis som den sparades. Går att
// visa även om jobbet har tagits bort.

export default function FakturaSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="animate-pulse h-screen bg-muted" />}>
      <FakturaInnehall params={params} />
    </Suspense>
  );
}

async function FakturaInnehall({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const { id } = await params;
  const [faktura, company] = await Promise.all([
    getFakturaMedId(id),
    getCompanySettings(),
  ]);
  if (!faktura || !company) notFound();

  return (
    <SkrivUtKlient
      faktura={faktura.data}
      fakturaId={faktura.id}
      krediteradAv={faktura.krediteradAv}
      logoUrl={company.logoUrl}
      nastaFakturanummer={company.nastaFakturanummer}
      tillbaka={{ href: "/mina-sidor/fakturor", text: "Fakturor" }}
    />
  );
}
