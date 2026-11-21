import { Suspense } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { idagISverige } from "@/lib/datum";
import {
  getJob,
  getCustomers,
  getFaktura,
  getRotIArPerKund,
} from "@/lib/queries";
import { getSession, inloggatForetag } from "@/lib/server-hjalp";
import { Button } from "@/components/ui/button";
import {
  InfoRuta,
  Sida,
  SidHuvud,
  SidLaddar,
} from "@/components/minasidor/sida";
import EditJobClient from "@/components/minasidor/jobb/edit-job-client";

export default function RedigeraJobbPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Sida>
      <Suspense fallback={<SidLaddar />}>
        <RedigeraJobbInnehall params={params} />
      </Suspense>
    </Sida>
  );
}

async function RedigeraJobbInnehall({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const { id } = await params;
  const [job, customers, company, faktura, rotIArPerKund] = await Promise.all([
    getJob(id),
    getCustomers(),
    inloggatForetag(),
    getFaktura(id),
    // Jobbets egna fakturor räknas inte – dess ROT räknas i formuläret
    getRotIArPerKund(Number(idagISverige().slice(0, 4)), id),
  ]);

  if (!job) notFound();

  return (
    <>
      <SidHuvud
        titel="Redigera jobb"
        tillbaka={{ href: "/mina-sidor", text: "Mina jobb" }}
        atgard={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/mina-sidor/jobb/${job.id}/skriv-ut`}>
              <FileText className="h-4 w-4" />
              {faktura ? `Faktura ${faktura.fakturanummer}` : "Faktura"}
            </Link>
          </Button>
        }
      />
      {faktura && (
        <InfoRuta>
          Faktura {faktura.fakturanummer} är utfärdad och sparad. Ändringar
          här påverkar inte fakturan.
        </InfoRuta>
      )}
      <EditJobClient
        job={job}
        customers={customers}
        materialPaslag={company?.materialPaslag ?? 0}
        utfardadFaktura={faktura?.fakturanummer ?? null}
        rotIArPerKund={rotIArPerKund}
      />
    </>
  );
}
