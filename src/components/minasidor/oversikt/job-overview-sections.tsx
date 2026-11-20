"use client";

import {
  ClipboardList,
  Clock,
  IdCard,
  Images,
  Mail,
  MapPinned,
  NotebookPen,
  Package,
  Phone,
  Receipt,
  Tag,
  User,
  Van,
  Wrench,
} from "lucide-react";
import {
  beräknaSummering,
  formateraAntal,
  formateraKr,
  formateraTal,
  kundensNamn,
  type Job,
} from "@/lib/job-schema";
import { InfoItem, toTelHref } from "./job-overview-badges";

export function ContactSection({ job }: { job: Job }) {
  const customer = job.customer;

  const phoneHref = customer?.telefon
    ? `tel:${toTelHref(customer.telefon)}`
    : undefined;
  const emailHref = customer?.epost ? `mailto:${customer.epost}` : undefined;

  const fullAddress = [customer?.adress, customer?.postnummer, customer?.ort]
    .filter(Boolean)
    .join(", ");

  // Företagskund: den man pratar med. Kontaktperson om ifylld, annars namnet.
  const kontakt =
    customer?.typ === "foretag"
      ? customer.kontaktperson?.trim() || customer.namn.trim()
      : undefined;

  return (
    <section className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
      <InfoItem icon={<IdCard />} label="Kund" value={kundensNamn(customer)} />
      <InfoItem icon={<User />} label="Kontaktperson" value={kontakt} />
      <InfoItem icon={<MapPinned />} label="Adress" value={fullAddress} />
      <InfoItem
        icon={<Phone />}
        label="Telefon"
        value={customer?.telefon}
        href={phoneHref}
      />
      <InfoItem
        icon={<Mail />}
        label="E-post"
        value={customer?.epost}
        href={emailHref}
      />
      {/* Personnummer visas bara när det behövs – för ROT-avdraget */}
      {job.rotAvdrag && customer?.typ === "privat" && (
        <InfoItem
          icon={<IdCard />}
          label="Personnummer (ROT)"
          value={customer.personnummer}
        />
      )}
    </section>
  );
}

export function QuickOverviewSection({
  job,
  summary,
}: {
  job: Job;
  summary: ReturnType<typeof beräknaSummering>;
}) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <ClipboardList className="h-4 w-4" /> Snabböversikt
      </h4>
      <div className="grid grid-cols-1 gap-3 text-sm min-[420px]:grid-cols-2">
        <InfoItem
          icon={<Clock />}
          label="Arbetstid"
          value={`${formateraTal(summary.totalTimmar)} h`}
        />
        <InfoItem
          icon={<Van />}
          label="Resor"
          value={`${formateraTal(summary.totalStracka)} km`}
        />
        <InfoItem
          icon={<Package />}
          label="Material"
          value={formateraKr(summary.artiklarSum)}
        />
        {summary.ovrigaSum > 0 && (
          <InfoItem
            icon={<Receipt />}
            label="Övriga kostnader"
            value={formateraKr(summary.ovrigaSum)}
          />
        )}
        {job.fastPris != null && (
          <InfoItem
            icon={<Tag />}
            label="Fast pris (exkl. moms)"
            value={formateraKr(job.fastPris)}
          />
        )}
        {job.bilder && job.bilder.length > 0 && (
          <InfoItem
            icon={<Images />}
            label="Bilder"
            value={`${job.bilder.length} st`}
          />
        )}
      </div>
    </section>
  );
}

export function WorkDescriptionSection({ job }: { job: Job }) {
  return (
    <>
      {job.planeratArbete && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="h-4 w-4" /> Planerat arbete
          </h4>
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
            {job.planeratArbete}
          </p>
        </section>
      )}

      {job.utfortArbete && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4" /> Utfört arbete
          </h4>
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
            {job.utfortArbete}
          </p>
        </section>
      )}
    </>
  );
}

export function MaterialSection({ job }: { job: Job }) {
  if (job.artiklar.length === 0) return null;

  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Package className="h-4 w-4" /> Inköpt material
      </h4>

      <div className="overflow-hidden rounded-md border">
        <div className="divide-y">
          {job.artiklar.map((artikel, index) => (
            <div
              key={artikel.id ?? index}
              className="grid gap-2 p-3 text-sm sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <p className="font-medium leading-tight">{artikel.namn}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {artikel.artikelnr && <span>Art.nr {artikel.artikelnr}</span>}
                  {artikel.aterforsaljare && (
                    <span>{artikel.aterforsaljare}</span>
                  )}
                  <span>{formateraAntal(artikel.antal, artikel.enhet)}</span>
                </div>
              </div>
              <div className="text-left text-sm tabular-nums sm:text-right">
                <div className="font-medium">
                  {formateraKr(artikel.pris * artikel.antal)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formateraKr(artikel.pris)} /{" "}
                  {(artikel.enhet ?? "").trim().toLowerCase() || "st"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OvrigaKostnaderSection({ job }: { job: Job }) {
  const kostnader = job.ovrigaKostnader ?? [];
  if (kostnader.length === 0) return null;

  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Receipt className="h-4 w-4" /> Övriga kostnader
      </h4>
      <div className="divide-y overflow-hidden rounded-md border">
        {kostnader.map((k, index) => (
          <div
            key={k.id ?? index}
            className="flex items-start justify-between gap-3 p-3 text-sm"
          >
            <span className="min-w-0">{k.beskrivning}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {formateraKr(k.pris)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NotesSection({ job }: { job: Job }) {
  if (!job.anteckningar && !job.internaAnteckningar) return null;

  return (
    <>
      {job.anteckningar && (
        <section className="space-y-2 border-t pt-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <NotebookPen className="h-4 w-4" /> Övrigt
          </h4>
          <p className="whitespace-pre-wrap text-sm">{job.anteckningar}</p>
        </section>
      )}
      {job.internaAnteckningar && (
        <section className="space-y-2 border-t pt-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <NotebookPen className="h-4 w-4" /> Anteckningar
            <span className="text-xs font-normal text-muted-foreground">
              (visas ej för kunden)
            </span>
          </h4>
          <p className="whitespace-pre-wrap text-sm">
            {job.internaAnteckningar}
          </p>
        </section>
      )}
    </>
  );
}
