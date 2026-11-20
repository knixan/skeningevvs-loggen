"use client";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Trash2,
  Package,
  Tag,
  Hash,
  Store,
  Layers2,
  Receipt,
  StickyNote,
  MapPin,
  Calendar,
  Van,
  Clock,
  ClipboardList,
  CheckCircle2,
  CreditCard,
  NotebookPen,
  TriangleAlert,
  Wrench,
  User,
  UserPlus,
  Search,
  ImagePlus,
  Calculator,
  X,
} from "lucide-react";

import {
  jobSchema,
  type JobInput,
  beräknaSummering,
  type Customer,
} from "@/lib/job-schema";
import { deleteUploadedImage } from "@/lib/job-actions";
import { foreslagetUtpris } from "@/lib/ahlsell";
import AhlsellSok from "./ahlsell-sok";
import { idag } from "@/lib/datum";
import { useUploadThing } from "@/lib/uploadthing-client";
import { useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FormSection,
  FormSubsection,
  SekundarKnapp,
} from "@/components/minasidor/formular";

interface Props {
  onSubmit: (data: JobInput, bilder: { url: string; key: string }[]) => void;
  defaultValues?: Partial<JobInput>;
  submitLabel?: string;
  isPending?: boolean;
  customers?: Customer[];
}

const tomDefaults: JobInput = {
  customerId: undefined,
  artiklar: [],
  resor: [],
  arbetstider: [],
  ovrigaKostnader: [],
  timpris: 0,
  milersattning: 0,
  rotAvdrag: false,
  pagaende: false,
  utfort: false,
  fakturerat: false,
  betalt: false,
  foljUpp: false,
  foljUppDatum: "",
  anteckningar: "",
  utfortArbete: "",
  planeratArbete: "",
  internaAnteckningar: "",
  bilder: [],
  fastPris: undefined,
};

const sek = (n: number) =>
  n.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

