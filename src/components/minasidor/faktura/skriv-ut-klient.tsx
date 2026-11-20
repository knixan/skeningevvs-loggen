"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { formateraAntal } from "@/lib/job-schema";
import {
  fakturaAPris,
  fakturaKr as kr,
  saljarensMomsNummer,
  type FakturaData,
} from "@/lib/faktura";
import { utfardaFaktura } from "@/lib/job-actions";
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
import { FileCheck, Printer } from "lucide-react";

const PdfKnapp = dynamic(() => import("./pdf-knapp").then((m) => m.PdfKnapp), {
  ssr: false,
  loading: () => (
    <Button variant="outline" size="sm" disabled>
      Laddar...
    </Button>
  ),
});

interface Props {
  jobId: string;
  /** Den sparade fakturan, eller en förhandsgranskning av dagens data */
  faktura: FakturaData;
  /** false = förhandsgranskning, fakturan är inte sparad */
  arUtfardad: boolean;
  logoUrl: string;
  nastaFakturanummer: number;
}

export default function SkrivUtKlient({
  jobId,
  faktura,
  arUtfardad,
  logoUrl,
  nastaFakturanummer,
}: Props) {
  const router = useRouter();
  const [utfardar, startUtfarda] = useTransition();

  const { saljare, kund, summa, satser } = faktura;
  // Jobb som fick ett nummer innan fakturor sparades: numret finns, men
  // fakturan är inte låst än.
  const harNummerUtanSparadFaktura =
    !arUtfardad && faktura.fakturanummer != null;
  const kundPostOrt = [kund?.postnummer, kund?.ort].filter(Boolean).join(" ");

  function utfarda() {
    startUtfarda(async () => {
      const result = await utfardaFaktura(jobId);
      if (result.ok) {
        toast.success(`Faktura ${result.nummer} utfärdad`);
        router.refresh();
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

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; background: white; }
        .sida { padding: 2cm; max-width: 21cm; margin: 0 auto; }

        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 20px; }
        .logo-block { display: flex; align-items: center; gap: 12px; }
        .logo-block img { max-height: 60px; max-width: 160px; object-fit: contain; }
        .company-name { font-size: 18pt; font-weight: 700; }
        .company-details { font-size: 8.5pt; color: #555; margin-top: 4px; line-height: 1.5; }
        .faktura-info { text-align: right; }
        .faktura-info h1 { font-size: 22pt; font-weight: 700; color: #1a1a1a; }
        .faktura-info table { margin-top: 6px; font-size: 9pt; }
        .faktura-info td { padding: 1px 0 1px 16px; }
        .faktura-info td:first-child { color: #777; padding-left: 0; }

        .kund-block { margin-bottom: 24px; }
        .kund-block h3 { font-size: 8pt; text-transform: uppercase; color: #999; letter-spacing: 0.08em; margin-bottom: 4px; }
        .kund-block p { font-size: 10pt; line-height: 1.5; }

        table.rader { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        table.rader th { text-align: left; font-size: 8pt; text-transform: uppercase; color: #888; padding: 5px 6px; border-bottom: 1.5px solid #1a1a1a; }
        table.rader td { padding: 6px 6px; border-bottom: 1px solid #eee; font-size: 9.5pt; vertical-align: top; }
        table.rader tr:last-child td { border-bottom: none; }
        .right { text-align: right; }
        .bold { font-weight: 600; }

        .summering { margin-left: auto; width: 280px; margin-bottom: 24px; }
        .summering table { width: 100%; border-collapse: collapse; }
        .summering td { padding: 4px 0; font-size: 9.5pt; }
        .summering td:last-child { text-align: right; }
        .summering .total-rad td { border-top: 1.5px solid #1a1a1a; font-weight: 700; font-size: 11pt; padding-top: 8px; }
        .summering .moms-rad td { color: #555; font-size: 9pt; }

        .betalning { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .betalning-block h4 { font-size: 8pt; text-transform: uppercase; color: #888; letter-spacing: 0.08em; margin-bottom: 6px; }
        .betalning-block p { font-size: 9.5pt; line-height: 1.6; }

        .fakturatext { font-size: 9pt; color: #555; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 4px; white-space: pre-wrap; }
        .fskatt { font-size: 8.5pt; color: #555; margin-top: 8px; }

        @media print {
          body { margin: 0; }
          .sida { padding: 1.5cm; }
          @page { margin: 0; size: A4; }
          nav, footer, .no-print { display: none !important; }
        }
      `}</style>

      <div
        className="no-print"
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {arUtfardad ? (
          <>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Skriv ut
            </Button>
            <PdfKnapp faktura={faktura} logoUrl={logoUrl} />
          </>
        ) : (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={utfardar}>
                  <FileCheck className="h-4 w-4 mr-2" />
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
                        ändras inte efteråt. Ett utfärdat fakturanummer kan
                        inte ändras eller återanvändas.
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
            <p
              style={{
                alignSelf: "center",
                fontSize: "9pt",
                color: "#6b7280",
              }}
            >
              {harNummerUtanSparadFaktura
                ? "Fakturan är inte sparad – den ändras om jobbet ändras."
                : "Förhandsgranskning – fakturan har inget fakturanummer än."}
            </p>
          </>
        )}
      </div>

      <div className="sida">
        {/* Header */}
        <div className="header">
          <div className="logo-block">
            {logoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logotyp" />
                <div>
                  <div className="company-name">{saljare.namn}</div>
                  {foretagsDetaljer}
                </div>
              </>
            ) : (
              <>
                <div className="company-name">{saljare.namn}</div>
                {foretagsDetaljer}
              </>
            )}
          </div>

          <div className="faktura-info">
            <h1>{arUtfardad ? "FAKTURA" : "FÖRHANDSGRANSKNING"}</h1>
            <table>
              <tbody>
                <tr>
                  <td>Fakturanummer</td>
                  <td className="bold">{faktura.fakturanummer ?? "–"}</td>
                </tr>
                <tr>
                  <td>Fakturadatum</td>
                  <td>{faktura.fakturadatum}</td>
                </tr>
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
          {kund?.personnummer && (
            <p style={{ marginTop: 4, fontSize: "9pt", color: "#555" }}>
              Personnummer: {kund.personnummer}
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
        )}
        {faktura.utfortArbete && (
          <p
            style={{
              marginBottom: 20,
              color: "#555",
              fontSize: "9pt",
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
                <td>Moms {satser.momsProcent}%</td>
                <td>{kr(summa.moms)}</td>
              </tr>
              {summa.rotAvdrag > 0 && (
                <tr className="moms-rad">
                  <td>
                    ROT-avdrag {satser.rotProcent}% (av {kr(summa.rotUnderlag)}{" "}
                    arbete inkl. moms)*
                  </td>
                  <td style={{ color: "#dc2626" }}>−{kr(summa.rotAvdrag)}</td>
                </tr>
              )}
              {summa.oresutjamning !== 0 && (
                <tr className="moms-rad">
                  <td>Öresutjämning</td>
                  <td>{kr(summa.oresutjamning)}</td>
                </tr>
              )}
              <tr className="total-rad">
                <td>Att betala</td>
                <td>{kr(summa.attBetala)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Betalningsuppgifter */}
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
            <h4>Meddelande / OCR</h4>
            <p>{faktura.fakturanummer ?? "–"}</p>
          </div>
        </div>

        {/* Fakturatext och F-skatt */}
        {saljare.fakturatext && (
          <p className="fakturatext">{saljare.fakturatext}</p>
        )}
        {saljare.fSkatt && (
          <p className="fskatt">
            ✓ Godkänd för F-skatt · Momsreg.nr: {saljarensMomsNummer(saljare)}
          </p>
        )}
        {faktura.rotAvdrag && (
          <p className="fskatt" style={{ marginTop: 4 }}>
            * ROT-avdrag: Avser {satser.rotProcent}% av arbetskostnad inkl.
            moms. Hantverkaren ansöker om utbetalning hos Skatteverket.
          </p>
        )}
      </div>
    </>
  );
}
