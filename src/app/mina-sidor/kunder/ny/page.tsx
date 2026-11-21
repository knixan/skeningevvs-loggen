import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server-hjalp";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import CustomerForm from "@/components/minasidor/kunder/customer-form";

export default function NyKundPage() {
  return (
    <Sida>
      <Suspense fallback={<SidLaddar />}>
        <NyKundInnehall />
      </Suspense>
    </Sida>
  );
}

async function NyKundInnehall() {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  return (
    <>
      <SidHuvud
        titel="Ny kund"
        beskrivning="Lägg till en ny kund i kundregistret."
        tillbaka={{ href: "/mina-sidor/kunder", text: "Kundregister" }}
      />
      <CustomerForm mode="create" />
    </>
  );
}
