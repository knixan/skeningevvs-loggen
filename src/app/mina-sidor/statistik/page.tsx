import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { idagISverige } from "@/lib/datum";
import { getStatistik, tolkaPeriod } from "@/lib/statistik";
import { Card, CardContent } from "@/components/ui/card";
import { StatistikVy } from "@/components/minasidor/statistik/statistik-vy";

export const metadata = { title: "Statistik – Skeningevvs-loggen" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function StatistikPage({ searchParams }: Props) {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <Suspense
        fallback={<div className="animate-pulse h-8 w-48 bg-muted rounded" />}
      >
        <StatistikInnehall searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function StatistikInnehall({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/logga-in");

  // ?ar=2026&manad=3 – ogiltiga värden ger innevarande år
  const period = tolkaPeriod(await searchParams, idagISverige());
  const statistik = await getStatistik(period);

  if (!statistik) {
    return (
      <>
        <h1 className="mb-6 text-2xl font-bold">Statistik</h1>
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
