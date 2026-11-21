import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HittadesInte() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">Sidan hittades inte</h1>
      <p className="text-sm text-muted-foreground">
        Adressen finns inte. Kontrollera länken eller gå till startsidan.
      </p>
      <Button asChild>
        <Link href="/">Till startsidan</Link>
      </Button>
    </main>
  );
}
