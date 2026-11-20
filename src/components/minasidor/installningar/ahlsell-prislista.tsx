"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Percent, Store, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormSection,
  FormSubsection,
} from "@/components/minasidor/formular";
import {
  AHLSELL_DELSTORLEK,
  avkodaAnsi,
  beraknaPrislista,
  formateraAvtalsdatum,
  tolkaAvtalsfil,
  tolkaBerakningsgrund,
} from "@/lib/ahlsell";
import {
  paborjaAhlsellImport,
  rensaAhlsellPrislista,
  slutforAhlsellImport,
  sparaAhlsellDel,
  uppdateraMaterialPaslag,
} from "@/lib/ahlsell-actions";

export type AhlsellStatus = {
  antalArtiklar: number;
  importeradVid: string | null;
  avtalInlast: boolean;
  avtalSlutdatum: string;
  materialPaslag: number;
};

const tal = (n: number) => n.toLocaleString("sv-SE");

export default function AhlsellPrislista({ status }: { status: AhlsellStatus }) {
  return (
    <FormSection
      icon={Store}
      title="Ahlsell-prislista"
      description="Läs in prislistan från Ahlsell så kan du söka artiklar med ert inköpspris direkt i jobbet."
    >
      <InlasningForm status={status} />
      <PaslagForm paslag={status.materialPaslag} />
    </FormSection>
  );
}

