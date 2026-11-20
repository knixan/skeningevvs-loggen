"use client";

import { useRef } from "react";
import { toast } from "sonner";
import {
  FormProvider,
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calculator,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FilePenLine,
  MapPin,
  NotebookPen,
  Package,
  Receipt,
  ScrollText,
  StickyNote,
  TriangleAlert,
  User,
  Van,
  Wrench,
} from "lucide-react";

import {
  beräknaFaktura,
  beräknaPaslag,
  formateraKr,
  formateraTal,
  MOMS_PROCENT,
  OFFERT_STATUS_TEXT,
  OFFERT_STATUSAR,
  offertPrisunderlag,
  offertSchema,
  ROT_BARA_PRIVAT,
  ROT_PROCENT,
  type Customer,
  type OffertInput,
} from "@/lib/job-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Felmeddelande,
  Field,
  FormSection,
  FormSubsection,
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
  onSubmit: (data: OffertInput) => void;
  /** Ny offert: datum och förslag på priser. Redigering: den sparade offerten. */
  defaultValues: Partial<OffertInput> &
    Pick<OffertInput, "offertdatum" | "giltigTill">;
  submitLabel: string;
  isPending?: boolean;
  customers: Customer[];
  /** Företagets standardpåslag i procent för nya artikelrader */
  materialPaslag?: number;
}

const tomDefaults: Omit<OffertInput, "offertdatum" | "giltigTill"> = {
  // Tom sträng = ingen kund vald – schemat kräver att en väljs
  customerId: "",
  status: "utkast",
  timpris: 0,
  milersattning: 0,
  beraknadeTimmar: 0,
  beraknadStracka: 0,
  rotAvdrag: false,
  artiklar: [],
  ovrigaKostnader: [],
  beskrivning: "",
  villkor: "",
  internaAnteckningar: "",
  fastPris: undefined,
  fastPrisArbete: undefined,
};

/** Med ören, som på offerten. Ett tomt nummerfält (NaN) visas som "–". */
const kronor = (n: number) => (Number.isFinite(n) ? formateraKr(n) : "–");

