import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

// Visas av notFound(), t.ex. för ett jobb som har tagits bort
export default function HittadesInte() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-bold">Sidan hittades inte</h1>
      <p className="text-sm text-muted-foreground">
        Det du letar efter finns inte längre – det kan ha tagits bort.
      </p>
      <Button asChild>
        <Link href="/mina-sidor">Till Mina jobb</Link>
      </Button>
    </main>
  );
}
