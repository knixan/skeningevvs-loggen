import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import InstallningarKlient from "@/components/minasidor/installningar/installningar-klient";

export const metadata = { title: "Inställningar – Skeningevvs-loggen" };

export default function InstallningarPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <Suspense
        fallback={<div className="animate-pulse h-8 w-48 bg-muted rounded" />}
      >
        <InstallningarInnehall />
      </Suspense>
    </main>
  );
}

async function InstallningarInnehall() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/logga-in");

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Inställningar</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {session.user.email}
        </p>
      </div>
      <InstallningarKlient />
    </>
  );
}
