import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCustomers } from "@/lib/job-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import KundLista from "@/components/minasidor/kunder/kund-lista";

export default function KundregisterPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Suspense
        fallback={<div className="animate-pulse h-8 w-48 bg-muted rounded" />}
      >
        <KunderInnehall />
      </Suspense>
    </main>
  );
}

async function KunderInnehall() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/logga-in");

  const customers = await getCustomers();

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Kundregister</h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} {customers.length === 1 ? "kund" : "kunder"}
          </p>
        </div>
        <Link href="/mina-sidor/kunder/ny">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Ny kund
          </Button>
        </Link>
      </div>

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
