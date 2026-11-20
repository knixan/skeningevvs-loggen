"use client";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Trash2,
  Package,
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
  ImagePlus,
  Calculator,
  X,
} from "lucide-react";

import {
  jobSchema,
  type JobInput,
  beräknaFaktura,
  beräknaPaslag,
  formateraKr,
  formateraTal,
  MOMS_PROCENT,
  ROT_PROCENT,
  ROT_BARA_PRIVAT,
  type Customer,
} from "@/lib/job-schema";
import { deleteUploadedImage } from "@/lib/job-actions";
import { idag } from "@/lib/datum";
import { useUploadThing } from "@/lib/uploadthing-client";
import { useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Felmeddelande,
  Field,
  FormSection,
  FormSubsection,
  SekundarKnapp,
  SumRow,
  ToggleRow,
  forstaFormularFel,
  tomtBlirInget,
  tomtBlirNoll,
  useScrollaTillForstaFel,
} from "@/components/minasidor/formular";
import KundValjare from "@/components/minasidor/kund-valjare";
import {
  ArtiklarFalt,
  OvrigaKostnaderFalt,
} from "@/components/minasidor/prisrader";

interface Props {
  onSubmit: (data: JobInput, bilder: { url: string; key: string }[]) => void;
  defaultValues?: Partial<JobInput>;
  submitLabel?: string;
  isPending?: boolean;
  customers?: Customer[];
  /** Företagets standardpåslag i procent för nya artikelrader */
  materialPaslag?: number;
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
  fastPrisArbete: undefined,
};

/** Med ören, som på fakturan. Ett tomt nummerfält (NaN) visas som "–". */
const kronor = (n: number) => (Number.isFinite(n) ? formateraKr(n) : "–");

