import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { idagISverige } from "@/lib/datum";
import { skapaFakturaData } from "@/lib/faktura";
import { getJob, getCompanySettings, getFaktura } from "@/lib/queries";
import SkrivUtKlient from "@/components/minasidor/faktura/skriv-ut-klient";

export default function SkrivUtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="animate-pulse h-screen bg-muted" />}>
      <SkrivUtInnehall params={params} />
    </Suspense>
  );
}

async function SkrivUtInnehall({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/logga-in");

  const { id } = await params;
  const [job, company, sparad] = await Promise.all([
    getJob(id),
    getCompanySettings(),
    getFaktura(id),
  ]);

  if (!job) notFound();
  if (!company) notFound();

  // Utfärdad faktura: den sparade, precis som den var när den utfärdades.
  // Annars en förhandsgranskning av dagens data, byggd på samma sätt. Att
  // öppna sidan ändrar ingenting – numret delas ut först med "Utfärda faktura".
  const faktura =
    sparad ??
    skapaFakturaData(job, company, {
      fakturanummer: job.fakturanummer ?? null,
      fakturadatum: idagISverige(),
    });

  return (
    <SkrivUtKlient
      jobId={job.id}
      faktura={faktura}
      arUtfardad={sparad != null}
      logoUrl={company.logoUrl}
      nastaFakturanummer={company.nastaFakturanummer}
    />
  );
}
