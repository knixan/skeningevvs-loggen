import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background">
      <main className="flex w-full max-w-xl flex-col items-center gap-6 px-6 py-32 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Skeningevvs-loggen
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Din personliga loggbok. Logga in eller skapa ett konto för att
          komma igång.
        </p>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Button asChild size="lg" className="sm:w-40">
            <Link href="/logga-in">Logga in</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="sm:w-40">
            <Link href="/registrera">Registrera</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
