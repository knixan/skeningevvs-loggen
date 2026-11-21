import * as React from "react";
import { cn } from "@/lib/utils";

// Små etiketter för status (Betalt, Pågående, ROT …) och filterknapparna
// ovanför listorna. En färg betyder alltid samma sak i hela appen:
//
//   neutral – bara information (Ej påbörjat, Utkast, ROT, Privat)
//   info    – pågår (Pågående, Skickad, Företag)
//   ok      – klart (Utfört, Betalt, Accepterad)
//   varning – behöver åtgärd (Fakturerat/obetalt, Följ upp, Har gått ut)
//   fel     – fel eller försenat (Avböjd, Krediterad)
//   larm    – försenat och måste göras nu (Följ upp med passerat datum)
//
// Färgerna är variabler i globals.css – skriv inte green-700 m.fl. i en vy.

export type ChipTon = "neutral" | "info" | "ok" | "varning" | "fel" | "larm";

const TON: Record<ChipTon, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-info/10 text-info",
  ok: "bg-ok/10 text-ok",
  varning: "bg-varning/15 text-varning",
  fel: "bg-destructive/10 text-destructive",
  larm: "bg-destructive text-white",
};

export function Chip({
  ton = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { ton?: ChipTon }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0",
        TON[ton],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Klasser för en filterknapp (jobb, offerter, år på fakturor). */
export function filterChipKlass(aktiv: boolean) {
  return cn(
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
    aktiv
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}
