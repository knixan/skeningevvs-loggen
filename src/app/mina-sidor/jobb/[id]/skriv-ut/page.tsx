import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getJob, getCompanySettings } from "@/lib/job-actions";
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
  const [job, company] = await Promise.all([getJob(id), getCompanySettings()]);

  if (!job) notFound();
  if (!company) notFound();

  // Att öppna sidan ändrar ingenting. Har jobbet inget fakturanummer visas en
  // förhandsgranskning, och numret delas ut först med "Utfärda faktura".
  return (
    <SkrivUtKlient
      job={job}
      company={company}
      fakturanummer={job.fakturanummer ?? null}
    />
  );
}
