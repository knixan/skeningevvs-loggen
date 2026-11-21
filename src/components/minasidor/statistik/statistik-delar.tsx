import Link from "next/link";
import { MANADSNAMN } from "@/lib/datum";
import { formateraKr, formateraTal } from "@/lib/job-schema";
import type { Period, Statistik } from "@/lib/statistik";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { statistikUrl } from "./period-val";

// Delarna på statistiksidan. Bara uppritning – alla siffror kommer färdiga
// från lib/statistik.ts. Beloppen kommer i ören.

/** "1 faktura", "3 fakturor" */
export function antal(n: number, en: string, flera: string) {
  return `${n.toLocaleString("sv-SE")} ${n === 1 ? en : flera}`;
}

/** Exakt belopp, med ören när de finns – för tabeller. */
export function kr(ore: number) {
  return formateraKr(ore / 100);
}

/** Hela kronor – för nyckeltalen, där ören bara gör siffran svårläst. */
export function heltKr(ore: number) {
  return formateraKr(Math.round(ore / 100));
}

/** "Hela 2026" eller "Mars 2026". */
export function periodNamn({ ar, manad }: Period) {
  if (manad == null) return `Hela ${ar}`;
  const namn = MANADSNAMN[manad - 1];
  return `${namn.charAt(0).toUpperCase()}${namn.slice(1)} ${ar}`;
}

// ------------------------------------------------------------
// Nyckeltal
// ------------------------------------------------------------

