"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, User, UserPlus, X } from "lucide-react";
import { kundensNamn, type Customer } from "@/lib/job-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Felmeddelande, SekundarKnapp } from "@/components/minasidor/formular";

/**
 * Välj en kund ur kundregistret, med sökning. Används i jobb- och
 * offertformuläret.
 */
export default function KundValjare({
  customers,
  valdId,
  onValj,
  fel,
}: {
  customers: Customer[];
  valdId?: string;
  onValj: (id: string | undefined) => void;
  fel?: string;
}) {
  // "Skapa ny kund" öppnar en ny flik. När man kommer tillbaka hämtas
  // kundlistan på nytt med router.refresh() – det behåller det man redan
  // fyllt i i formuläret, till skillnad från att ladda om sidan.
  const router = useRouter();
  const vantarPaNyKund = useRef(false);
  useEffect(() => {
    function hamtaNyaKunder() {
      if (document.visibilityState !== "visible" || !vantarPaNyKund.current)
        return;
      vantarPaNyKund.current = false;
      router.refresh();
    }
    document.addEventListener("visibilitychange", hamtaNyaKunder);
    window.addEventListener("focus", hamtaNyaKunder);
    return () => {
      document.removeEventListener("visibilitychange", hamtaNyaKunder);
      window.removeEventListener("focus", hamtaNyaKunder);
    };
  }, [router]);

  const [kundSok, setKundSok] = useState("");
  const [kundFokus, setKundFokus] = useState(false);
  const kundSokRef = useRef<HTMLInputElement>(null);
  const valdKund = customers.find((c) => c.id === valdId) ?? null;

  const filtradeKunder = kundSok.trim()
    ? customers.filter((c) => {
        const q = kundSok.toLowerCase();
        return (
          c.namn.toLowerCase().includes(q) ||
          (c.foretagsnamn ?? "").toLowerCase().includes(q) ||
          (c.telefon ?? "").includes(q) ||
          (c.epost ?? "").toLowerCase().includes(q)
        );
      })
    : customers;

  if (valdKund) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
        <div className="space-y-0.5">
          <p className="font-medium text-sm">{kundensNamn(valdKund)}</p>
          <p className="text-xs text-muted-foreground">
            {valdKund.typ === "foretag" && valdKund.kontaktperson
              ? `${valdKund.kontaktperson} · `
              : ""}
            {valdKund.telefon}
            {valdKund.telefon && valdKund.epost ? " · " : ""}
            {valdKund.epost}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onValj(undefined);
            setKundSok("");
          }}
        >
          <X className="h-4 w-4 mr-1" />
          Byt kund
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <SekundarKnapp onClick={() => kundSokRef.current?.focus()}>
          <User className="h-4 w-4" />
          Befintlig kund
        </SekundarKnapp>
        <SekundarKnapp asChild>
          <a
            href="/mina-sidor/kunder/ny"
            target="_blank"
            rel="noreferrer"
            onClick={() => (vantarPaNyKund.current = true)}
          >
            <UserPlus className="h-4 w-4" />
            Skapa ny kund
          </a>
        </SekundarKnapp>
      </div>
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={kundSokRef}
            placeholder="Sök på namn, telefon eller e-post..."
            value={kundSok}
            onChange={(e) => setKundSok(e.target.value)}
            onFocus={() => setKundFokus(true)}
            onBlur={() => setTimeout(() => setKundFokus(false), 150)}
            className="pl-9"
          />
        </div>
        {customers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Inga kunder i kundregistret ännu.{" "}
            <a
              href="/mina-sidor/kunder/ny"
              className="underline"
              target="_blank"
              onClick={() => (vantarPaNyKund.current = true)}
            >
              Lägg till en kund
            </a>
            .
          </p>
        ) : (kundSok.trim() || kundFokus) && filtradeKunder.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Inga kunder matchar sökningen.
          </p>
        ) : kundSok.trim() || kundFokus ? (
          <div className="rounded-lg border divide-y max-h-60 overflow-y-auto">
            {filtradeKunder.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onValj(c.id);
                  setKundSok("");
                  setKundFokus(false);
                }}
              >
                <p className="text-sm font-medium">{kundensNamn(c)}</p>
                <p className="text-xs text-muted-foreground">
                  {c.typ === "foretag" && c.kontaktperson
                    ? `${c.kontaktperson} · `
                    : ""}
                  {c.telefon}
                  {c.telefon && c.epost ? " · " : ""}
                  {c.epost}
                </p>
              </button>
            ))}
          </div>
        ) : null}
        <Felmeddelande fel={fel} />
      </div>
    </div>
  );
}
