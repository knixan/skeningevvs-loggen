import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { idagISverige } from "@/lib/datum";
import { getFakturaAr, getFakturor } from "@/lib/queries";
import { getSession } from "@/lib/server-hjalp";
import { fakturaKr } from "@/lib/faktura";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/minasidor/oversikt/job-overview-badges";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";

export const metadata = { title: "Fakturor – Skeningevvs-loggen" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function FakturorPage({ searchParams }: Props) {
  return (
    <Sida bredd="normal">
      <Suspense fallback={<SidLaddar />}>
        <FakturorInnehall searchParams={searchParams} />
      </Suspense>
    </Sida>
  );
}

async function FakturorInnehall({ searchParams }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  const idag = idagISverige();
  const innevarande = Number(idag.slice(0, 4));
  const sp = await searchParams;
  const arParam = Array.isArray(sp.ar) ? sp.ar[0] : sp.ar;
  const ar =
    arParam && /^\d{4}$/.test(arParam) ? Number(arParam) : innevarande;

  const [fakturor, arMedFakturor] = await Promise.all([
    getFakturor(ar),
    getFakturaAr(),
  ]);
  const arsval = [...new Set([innevarande, ...arMedFakturor, ar])].sort(
    (a, b) => b - a,
  );
  const summa = fakturor.reduce((s, f) => s + f.exklMomsOre, 0);

  return (
    <>
      <SidHuvud
        titel="Fakturor"
        beskrivning="Alla utfärdade fakturor och kreditfakturor. En utfärdad faktura ändras aldrig – blev något fel krediteras den."
        atgard={
          <Button variant="outline" asChild>
            <a href={`/api/export/fakturor?ar=${ar}`} download>
              <Download className="h-4 w-4" />
              Ladda ner {ar} (CSV)
            </a>
          </Button>
        }
      />

      <nav aria-label="Välj år" className="mb-4 flex flex-wrap gap-2">
        {arsval.map((a) => (
          <Link
            key={a}
            href={a === innevarande ? "/mina-sidor/fakturor" : `?ar=${a}`}
            aria-current={a === ar ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors",
              a === ar
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-muted",
            )}
          >
            {a}
          </Link>
        ))}
      </nav>

      {fakturor.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Inga fakturor utfärdade {ar}. Fakturor utfärdas från jobben.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {fakturor.length} st · summa exkl. moms{" "}
            <span className="font-medium text-foreground tabular-nums">
              {fakturaKr(summa / 100)}
            </span>
          </p>
          <ul className="grid gap-2">
            {fakturor.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/mina-sidor/fakturor/${f.id}/skriv-ut`}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums">
                        {f.arKredit ? "Kreditfaktura" : "Faktura"}{" "}
                        {f.fakturanummer}
                      </span>
                      {f.arKredit && f.krediterarNummer != null && (
                        <Badge
                          label={`Krediterar ${f.krediterarNummer}`}
                          color="red"
                        />
                      )}
                      {f.krediteradAvNummer != null && (
                        <Badge
                          label={`Krediterad av ${f.krediteradAvNummer}`}
                          color="red"
                        />
                      )}
                      {!f.arKredit &&
                        f.krediteradAvNummer == null &&
                        f.betalt != null && (
                          <Badge
                            label={f.betalt ? "Betald" : "Obetald"}
                            color={f.betalt ? "green" : "orange"}
                          />
                        )}
                      {f.omvandMoms && <Badge label="Omvänd moms" />}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {f.kund || "Okänd kund"} · {f.fakturadatum}
                      {f.jobId == null && " · jobbet borttaget"}
                    </p>
                  </div>
                  <div className="text-left tabular-nums sm:text-right">
                    <div className="font-semibold">
                      {fakturaKr(f.attBetalaOre / 100)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      exkl. moms {fakturaKr(f.exklMomsOre / 100)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
