import * as React from "react";
import type { LucideIcon } from "lucide-react";
import type { FieldErrors } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Gemensamma byggstenar så att alla formulär på Mina sidor ser likadana ut:
// vita kort med rundade hörn på grå bakgrund, ikon + fet rubrik och grå
// sekundärknappar ("Lägg till").

/** Ett formulärkort med rubrik, valfri beskrivning och valfri knapp till höger. */
export function FormSection({
  icon: Icon,
  title,
  description,
  action,
  tone = "default",
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "default" | "destructive";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-5 text-card-foreground shadow-xs sm:p-6",
        tone === "destructive" && "border-destructive/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={cn(
              "flex items-center gap-2.5 text-base font-semibold",
              tone === "destructive" && "text-destructive",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children && <div className="mt-5 space-y-6">{children}</div>}
    </section>
  );
}

/** Ett delavsnitt inuti ett FormSection-kort, avskilt med en linje. */
export function FormSubsection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 border-t pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/** Grå knapp med kant – används för "Lägg till", "Befintlig kund" m.m. */
export function SekundarKnapp({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn("border-border shadow-xs", className)}
      {...props}
    />
  );
}

/**
 * Rött felmeddelande under ett fält. `data-fel` gör att formuläret kan hitta
 * och scrolla till det första felet när sparningen stoppas.
 */
export function Felmeddelande({ fel }: { fel?: string }) {
  if (!fel) return null;
  return (
    <p data-fel className="text-xs text-destructive">
      {fel}
    </p>
  );
}

/** Etikett med ikon, fältet och ev. felmeddelande. */
export function Field({
  label,
  icon,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  htmlFor?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
      </Label>
      {children}
      <Felmeddelande fel={error} />
    </div>
  );
}

/** Kryssruta med etikett – för val och statusar i formulären. */
export function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled,
  hjalptext,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Liten text under, t.ex. varför rutan är låst */
  hjalptext?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(Boolean(v))}
        className="mt-0.5"
        aria-describedby={hjalptext ? `${id}-hjalp` : undefined}
      />
      <div className="space-y-0.5">
        <Label
          htmlFor={id}
          className={cn(
            "font-normal",
            disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          )}
        >
          {label}
        </Label>
        {hjalptext && (
          <p id={`${id}-hjalp`} className="text-xs text-muted-foreground">
            {hjalptext}
          </p>
        )}
      </div>
    </div>
  );
}

/** En rad i en summering: etikett till vänster, belopp till höger. */
export function SumRow({
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

// Decimaltal skrivs i vanliga textfält med inputMode="decimal" (se
// decimalFalt), inte type="number". Ett nummerfält i en svensk telefon
// visar decimalkomma, men webbläsaren kan inte alltid tolka "7,5" – då blev
// fältet tomt och sparades tyst som 0. Här tolkas både komma och punkt, och
// något som inte är ett tal blir NaN, så att zod säger "Ange …".

/** "7,5" → 7.5, "1 250" → 1250, "" → `tomt`, "abc" → NaN. */
export function lasDecimal(v: unknown, tomt: number | undefined) {
  if (typeof v === "number") return v;
  const text = String(v ?? "")
    .replace(/[\s ]/g, "")
    .replace(",", ".");
  if (text === "") return tomt;
  return /^-?\d*\.?\d+$|^-?\d+\.$/.test(text) ? Number(text) : NaN;
}

/** Tomt fält → 0, t.ex. timpris och priser. */
export const tomtBlirNoll = {
  setValueAs: (v: unknown) => lasDecimal(v, 0),
};
/** Tomt fält → inget värde, för tal som är valfria. */
export const tomtBlirInget = {
  setValueAs: (v: unknown) => lasDecimal(v, undefined),
};
/** Tomt fält → NaN, för tal som måste fyllas i ("Ange …"). */
export const tomtBlirFel = {
  setValueAs: (v: unknown) => lasDecimal(v, NaN),
};

/** Egenskaper för ett decimalfält: sifferknappar med komma på mobilen. */
export const decimalFalt = {
  type: "text",
  inputMode: "decimal",
  autoComplete: "off",
} as const;

/**
 * Spara/Avbryt längst ner i ett formulär. På mobilen ligger raden fast
 * precis ovanför bottenmenyn, så att Spara alltid går att nå med tummen.
 */
export function FormKnappar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none md:bottom-0">
      {children}
    </div>
  );
}

/** Första felmeddelandet bland formulärets fel, även inne i listor. */
export function forstaFormularFel(fel: FieldErrors): string | undefined {
  for (const [nyckel, varde] of Object.entries(fel)) {
    // `ref` pekar på DOM-elementet – gå aldrig in i det
    if (nyckel === "ref" || !varde || typeof varde !== "object") continue;
    if ("message" in varde && typeof varde.message === "string" && varde.message)
      return varde.message;
    const djupare = forstaFormularFel(varde as FieldErrors);
    if (djupare) return djupare;
  }
  return undefined;
}

/**
 * Efter ett stoppat försök att spara: scrolla till första felet. Körs efter
 * att felmeddelandena ritats ut – därför en effekt.
 */
export function useScrollaTillForstaFel(
  formRef: React.RefObject<HTMLFormElement | null>,
  submitCount: number,
) {
  React.useEffect(() => {
    if (submitCount === 0) return;
    formRef.current
      ?.querySelector("[data-fel]")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [formRef, submitCount]);
}
