import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { merItems } from "@/components/minasidor/nav-items";
import { Sida, SidHuvud } from "@/components/minasidor/sida";

export const metadata = { title: "Mer – Skeningevvs-loggen" };

// "Mer" i bottenmenyn på mobilen: det som används mer sällan ute på jobb.
// På dator finns allt i sidomenyn.

const BESKRIVNING: Record<string, string> = {
  "/mina-sidor/fakturor": "Utfärdade fakturor, kreditfakturor och export",
  "/mina-sidor/statistik": "Omsättning, ROT, obetalt och arbetade timmar",
  "/mina-sidor/foretag": "Logotyp, kontaktuppgifter och fakturainställningar",
  "/mina-sidor/installningar": "Ahlsell-prislista, export, lösenord och konto",
};

export default function MerPage() {
  return (
    <Sida>
      <SidHuvud titel="Mer" />
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {merItems.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {BESKRIVNING[href]}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Sida>
  );
}
