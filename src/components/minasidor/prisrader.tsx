"use client";

import {
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form";
import {
  Hash,
  Layers2,
  Package,
  Percent,
  Plus,
  Receipt,
  StickyNote,
  Store,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  beräknaPaslag,
  radBelopp,
  utprisMedPaslag,
  type JobInput,
} from "@/lib/job-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Felmeddelande,
  Field,
  FormSubsection,
  SekundarKnapp,
  tomtBlirNoll,
  tomtBlirFel,
  decimalFalt,
} from "@/components/minasidor/formular";
import AhlsellSok from "@/components/minasidor/jobb/ahlsell-sok";

// Artiklar och övriga kostnader – samma fält i jobb- och offertformuläret.
// Komponenterna läser formuläret med useFormContext, så formuläret måste
// ligga i en <FormProvider> och ha fälten `artiklar` och `ovrigaKostnader`.

type MedPrisrader = Pick<JobInput, "artiklar" | "ovrigaKostnader">;

const sek = (n: number) =>
  n.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

export function ArtiklarFalt({
  materialPaslag,
  summering,
}: {
  /** Företagets standardpåslag i procent för nya artikelrader */
  materialPaslag: number;
  /** Från beräknaSummering – räknas inte här */
  summering: {
    artiklarSum: number;
    artiklarInkopSum: number;
    artiklarMarginal: number;
  };
}) {
  const { control, register, setValue, getValues } =
    useFormContext<MedPrisrader>();
  const { errors } = useFormState({ control, name: "artiklar" });
  const artiklar = useFieldArray({ control, name: "artiklar" });
  const live = useWatch({ control, name: "artiklar" });

  // Inköpspris eller påslag ändrat → räkna om utpriset
  function raknaUtpris(i: number) {
    const ink = getValues(`artiklar.${i}.inkopspris`);
    const paslag = getValues(`artiklar.${i}.paslag`);
    if (ink > 0 && typeof paslag === "number" && Number.isFinite(paslag)) {
      setValue(`artiklar.${i}.pris`, utprisMedPaslag(ink, paslag), {
        shouldDirty: true,
      });
    }
  }

  // Utpris skrivet för hand → visa vilket påslag det motsvarar
  function raknaPaslag(i: number) {
    setValue(
      `artiklar.${i}.paslag`,
      beräknaPaslag(
        getValues(`artiklar.${i}.inkopspris`),
        getValues(`artiklar.${i}.pris`),
      ) ?? NaN,
    );
  }

  return (
    <FormSubsection
      icon={Package}
      title="Artiklar"
      action={
        <SekundarKnapp
          onClick={() =>
            artiklar.append({
              namn: "",
              artikelnr: "",
              aterforsaljare: "",
              inkopspris: 0,
              pris: 0,
              antal: 1,
              enhet: "",
              paslag: materialPaslag > 0 ? materialPaslag : undefined,
            })
          }
        >
          <Plus className="h-4 w-4" /> Lägg till
        </SekundarKnapp>
      }
    >
      <AhlsellSok
        onValj={(t, paslag) => {
          const inkopspris = t.nettoprisOre / 100;
          const medPaslag = paslag > 0 && inkopspris > 0;
          artiklar.append({
            namn: t.benamning,
            artikelnr: t.artikelnr,
            aterforsaljare: "Ahlsell",
            inkopspris,
            // Inget påslag inställt → utpriset fylls i för hand
            pris: medPaslag ? utprisMedPaslag(inkopspris, paslag) : 0,
            paslag: medPaslag ? paslag : undefined,
            antal: t.bestallningsmultipel > 1 ? t.bestallningsmultipel : 1,
            enhet: t.enhet,
          });
        }}
      />
      {artiklar.fields.map((field, i) => {
        const rad = live?.[i];
        const radSumma = radBelopp(rad?.pris || 0, rad?.antal || 0);
        return (
          <div
            key={field.id}
            className="rounded-lg border bg-muted/20 p-3 space-y-3"
          >
            <div className="grid grid-cols-12 gap-2 items-start">
              <Field
                label="Artikelnamn"
                icon={<Tag className="h-3 w-3" />}
                className="col-span-10 sm:col-span-5"
                error={errors.artiklar?.[i]?.namn?.message}
              >
                <Input
                  {...register(`artiklar.${i}.namn`)}
                  placeholder="Artikelnamn"
                />
              </Field>
              <div className="col-span-2 sm:col-span-1 sm:order-last flex justify-end pt-5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => artiklar.remove(i)}
                  aria-label="Ta bort artikel"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Field
                label="Artikelnr"
                icon={<Hash className="h-3 w-3" />}
                className="col-span-6 sm:col-span-3"
                error={errors.artiklar?.[i]?.artikelnr?.message}
              >
                <Input
                  {...register(`artiklar.${i}.artikelnr`)}
                  placeholder="Artikelnr"
                />
              </Field>
              <Field
                label="Återförsäljare"
                icon={<Store className="h-3 w-3" />}
                className="col-span-6 sm:col-span-3"
                error={errors.artiklar?.[i]?.aterforsaljare?.message}
              >
                <Input
                  {...register(`artiklar.${i}.aterforsaljare`)}
                  placeholder="T.ex. Ahlsell"
                />
              </Field>
            </div>

            <div className="grid grid-cols-12 gap-2 items-start">
              <Field
                label={
                  rad?.enhet ? `Antal (${rad.enhet.toLowerCase()})` : "Antal"
                }
                icon={<Layers2 className="h-3 w-3" />}
                className="col-span-4 sm:col-span-2"
                error={errors.artiklar?.[i]?.antal?.message}
              >
                <Input
                  {...decimalFalt}
                  {...register(`artiklar.${i}.antal`, {
                    ...tomtBlirFel,
                  })}
                  placeholder="Antal"
                />
              </Field>
              <Field
                label="Inköpspris"
                icon={<Receipt className="h-3 w-3" />}
                className="col-span-4 sm:col-span-3"
                error={errors.artiklar?.[i]?.inkopspris?.message}
              >
                <Input
                  {...decimalFalt}
                  {...register(`artiklar.${i}.inkopspris`, {
                    ...tomtBlirNoll,
                    onChange: () => raknaUtpris(i),
                  })}
                  placeholder="kr"
                />
              </Field>
              <Field
                label="Påslag (%)"
                icon={<Percent className="h-3 w-3" />}
                className="col-span-4 sm:col-span-2"
              >
                <Input
                  {...decimalFalt}
                  {...register(`artiklar.${i}.paslag`, {
                    ...tomtBlirFel,
                    onChange: () => raknaUtpris(i),
                  })}
                  placeholder="%"
                />
              </Field>
              <Field
                label="Utpris"
                icon={<Receipt className="h-3 w-3" />}
                className="col-span-6 sm:col-span-3"
                error={errors.artiklar?.[i]?.pris?.message}
              >
                <Input
                  {...decimalFalt}
                  {...register(`artiklar.${i}.pris`, {
                    ...tomtBlirNoll,
                    onChange: () => raknaPaslag(i),
                  })}
                  placeholder="kr"
                />
                {!(rad?.pris && rad.pris > 0) && (
                  <p className="text-xs font-bold text-varning flex items-center gap-1">
                    <TriangleAlert className="h-3 w-3" />
                    Utpris ej ifyllt
                  </p>
                )}
              </Field>
              <div className="col-span-6 sm:col-span-2 space-y-1.5 text-right">
                <p className="text-sm font-medium">Summa</p>
                <p className="h-9 flex items-center justify-end text-sm font-semibold">
                  {sek(radSumma)}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {artiklar.fields.length > 0 && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between text-muted-foreground">
            <span>Inköpspris totalt</span>
            <span>{sek(summering.artiklarInkopSum)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Pris till kund (exkl. moms)</span>
            <span>{sek(summering.artiklarSum)}</span>
          </div>
          {summering.artiklarInkopSum > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Marginal</span>
              <span
                className={
                  summering.artiklarMarginal < 0
                    ? "text-destructive font-medium"
                    : ""
                }
              >
                {sek(summering.artiklarMarginal)}
              </span>
            </div>
          )}
        </div>
      )}
    </FormSubsection>
  );
}

export function OvrigaKostnaderFalt() {
  const { control, register } = useFormContext<MedPrisrader>();
  const { errors } = useFormState({ control, name: "ovrigaKostnader" });
  const ovrigaKostnader = useFieldArray({ control, name: "ovrigaKostnader" });

  return (
    <FormSubsection
      icon={StickyNote}
      title="Övriga kostnader"
      description="T.ex. förbrukningsmaterial, bortforsling, hyrd utrustning, parkeringskostnad."
      action={
        <SekundarKnapp
          onClick={() => ovrigaKostnader.append({ beskrivning: "", pris: 0 })}
        >
          <Plus className="h-4 w-4" /> Lägg till
        </SekundarKnapp>
      }
    >
      {ovrigaKostnader.fields.length > 0 && (
        <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
          <div className="col-span-9">Produkt / tjänst</div>
          <div className="col-span-2">Pris (kr)</div>
          <div className="col-span-1" />
        </div>
      )}
      {ovrigaKostnader.fields.map((field, i) => (
        <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
          <div className="col-span-8 sm:col-span-9 space-y-1">
            <Input
              {...register(`ovrigaKostnader.${i}.beskrivning`)}
              placeholder="T.ex. parkeringskostnad, hyrd utrustning..."
            />
            <Felmeddelande
              fel={errors.ovrigaKostnader?.[i]?.beskrivning?.message}
            />
          </div>
          <div className="col-span-3 sm:col-span-2 space-y-1">
            <Input
              {...decimalFalt}
              {...register(`ovrigaKostnader.${i}.pris`, tomtBlirNoll)}
              placeholder="0"
            />
            <Felmeddelande fel={errors.ovrigaKostnader?.[i]?.pris?.message} />
          </div>
          <div className="col-span-1 flex justify-end">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => ovrigaKostnader.remove(i)}
              aria-label="Ta bort kostnad"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </FormSubsection>
  );
}
