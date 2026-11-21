import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getJobbRaknare, getJobs } from "@/lib/queries";
import { getSession } from "@/lib/server-hjalp";
import { tolkaJobbFilter, tolkaJobbSok } from "@/lib/jobb-filter";
import { Button } from "@/components/ui/button";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import JobDashboard from "@/components/minasidor/jobb/job-dashboard";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function MinaSidorPage({ searchParams }: Props) {
  return (
    <Sida bredd="bred">
      <Suspense fallback={<SidLaddar />}>
        <MinaSidorInnehall searchParams={searchParams} />
      </Suspense>
    </Sida>
  );
}

async function MinaSidorInnehall({ searchParams }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  // ?status=fakturerat&sok=berga – filtreras och räknas i databasen
  const sp = await searchParams;
  const forsta = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const filter = tolkaJobbFilter(forsta(sp.status));
  const sok = tolkaJobbSok(forsta(sp.sok));

  const [{ jobs, nextCursor }, raknare] = await Promise.all([
    getJobs({ filter, sok }),
    getJobbRaknare(sok),
  ]);

  return (
    <>
      <SidHuvud
        titel="Mina jobb"
        beskrivning={`Välkommen, ${session.user.name}`}
        atgard={
          <Button asChild>
            <Link href="/mina-sidor/nytt-jobb">
              <Plus className="h-4 w-4" />
              Nytt jobb
            </Link>
          </Button>
        }
      />
      <JobDashboard
        jobs={jobs}
        nextCursor={nextCursor}
        filter={filter}
        sok={sok}
        raknare={raknare}
      />
    </>
  );
}
