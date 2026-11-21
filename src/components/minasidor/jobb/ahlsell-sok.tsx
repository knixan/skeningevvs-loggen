"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  sokAhlsellArtiklar,
  type AhlsellTraff,
} from "@/lib/ahlsell-actions";
import { prisvarning } from "@/lib/ahlsell";

const kr = (ore: number) =>
  (ore / 100).toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 2,
  });

/**
 * Sökruta mot den inlästa Ahlsell-prislistan. `onValj` får artikeln och
 * företagets påslag i procent.
 */
export default function AhlsellSok({
  onValj,
}: {
  onValj: (artikel: AhlsellTraff, paslag: number) => void;
}) {
  const [sok, setSok] = useState("");
  const [fokus, setFokus] = useState(false);
  const [laddar, setLaddar] = useState(false);
  const [traffar, setTraffar] = useState<AhlsellTraff[]>([]);
  const [paslag, setPaslag] = useState(0);
  const [harPrislista, setHarPrislista] = useState<boolean | null>(null);
  const [fel, setFel] = useState<string | null>(null);
  const senasteSok = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function sokEfter(text: string) {
    setSok(text);
    if (timer.current) clearTimeout(timer.current);
    const nr = ++senasteSok.current;
    const q = text.trim();
    if (q.length < 2) {
      setTraffar([]);
      setLaddar(false);
      return;
    }
    setLaddar(true);
    // Vänta tills användaren slutat skriva en kort stund
    timer.current = setTimeout(async () => {
      const res = await sokAhlsellArtiklar(q).catch(() => null);
      // Ett långsamt svar på en gammal sökning får inte skriva över ett nytt
      if (nr !== senasteSok.current) return;
      setLaddar(false);
      if (!res || !res.ok) {
        setFel(res?.error ?? "Sökningen misslyckades");
        setTraffar([]);
        return;
      }
      setFel(null);
      setHarPrislista(res.harPrislista);
      setPaslag(res.paslag);
      setTraffar(res.traffar);
    }, 250);
  }

  function valj(t: AhlsellTraff) {
    onValj(t, paslag);
    sokEfter("");
  }

  const visaLista = fokus && sok.trim().length >= 2;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Sök i Ahlsells prislista – benämning eller artikelnummer..."
          value={sok}
          onChange={(e) => sokEfter(e.target.value)}
          onFocus={() => setFokus(true)}
          onBlur={() => setTimeout(() => setFokus(false), 150)}
          onKeyDown={(e) => {
            // Enter ska inte skicka hela jobbformuläret
            if (e.key === "Enter") {
              e.preventDefault();
              if (traffar[0]) valj(traffar[0]);
            }
          }}
          className="pl-9 pr-9"
          aria-label="Sök artikel hos Ahlsell"
        />
        {laddar && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {visaLista && !laddar && (
        <>
          {fel ? (
            <p className="text-xs text-destructive">{fel}</p>
          ) : harPrislista === false ? (
            <p className="text-xs text-muted-foreground">
              Ingen Ahlsell-prislista inläst.{" "}
              <a href="/mina-sidor/installningar" className="underline">
                Läs in den under Inställningar
              </a>
              .
            </p>
          ) : traffar.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Inga artiklar matchar sökningen.
            </p>
          ) : (
            <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
              {traffar.map((t) => {
                const varning = prisvarning(t.materialklass);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-start justify-between gap-3"
                    onClick={() => valj(t)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.benamning}</p>
                      <p className="text-xs text-muted-foreground">
                        Art.nr {t.artikelnr}
                        {!t.lagerford && " · Ej lagerförd"}
                        {t.bestallningsmultipel > 1 &&
                          ` · Säljs i ${t.bestallningsmultipel.toLocaleString("sv-SE")} ${t.enhet.toLowerCase()}`}
                        {varning && (
                          <span className="text-varning">
                            {" "}
                            · {varning}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-sm font-medium whitespace-nowrap">
                      {t.nettoprisOre > 0 ? (
                        <>
                          {kr(t.nettoprisOre)}
                          <span className="text-xs font-normal text-muted-foreground">
                            /{(t.enhet || "st").toLowerCase()}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-normal text-muted-foreground">
                          Pris på begäran
                        </span>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