function InlasningForm({ status }: { status: AhlsellStatus }) {
  const router = useRouter();
  const grundRef = useRef<HTMLInputElement>(null);
  const avtalRef = useRef<HTMLInputElement>(null);
  const [grundFil, setGrundFil] = useState<File | null>(null);
  const [avtalFil, setAvtalFil] = useState<File | null>(null);
  const [framsteg, setFramsteg] = useState<{ klara: number; totalt: number } | null>(null);
  const [tarBort, startTaBort] = useTransition();
  const laser = framsteg !== null;

  async function lasIn() {
    if (!grundFil) {
      toast.error("Välj filen med beräkningsgrund");
      return;
    }
    setFramsteg({ klara: 0, totalt: 0 });
    try {
      const grund = tolkaBerakningsgrund(avkodaAnsi(await grundFil.arrayBuffer()));
      if (grund.artiklar.length === 0) {
        toast.error(
          "Hittade inga artiklar i filen. Är det beräkningsgrunden (textfil) från Ahlsell?",
        );
        return;
      }
      const avtal = avtalFil
        ? tolkaAvtalsfil(avkodaAnsi(await avtalFil.arrayBuffer()))
        : undefined;
      if (avtal && avtal.antalRader === 0) {
        toast.error("Hittade inga avtalsrader i avtalsfilen. Är det rätt fil?");
        return;
      }

      const rader = beraknaPrislista(grund.artiklar, avtal);
      setFramsteg({ klara: 0, totalt: rader.length });

      const start = await paborjaAhlsellImport();
      if (!start.ok) {
        toast.error(start.error);
        return;
      }

      for (let i = 0; i < rader.length; i += AHLSELL_DELSTORLEK) {
        const del = rader.slice(i, i + AHLSELL_DELSTORLEK);
        const res = await sparaAhlsellDel(start.importId, del);
        if (!res.ok) {
          toast.error(`${res.error}. Den tidigare prislistan gäller fortfarande.`);
          return;
        }
        setFramsteg({ klara: i + del.length, totalt: rader.length });
      }

      const klar = await slutforAhlsellImport(start.importId, {
        avtalInlast: Boolean(avtal),
        avtalSlutdatum: avtal?.slutdatum ?? "",
      });
      if (!klar.ok) {
        toast.error(klar.error);
        return;
      }

      toast.success(
        `${tal(rader.length)} artiklar inlästa` +
          (avtal ? " med era avtalspriser" : " (grundpriser, utan avtal)"),
      );
      setGrundFil(null);
      setAvtalFil(null);
      if (grundRef.current) grundRef.current.value = "";
      if (avtalRef.current) avtalRef.current.value = "";
      router.refresh();
    } catch {
      toast.error("Kunde inte läsa in prislistan. Försök igen.");
    } finally {
      setFramsteg(null);
    }
  }

  function taBort() {
    if (!confirm("Ta bort den inlästa Ahlsell-prislistan? Artiklar som redan ligger på jobb påverkas inte.")) {
      return;
    }
    startTaBort(async () => {
      const res = await rensaAhlsellPrislista();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prislistan borttagen");
      router.refresh();
    });
  }

  const slutdatum = formateraAvtalsdatum(status.avtalSlutdatum);

  return (
    <FormSubsection
      icon={FileText}
      title="Prisfiler"
      description={
        <>
          Hämta filerna under Mina sidor på ahlsell.se: <b>beräkningsgrund</b>{" "}
          (artiklar och grundpriser) och <b>avtalsfil</b> (Beställ avtal → ert
          kundavtal). Utan avtalsfil används grundpriset, före era rabatter.
        </>
      }
    >
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        {status.importeradVid ? (
          <>
            <p className="font-medium">
              {tal(status.antalArtiklar)} artiklar inlästa{" "}
              {new Date(status.importeradVid).toLocaleDateString("sv-SE")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status.avtalInlast
                ? `Med era avtalspriser${slutdatum ? ` · avtalet gäller t.o.m. ${slutdatum}` : ""}`
                : "Grundpriser – ingen avtalsfil inläst"}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Ingen prislista inläst ännu.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Beräkningsgrund (krävs)" htmlFor="ahlsell-grund">
          <Input
            ref={grundRef}
            id="ahlsell-grund"
            type="file"
            accept=".txt,.dat,.prn,text/plain"
            disabled={laser}
            onChange={(e) => setGrundFil(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label="Avtalsfil (valfri)" htmlFor="ahlsell-avtal">
          <Input
            ref={avtalRef}
            id="ahlsell-avtal"
            type="file"
            accept=".txt,.dat,.prn,text/plain"
            disabled={laser}
            onChange={(e) => setAvtalFil(e.target.files?.[0] ?? null)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={lasIn} disabled={laser || !grundFil}>
          <Upload className="h-4 w-4" />
          {laser ? "Läser in..." : "Läs in prislista"}
        </Button>
        {status.importeradVid && !laser && (
          <Button
            type="button"
            variant="ghost"
            onClick={taBort}
            disabled={tarBort}
          >
            <Trash2 className="h-4 w-4" />
            Ta bort prislista
          </Button>
        )}
      </div>

      {framsteg && framsteg.totalt > 0 && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(framsteg.klara / framsteg.totalt) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Sparar {tal(framsteg.klara)} av {tal(framsteg.totalt)} artiklar – stäng
            inte sidan.
          </p>
        </div>
      )}
    </FormSubsection>
  );
}

function PaslagForm({ paslag }: { paslag: number }) {
  const [varde, setVarde] = useState(String(paslag));
  const [isPending, startTransition] = useTransition();

  function spara(e: React.FormEvent) {
    e.preventDefault();
    const procent = Number(varde.replace(",", "."));
    if (varde.trim() === "" || !Number.isFinite(procent)) {
      toast.error("Ange påslaget som ett tal");
      return;
    }
    startTransition(async () => {
      const res = await uppdateraMaterialPaslag(procent);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Påslag sparat");
    });
  }

  return (
    <FormSubsection
      icon={Percent}
      title="Påslag på material"
      description="Standardpåslag för nya artiklar i ett jobb. Utpriset räknas som inköpspris + påslag och kan ändras per artikel. 0 % = du fyller i utpriset själv."
    >
      <form onSubmit={spara} className="flex items-end gap-3">
        <Field label="Påslag (%)" htmlFor="material-paslag" className="w-32">
          <Input
            id="material-paslag"
            inputMode="decimal"
            value={varde}
            onChange={(e) => setVarde(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Sparar..." : "Spara"}
        </Button>
      </form>
    </FormSubsection>
  );
}
