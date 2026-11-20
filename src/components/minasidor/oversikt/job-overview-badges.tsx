"use client";

import type { ReactNode } from "react";
import { BellRing, Wrench } from "lucide-react";
import type { Job } from "@/lib/job-schema";
import { idag, kortDatum } from "@/lib/datum";

export function toTelHref(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export function Badge({
  label,
  color,
}: {
  label: string;
  color?: "orange" | "green";
}) {
  const colors = {
    orange:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    green:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
        color ? colors[color] : colors.default
      }`}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ job }: { job: Job }) {
  const label = job.utfort
    ? "Utfört"
    : job.pagaende
      ? "Pågående"
      : "Ej påbörjat";
  const colorClass = job.utfort
    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
    : job.pagaende
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${colorClass}`}
    >
      <Wrench className="h-3 w-3" />
      {label}
    </span>
  );
}

/** "Följ upp" med datum. Röd när datumet har passerat. */
export function FoljUppBadge({ job }: { job: Job }) {
  if (!job.foljUpp) return null;

  const datum = job.foljUppDatum || "";
  const forsenad = datum !== "" && datum < idag();
  const colorClass = forsenad
    ? "bg-red-600 text-white dark:bg-red-700"
    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";

  return (
    // Servern (UTC) och webbläsaren (svensk tid) kan vara oense om "idag"
    // runt midnatt – därför suppressHydrationWarning.
    <span
      suppressHydrationWarning
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${colorClass}`}
    >
      <BellRing className="h-3 w-3" />
      Följ upp{datum ? ` ${kortDatum(datum)}` : ""}
    </span>
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
        <p className="mb-1 text-[10px] font-medium uppercase leading-none text-muted-foreground">
          {label}
        </p>
        {content}
      </div>
    </div>
  );
}
