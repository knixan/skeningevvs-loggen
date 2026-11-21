import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { kortManad } from "@/lib/datum";
import type { Period } from "@/lib/statistik";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Adressen till statistiksidan för ett år och en valfri månad. */
export function statistikUrl(ar: number, manad: number | null) {
  return `/mina-sidor/statistik?ar=${ar}${manad ? `&manad=${manad}` : ""}`;
}

const MANADER = Array.from({ length: 12 }, (_, i) => i + 1);

export function PeriodVal({
  period,
  forstaAr,
  innevarandeAr,
}: {
  period: Period;
  forstaAr: number;
  innevarandeAr: number;
}) {
  const { ar, manad } = period;

  return (
    <nav
      aria-label="Välj period"
      className="flex flex-col gap-3 lg:flex-row lg:items-center"
    >
      <div className="flex items-center gap-1">
        <ArKnapp
          // Månaden följer med, så att t.ex. mars kan jämföras år för år
          href={statistikUrl(ar - 1, manad)}
          aktiv={ar > forstaAr}
          etikett={`Föregående år (${ar - 1})`}
        >
          <ChevronLeft />
        </ArKnapp>
        <span className="w-14 text-center text-lg font-semibold tabular-nums">
          {ar}
        </span>
        <ArKnapp
          href={statistikUrl(ar + 1, manad)}
          aktiv={ar < innevarandeAr}
          etikett={`Nästa år (${ar + 1})`}
        >
          <ChevronRight />
        </ArKnapp>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[null, ...MANADER].map((m) => {
          const vald = m === manad;
          return (
            <Link
              key={m ?? "hela"}
              href={statistikUrl(ar, m)}
              scroll={false}
              aria-current={vald ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                vald
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {m == null ? "Hela året" : kortManad(m)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ArKnapp({
  href,
  aktiv,
  etikett,
  children,
}: {
  href: string;
  aktiv: boolean;
  etikett: string;
  children: React.ReactNode;
}) {
  if (!aktiv) {
    return (
      <Button variant="outline" size="icon" disabled aria-label={etikett}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="icon">
      <Link href={href} scroll={false} aria-label={etikett}>
        {children}
      </Link>
    </Button>
  );
}
