"use client";

import { useState } from "react";
import { ClipboardList, FileText, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  beräknaSummering,
  formateraTal,
  kundensNamn,
  type Job,
} from "@/lib/job-schema";
import JobOverviewDialog from "../oversikt/job-overview-dialog";
import { BildVisare } from "../bild-visare";
import {
  StatusBadge,
  FoljUppBadge,
  Badge,
} from "../oversikt/job-overview-badges";

interface Props {
  jobs: Job[];
  onEdit: (job: Job) => void;
  onDelete: (id: string) => void;
}

export default function JobList({ jobs, onEdit, onDelete }: Props) {
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [valdBild, setValdBild] = useState<string | null>(null);

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Inga jobb ännu. Lägg till ditt första jobb ovan.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {jobs.map((job) => {
        const summary = beräknaSummering(job);
        const customerDisplayName = kundensNamn(job.customer);
        // Första raden av arbetsbeskrivningen – skiljer jobb för samma kund åt
        const beskrivning = (job.planeratArbete || job.utfortArbete || "")
          .trim()
          .split("\n")[0];
        const customerAddress = [
          job.customer?.adress,
          job.customer?.postnummer,
          job.customer?.ort,
        ]
          .filter(Boolean)
          .join(", ");

        return (
          <Card
            key={job.id}
            className="cursor-pointer transition-colors hover:bg-accent/50"
            onClick={() => setViewingJob(job)}
          >
            <CardContent className="space-y-4 pt-5">
              {/* Överst: kund och jobb till vänster, siffrorna till höger */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="truncate text-lg font-bold text-blue-700 dark:text-blue-400">
                    {customerDisplayName || "Jobb utan kundnamn"}
                  </div>
                  {beskrivning && (
                    <p className="truncate text-sm text-foreground/80">
                      {beskrivning}
                    </p>
                  )}
                  <p className="truncate text-sm text-muted-foreground">
                    {customerAddress || "Ingen adress angiven"}
                  </p>
                </div>

                <div className="shrink-0 space-y-0.5 whitespace-nowrap text-right text-xs text-muted-foreground">
                  <div>
                    <span className="tabular-nums font-medium text-foreground">
                      {formateraTal(summary.totalTimmar)}
                    </span>{" "}
                    h arbete
                  </div>

                  <div>
                    <span className="tabular-nums font-medium text-foreground">
                      {formateraTal(summary.totalStracka)}
                    </span>{" "}
                    km resa
                  </div>

                  <div className="tabular-nums font-medium text-foreground">
                    {summary.artiklarSum.toLocaleString("sv-SE", {
                      style: "currency",
                      currency: "SEK",
                      maximumFractionDigits: 0,
                    })}{" "}
                    material
                  </div>
                  {job.bilder?.length ? (
                    <div>
                      <span className="tabular-nums font-medium text-foreground">
                        {job.bilder.length}
                      </span>{" "}
                      {job.bilder.length === 1 ? "bild" : "bilder"}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Nederst: status till vänster, knappar till höger */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge job={job} />
                  <FoljUppBadge job={job} />
                  {job.fakturerat && (
                    <Badge label="Fakturerat" color="orange" />
                  )}
                  {job.betalt && <Badge label="Betalt" color="green" />}
                  {job.rotAvdrag && <Badge label="ROT" />}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      setViewingJob(job);
                    }}
                  >
                    <ClipboardList className="h-4 w-4" />
                    Översikt
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/mina-sidor/jobb/${job.id}/skriv-ut`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText className="h-4 w-4" />
                      Faktura
                    </Link>
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(job);
                    }}
                    aria-label={`Redigera jobbet för ${customerDisplayName || "jobb utan kund"}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(job.id);
                    }}
                    aria-label={`Ta bort jobbet för ${customerDisplayName || "jobb utan kund"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <JobOverviewDialog
        job={viewingJob}
        onOpenChange={(open) => {
          if (!open) setViewingJob(null);
        }}
        onSelectImage={setValdBild}
      />

      <BildVisare url={valdBild} onStang={() => setValdBild(null)} />
    </div>
  );
}
