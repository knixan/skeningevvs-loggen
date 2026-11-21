"use client";

import { useRef, useState } from "react";
import { Search, User, UserPlus, X } from "lucide-react";
import { kundensNamn, type Customer } from "@/lib/job-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Felmeddelande, SekundarKnapp } from "@/components/minasidor/formular";
import CustomerForm from "@/components/minasidor/kunder/customer-form";

/**
 * Välj en kund ur kundregistret, med sökning. Används i jobb- och
 * offertformuläret. "Skapa ny kund" öppnar kundformuläret i en dialog – den
 * nya kunden väljs direkt och det man fyllt i ligger kvar.
 */
export default function KundValjare({
  customers,
  valdId,
  onValj,
  onNyKund,
  fel,
}: {
  customers: Customer[];
  valdId?: string;
  onValj: (id: string | undefined) => void;
  /** En kund som skapats i dialogen. Formuläret lägger till och väljer den. */
  onNyKund: (kund: Customer) => void;
  fel?: string;
}) {
  const [nyKundOppen, setNyKundOppen] = useState(false);
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

  const nyKundDialog = (
    <Dialog open={nyKundOppen} onOpenChange={setNyKundOppen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ny kund</DialogTitle>
          <DialogDescription>
            Kunden sparas i kundregistret och väljs här direkt.
          </DialogDescription>
        </DialogHeader>
        <CustomerForm
          mode="create"
          onSparad={(kund) => {
            setNyKundOppen(false);
            setKundSok("");
            onNyKund(kund);
          }}
          onAvbryt={() => setNyKundOppen(false)}
        />
      </DialogContent>
    </Dialog>
  );

  if (valdKund) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium text-sm">{kundensNamn(valdKund)}</p>
          <p className="truncate text-xs text-muted-foreground">
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
        <SekundarKnapp onClick={() => setNyKundOppen(true)}>
          <UserPlus className="h-4 w-4" />
          Skapa ny kund
        </SekundarKnapp>
      </div>
      {nyKundDialog}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={kundSokRef}
            type="search"
            aria-label="Sök kund"
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
            <button
              type="button"
              className="underline"
              onClick={() => setNyKundOppen(true)}
            >
              Lägg till en kund
            </button>
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
