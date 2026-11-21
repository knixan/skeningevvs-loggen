"use client";

import type { ReactNode } from "react";
import { BellRing, Wrench } from "lucide-react";
import type { Job } from "@/lib/job-schema";
import { idag, kortDatum } from "@/lib/datum";
import { Chip } from "@/components/minasidor/chip";

export function toTelHref(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export function StatusBadge({ job }: { job: Job }) {
  const [label, ton] = job.utfort
    ? (["Utfört", "ok"] as const)
    : job.pagaende
      ? (["Pågående", "info"] as const)
      : (["Ej påbörjat", "neutral"] as const);

  return (
    <Chip ton={ton}>
      <Wrench aria-hidden />
      {label}
    </Chip>
  );
}

/** "Följ upp" med datum. Röd när datumet har passerat. */
export function FoljUppBadge({ job }: { job: Job }) {
  if (!job.foljUpp) return null;

  const datum = job.foljUppDatum || "";
  const forsenad = datum !== "" && datum < idag();

  return (
    // Servern (UTC) och webbläsaren (svensk tid) kan vara oense om "idag"
    // runt midnatt – därför suppressHydrationWarning.
    <Chip suppressHydrationWarning ton={forsenad ? "larm" : "varning"}>
      <BellRing aria-hidden />
      Följ upp{datum ? ` ${kortDatum(datum)}` : ""}
    </Chip>
  );
}

export function InfoItem({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  href?: string;
}) {
  if (!value) return null;
  const content = href ? (
    <a
      href={href}
      className="wrap-break-words leading-tight text-primary underline-offset-4 hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {value}
    </a>
  ) : (
    <p className="wrap-break-words leading-tight">{value}</p>
  );

  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium uppercase leading-none text-muted-foreground">
          {label}
        </p>
        {content}
      </div>
    </div>
  );
}
