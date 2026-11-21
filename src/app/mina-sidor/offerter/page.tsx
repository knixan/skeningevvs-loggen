import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/server-hjalp";
import { idagISverige } from "@/lib/datum";
import { getOfferter } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import OffertLista from "@/components/minasidor/offert/offert-lista";

export default function OfferterPage() {
  return (
    <Sida bredd="normal">
      <Suspense
        fallback={<SidLaddar />}
      >
        <OfferterInnehall />
      </Suspense>
    </Sida>
  );
}

async function OfferterInnehall() {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const offerter = await getOfferter();

  return (
    <>
      <SidHuvud
        titel="Offerter"
        beskrivning={`${offerter.length} ${offerter.length === 1 ? "offert" : "offerter"}`}
        atgard={
          <Button asChild>
            <Link href="/mina-sidor/offerter/ny">
              <Plus className="h-4 w-4" />
              Ny offert
            </Link>
          </Button>
        }
      />

      {offerter.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Inga offerter ännu.{" "}
            <Link
              href="/mina-sidor/offerter/ny"
              className="underline hover:text-foreground"
            >
              Skapa din första offert
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <OffertLista offerter={offerter} idag={idagISverige()} />
      )}
    </>
  );
}
