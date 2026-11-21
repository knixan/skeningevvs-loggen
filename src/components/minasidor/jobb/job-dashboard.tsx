"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Search } from "lucide-react";
import JobList from "@/components/minasidor/jobb/job-list";
import { deleteJob, laddaFlerJobb } from "@/lib/job-actions";
import { anropaAction } from "@/lib/anropa-action";
import { kundensNamn, type Job } from "@/lib/job-schema";
import {
  JOBB_FILTER,
  JOBB_FILTER_TEXT,
  type JobbFilter,
  type JobbRaknare,
} from "@/lib/jobb-filter";
import { cn } from "@/lib/utils";
import { filterChipKlass } from "@/components/minasidor/chip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Ett jobb som fakturerats kan inte tas bort (bokföringslagen). */
function arFakturerat(job: Job) {
  return Boolean(job.harFaktura || job.fakturanummer != null || job.fakturerat);
}

interface Props {
  jobs: Job[];
  nextCursor: string | null;
  filter: JobbFilter;
  sok: string;
  /** Antal per filter, räknat i databasen över alla jobb som matchar sökningen */
  raknare: JobbRaknare;
}

export default function JobDashboard({
  jobs: initialJobs,
  nextCursor: initialCursor,
  filter,
  sok: initialSok,
  raknare,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [allJobs, setAllJobs] = useState<Job[]>(initialJobs);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [prevInitialJobs, setPrevInitialJobs] = useState(initialJobs);
  const [laddar, startLadda] = useTransition();
  const [byter, startByt] = useTransition();
  const [sok, setSok] = useState(initialSok);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  // Ny sida från servern (filter, sökning eller ändring) – börja om listan
  if (initialJobs !== prevInitialJobs) {
    setPrevInitialJobs(initialJobs);
    setAllJobs(initialJobs);
    setCursor(initialCursor);
  }

  /** Byter filter/sökning i adressen – servern filtrerar och räknar. */
  function visa(nyttFilter: JobbFilter, nyttSok: string) {
    const params = new URLSearchParams();
    if (nyttFilter !== "alla") params.set("status", nyttFilter);
    if (nyttSok.trim()) params.set("sok", nyttSok.trim());
    const qs = params.toString();
    startByt(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Sökningen skickas när man slutat skriva en stund
  useEffect(() => {
    if (sok.trim() === initialSok) return;
    const t = setTimeout(() => visa(filter, sok), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bara när sökordet ändras
  }, [sok]);

  async function confirmDelete() {
    if (!jobToDelete) return;
    const id = jobToDelete.id;
    const result = await anropaAction(() => deleteJob(id));
    if (result.ok) {
      toast.success("Jobb borttaget");
      setAllJobs((prev) => prev.filter((j) => j.id !== id));
      router.refresh();
    } else {
      toast.error(result.error ?? "Kunde inte ta bort jobb");
    }
    setJobToDelete(null);
  }

  function handleEdit(job: Job) {
    router.push(`/mina-sidor/jobb/${job.id}/redigera`);
  }

  function loadMore() {
    if (!cursor) return;
    startLadda(async () => {
      const result = await anropaAction(() =>
        laddaFlerJobb({ cursor, filter, sok: initialSok }),
      );
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("jobs" in result) {
        setAllJobs((prev) => [...prev, ...result.jobs]);
        setCursor(result.nextCursor);
      }
    });
  }

  const inganJobbAlls = raknare.alla === 0 && !initialSok;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          inputMode="search"
          aria-label="Sök bland jobben"
          placeholder="Sök kund, adress, utfört arbete, fakturanr..."
          value={sok}
          onChange={(e) => setSok(e.target.value)}
          className="h-10 pl-9"
        />
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrera på status"
      >
        {JOBB_FILTER.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => visa(f, sok)}
            className={filterChipKlass(filter === f)}
          >
            {JOBB_FILTER_TEXT[f]}
            <span className="text-xs opacity-80">({raknare[f]})</span>
          </button>
        ))}
      </div>

      <div
        className={cn("transition-opacity", byter && "opacity-60")}
        aria-busy={byter}
      >
        {allJobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {inganJobbAlls ? (
                <>
                  Du har inga jobb ännu.{" "}
                  <Link
                    href="/mina-sidor/nytt-jobb"
                    className="underline hover:text-foreground"
                  >
                    Skapa ditt första jobb
                  </Link>
                  .
                </>
              ) : (
                `Inga jobb matchar${initialSok ? ` sökningen "${initialSok}"` : ""} med vald status.`
              )}
            </CardContent>
          </Card>
        ) : (
          <JobList
            jobs={allJobs}
            onEdit={handleEdit}
            onDelete={(id) => {
              const job = allJobs.find((j) => j.id === id);
              if (job) setJobToDelete(job);
            }}
          />
        )}
      </div>

      {cursor && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore} disabled={laddar}>
            {laddar ? "Laddar..." : "Ladda fler jobb"}
          </Button>
        </div>
      )}

      <AlertDialog
        open={!!jobToDelete}
        onOpenChange={(open) => !open && setJobToDelete(null)}
      >
        <AlertDialogContent>
          {jobToDelete && arFakturerat(jobToDelete) ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Jobbet kan inte tas bort</AlertDialogTitle>
                <AlertDialogDescription>
                  Jobbet för{" "}
                  <span className="font-medium text-foreground">
                    {kundensNamn(jobToDelete.customer) || "detta jobb"}
                  </span>{" "}
                  är fakturerat. Fakturor och deras underlag ska sparas i sju
                  år enligt bokföringslagen. Blev fakturan fel kan den
                  krediteras från fakturasidan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stäng</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Ta bort jobb?</AlertDialogTitle>
                <AlertDialogDescription>
                  Du håller på att ta bort jobbet för{" "}
                  <span className="font-medium text-foreground">
                    {kundensNamn(jobToDelete?.customer) || "detta jobb"}
                  </span>
                  . Detta raderar all information, inklusive artiklar, resor,
                  arbetstid och uppladdade bilder. Åtgärden kan inte ångras.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDelete}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Ta bort
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
