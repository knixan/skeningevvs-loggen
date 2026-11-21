"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { formateraAntal } from "@/lib/job-schema";
import {
  fakturaAPris,
  fakturaKr as kr,
  formateraPeriod,
  saljarensMomsNummer,
  type FakturaData,
} from "@/lib/faktura";
import { krediteraFaktura, utfardaFaktura } from "@/lib/job-actions";
import { anropaAction } from "@/lib/anropa-action";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, FileCheck, FileX, Printer } from "lucide-react";

const PdfKnapp = dynamic(() => import("./pdf-knapp").then((m) => m.PdfKnapp), {
  ssr: false,
  loading: () => (
    <Button variant="outline" size="sm" disabled>
      Laddar...
    </Button>
  ),
});

interface Props {
  /** Den sparade fakturan, eller en förhandsgranskning av dagens data */
  faktura: FakturaData;
  logoUrl: string;
  nastaFakturanummer: number;
  /** Vart tillbakapilen leder, t.ex. jobblistan eller fakturalistan */
  tillbaka: { href: string; text: string };
  /** Förhandsgranskning: jobbet som fakturan gäller */
  jobId?: string;
  /** Utfärdad: den sparade fakturans id */
  fakturaId?: string;
  /** Det som stoppar att fakturan utfärdas (förhandsgranskning) */
  hinder?: string[];
  /** Varningar som inte stoppar, t.ex. ROT-taket */
  varningar?: string[];
  /** Fakturan är krediterad av kreditfaktura med det här numret */
  krediteradAv?: { id: string; fakturanummer: number } | null;
}

