"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, FileText, Pencil, Search } from "lucide-react";
import { kortDatum } from "@/lib/datum";
import {
  beräknaFaktura,
  formateraKr,
  kundensNamn,
  OFFERT_STATUS_TEXT,
  OFFERT_STATUSAR,
  offertPrisunderlag,
  type Offert,
  type OffertStatus,
} from "@/lib/job-schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SkapaJobbKnapp, TaBortOffertKnapp } from "./offert-knappar";

const statusFarg: Record<OffertStatus, string> = {
  utkast: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  skickad: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  accepterad:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  avbojd: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

type Filter = "alla" | OffertStatus;

/** Utkast och skickade offerter vars sista giltighetsdag har passerat. */
function harGattUt(offert: Offert, idag: string) {
  return (
    (offert.status === "utkast" || offert.status === "skickad") &&
    offert.giltigTill < idag
  );
}

function matchar(offert: Offert, q: string) {
  return [
    String(offert.offertnummer),
    kundensNamn(offert.customer),
    offert.customer?.adress,
    offert.customer?.ort,
    offert.beskrivning,
    offert.internaAnteckningar,
  ].some((falt) => (falt ?? "").toLowerCase().includes(q));
}

export default function OffertLista({
  offerter,
  idag,
}: {
  offerter: Offert[];
  /** Dagens datum i Sverige (YYYY-MM-DD), från servern */
  idag: string;
}) {
  const [filter, setFilter] = useState<Filter>("alla");
  const [sok, setSok] = useState("");

  const q = sok.trim().toLowerCase();
  const visade = offerter.filter(
    (o) => (filter === "alla" || o.status === filter) && (!q || matchar(o, q)),
  );

  const filterknappar: { value: Filter; label: string }[] = [
    { value: "alla", label: "Alla" },
    ...OFFERT_STATUSAR.map((s) => ({ value: s, label: OFFERT_STATUS_TEXT[s] })),
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Sök kund, offertnummer, beskrivning..."
          value={sok}
          onChange={(e) => setSok(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {filterknappar.map((f) => {
          const antal =
            f.value === "alla"
              ? offerter.length
              : offerter.filter((o) => o.status === f.value).length;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
              <span className="text-xs opacity-80">({antal})</span>
            </button>
          );
        })}
      </div>

      {visade.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Inga offerter matchar{sok ? ` sökningen "${sok}"` : ""} med vald
            status.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visade.map((o) => {
            const pris = beräknaFaktura(offertPrisunderlag(o));
            const beskrivning = o.beskrivning.trim().split("\n")[0];
            const gattUt = harGattUt(o, idag);
            return (
              <Card key={o.id}>
                <CardContent className="space-y-4 pt-5">
                  {/* Överst: vem och vad till vänster, priset till höger */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Offert {o.offertnummer}
                      </p>
                      <Link
                        href={`/mina-sidor/offerter/${o.id}/redigera`}
                        className="block truncate text-lg font-bold text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {kundensNamn(o.customer) || "Ingen kund vald"}
                      </Link>
                      {beskrivning && (
                        <p className="truncate text-sm text-foreground/80">
                          {beskrivning}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="whitespace-nowrap text-lg font-semibold tabular-nums">
                        {formateraKr(pris.attBetala)}
                      </div>
                      <div className="whitespace-nowrap text-xs text-muted-foreground">
                        {pris.rotAvdrag > 0 ? "efter ROT" : "inkl. moms"}
                      </div>
                    </div>
                  </div>

                  {/* Nederst: status och giltighet till vänster, knappar till höger */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          statusFarg[o.status],
                        )}
                      >
                        {OFFERT_STATUS_TEXT[o.status]}
                      </span>
                      {gattUt && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Har gått ut
                        </span>
                      )}
                      {o.rotAvdrag && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          ROT
                        </span>
                      )}
                      {o.fastPris != null && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          Fast pris
                        </span>
                      )}
                      <span className="ml-1 inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Gäller t.o.m. {kortDatum(o.giltigTill)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/mina-sidor/offerter/${o.id}/skriv-ut`}
                          target="_blank"
                        >
                          <FileText className="h-4 w-4" />
                          Offert
                        </Link>
                      </Button>
                      <SkapaJobbKnapp
                        offertId={o.id}
                        offertnummer={o.offertnummer}
                        jobId={o.jobId}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Redigera"
                        asChild
                      >
                        <Link href={`/mina-sidor/offerter/${o.id}/redigera`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <TaBortOffertKnapp
                        offertId={o.id}
                        offertnummer={o.offertnummer}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