export default function JobForm({
  onSubmit,
  defaultValues,
  submitLabel = "Spara jobb",
  isPending = false,
  customers = [],
  materialPaslag = 0,
}: Props) {
  const form = useForm<JobInput>({
    resolver: zodResolver(jobSchema) as Resolver<JobInput>,
    defaultValues: {
      ...tomDefaults,
      ...defaultValues,
      // Påslaget sparas inte – visa det som de sparade priserna motsvarar
      artiklar: (defaultValues?.artiklar ?? []).map((a) => ({
        ...a,
        paslag: beräknaPaslag(a.inkopspris ?? 0, a.pris),
      })),
    },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, submitCount },
  } = form;

  const formRef = useRef<HTMLFormElement>(null);
  useScrollaTillForstaFel(formRef, submitCount);

  function visaFel(fel: FieldErrors<JobInput>) {
    toast.error("Jobbet sparades inte", {
      description: forstaFormularFel(fel) ?? "Kontrollera de markerade fälten.",
    });
  }

  const resor = useFieldArray({ control, name: "resor" });
  const arbetstider = useFieldArray({ control, name: "arbetstider" });

  const live = useWatch({ control }) as Partial<JobInput>;
  // Samma beräkning som fakturan, så att summeringen här stämmer med den
  const faktura = beräknaFaktura({ ...tomDefaults, ...live } as JobInput);
  const summering = faktura.summary;

  const valdKund = customers.find((c) => c.id === live.customerId) ?? null;
  // ROT gäller bara privatpersoner. Servern stoppar det också.
  const rotForForetag =
    (live.rotAvdrag ?? false) && valdKund?.typ === "foretag";

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

  function sparaJobb(data: JobInput) {
    const kund = customers.find((c) => c.id === data.customerId);
    if (data.rotAvdrag && kund?.typ === "foretag") {
      toast.error("Jobbet sparades inte", { description: ROT_BARA_PRIVAT });
      return;
    }
    onSubmit(data, bilder);
  }

  return (
    // noValidate: all validering sker med zod, så att felen syns på svenska
    // vid fältet – webbläsarens egna bubblor (t.ex. för step) stoppar inte.
    // FormProvider: artikel- och kostnadsraderna läser formuläret därifrån.
    <FormProvider {...form}>
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit(sparaJobb, visaFel)}
      className="space-y-6"
    >
      {/* 1. Kund & planering */}
      <FormSection icon={User} title="Kund & planering">
        <FormSubsection icon={User} title="Kund">
          <KundValjare
            customers={customers}
            valdId={live.customerId}
            onValj={(id) => setValue("customerId", id, { shouldDirty: true })}
          />
        </FormSubsection>

        <FormSubsection icon={ClipboardList} title="Planera arbete & bilder">
          <Textarea
            rows={4}
            {...register("planeratArbete")}
            placeholder="Vad ska göras? T.ex. byta rör i kök, dra el till garage..."
          />
          <Felmeddelande fel={errors.planeratArbete?.message} />
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
        <ArtiklarFalt materialPaslag={materialPaslag} summering={summering} />
        <OvrigaKostnaderFalt />
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
                <Felmeddelande fel={errors.arbetstider?.[i]?.datum?.message} />
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
                  {...register(`arbetstider.${i}.timmar`, tomtBlirNoll)}
                  placeholder="t.ex. 7.5"
                />
                <Felmeddelande
                  fel={errors.arbetstider?.[i]?.timmar?.message}
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
                <Felmeddelande fel={errors.resor?.[i]?.datum?.message} />
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
                  {...register(`resor.${i}.stracka`, tomtBlirNoll)}
                  placeholder="0"
                />
                <Felmeddelande fel={errors.resor?.[i]?.stracka?.message} />
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
          <Felmeddelande fel={errors.utfortArbete?.message} />
        </FormSubsection>
        <FormSubsection icon={NotebookPen} title="Övrigt">
          <Textarea
            rows={4}
            {...register("anteckningar")}
            placeholder="T.ex. tillval, garanti, kommande arbete..."
          />
          <Felmeddelande fel={errors.anteckningar?.message} />
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
              error={errors.timpris?.message}
            >
              <Input
                type="number"
                step="50"
                min="0"
                {...register("timpris", tomtBlirNoll)}
                placeholder="t.ex. 950"
              />
            </Field>
            <Field
              label="Milersättning (kr/km)"
              icon={<Van className="h-3.5 w-3.5" />}
              error={errors.milersattning?.message}
            >
              <Input
                type="number"
                step="0.5"
                min="0"
                {...register("milersattning", tomtBlirNoll)}
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
                  setValue("fastPrisArbete", undefined, { shouldDirty: true });
                }
              }}
            />
            {live.fastPris !== undefined && live.fastPris !== null && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Fast pris exkl. moms (kr)"
                  icon={<Receipt className="h-3.5 w-3.5" />}
                  error={errors.fastPris?.message}
                >
                  <Input
                    type="number"
                    step="100"
                    min="0"
                    {...register("fastPris", { valueAsNumber: true })}
                    placeholder="t.ex. 15000"
                  />
                </Field>
                <Field
                  label="Varav arbetskostnad exkl. moms (kr)"
                  icon={<Wrench className="h-3.5 w-3.5" />}
                  error={errors.fastPrisArbete?.message}
                >
                  <Input
                    type="number"
                    step="100"
                    min="0"
                    {...register("fastPrisArbete", tomtBlirInget)}
                    placeholder="t.ex. 6000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Står på fakturan. Krävs för ROT-avdrag – ROT räknas bara
                    på arbetskostnaden.
                  </p>
                </Field>
              </div>
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
                error={errors.foljUppDatum?.message}
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
            <Felmeddelande fel={rotForForetag ? ROT_BARA_PRIVAT : undefined} />
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
            <Felmeddelande fel={errors.betalt?.message} />
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
          <Felmeddelande fel={errors.internaAnteckningar?.message} />
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
            value={kronor(summering.artiklarSum)}
          />
          {summering.ovrigaSum > 0 && (
            <SumRow
              label="Övriga kostnader"
              icon={<StickyNote className="h-3.5 w-3.5" />}
              value={kronor(summering.ovrigaSum)}
            />
          )}
          <SumRow
            label={`Arbetstid (${formateraTal(summering.totalTimmar)} h × ${formateraTal(summering.timpris)} kr/h)`}
            icon={<Clock className="h-3.5 w-3.5" />}
            value={kronor(summering.arbetstidSum)}
          />
          <SumRow
            label={`Resor (${formateraTal(summering.totalStracka)} km × ${formateraTal(summering.milersattning)} kr/km)`}
            icon={<Van className="h-3.5 w-3.5" />}
            value={kronor(summering.resorSum)}
          />
          <Separator />
          {live.fastPris != null ? (
            <>
              <SumRow
                label="Löpande räkning exkl. moms (står inte på fakturan)"
                icon={<Receipt className="h-3.5 w-3.5" />}
                value={kronor(summering.totalExklMoms)}
              />
              <SumRow
                label="Fast pris exkl. moms"
                icon={<Receipt className="h-3.5 w-3.5" />}
                value={kronor(faktura.exklMoms)}
              />
            </>
          ) : (
            <SumRow
              label="Totalt exkl. moms"
              icon={<Receipt className="h-3.5 w-3.5" />}
              value={kronor(faktura.exklMoms)}
            />
          )}
          <SumRow label={`Moms ${MOMS_PROCENT} %`} value={kronor(faktura.moms)} />
          {faktura.rotAvdrag > 0 && (
            <SumRow
              label={`ROT-avdrag ${ROT_PROCENT} % av ${kronor(faktura.rotUnderlag)} arbete inkl. moms`}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              value={`−${kronor(faktura.rotAvdrag)}`}
            />
          )}
          {Number.isFinite(faktura.oresutjamning) && faktura.oresutjamning !== 0 && (
            <SumRow
              label="Öresutjämning"
              value={kronor(faktura.oresutjamning)}
            />
          )}
          <Separator />
          <SumRow label="Att betala" value={kronor(faktura.attBetala)} />
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
    </FormProvider>
  );
}
