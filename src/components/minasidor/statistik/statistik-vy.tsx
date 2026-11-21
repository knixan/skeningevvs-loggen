import { Info } from "lucide-react";
import { formateraTal } from "@/lib/job-schema";
import type { Statistik } from "@/lib/statistik";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SidHuvud } from "@/components/minasidor/sida";
import { OmsattningDiagram } from "./omsattning-diagram";
import { PeriodVal } from "./period-val";
import {
  antal,
  ArsTabell,
  heltKr,
  JobbStatusKort,
  ManadsTabell,
  Nyckeltal,
  periodNamn,
  ToppKunderKort,
} from "./statistik-delar";

/** Hela statistiksidan, uppritad från färdiga siffror (lib/statistik.ts). */
export function StatistikVy({ s }: { s: Statistik }) {
  const { period, summa, obetalt } = s;

  return (
    <div className="space-y-10">
      <SidHuvud
        titel="Statistik"
        beskrivning="Omsättning och ROT-avdrag räknas på utfärdade fakturor, efter fakturadatum."
      />

      <section aria-labelledby="just-nu" className="space-y-4">
        <div>
          <h2 id="just-nu" className="text-lg font-semibold">
            Just nu
          </h2>
          <p className="text-sm text-muted-foreground">
            Gäller i dag, oavsett vald period.
          </p>
        </div>
        {/* Obetalt och Förfallet delar på höjden bredvid Jobben-kortet */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid auto-rows-fr gap-4">
            <Nyckeltal
              etikett="Obetalt"
              varde={heltKr(obetalt.attBetalaOre)}
              detalj={`${antal(obetalt.antal, "fakturerat jobb", "fakturerade jobb")} · att betala inkl. moms`}
            />
            <Nyckeltal
              etikett="Förfallet"
              varde={heltKr(obetalt.forfallnaOre)}
              detalj={
                obetalt.forfallna > 0
                  ? `${antal(obetalt.forfallna, "faktura", "fakturor")} har passerat förfallodagen`
                  : "Inga fakturor har passerat förfallodagen"
              }
            />
          </div>
          <JobbStatusKort status={s.status} />
        </div>
        {s.fakturaSaknas > 0 && (
          <p className="flex gap-2 rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {s.fakturaSaknas === 1
                ? "1 jobb är markerat som fakturerat"
                : `${s.fakturaSaknas} jobb är markerade som fakturerade`}{" "}
              men har ingen utfärdad faktura i appen. Utan fakturadatum räknas{" "}
              {s.fakturaSaknas === 1 ? "det" : "de"} inte i omsättning och ROT
              nedan – men obetalda jobb räknas med i Obetalt ovan.
            </span>
          </p>
        )}
      </section>

      <section aria-labelledby="period" className="space-y-4">
        <div className="space-y-3">
          <h2 id="period" className="text-lg font-semibold">
            {periodNamn(period)}
          </h2>
          <PeriodVal
            period={period}
            forstaAr={s.forstaAr}
            innevarandeAr={s.innevarandeAr}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Nyckeltal
            etikett="Omsättning exkl. moms"
            varde={heltKr(summa.omsattningOre)}
            detalj={antal(
              summa.fakturor,
              "utfärdad faktura",
              "utfärdade fakturor",
            )}
          />
          <Nyckeltal
            etikett="ROT-avdrag"
            varde={heltKr(summa.rotOre)}
            detalj={
              summa.fakturorMedRot > 0
                ? `På ${antal(summa.fakturorMedRot, "faktura", "fakturor")} – begärs från Skatteverket`
                : "Inga fakturor med ROT-avdrag"
            }
          />
        </div>
        {/* Samma tre kolumner som diagrammet och kundlistan nedanför, så
            att kanterna linjerar */}
        <div className="grid grid-cols-3 gap-4">
          <Nyckeltal etikett="Nya jobb" varde={String(summa.nyaJobb)} />
          <Nyckeltal
            etikett="Arbetade timmar"
            varde={`${formateraTal(summa.timmar)} h`}
          />
          <Nyckeltal
            etikett="Körda km"
            varde={`${formateraTal(summa.km)} km`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Omsättning per månad</CardTitle>
              <CardDescription>
                {period.ar}, kr exkl. moms. Klicka på en stapel för att välja
                månaden.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OmsattningDiagram manader={s.manader} period={period} />
            </CardContent>
          </Card>
          <ToppKunderKort
            kunder={s.toppKunder}
            period={period}
            omsattningOre={summa.omsattningOre}
          />
        </div>

        <ManadsTabell
          manader={s.manader}
          arsSumma={s.arsSumma}
          period={period}
        />
      </section>

      {s.arsvis.length > 0 && (
        <section aria-label="År för år">
          <ArsTabell arsvis={s.arsvis} valtAr={period.ar} />
        </section>
      )}
    </div>
  );
}
