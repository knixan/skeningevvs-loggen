"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
      <h1 className="text-xl font-bold">Något gick fel</h1>
      <p className="text-sm text-muted-foreground">
        Ett oväntat fel uppstod när sidan laddades. Försök igen, eller gå
        tillbaka till startsidan om problemet kvarstår.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Försök igen</Button>
        <Button variant="outline" asChild>
          <Link href="/mina-sidor">Till Mina jobb</Link>
        </Button>
      </div>
    </main>
  );
}
