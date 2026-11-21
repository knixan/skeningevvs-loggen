import Link from "next/link";
import { kortManad, MANADSNAMN } from "@/lib/datum";
import { formateraKr } from "@/lib/job-schema";
import type { ManadStatistik, Period } from "@/lib/statistik";
import { cn } from "@/lib/utils";
import { statistikUrl } from "./period-val";
import { antal } from "./statistik-delar";

// Stapeldiagram över omsättningen per månad, i ren HTML – ingen klientkod.
// Varje stapel är en länk som väljer månaden, och visar beloppet när man
// håller över eller tabbar till den. Samma siffror står i månadstabellen.

/** "0", "5 tn", "1,5 mn" – för y-axeln. */
const kompakt = new Intl.NumberFormat("sv-SE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Jämna steg för y-axeln (1, 2, 2,5 eller 5 gånger en tiopotens), ca 4 st. */
function axelSteg(max: number) {
  const grovt = max / 4;
  const tiopotens = 10 ** Math.floor(Math.log10(grovt));
  return (
    [1, 2, 2.5, 5].map((f) => f * tiopotens).find((s) => s >= grovt) ??
    10 * tiopotens
  );
}

export function OmsattningDiagram({
  manader,
  period,
}: {
  manader: ManadStatistik[];
  period: Period;
}) {
  const kronor = manader.map((m) => m.omsattningOre / 100);
  const max = Math.max(...kronor);
  const steg = max > 0 ? axelSteg(max) : 2500;
  const topp = max > 0 ? Math.ceil(max / steg) * steg : 4 * steg;
  const linjer = Array.from(
    { length: Math.round(topp / steg) + 1 },
    (_, i) => i * steg,
  );
  const hojd = (kr: number) => `${(kr / topp) * 100}%`;

  return (
    <figure>
      <div className="flex gap-2">
        <div
          aria-hidden
          className="relative h-48 w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
        >
          {linjer.map((v) => (
            <span
              key={v}
              className="absolute right-0 translate-y-1/2 leading-none"
              style={{ bottom: hojd(v) }}
            >
              {kompakt.format(v)}
            </span>
          ))}
        </div>

        <div className="relative h-48 flex-1">
          {linjer.map((v) => (
            <div
              key={v}
              aria-hidden
              className="absolute inset-x-0 border-t border-border"
              style={{ bottom: hojd(v) }}
            />
          ))}

          <ol className="absolute inset-0 flex">
            {manader.map((m, i) => {
              const kr = kronor[i];
              const vald = period.manad === m.manad;
              const framhavd = period.manad == null || vald;
              const namn = `${MANADSNAMN[i]} ${period.ar}`;
              return (
                <li key={m.manad} className="flex flex-1">
                  <Link
                    href={statistikUrl(period.ar, m.manad)}
                    scroll={false}
                    aria-label={`${namn}: ${formateraKr(kr)}, ${antal(m.fakturor, "faktura", "fakturor")}`}
                    aria-current={vald ? "true" : undefined}
                    className="group relative flex w-full items-end justify-center rounded-sm px-0.5 outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring sm:px-1"
                  >
                    <span
                      className={cn(
                        "block w-full max-w-6 rounded-t-[4px]",
                        framhavd ? "bg-primary" : "bg-primary/20",
                      )}
                      style={{ height: hojd(kr) }}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block",
                        // Kanterna: håll rutan inom diagrammet
                        i < 2
                          ? "left-0"
                          : i > 9
                            ? "right-0"
                            : "left-1/2 -translate-x-1/2",
                      )}
                      style={{ bottom: `calc(${hojd(kr)} + 6px)` }}
                    >
                      <span className="block font-semibold tabular-nums">
                        {formateraKr(kr)}
                      </span>
                      <span className="block text-muted-foreground">
                        {namn} · {antal(m.fakturor, "faktura", "fakturor")}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          {max === 0 && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              <span className="bg-card px-2">
                Inga utfärdade fakturor {period.ar}
              </span>
            </p>
          )}
        </div>
      </div>

      <div aria-hidden className="ml-12 mt-1.5 flex">
        {manader.map((m) => (
          <span
            key={m.manad}
            className={cn(
              "flex-1 text-center text-[11px]",
              period.manad === m.manad
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            <span className="sm:hidden">
              {kortManad(m.manad).charAt(0).toUpperCase()}
            </span>
            <span className="hidden sm:inline">{kortManad(m.manad)}</span>
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        Omsättning exkl. moms per månad {period.ar}. Samma siffror finns i
        tabellen Månad för månad.
      </figcaption>
    </figure>
  );
}
