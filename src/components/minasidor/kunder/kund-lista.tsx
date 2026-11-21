"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Mail, Pencil, Phone, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { kundensNamn, type Customer } from "@/lib/job-schema";
import CustomerDeleteButton from "./customer-delete-button";

function matchar(kund: Customer, q: string) {
  return [
    kund.namn,
    kund.foretagsnamn,
    kund.kontaktperson,
    kund.telefon,
    kund.epost,
    kund.adress,
    kund.ort,
  ].some((falt) => (falt ?? "").toLowerCase().includes(q));
}

export default function KundLista({ customers }: { customers: Customer[] }) {
  const [sok, setSok] = useState("");
  const q = sok.trim().toLowerCase();
  const filtrerade = q ? customers.filter((c) => matchar(c, q)) : customers;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Sök namn, telefon, e-post, adress..."
          value={sok}
          onChange={(e) => setSok(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtrerade.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Inga kunder matchar sökningen &quot;{sok}&quot;.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrerade.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between gap-4 pt-5 pb-5">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {c.typ === "foretag" ? (
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="font-semibold truncate">
                      {kundensNamn(c)}
                    </span>
                    <span
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        c.typ === "foretag"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {c.typ === "foretag" ? "Företag" : "Privat"}
                    </span>
                  </div>
                  {c.typ === "foretag" && (c.kontaktperson || c.namn) && (
                    <p className="text-sm text-muted-foreground">
                      {c.kontaktperson || c.namn}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {c.telefon && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.telefon}
                      </span>
                    )}
                    {c.epost && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.epost}
                      </span>
                    )}
                    {c.ort && (
                      <span>
                        {c.postnummer} {c.ort}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="icon" asChild>
                    <Link
                      href={`/mina-sidor/kunder/${c.id}/redigera`}
                      aria-label={`Redigera ${kundensNamn(c)}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <CustomerDeleteButton id={c.id} namn={kundensNamn(c)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
