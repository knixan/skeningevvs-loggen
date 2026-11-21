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
import { Chip, filterChipKlass, type ChipTon } from "@/components/minasidor/chip";
import { SkapaJobbKnapp, TaBortOffertKnapp } from "./offert-knappar";

const statusTon: Record<OffertStatus, ChipTon> = {
  utkast: "neutral",
  skickad: "info",
  accepterad: "ok",
  avbojd: "fel",
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
              className={filterChipKlass(filter === f.value)}
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
                        className="block truncate text-lg font-bold text-blue-700 hover:underline"
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
                      <Chip ton={statusTon[o.status]}>
                        {OFFERT_STATUS_TEXT[o.status]}
                      </Chip>
                      {gattUt && <Chip ton="varning">Har gått ut</Chip>}
                      {o.rotAvdrag && <Chip>ROT</Chip>}
                      {o.fastPris != null && <Chip>Fast pris</Chip>}
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
