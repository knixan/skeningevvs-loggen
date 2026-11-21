import { Suspense } from "react";
import { redirect } from "next/navigation";
import { idagISverige } from "@/lib/datum";
import { getCustomers, getRotIArPerKund } from "@/lib/queries";
import { getSession, inloggatForetag } from "@/lib/server-hjalp";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import NyttJobbClient from "@/components/minasidor/jobb/nytt-jobb-client";

export default function NyttJobbPage() {
  return (
    <Sida>
      <Suspense fallback={<SidLaddar />}>
        <NyttJobbInnehall />
      </Suspense>
    </Sida>
  );
}

async function NyttJobbInnehall() {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const [customers, company, rotIArPerKund] = await Promise.all([
    getCustomers(),
    inloggatForetag(),
    getRotIArPerKund(Number(idagISverige().slice(0, 4))),
  ]);

  return (
    <>
      <SidHuvud
        titel="Nytt jobb"
        tillbaka={{ href: "/mina-sidor", text: "Mina jobb" }}
      />
      <NyttJobbClient
        customers={customers}
        materialPaslag={company?.materialPaslag ?? 0}
        rotIArPerKund={rotIArPerKund}
      />
    </>
  );
}
