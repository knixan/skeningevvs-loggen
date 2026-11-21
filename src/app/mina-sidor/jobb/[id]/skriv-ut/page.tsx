import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { idagISverige } from "@/lib/datum";
import { fakturaFel, skapaFakturaData } from "@/lib/faktura";
import { jobbPrisunderlag, beräknaFaktura, rotTakVarning } from "@/lib/job-schema";
import {
  getJob,
  getCompanySettings,
  getFaktura,
  getKrediteradeFakturor,
  getRotIArPerKund,
} from "@/lib/queries";
import { getSession } from "@/lib/server-hjalp";
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
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const { id } = await params;
  const [job, company, sparad, krediterade] = await Promise.all([
    getJob(id),
    getCompanySettings(),
    getFaktura(id),
    getKrediteradeFakturor(id),
  ]);

  if (!job) notFound();
  if (!company) notFound();

  const tillbaka = { href: "/mina-sidor", text: "Mina jobb" };

  // Utfärdad faktura: den sparade, precis som den var när den utfärdades.
  if (sparad) {
    return (
      <SkrivUtKlient
        faktura={sparad.data}
        fakturaId={sparad.id}
        logoUrl={company.logoUrl}
        nastaFakturanummer={company.nastaFakturanummer}
        tillbaka={tillbaka}
      />
    );
  }

  // Annars en förhandsgranskning av dagens data, byggd på samma sätt. Att
  // öppna sidan ändrar ingenting – numret delas ut först med "Utfärda faktura".
  const idag = idagISverige();
  const faktura = skapaFakturaData(job, company, {
    fakturanummer: job.fakturanummer ?? null,
    fakturadatum: idag,
  });

  const varningar: string[] = [];
  if (krediterade > 0) {
    varningar.push(
      `Jobbet har ${krediterade === 1 ? "en krediterad faktura" : `${krediterade} krediterade fakturor`}. De finns under Fakturor.`,
    );
  }
  if (job.rotAvdrag && job.customerId) {
    const rotIAr = await getRotIArPerKund(Number(idag.slice(0, 4)), job.id);
    const varning = rotTakVarning(
      rotIAr[job.customerId] ?? 0,
      beräknaFaktura(jobbPrisunderlag(job)).rotAvdrag,
    );
    if (varning) varningar.push(varning);
  }

  return (
    <SkrivUtKlient
      faktura={faktura}
      jobId={job.id}
      logoUrl={company.logoUrl}
      nastaFakturanummer={company.nastaFakturanummer}
      tillbaka={tillbaka}
      hinder={fakturaFel(job, company)}
      varningar={varningar}
    />
  );
}
