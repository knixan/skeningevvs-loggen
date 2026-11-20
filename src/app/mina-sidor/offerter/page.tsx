import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { idagISverige } from "@/lib/datum";
import { getOfferter } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import OffertLista from "@/components/minasidor/offert/offert-lista";

export default function OfferterPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <Suspense
        fallback={<div className="animate-pulse h-8 w-48 bg-muted rounded" />}
      >
        <OfferterInnehall />
      </Suspense>
    </main>
  );
}

async function OfferterInnehall() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/logga-in");

  const offerter = await getOfferter();

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Offerter</h1>
          <p className="text-sm text-muted-foreground">
            {offerter.length} {offerter.length === 1 ? "offert" : "offerter"}
          </p>
        </div>
        <Button asChild>
          <Link href="/mina-sidor/offerter/ny">
            <Plus className="h-4 w-4 mr-2" />
            Ny offert
          </Link>
        </Button>
      </div>

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
