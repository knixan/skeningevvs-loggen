import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getCustomer } from "@/lib/queries";
import { getSession } from "@/lib/server-hjalp";
import { kundensNamn } from "@/lib/job-schema";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import CustomerForm from "@/components/minasidor/kunder/customer-form";

export default function RedigeraKundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Sida>
      <Suspense fallback={<SidLaddar />}>
        <RedigeraKundInnehall params={params} />
      </Suspense>
    </Sida>
  );
}

async function RedigeraKundInnehall({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <>
      <SidHuvud
        titel="Redigera kund"
        beskrivning={kundensNamn(customer)}
        tillbaka={{ href: "/mina-sidor/kunder", text: "Kundregister" }}
      />
      <CustomerForm mode="edit" defaultValues={{ ...customer, id }} />
    </>
  );
}