export function Nyckeltal({
  etikett,
  varde,
  detalj,
}: {
  etikett: string;
  varde: string;
  detalj?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-muted-foreground">{etikett}</p>
        <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          {varde}
        </p>
        {detalj && (
          <p className="mt-1 text-xs text-muted-foreground">{detalj}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Jobben just nu
// ------------------------------------------------------------

// Egna färger (inte Chip-tonerna) – fem grupper som måste gå att skilja åt
const STATUSRADER: {
  nyckel: keyof Statistik["status"];
  namn: string;
  prick: string;
}[] = [
  { nyckel: "ejPaborjade", namn: "Ej påbörjade", prick: "bg-gray-400" },
  { nyckel: "pagaende", namn: "Pågående", prick: "bg-blue-600" },
  {
    nyckel: "attFakturera",
    namn: "Utförda, ej fakturerade",
    prick: "bg-red-600",
  },
  {
    nyckel: "obetalda",
    namn: "Fakturerade, ej betalda",
    prick: "bg-orange-500",
  },
  { nyckel: "betalda", namn: "Betalda", prick: "bg-green-600" },
];

export function JobbStatusKort({ status }: { status: Statistik["status"] }) {
  const totalt = Object.values(status).reduce((s, n) => s + n, 0);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Jobben</CardTitle>
        <CardDescription>
          {antal(totalt, "jobb", "jobb")}, vart och ett i det senaste steget
          det har nått
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {STATUSRADER.map((r) => (
            <li
              key={r.nyckel}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full", r.prick)}
                />
                {r.namn}
              </span>
              <span className="font-medium tabular-nums">
                {status[r.nyckel]}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/mina-sidor"
          className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Till jobblistan
        </Link>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Största kunderna
// ------------------------------------------------------------

export function ToppKunderKort({
  kunder,
  period,
  omsattningOre,
  className,
}: {
  kunder: Statistik["toppKunder"];
  period: Period;
  /** Hela periodens omsättning, för andelen */
  omsattningOre: number;
  className?: string;
}) {
  const storst = kunder[0]?.omsattningOre ?? 0;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Största kunderna</CardTitle>
        <CardDescription>{periodNamn(period)}, exkl. moms</CardDescription>
      </CardHeader>
      <CardContent>
        {kunder.length === 0 ? (
          <p className="text-muted-foreground">
            Inga utfärdade fakturor under perioden.
          </p>
        ) : (
          <ol className="space-y-3">
            {kunder.map((k) => (
              <li key={k.customerId ?? "borttagen"}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{k.namn}</span>
                  <span className="shrink-0 tabular-nums">
                    {kr(k.omsattningOre)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-primary/10">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width: `${storst > 0 ? (k.omsattningOre / storst) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {antal(k.fakturor, "faktura", "fakturor")}
                  {omsattningOre > 0 &&
                    ` · ${Math.round((k.omsattningOre / omsattningOre) * 100)} % av omsättningen`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Tabeller
// ------------------------------------------------------------

/** Tal i en tabellcell, eller ett streck för noll. */
function Cell({
  children,
  noll,
  className,
}: {
  children: React.ReactNode;
  noll: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 text-right",
        noll && "text-muted-foreground",
        className,
      )}
    >
      {noll ? "–" : children}
    </td>
  );
}

const th = "px-3 py-2 text-right font-medium";

export function ManadsTabell({
  manader,
  arsSumma,
  period,
}: {
  manader: Statistik["manader"];
  arsSumma: Statistik["arsSumma"];
  period: Period;
}) {
  const rad = (m: Statistik["arsSumma"]) => (
    <>
      <Cell noll={m.omsattningOre === 0}>{kr(m.omsattningOre)}</Cell>
      <Cell noll={m.rotOre === 0}>{kr(m.rotOre)}</Cell>
      <Cell noll={m.fakturor === 0}>{m.fakturor}</Cell>
      <Cell noll={m.nyaJobb === 0}>{m.nyaJobb}</Cell>
      <Cell noll={m.timmar === 0}>{formateraTal(m.timmar)}</Cell>
      <Cell noll={m.km === 0}>{formateraTal(m.km)}</Cell>
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Månad för månad {period.ar}</CardTitle>
        <CardDescription>
          Omsättning och ROT-avdrag på utfärdade fakturor efter fakturadatum,
          exkl. moms. Timmar och km efter arbetspassens och resornas datum.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <table className="w-full min-w-xl text-sm tabular-nums">
          <thead>
            <tr className="border-y text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Månad</th>
              <th className={th}>Omsättning</th>
              <th className={th}>ROT-avdrag</th>
              <th className={th}>Fakturor</th>
              <th className={th}>Nya jobb</th>
              <th className={th}>Timmar</th>
              <th className={th}>Km</th>
            </tr>
          </thead>
          <tbody>
            {manader.map((m) => {
              const vald = period.manad === m.manad;
              return (
                <tr
                  key={m.manad}
                  className={cn("border-b", vald && "bg-muted font-medium")}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={statistikUrl(period.ar, m.manad)}
                      scroll={false}
                      aria-current={vald ? "true" : undefined}
                      className="capitalize underline-offset-4 hover:underline"
                    >
                      {MANADSNAMN[m.manad - 1]}
                    </Link>
                  </td>
                  {rad(m)}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="px-3 py-2">Hela {period.ar}</td>
              {rad(arsSumma)}
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

export function ArsTabell({
  arsvis,
  valtAr,
}: {
  arsvis: Statistik["arsvis"];
  valtAr: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>År för år</CardTitle>
        <CardDescription>
          Utfärdade fakturor per år, exkl. moms. ROT-avdraget är det som
          begärs från Skatteverket.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <table className="w-full min-w-sm text-sm tabular-nums">
          <thead>
            <tr className="border-y text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">År</th>
              <th className={th}>Omsättning</th>
              <th className={th}>ROT-avdrag</th>
              <th className={th}>Fakturor</th>
            </tr>
          </thead>
          <tbody>
            {arsvis.map((a) => (
              <tr
                key={a.ar}
                className={cn(
                  "border-b last:border-b-0",
                  a.ar === valtAr && "bg-muted font-medium",
                )}
              >
                <td className="px-3 py-2">
                  <Link
                    href={statistikUrl(a.ar, null)}
                    scroll={false}
                    className="underline-offset-4 hover:underline"
                  >
                    {a.ar}
                  </Link>
                </td>
                <Cell noll={a.omsattningOre === 0}>{kr(a.omsattningOre)}</Cell>
                <Cell noll={a.rotOre === 0}>{kr(a.rotOre)}</Cell>
                <Cell noll={a.fakturor === 0}>{a.fakturor}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