export default function JobForm({
  onSubmit,
  defaultValues,
  submitLabel = "Spara jobb",
  isPending = false,
  customers = [],
}: Props) {
  const form = useForm<JobInput>({
    resolver: zodResolver(jobSchema) as Resolver<JobInput>,
    defaultValues: { ...tomDefaults, ...defaultValues },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = form;

  const artiklar = useFieldArray({ control, name: "artiklar" });
  const resor = useFieldArray({ control, name: "resor" });
  const arbetstider = useFieldArray({ control, name: "arbetstider" });
  const ovrigaKostnader = useFieldArray({ control, name: "ovrigaKostnader" });

  const live = useWatch({ control }) as Partial<JobInput>;
  const summering = beräknaSummering({ ...tomDefaults, ...live } as JobInput);

  // Kundväljare
  const [kundSok, setKundSok] = useState("");
  const [kundFokus, setKundFokus] = useState(false);
  const kundSokRef = useRef<HTMLInputElement>(null);
  const valdCustomerId = live.customerId;
  const valdKund = customers.find((c) => c.id === valdCustomerId) ?? null;

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

  // Bilder
  const [bilder, setBilder] = useState<{ url: string; key: string }[]>(
    defaultValues?.bilder ?? [],
  );
  // Nycklar som redan var sparade på jobbet när formuläret öppnades. Dessa
  // rensas från UploadThing av updateJob när formuläret sparas (precis som
  // alla andra fält) – bara nyligen uppladdade, ännu osparade bilder som tas
  // bort raderas direkt, eftersom det annars aldrig städas upp.
  const persistedBildKeysRef = useRef(
    new Set((defaultValues?.bilder ?? []).map((b) => b.key)),
  );
  const [laddarUpp, setLaddarUpp] = useState(false);
  const [valdBild, setValdBild] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { startUpload } = useUploadThing("jobbBilder");

  async function hanteraFiler(e: React.ChangeEvent<HTMLInputElement>) {
    const filer = Array.from(e.target.files ?? []);
    if (!filer.length) return;
    setLaddarUpp(true);
    try {
      const res = await startUpload(filer);
      if (res) {
        setBilder((prev) => [
          ...prev,
          ...res.map((bild) => ({ url: bild.ufsUrl, key: bild.key })),
        ]);
      }
    } catch {
      toast.error("Bilduppladdning misslyckades. Försök igen.");
    } finally {
      setLaddarUpp(false);
    }
  }

  async function taBortBild(key: string) {
    setBilder((prev) => prev.filter((b) => b.key !== key));

    // Bilder som redan fanns sparade på jobbet rensas från UploadThing när
    // formuläret sparas (se updateJob) – precis som alla andra fält, så att
    // en avbruten redigering inte lämnar en trasig bildreferens i databasen.
    // En nyligen uppladdad bild som tas bort innan sparning har ingen annan
    // städning, så den raderas direkt.
    if (persistedBildKeysRef.current.has(key)) return;

    const result = await deleteUploadedImage(key);
    if (!result.ok) {
      toast.error("Kunde inte radera bilden från lagringen.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data, bilder))}
      className="space-y-6"
    >
      {/* 1. Kund & planering */}
      <FormSection icon={User} title="Kund & planering">
        <FormSubsection icon={User} title="Kund">
          {valdKund ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <div className="space-y-0.5">
                <p className="font-medium text-sm">
                  {valdKund.typ === "foretag" && valdKund.foretagsnamn
                    ? valdKund.foretagsnamn
                    : valdKund.namn}
                </p>
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
                  setValue("customerId", undefined, { shouldDirty: true });
                  setKundSok("");
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Byt kund
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <SekundarKnapp onClick={() => kundSokRef.current?.focus()}>
                  <User className="h-4 w-4" />
                  Befintlig kund
                </SekundarKnapp>
                <SekundarKnapp asChild>
                  <a href="/mina-sidor/kunder/ny" target="_blank" rel="noreferrer">
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
                    >
                      Lägg till en kund
                    </a>
                    .
                  </p>
                ) : (kundSok.trim() || kundFokus) &&
                  filtradeKunder.length === 0 ? (
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
                          setValue("customerId", c.id, { shouldDirty: true });
                          setKundSok("");
                          setKundFokus(false);
                        }}
                      >
                        <p className="text-sm font-medium">
                          {c.typ === "foretag" && c.foretagsnamn
                            ? c.foretagsnamn
                            : c.namn}
                        </p>
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
              </div>
            </div>
          )}
        </FormSubsection>

        <FormSubsection icon={ClipboardList} title="Planera arbete & bilder">
          <Textarea
            rows={4}
            {...register("planeratArbete")}
            placeholder="Vad ska göras? T.ex. byta rör i kök, dra el till garage..."
          />
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
              Bilder
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={hanteraFiler}
            />
            <SekundarKnapp
              disabled={laddarUpp}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              {laddarUpp ? "Laddar upp..." : "Lägg till bilder"}
            </SekundarKnapp>
            {bilder.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                {bilder.map((bild) => (
                  <div key={bild.key} className="relative group aspect-square">
                    <Image
                      src={bild.url}
                      alt="Jobbild"
                      fill
                      sizes="(max-width: 640px) 33vw, 200px"
                      className="object-cover rounded-lg cursor-pointer"
                      onClick={() => setValdBild(bild.url)}
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        taBortBild(bild.key);
                      }}
                      aria-label="Ta bort bild"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormSubsection>
      </FormSection>

      {/* 2. Material */}
      <FormSection icon={Package} title="Material">
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
              artiklar.append({
                namn: t.benamning,
                artikelnr: t.artikelnr,
                aterforsaljare: "Ahlsell",
                inkopspris,
                // Inget påslag inställt → utpriset fylls i för hand
                pris:
                  paslag > 0 && inkopspris > 0
                    ? foreslagetUtpris(inkopspris, paslag)
                    : 0,
                antal:
                  t.bestallningsmultipel > 1 ? t.bestallningsmultipel : 1,
                enhet: t.enhet,
              });
            }}
          />
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <div className="col-span-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Artikelnamn
            </div>
            <div className="col-span-2 flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" />
              Artikelnr
            </div>
            <div className="col-span-2 flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" />
              Återförsäljare
            </div>
            <div className="col-span-1 flex items-center justify-center gap-1">
              <Layers2 className="h-3.5 w-3.5" />
              Antal
            </div>
            <div className="col-span-2 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Inköpspris
            </div>
            <div className="col-span-2 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Utpris (kr)
            </div>
            <div className="col-span-1" />
          </div>
          {artiklar.fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-12 sm:col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Artikelnamn
                </Label>
                <Input
                  {...register(`artiklar.${i}.namn`)}
                  placeholder="Artikelnamn"
                />
                {errors.artiklar?.[i]?.namn && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.artiklar[i]?.namn?.message}
                  </p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Artikelnummer
                </Label>
                <Input
                  {...register(`artiklar.${i}.artikelnr`)}
                  placeholder="Artikelnummer"
                />
              </div>
              <div className="col-span-12 sm:col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <Store className="h-3 w-3" />
                  Återförsäljare
                </Label>
                <Input
                  {...register(`artiklar.${i}.aterforsaljare`)}
                  placeholder="Återförsäljare"
                />
              </div>
              <div className="col-span-2 sm:col-span-1 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <Layers2 className="h-3 w-3" />
                  Antal
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  {...register(`artiklar.${i}.antal`, { valueAsNumber: true })}
                  placeholder="Ant."
                />
                {live.artiklar?.[i]?.enhet && (
                  <p className="text-xs text-muted-foreground text-center">
                    {live.artiklar[i].enhet.toLowerCase()}
                  </p>
                )}
                {errors.artiklar?.[i]?.antal && (
                  <p className="text-xs text-destructive">
                    {errors.artiklar[i]?.antal?.message}
                  </p>
                )}
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <Receipt className="h-3 w-3" />
                  Inköpspris
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register(`artiklar.${i}.inkopspris`, {
                    valueAsNumber: true,
                  })}
                  placeholder="Inköpspris"
                />
              </div>
              <div className="col-span-5 sm:col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <Receipt className="h-3 w-3" />
                  Utpris (kr)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register(`artiklar.${i}.pris`, { valueAsNumber: true })}
                  placeholder="Utpris kr"
                />
                {(live.artiklar?.[i]?.pris === 0 ||
                  live.artiklar?.[i]?.pris === undefined) && (
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <TriangleAlert className="h-3 w-3" />
                    Utpris ej ifyllt
                  </p>
                )}
              </div>
              <div className="col-span-1 flex justify-end">
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
            </div>
          ))}
        </FormSubsection>

        <FormSubsection
          icon={StickyNote}
          title="Övriga kostnader"
          description="T.ex. förbrukningsmaterial, bortforsling, hyrd utrustning, parkeringskostnad."
          action={
            <SekundarKnapp
              onClick={() =>
                ovrigaKostnader.append({ beskrivning: "", pris: 0 })
              }
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
              <div className="col-span-8 sm:col-span-9">
                <Input
                  {...register(`ovrigaKostnader.${i}.beskrivning`)}
                  placeholder="T.ex. parkeringskostnad, hyrd utrustning..."
                />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register(`ovrigaKostnader.${i}.pris`, {
                    valueAsNumber: true,
                  })}
                  placeholder="0"
                />
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
      </FormSection>

      {/* 3. Tid & resor */}
      <FormSection icon={Clock} title="Tid & resor">
        <FormSubsection
          icon={Clock}
          title="Arbetstid"
          action={
            <SekundarKnapp
              onClick={() => arbetstider.append({ datum: idag(), timmar: 0 })}
            >
              <Plus className="h-4 w-4" /> Lägg till pass
            </SekundarKnapp>
          }
        >
          {arbetstider.fields.length > 0 && (
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <div className="col-span-5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Datum
              </div>
              <div className="col-span-6 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Antal timmar
              </div>
              <div className="col-span-1" />
            </div>
          )}
          {arbetstider.fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-7 sm:col-span-5 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Datum
                </Label>
                <Input type="date" {...register(`arbetstider.${i}.datum`)} />
              </div>
              <div className="col-span-4 sm:col-span-6 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Timmar
                </Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  {...register(`arbetstider.${i}.timmar`, {
                    valueAsNumber: true,
                  })}
                  placeholder="t.ex. 7.5"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => arbetstider.remove(i)}
                  aria-label="Ta bort arbetspass"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </FormSubsection>

        <FormSubsection
          icon={Van}
          title="Resor"
          action={
            <SekundarKnapp
              onClick={() => resor.append({ datum: idag(), stracka: 0 })}
            >
              <Plus className="h-4 w-4" /> Lägg till resa
            </SekundarKnapp>
          }
        >
          {resor.fields.length > 0 && (
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <div className="col-span-5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Datum
              </div>
              <div className="col-span-6 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Sträcka (km körd)
              </div>
              <div className="col-span-1" />
            </div>
          )}
          {resor.fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-7 sm:col-span-5 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Datum
                </Label>
                <Input type="date" {...register(`resor.${i}.datum`)} />
              </div>
              <div className="col-span-4 sm:col-span-6 space-y-1">
                <Label className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Sträcka (km)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  {...register(`resor.${i}.stracka`, { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => resor.remove(i)}
                  aria-label="Ta bort resa"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </FormSubsection>
      </FormSection>

      {/* 4. Utfört */}
      <FormSection icon={Wrench} title="Utfört">
        <FormSubsection icon={Wrench} title="Utfört arbete">
          <Textarea
            rows={4}
            {...register("utfortArbete")}
            placeholder="Beskriv vad som har gjorts i projektet..."
          />
        </FormSubsection>
        <FormSubsection icon={NotebookPen} title="Övrigt">
          <Textarea
            rows={4}
            {...register("anteckningar")}
            placeholder="T.ex. tillval, garanti, kommande arbete..."
          />
        </FormSubsection>
      </FormSection>

      {/* 5. Pris & faktura */}
      <FormSection icon={Receipt} title="Pris & faktura">
        <FormSubsection
          icon={Receipt}
          title="Prissättning"
          description="Används för att räkna ut kostnader för arbetstid och resor."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Timpris (kr/h)"
              icon={<Clock className="h-3.5 w-3.5" />}
            >
              <Input
                type="number"
                step="50"
                min="0"
                {...register("timpris", { valueAsNumber: true })}
                placeholder="t.ex. 950"
              />
            </Field>
            <Field
              label="Milersättning (kr/km)"
              icon={<Van className="h-3.5 w-3.5" />}
            >
              <Input
                type="number"
                step="0.5"
                min="0"
                {...register("milersattning", { valueAsNumber: true })}
                placeholder="t.ex. 25"
              />
            </Field>
          </div>
          <div className="space-y-3 pt-1">
            <ToggleRow
              id="fast-pris"
              label="Fakturera fast pris (åsidosätter beräknad summa på fakturan)"
              checked={
                !!(live.fastPris !== undefined && live.fastPris !== null)
              }
              onChange={(v) => {
                if (v) {
                  setValue("fastPris", 0, { shouldDirty: true });
                } else {
                  setValue("fastPris", undefined, { shouldDirty: true });
                }
              }}
            />
            {live.fastPris !== undefined && live.fastPris !== null && (
              <Field
                label="Fast pris exkl. moms (kr)"
                icon={<Receipt className="h-3.5 w-3.5" />}
              >
                <Input
                  type="number"
                  step="100"
                  min="0"
                  {...register("fastPris", { valueAsNumber: true })}
                  placeholder="t.ex. 15000"
                />
              </Field>
            )}
          </div>
        </FormSubsection>

        <FormSubsection
          icon={ClipboardList}
          title="Status"
          description="Välj aktuell status för jobbet."
        >
          <div className="space-y-3">
            <ToggleRow
              id="ej-paborjat"
              label="Ej påbörjat"
              checked={!(live.pagaende ?? false) && !(live.utfort ?? false)}
              onChange={() => {
                setValue("pagaende", false, { shouldDirty: true });
                setValue("utfort", false, { shouldDirty: true });
              }}
            />
            <ToggleRow
              id="pagaende"
              label="Pågående"
              checked={(live.pagaende ?? false) && !(live.utfort ?? false)}
              onChange={() => {
                setValue("pagaende", true, { shouldDirty: true });
                setValue("utfort", false, { shouldDirty: true });
              }}
            />
            <ToggleRow
              id="utfort"
              label="Jobb utfört och klart"
              checked={live.utfort ?? false}
              onChange={() => {
                setValue("utfort", true, { shouldDirty: true });
                setValue("pagaende", false, { shouldDirty: true });
              }}
            />
          </div>
          <Separator />
          <div className="space-y-3">
            <ToggleRow
              id="folj-upp"
              label="Behöver följas upp"
              checked={live.foljUpp ?? false}
              onChange={(v) => {
                setValue("foljUpp", v, { shouldDirty: true });
                if (!v) setValue("foljUppDatum", "", { shouldDirty: true });
              }}
            />
            {live.foljUpp && (
              <Field
                label="Följ upp senast (valfritt)"
                icon={<Calendar className="h-3.5 w-3.5" />}
              >
                <Input
                  type="date"
                  className="sm:max-w-xs"
                  {...register("foljUppDatum")}
                />
              </Field>
            )}
            {live.foljUpp && (
              <p className="text-xs text-muted-foreground">
                Skriv vad som ska följas upp under Anteckningar längre ner.
              </p>
            )}
          </div>
        </FormSubsection>

        <FormSubsection
          icon={CreditCard}
          title="Faktura & betalning"
          description="Bockas av den som sköter fakturering och bokföring."
        >
          <div className="space-y-3">
            <ToggleRow
              id="rot"
              label="ROT-avdrag ska tillämpas"
              checked={live.rotAvdrag ?? false}
              onChange={(v) =>
                setValue("rotAvdrag", v, { shouldDirty: true })
              }
            />
            <ToggleRow
              id="fakturerat"
              label="Fakturerat"
              checked={live.fakturerat ?? false}
              onChange={(v) =>
                setValue("fakturerat", v, { shouldDirty: true })
              }
            />
            <ToggleRow
              id="betalt"
              label="Betalt"
              checked={live.betalt ?? false}
              onChange={(v) => setValue("betalt", v, { shouldDirty: true })}
            />
          </div>
        </FormSubsection>

        <FormSubsection
          icon={NotebookPen}
          title="Anteckningar"
          description="Visas ej för kunden – syns inte på fakturan eller utskrifter."
        >
          <Textarea
            rows={4}
            {...register("internaAnteckningar")}
            placeholder="T.ex. portkod, att följa upp, egna noteringar..."
          />
        </FormSubsection>
      </FormSection>

      {/* Summering */}
      <FormSection
        icon={Calculator}
        title="Summering"
        className="border-primary/30"
      >
        <div className="space-y-2 text-sm">
          {live.artiklar?.some((a) => !a.pris) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium pb-1 flex items-center gap-1.5">
              <TriangleAlert className="h-3.5 w-3.5" />
              En eller flera artiklar saknar pris — totalsumman är inte
              komplett.
            </p>
          )}
          <SumRow
            label="Artiklar"
            icon={<Package className="h-3.5 w-3.5" />}
            value={sek(summering.artiklarSum)}
          />
          {summering.ovrigaSum > 0 && (
            <SumRow
              label="Övriga kostnader"
              icon={<StickyNote className="h-3.5 w-3.5" />}
              value={sek(summering.ovrigaSum)}
            />
          )}
          <SumRow
            label={`Arbetstid (${summering.totalTimmar} h × ${summering.timpris} kr/h)`}
            icon={<Clock className="h-3.5 w-3.5" />}
            value={sek(summering.arbetstidSum)}
          />
          <SumRow
            label={`Resor (${summering.totalStracka} km × ${summering.milersattning} kr/km)`}
            icon={<Van className="h-3.5 w-3.5" />}
            value={sek(summering.resorSum)}
          />
          <Separator />
          <SumRow
            label="Totalt exkl. moms"
            icon={<Receipt className="h-3.5 w-3.5" />}
            value={sek(summering.totalExklMoms)}
          />
          {live.rotAvdrag && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ROT-avdrag markerat — beräknas av den som fakturerar.
              </p>
            </>
          )}
        </div>
      </FormSection>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Sparar..." : submitLabel}
        </Button>
      </div>

      {valdBild && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setValdBild(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] aspect-auto">
            <button
              type="button"
              className="absolute -top-10 right-0 text-white"
              onClick={() => setValdBild(null)}
              aria-label="Stäng bild"
            >
              <X className="h-6 w-6" />
            </button>
            <Image
              src={valdBild}
              alt="Förstorad bild"
              width={1200}
              height={900}
              className="object-contain w-full h-full rounded-md"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </form>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <Label htmlFor={id} className="font-normal cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

function SumRow({
  label,
  icon,
  value,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}
