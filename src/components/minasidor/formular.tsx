import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