export default function OffertForm({
  onSubmit,
  defaultValues,
  submitLabel,
  isPending = false,
  customers,
  materialPaslag = 0,
}: Props) {
  const form = useForm<OffertInput>({
    resolver: zodResolver(offertSchema) as Resolver<OffertInput>,
    defaultValues: {
      ...tomDefaults,
      ...defaultValues,
      // Påslaget sparas inte – visa det som de sparade priserna motsvarar
      artiklar: (defaultValues.artiklar ?? []).map((a) => ({
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

  function visaFel(fel: FieldErrors<OffertInput>) {
    toast.error("Offerten sparades inte", {
      description: forstaFormularFel(fel) ?? "Kontrollera de markerade fälten.",
    });
  }

  const live = useWatch({ control }) as Partial<OffertInput>;
  // Samma beräkning som fakturan, så att summeringen här stämmer med
  // utskriften av offerten
  const pris = beräknaFaktura(
    offertPrisunderlag({ ...tomDefaults, ...live } as OffertInput),
  );
  const summering = pris.summary;
  const harFastPris = live.fastPris != null;

  const valdKund = customers.find((c) => c.id === live.customerId) ?? null;
  // ROT gäller bara privatpersoner. Servern stoppar det också.
  const rotForForetag =
    (live.rotAvdrag ?? false) && valdKund?.typ === "foretag";

  function sparaOffert(data: OffertInput) {
    if (rotForForetag) {
      toast.error("Offerten sparades inte", { description: ROT_BARA_PRIVAT });
      return;
    }
    onSubmit(data);
  }

  return (
    // noValidate: all validering sker med zod, så att felen syns på svenska
    // vid fältet. FormProvider: artikel- och kostnadsraderna läser
    // formuläret därifrån.
    <FormProvider {...form}>
      <form
        ref={formRef}
        noValidate
        onSubmit={handleSubmit(sparaOffert, visaFel)}
        className="space-y-6"
      >
        {/* 1. Kund & offert */}
        <FormSection icon={FilePenLine} title="Kund & offert">
          <FormSubsection icon={User} title="Kund">
            <KundValjare
              customers={customers}
              valdId={live.customerId || undefined}
              onValj={(id) =>
                setValue("customerId", id ?? "", {
                  shouldDirty: true,
                  shouldValidate: submitCount > 0,
                })
              }
              fel={errors.customerId?.message}
            />
          </FormSubsection>

          <FormSubsection icon={Calendar} title="Datum">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Offertdatum"
                icon={<Calendar className="h-3.5 w-3.5" />}
                error={errors.offertdatum?.message}
              >
                <Input type="date" {...register("offertdatum")} />
              </Field>
              <Field
                label="Gäller till och med"
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                error={errors.giltigTill?.message}
              >
                <Input type="date" {...register("giltigTill")} />
              </Field>
            </div>
          </FormSubsection>

          <FormSubsection
            icon={ClipboardList}
            title="Arbetsbeskrivning"
            description="Står på offerten. Beskriv vad som ingår."
          >
            <Textarea
              rows={5}
              {...register("beskrivning")}
              placeholder="T.ex. byte av varmvattenberedare 300 l inkl. säkerhetsventil och blandningsventil, demontering och bortforsling av gammal beredare..."
            />
            <Felmeddelande fel={errors.beskrivning?.message} />
          </FormSubsection>
        </FormSection>

        {/* 2. Material */}
        <FormSection icon={Package} title="Material">
          <ArtiklarFalt
            materialPaslag={materialPaslag}
            summering={summering}
          />
          <OvrigaKostnaderFalt />
        </FormSection>

        {/* 3. Arbete & pris */}
        <FormSection icon={Receipt} title="Arbete & pris">
          <FormSubsection
            icon={Clock}
            title="Beräknad arbetstid och resor"
            description="Uppskattningar för priset. Blir inte loggad tid om offerten görs om till jobb."
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
                label="Beräknad arbetstid (h)"
                icon={<Clock className="h-3.5 w-3.5" />}
                error={errors.beraknadeTimmar?.message}
              >
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  {...register("beraknadeTimmar", tomtBlirNoll)}
                  placeholder="t.ex. 8"
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
              <Field
                label="Beräknad körsträcka (km)"
                icon={<MapPin className="h-3.5 w-3.5" />}
                error={errors.beraknadStracka?.message}
              >
                <Input
                  type="number"
                  step="1"
                  min="0"
                  {...register("beraknadStracka", tomtBlirNoll)}
                  placeholder="t.ex. 40"
                />
              </Field>
            </div>
          </FormSubsection>

          <FormSubsection
            icon={Receipt}
            title="Fast pris och ROT"
          >
            <div className="space-y-3">
              <ToggleRow
                id="fast-pris"
                label="Fast pris (ersätter den beräknade summan på offerten)"
                checked={harFastPris}
                onChange={(v) => {
                  if (v) {
                    setValue("fastPris", 0, { shouldDirty: true });
                  } else {
                    setValue("fastPris", undefined, { shouldDirty: true });
                    setValue("fastPrisArbete", undefined, {
                      shouldDirty: true,
                    });
                  }
                }}
              />
              {harFastPris && (
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
                      Står på offerten. Krävs för ROT-avdrag – ROT räknas bara
                      på arbetskostnaden.
                    </p>
                  </Field>
                </div>
              )}
              <ToggleRow
                id="rot"
                label="Räkna med ROT-avdrag"
                checked={live.rotAvdrag ?? false}
                onChange={(v) =>
                  setValue("rotAvdrag", v, { shouldDirty: true })
                }
              />
              <Felmeddelande
                fel={rotForForetag ? ROT_BARA_PRIVAT : undefined}
              />
            </div>
          </FormSubsection>
        </FormSection>

        {/* 4. Villkor & anteckningar */}
        <FormSection icon={ScrollText} title="Villkor & anteckningar">
          <FormSubsection
            icon={ScrollText}
            title="Villkor"
            description="Står på offerten, t.ex. vad som inte ingår eller när arbetet kan utföras."
          >
            <Textarea
              rows={4}
              {...register("villkor")}
              placeholder="T.ex. Eventuella tilläggsarbeten debiteras löpande. Kakel och golv ingår inte."
            />
            <Felmeddelande fel={errors.villkor?.message} />
          </FormSubsection>
          <FormSubsection
            icon={NotebookPen}
            title="Anteckningar"
            description="Visas ej för kunden – syns inte på offerten."
          >
            <Textarea
              rows={3}
              {...register("internaAnteckningar")}
              placeholder="T.ex. mätt upp på plats, kunden vill ha svar före jul..."
            />
            <Felmeddelande fel={errors.internaAnteckningar?.message} />
          </FormSubsection>
          <FormSubsection icon={CheckCircle2} title="Status">
            <div className="grid gap-3 sm:grid-cols-2">
              {OFFERT_STATUSAR.map((status) => (
                <ToggleRow
                  key={status}
                  id={`status-${status}`}
                  label={OFFERT_STATUS_TEXT[status]}
                  checked={live.status === status}
                  onChange={() =>
                    setValue("status", status, { shouldDirty: true })
                  }
                />
              ))}
            </div>
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
            {harFastPris ? (
              <>
                <SumRow
                  label="Beräknat exkl. moms (står inte på offerten)"
                  icon={<Receipt className="h-3.5 w-3.5" />}
                  value={kronor(summering.totalExklMoms)}
                />
                <SumRow
                  label="Fast pris exkl. moms"
                  icon={<Receipt className="h-3.5 w-3.5" />}
                  value={kronor(pris.exklMoms)}
                />
              </>
            ) : (
              <SumRow
                label="Totalt exkl. moms"
                icon={<Receipt className="h-3.5 w-3.5" />}
                value={kronor(pris.exklMoms)}
              />
            )}
            <SumRow label={`Moms ${MOMS_PROCENT} %`} value={kronor(pris.moms)} />
            {pris.rotAvdrag > 0 && (
              <SumRow
                label={`Preliminärt ROT-avdrag ${ROT_PROCENT} % av ${kronor(pris.rotUnderlag)} arbete inkl. moms`}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                value={`−${kronor(pris.rotAvdrag)}`}
              />
            )}
            {Number.isFinite(pris.oresutjamning) &&
              pris.oresutjamning !== 0 && (
                <SumRow
                  label="Öresutjämning"
                  value={kronor(pris.oresutjamning)}
                />
              )}
            <Separator />
            <SumRow
              label={
                pris.rotAvdrag > 0
                  ? "Att betala efter ROT-avdrag"
                  : "Att betala"
              }
              value={kronor(pris.attBetala)}
            />
          </div>
        </FormSection>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Sparar..." : submitLabel}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