export default function SkrivUtKlient({
  faktura,
  logoUrl,
  nastaFakturanummer,
  tillbaka,
  jobId,
  fakturaId,
  hinder = [],
  varningar = [],
  krediteradAv = null,
}: Props) {
  const router = useRouter();
  const [utfardar, startUtfarda] = useTransition();
  const [krediterar, startKreditera] = useTransition();

  const arUtfardad = fakturaId != null;
  const arKredit = faktura.krediterar != null;
  const { saljare, kund, summa, satser } = faktura;
  // Jobb som fick ett nummer innan fakturor sparades: numret finns, men
  // fakturan är inte låst än.
  const harNummerUtanSparadFaktura =
    !arUtfardad && faktura.fakturanummer != null;
  const kundPostOrt = [kund?.postnummer, kund?.ort].filter(Boolean).join(" ");
  const momsNr = saljarensMomsNummer(saljare);
  // Gamla fakturor sparade personnumret även utan ROT – visa det bara med ROT
  const visaPersonnummer = faktura.rotAvdrag && kund?.personnummer;

  function utfarda() {
    if (!jobId) return;
    startUtfarda(async () => {
      const result = await anropaAction(() => utfardaFaktura(jobId));
      if (result.ok) {
        toast.success(`Faktura ${result.nummer} utfärdad`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function kreditera() {
    if (!fakturaId) return;
    startKreditera(async () => {
      const result = await anropaAction(() => krediteraFaktura(fakturaId));
      if (result.ok) {
        toast.success(`Kreditfaktura ${result.nummer} utfärdad`);
        router.push(`/mina-sidor/fakturor/${result.id}/skriv-ut`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const foretagsDetaljer = (
    <div className="company-details">
      {saljare.orgNummer && (
        <span>
          Org.nr {saljare.orgNummer}
          <br />
        </span>
      )}
      {saljare.adress && (
        <span>
          {saljare.adress}
          <br />
        </span>
      )}
      {(saljare.postnummer || saljare.ort) && (
        <span>
          {saljare.postnummer} {saljare.ort}
          <br />
        </span>
      )}
      {saljare.telefon && (
        <span>
          {saljare.telefon}
          <br />
        </span>
      )}
      {saljare.epost && <span>{saljare.epost}</span>}
    </div>
  );

  const rubrik = !arUtfardad
    ? "FÖRHANDSGRANSKNING"
    : arKredit
      ? "KREDITFAKTURA"
      : "FAKTURA";

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; background: white; }
        .sida { padding: 2cm; max-width: 21cm; margin: 0 auto; }

        .header { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 20px; }
        .logo-block { display: flex; align-items: center; gap: 12px; }
        .logo-block img { max-height: 60px; max-width: 160px; object-fit: contain; }
        .company-name { font-size: 18pt; font-weight: 700; }
        .company-details { font-size: 8.5pt; color: #555; margin-top: 4px; line-height: 1.5; }
        .faktura-info { text-align: right; margin-left: auto; }
        .faktura-info h1 { font-size: 22pt; font-weight: 700; color: #1a1a1a; }
        .faktura-info table { margin-top: 6px; font-size: 9pt; margin-left: auto; }
        .faktura-info td { padding: 1px 0 1px 16px; }
        .faktura-info td:first-child { color: #777; padding-left: 0; }

        .kund-block { margin-bottom: 24px; }
        .kund-block h3 { font-size: 8pt; text-transform: uppercase; color: #999; letter-spacing: 0.08em; margin-bottom: 4px; }
        .kund-block p { font-size: 10pt; line-height: 1.5; }

        .rader-wrap { overflow-x: auto; margin-bottom: 20px; }
        table.rader { width: 100%; border-collapse: collapse; }
        table.rader th { text-align: left; font-size: 8pt; text-transform: uppercase; color: #888; padding: 5px 6px; border-bottom: 1.5px solid #1a1a1a; }
        table.rader td { padding: 6px 6px; border-bottom: 1px solid #eee; font-size: 9.5pt; vertical-align: top; }
        table.rader tr:last-child td { border-bottom: none; }
        .right { text-align: right; white-space: nowrap; }
        .bold { font-weight: 600; }

        .summering { margin-left: auto; width: 100%; max-width: 300px; margin-bottom: 24px; }
        .summering table { width: 100%; border-collapse: collapse; }
        .summering td { padding: 4px 0; font-size: 9.5pt; }
        .summering td:last-child { text-align: right; white-space: nowrap; padding-left: 12px; }
        .summering .total-rad td { border-top: 1.5px solid #1a1a1a; font-weight: 700; font-size: 11pt; padding-top: 8px; }
        .summering .moms-rad td { color: #555; font-size: 9pt; }

        .betalning { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .betalning-block h4 { font-size: 8pt; text-transform: uppercase; color: #888; letter-spacing: 0.08em; margin-bottom: 6px; }
        .betalning-block p { font-size: 9.5pt; line-height: 1.6; }

        .fakturatext { font-size: 9pt; color: #555; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 4px; white-space: pre-wrap; }
        .fskatt { font-size: 8.5pt; color: #555; margin-top: 8px; }
        .omvand { font-size: 9.5pt; font-weight: 700; margin-top: 8px; }

        .verktyg { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; position: sticky; top: 0; z-index: 10; }
        .meddelanden { padding: 12px 16px 0; max-width: 21cm; margin: 0 auto; font-size: 9.5pt; }
        .meddelanden ul { margin: 6px 0 0 18px; list-style: disc; }
        .hinder { border: 1px solid #fca5a5; background: #fef2f2; color: #991b1b; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
        .varning { border: 1px solid #fcd34d; background: #fffbeb; color: #92400e; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }

        @media (max-width: 640px) {
          .sida { padding: 16px; }
        }
        @media print {
          body { margin: 0; }
          .sida { padding: 1.5cm; }
          @page { margin: 0; size: A4; }
          nav, footer, .no-print { display: none !important; }
        }
      `}</style>

      <div className="verktyg no-print">
        <Button variant="ghost" size="sm" asChild>
          <Link href={tillbaka.href}>
            <ArrowLeft className="h-4 w-4" />
            {tillbaka.text}
          </Link>
        </Button>
        {arUtfardad ? (
          <>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Skriv ut
            </Button>
            <PdfKnapp faktura={faktura} logoUrl={logoUrl} />
            {!arKredit && !krediteradAv && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={krediterar}>
                    <FileX className="h-4 w-4" />
                    {krediterar ? "Krediterar..." : "Kreditera"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Kreditera faktura {faktura.fakturanummer}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      En kreditfaktura med nästa fakturanummer (just nu{" "}
                      {nastaFakturanummer}) och negativa belopp utfärdas och
                      tar ut den här fakturan. Jobbet blir ofakturerat och kan
                      faktureras på nytt med ett nytt nummer.
                      {faktura.rotAvdrag &&
                        " Har Skatteverket redan betalat ut ROT-avdraget ska det betalas tillbaka."}{" "}
                      Det går inte att ångra.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                    <AlertDialogAction onClick={kreditera}>
                      Utfärda kreditfaktura
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {krediteradAv && (
              <Link
                href={`/mina-sidor/fakturor/${krediteradAv.id}/skriv-ut`}
                style={{ fontSize: "9pt", color: "#b91c1c" }}
                className="underline"
              >
                Krediterad av kreditfaktura {krediteradAv.fakturanummer}
              </Link>
            )}
          </>
        ) : (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={utfardar || hinder.length > 0}>
                  <FileCheck className="h-4 w-4" />
                  {utfardar
                    ? "Sparar..."
                    : harNummerUtanSparadFaktura
                      ? `Spara faktura ${faktura.fakturanummer}`
                      : "Utfärda faktura"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {harNummerUtanSparadFaktura
                      ? `Spara faktura ${faktura.fakturanummer}?`
                      : "Utfärda faktura?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {harNummerUtanSparadFaktura ? (
                      <>
                        Fakturan sparas som den ser ut nu, med dagens datum
                        som fakturadatum. Därefter ändras den inte, även om
                        jobbet, kunden eller företagsuppgifterna ändras.
                      </>
                    ) : (
                      <>
                        Fakturan får nästa lediga fakturanummer (just nu{" "}
                        {nastaFakturanummer}) och jobbet markeras som
                        fakturerat. Fakturan sparas som den ser ut nu och
                        ändras inte efteråt – blir något fel får den
                        krediteras. Ett utfärdat fakturanummer kan inte ändras
                        eller återanvändas.
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction onClick={utfarda}>
                    {harNummerUtanSparadFaktura
                      ? "Spara faktura"
                      : "Utfärda faktura"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p style={{ fontSize: "9pt", color: "#6b7280" }}>
              {harNummerUtanSparadFaktura
                ? "Fakturan är inte sparad – den ändras om jobbet ändras."
                : "Förhandsgranskning – fakturan har inget fakturanummer än."}
            </p>
          </>
        )}
      </div>

      {(hinder.length > 0 || varningar.length > 0) && (
        <div className="meddelanden no-print">
          {hinder.length > 0 && (
            <div className="hinder" role="alert">
              <strong>Fakturan kan inte utfärdas än:</strong>
              <ul>
                {hinder.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {varningar.map((v) => (
            <p key={v} className="varning">
              {v}
            </p>
          ))}
        </div>
      )}

      <div className="sida">
        {/* Header */}
        <div className="header">
          <div className="logo-block">
            {logoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={`${saljare.namn} logotyp`} />
                <div>
                  <div className="company-name">{saljare.namn}</div>
                  {foretagsDetaljer}
                </div>
              </>
            ) : (
              <div>
                <div className="company-name">{saljare.namn}</div>
                {foretagsDetaljer}
              </div>
            )}
          </div>

          <div className="faktura-info">
            <h1>{rubrik}</h1>
            <table>
              <tbody>
                <tr>
                  <td>{arKredit ? "Kreditfakturanr" : "Fakturanummer"}</td>
                  <td className="bold">{faktura.fakturanummer ?? "–"}</td>
                </tr>
                <tr>
                  <td>Fakturadatum</td>
                  <td>{faktura.fakturadatum}</td>
                </tr>
                {faktura.krediterar && (
                  <tr>
                    <td>Avser faktura</td>
                    <td>
                      {faktura.krediterar.fakturanummer} (
                      {faktura.krediterar.fakturadatum})
                    </td>
                  </tr>
                )}
                {faktura.utfortPeriod && (
                  <tr>
                    <td>Utfört</td>
                    <td>{formateraPeriod(faktura.utfortPeriod)}</td>
                  </tr>
                )}
                {!arKredit && (
                  <>
                    <tr>
                      <td>Förfallodatum</td>
                      <td>{faktura.forfallodatum}</td>
                    </tr>
                    <tr>
                      <td>Betalningsvillkor</td>
                      <td>{saljare.forfallodagar} dagar netto</td>
                    </tr>
                    {saljare.drojsmalsranta > 0 && (
                      <tr>
                        <td>Dröjsmålsränta</td>
                        <td>{saljare.drojsmalsranta}%</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kund */}
        <div className="kund-block">
          <h3>Faktureras till</h3>
          <p>
            <strong>{kund?.namn || "Okänd kund"}</strong>
            <br />
            {kund?.kontaktperson && (
              <>
                {kund.kontaktperson}
                <br />
              </>
            )}
            {kund?.adress && (
              <>
                {kund.adress}
                <br />
              </>
            )}
            {kundPostOrt && (
              <>
                {kundPostOrt}
                <br />
              </>
            )}
            {kund?.epost && (
              <>
                {kund.epost}
                <br />
              </>
            )}
            {kund?.telefon && <>{kund.telefon}</>}
          </p>
          {kund?.momsNummer && (
            <p style={{ marginTop: 4, fontSize: "9pt", color: "#555" }}>
              Köparens momsreg.nr: {kund.momsNummer}
            </p>
          )}
          {visaPersonnummer && (
            <p style={{ marginTop: 4, fontSize: "9pt", color: "#555" }}>
              Personnummer: {kund?.personnummer}
            </p>
          )}
          {faktura.rotAvdrag && kund?.rotBostad && (
            <p style={{ marginTop: 4, fontSize: "9pt", color: "#555" }}>
              ROT-avdrag · {kund.rotBostad}
            </p>
          )}
        </div>

        {/* Fakturaraderna – med fast pris finns inga */}
        {faktura.rader.length > 0 && (
          <div className="rader-wrap">
            <table className="rader">
              <thead>
                <tr>
                  <th>Beskrivning</th>
                  <th className="right">Antal</th>
                  <th className="right">À-pris</th>
                  <th className="right">Belopp</th>
                </tr>
              </thead>
              <tbody>
                {faktura.rader.map((rad, i) => (
                  <tr key={i}>
                    <td>
                      {rad.beskrivning}
                      {rad.detalj && (
                        <span style={{ color: "#888", fontSize: "8.5pt" }}>
                          {" "}
                          · {rad.detalj}
                        </span>
                      )}
                    </td>
                    <td className="right">
                      {formateraAntal(rad.antal, rad.enhet)}
                    </td>
                    <td className="right">{fakturaAPris(rad)}</td>
                    <td className="right bold">{kr(rad.belopp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {faktura.utfortArbete && (
          <p
            style={{
              marginBottom: 20,
              color: "#555",
              fontSize: "9pt",
              whiteSpace: "pre-wrap",
            }}
          >
            <strong>Utfört arbete:</strong> {faktura.utfortArbete}
          </p>
        )}

        {/* Summering */}
        <div className="summering">
          <table>
            <tbody>
              <tr>
                <td>
                  {faktura.fastPris
                    ? "Fast pris exkl. moms"
                    : "Summa exkl. moms"}
                </td>
                <td>{kr(summa.exklMoms)}</td>
              </tr>
              {/* Arbetsdelen av ett fast pris – ROT räknas bara på den */}
              {faktura.visaArbetskostnad && (
                <tr className="moms-rad">
                  <td>varav arbetskostnad exkl. moms</td>
                  <td>{kr(summa.arbetskostnad)}</td>
                </tr>
              )}
              <tr className="moms-rad">
                <td>
                  {faktura.omvandMoms
                    ? "Moms 0 % – omvänd betalningsskyldighet"
                    : `Moms ${satser.momsProcent}%`}
                </td>
                <td>{kr(summa.moms)}</td>
              </tr>
              {summa.rotAvdrag !== 0 && (
                <tr className="moms-rad">
                  <td>
                    ROT-avdrag {satser.rotProcent}% (av {kr(summa.rotUnderlag)}{" "}
                    arbete inkl. moms)*
                  </td>
                  <td style={{ color: "#dc2626" }}>{kr(-summa.rotAvdrag)}</td>
                </tr>
              )}
              {summa.oresutjamning !== 0 && (
                <tr className="moms-rad">
                  <td>Öresutjämning</td>
                  <td>{kr(summa.oresutjamning)}</td>
                </tr>
              )}
              <tr className="total-rad">
                <td>{arKredit ? "Att kreditera" : "Att betala"}</td>
                <td>{kr(summa.attBetala)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Betalningsuppgifter – en kreditfaktura betalas inte */}
        {arKredit ? (
          <p style={{ fontSize: "9.5pt", marginBottom: 20 }}>
            Kreditfakturan tar ut faktura {faktura.krediterar?.fakturanummer}.
            Har den redan betalats återbetalar vi beloppet.
          </p>
        ) : (
          <div className="betalning">
            <div className="betalning-block">
              <h4>Betalningsuppgifter</h4>
              <p>
                {saljare.bankgiro && (
                  <>
                    Bankgiro: {saljare.bankgiro}
                    <br />
                  </>
                )}
                {saljare.plusgiro && (
                  <>
                    Plusgiro: {saljare.plusgiro}
                    <br />
                  </>
                )}
                {saljare.swish && <>Swish: {saljare.swish}</>}
              </p>
            </div>
            <div className="betalning-block">
              <h4>Ange vid betalning</h4>
              <p>Fakturanummer {faktura.fakturanummer ?? "–"}</p>
            </div>
          </div>
        )}

        {/* Fakturatext, F-skatt och momsreg.nr */}
        {saljare.fakturatext && (
          <p className="fakturatext">{saljare.fakturatext}</p>
        )}
        {faktura.omvandMoms && (
          <p className="omvand">Omvänd betalningsskyldighet</p>
        )}
        {(saljare.fSkatt || momsNr) && (
          <p className="fskatt">
            {[
              saljare.fSkatt && "✓ Godkänd för F-skatt",
              momsNr && `Momsreg.nr: ${momsNr}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {faktura.rotAvdrag && (
          <p className="fskatt" style={{ marginTop: 4 }}>
            {arKredit
              ? `* ROT-avdraget på faktura ${faktura.krediterar?.fakturanummer} krediteras.`
              : `* ROT-avdrag: Avser ${satser.rotProcent}% av arbetskostnad inkl. moms. Hantverkaren ansöker om utbetalning hos Skatteverket.`}
          </p>
        )}
      </div>
    </>
  );
}
