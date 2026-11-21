import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/server-hjalp";
import { idagISverige } from "@/lib/datum";
import { getStatistik, tolkaPeriod } from "@/lib/statistik";
import { Card, CardContent } from "@/components/ui/card";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import { StatistikVy } from "@/components/minasidor/statistik/statistik-vy";

export const metadata = { title: "Statistik – Skeningevvs-loggen" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function StatistikPage({ searchParams }: Props) {
  return (
    <Sida bredd="bred">
      <Suspense
        fallback={<SidLaddar />}
      >
        <StatistikInnehall searchParams={searchParams} />
      </Suspense>
    </Sida>
  );
}

async function StatistikInnehall({ searchParams }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  // ?ar=2026&manad=3 – ogiltiga värden ger innevarande år
  const period = tolkaPeriod(await searchParams, idagISverige());
  const statistik = await getStatistik(period);

  if (!statistik) {
    return (
      <>
        <SidHuvud titel="Statistik" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Ingen statistik ännu.{" "}
            <Link
              href="/mina-sidor/nytt-jobb"
              className="underline hover:text-foreground"
            >
              Lägg in ditt första jobb
            </Link>
            .
          </CardContent>
        </Card>
      </>
    );
  }

  return <StatistikVy s={statistik} />;
}
