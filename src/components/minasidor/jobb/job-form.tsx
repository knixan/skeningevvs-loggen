"use client";
import Image from "next/image";
import Link from "next/link";
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
  FileCheck,
} from "lucide-react";

import {
  jobSchema,
  type JobInput,
  beräknaFaktura,
  beräknaPaslag,
  formateraKr,
  formateraTal,
  jobbPrisunderlag,
  MOMS_PROCENT,
  ROT_PROCENT,
  ROT_BARA_PRIVAT,
  rotTakVarning,
  rotUppgifterSomSaknas,
  type Customer,
} from "@/lib/job-schema";
import { deleteUploadedImage } from "@/lib/job-actions";
import { anropaAction } from "@/lib/anropa-action";
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
  FormKnappar,
  FormSection,
  FormSubsection,
  SekundarKnapp,
  SumRow,
  ToggleRow,
  forstaFormularFel,
  tomtBlirInget,
  tomtBlirNoll,
  tomtBlirFel,
  decimalFalt,
  useScrollaTillForstaFel,
} from "@/components/minasidor/formular";
import KundValjare from "@/components/minasidor/kund-valjare";
import { BildVisare } from "@/components/minasidor/bild-visare";
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
  /** Vart Avbryt leder – en fast sida, så att det fungerar utan historik */
  avbrytHref: string;
  /** Numret på jobbets gällande, utfärdade faktura – låser Fakturerat */
  utfardadFaktura?: number | null;
  /** ROT (kr) som varje kund redan fått på andra fakturor i år – för taket */
  rotIArPerKund?: Record<string, number>;
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
  customers: kunderFranServern = [],
  materialPaslag = 0,
  avbrytHref,
  utfardadFaktura = null,
  rotIArPerKund = {},
}: Props) {
  // Kunder som skapas i formuläret läggs till här, så att de kan väljas
  // direkt utan att sidan laddas om
  const [nyaKunder, setNyaKunder] = useState<Customer[]>([]);
  const customers = React.useMemo(
    () => [...kunderFranServern, ...nyaKunder],
    [kunderFranServern, nyaKunder],
  );

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
    formState: { errors, submitCount, isDirty },
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
  const valdKund = customers.find((c) => c.id === live.customerId) ?? null;
  // Samma beräkning som fakturan, så att summeringen här stämmer med den
  const faktura = beräknaFaktura(
    jobbPrisunderlag({
      ...tomDefaults,
      ...live,
      customer: valdKund,
    } as JobInput & { customer: Customer | null }),
  );
  const summering = faktura.summary;

  // ROT gäller bara privatpersoner. Servern stoppar det också.
  const rotForForetag =
    (live.rotAvdrag ?? false) && valdKund?.typ === "foretag";
  // Det Skatteverket kräver – fakturan kan inte utfärdas utan det
  const rotSaknas =
    live.rotAvdrag && valdKund?.typ === "privat"
      ? rotUppgifterSomSaknas(valdKund)
      : [];
  const rotTak =
    live.rotAvdrag && valdKund
      ? rotTakVarning(rotIArPerKund[valdKund.id] ?? 0, faktura.rotAvdrag)
      : null;

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

    const result = await anropaAction(() => deleteUploadedImage(key));
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
            onNyKund={(kund) => {
              setNyaKunder((prev) => [...prev, kund]);
              setValue("customerId", kund.id, { shouldDirty: true });
            }}
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
                    <button
                      type="button"
                      className="absolute inset-0 overflow-hidden rounded-lg"
                      onClick={() => setValdBild(bild.url)}
                      aria-label="Visa bilden förstorad"
                    >
                      <Image
                        src={bild.url}
                        alt="Jobbild"
                        fill
                        sizes="(max-width: 640px) 33vw, 200px"
                        className="object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
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
                  {...decimalFalt}
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
                  {...decimalFalt}
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
                {...decimalFalt}
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
                {...decimalFalt}
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
                    {...decimalFalt}
                    {...register("fastPris", tomtBlirFel)}
                    placeholder="t.ex. 15000"
                  />
                </Field>
                <Field
                  label="Varav arbetskostnad exkl. moms (kr)"
                  icon={<Wrench className="h-3.5 w-3.5" />}
                  error={errors.fastPrisArbete?.message}
                >
                  <Input
                    {...decimalFalt}
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
            {rotSaknas.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs font-medium text-varning">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Fakturan kan inte utfärdas förrän kunden har{" "}
                {rotSaknas.join(" och ")} i kundregistret.
              </p>
            )}
            {rotTak && (
              <p className="flex items-start gap-1.5 text-xs font-medium text-varning">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {rotTak}
              </p>
            )}
            <ToggleRow
              id="fakturerat"
              label="Fakturerat"
              // En utfärdad faktura kan bara tas ut med en kreditfaktura –
              // servern sparar alltid fakturerat då
              checked={utfardadFaktura != null || (live.fakturerat ?? false)}
              disabled={utfardadFaktura != null}
              hjalptext={
                utfardadFaktura != null ? (
                  <span className="inline-flex items-center gap-1">
                    <FileCheck className="h-3 w-3" />
                    Faktura {utfardadFaktura} är utfärdad. Kreditera den på
                    fakturasidan om den ska tas bort.
                  </span>
                ) : undefined
              }
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
            <p className="text-xs text-varning font-medium pb-1 flex items-center gap-1.5">
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
          <SumRow
            label={
              faktura.omvandMoms
                ? "Moms 0 % (omvänd byggmoms – kunden redovisar momsen)"
                : `Moms ${MOMS_PROCENT} %`
            }
            value={kronor(faktura.moms)}
          />
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

      <FormKnappar>
        <Button variant="outline" size="lg" asChild>
          <Link
            href={avbrytHref}
            onClick={(e) => {
              if (isDirty && !window.confirm("Vill du lämna utan att spara?")) {
                e.preventDefault();
              }
            }}
          >
            Avbryt
          </Link>
        </Button>
        <Button type="submit" size="lg" disabled={isPending || laddarUpp}>
          {isPending ? "Sparar..." : submitLabel}
        </Button>
      </FormKnappar>

      <BildVisare url={valdBild} onStang={() => setValdBild(null)} />
    </form>
    </FormProvider>
  );
}
