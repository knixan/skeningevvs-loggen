import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/server-hjalp";
import { skapaOffertData } from "@/lib/offert";
import { getCompanySettings, getOffert } from "@/lib/queries";
import SkrivUtOffert from "@/components/minasidor/offert/skriv-ut-offert";

export default function SkrivUtOffertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="animate-pulse h-screen bg-muted" />}>
      <SkrivUtOffertInnehall params={params} />
    </Suspense>
  );
}

async function SkrivUtOffertInnehall({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const { id } = await params;
  const [offert, company] = await Promise.all([
    getOffert(id),
    getCompanySettings(),
  ]);

  if (!offert) notFound();
  if (!company) notFound();

  return (
    <SkrivUtOffert
      offertId={offert.id}
      offert={skapaOffertData(offert, company)}
      logoUrl={company.logoUrl}
    />
  );
}
