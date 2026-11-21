import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Gemensamt upplägg för alla sidor under Mina sidor, så att de ser likadana
// ut: samma sidbredd, marginaler och sidhuvud (bakåtlänk, rubrik,
// beskrivning och knappar till höger). Mobil först – 16 px marginal på
// telefonen, knapparna hamnar under rubriken på smal skärm.

const BREDD = {
  /** Formulär och listor med en kolumn */
  smal: "max-w-3xl",
  /** Listor med fler kolumner, t.ex. offerter och fakturor */
  normal: "max-w-5xl",
  /** Jobblistan och statistiken */
  bred: "max-w-6xl",
} as const;

export function Sida({
  bredd = "smal",
  className,
  children,
}: {
  bredd?: keyof typeof BREDD;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 sm:py-8",
        BREDD[bredd],
        className,
      )}
    >
      {children}
    </main>
  );
}

/**
 * Länk tillbaka till en fast föräldersida – inte router.back(), som inte
 * fungerar när sidan öppnats direkt (bokmärke, ny flik, hemskärmen).
 */
export function TillbakaLank({ href, text }: { href: string; text: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {text}
    </Link>
  );
}

export function SidHuvud({
  titel,
  beskrivning,
  tillbaka,
  atgard,
}: {
  titel: React.ReactNode;
  beskrivning?: React.ReactNode;
  tillbaka?: { href: string; text: string };
  /** Knappar till höger om rubriken (under den på mobil) */
  atgard?: React.ReactNode;
}) {
  return (
    <div className="mb-6 space-y-2">
      {tillbaka && <TillbakaLank {...tillbaka} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{titel}</h1>
          {beskrivning && (
            <p className="mt-1 text-sm text-muted-foreground">{beskrivning}</p>
          )}
        </div>
        {atgard && <div className="flex flex-wrap gap-2">{atgard}</div>}
      </div>
    </div>
  );
}

/** Platshållare medan sidans innehåll laddas (Suspense). */
export function SidLaddar() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Laddar">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

/** Ruta med information eller varning ovanför ett formulär. */
export function InfoRuta({
  ton = "info",
  children,
}: {
  ton?: "info" | "varning";
  children: React.ReactNode;
}) {
  return (
    <div
      role={ton === "varning" ? "alert" : undefined}
      className={cn(
        "mb-6 rounded-lg border px-4 py-3 text-sm",
        ton === "info" && "bg-muted/40 text-muted-foreground",
        ton === "varning" &&
          "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
      )}
    >
      {children}
    </div>
  );
}
