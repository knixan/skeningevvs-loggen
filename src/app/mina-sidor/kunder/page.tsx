import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getCustomers } from "@/lib/queries";
import { getSession } from "@/lib/server-hjalp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import KundLista from "@/components/minasidor/kunder/kund-lista";

export default function KundregisterPage() {
  return (
    <Sida>
      <Suspense fallback={<SidLaddar />}>
        <KunderInnehall />
      </Suspense>
    </Sida>
  );
}

async function KunderInnehall() {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const customers = await getCustomers();

  return (
    <>
      <SidHuvud
        titel="Kundregister"
        beskrivning={`${customers.length} ${customers.length === 1 ? "kund" : "kunder"}`}
        atgard={
          <Button asChild>
            <Link href="/mina-sidor/kunder/ny">
              <Plus className="h-4 w-4" />
              Ny kund
            </Link>
          </Button>
        }
      />

      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Inga kunder ännu.{" "}
            <Link
              href="/mina-sidor/kunder/ny"
              className="underline hover:text-foreground"
            >
              Lägg till din första kund
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <KundLista customers={customers} />
      )}
    </>
  );
}
