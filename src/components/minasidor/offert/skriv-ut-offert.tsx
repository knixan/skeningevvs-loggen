"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Pencil, Printer } from "lucide-react";
import { formateraAntal } from "@/lib/job-schema";
import {
  fakturaAPris,
  fakturaKr as kr,
  saljarensMomsNummer,
} from "@/lib/faktura";
import type { OffertData } from "@/lib/offert";
import { Button } from "@/components/ui/button";

const OffertPdfKnapp = dynamic(
  () => import("./offert-pdf-knapp").then((m) => m.OffertPdfKnapp),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" size="sm" disabled>
        Laddar...
      </Button>
    ),
  },
);

interface Props {
  offertId: string;
  offert: OffertData;
  logoUrl: string;
}

/** Ritar bara upp offerten – alla belopp är färdigräknade i `offert`. */
export default function SkrivUtOffert({ offertId, offert, logoUrl }: Props) {
  const { saljare, kund, summa, satser } = offert;
  const kundPostOrt = [kund?.postnummer, kund?.ort].filter(Boolean).join(" ");

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
        .offert-info { text-align: right; }
        .offert-info h1 { font-size: 22pt; font-weight: 700; color: #1a1a1a; }
        .offert-info table { margin-top: 6px; font-size: 9pt; }
        .offert-info td { padding: 1px 0 1px 16px; }
        .offert-info td:first-child { color: #777; padding-left: 0; }

        .kund-block { margin-bottom: 24px; }
        .kund-block h3, .beskrivning h3 { font-size: 8pt; text-transform: uppercase; color: #999; letter-spacing: 0.08em; margin-bottom: 4px; }
        .kund-block p { font-size: 10pt; line-height: 1.5; }
        .beskrivning { margin-bottom: 20px; }
        .beskrivning p { font-size: 10pt; line-height: 1.5; white-space: pre-wrap; }

        table.rader { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        table.rader th { text-align: left; font-size: 8pt; text-transform: uppercase; color: #888; padding: 5px 6px; border-bottom: 1.5px solid #1a1a1a; }
        table.rader td { padding: 6px 6px; border-bottom: 1px solid #eee; font-size: 9.5pt; vertical-align: top; }
        table.rader tr:last-child td { border-bottom: none; }
        .right { text-align: right; }
        .bold { font-weight: 600; }

        .summering { margin-left: auto; width: 300px; margin-bottom: 24px; }
        .summering table { width: 100%; border-collapse: collapse; }
        .summering td { padding: 4px 0; font-size: 9.5pt; }
        .summering td:last-child { text-align: right; }
        .summering .total-rad td { border-top: 1.5px solid #1a1a1a; font-weight: 700; font-size: 11pt; padding-top: 8px; }
        .summering .moms-rad td { color: #555; font-size: 9pt; }

        .villkor { font-size: 9pt; color: #333; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 4px; white-space: pre-wrap; }
        .villkor h4 { font-size: 8pt; text-transform: uppercase; color: #888; letter-spacing: 0.08em; margin-bottom: 6px; }
        .giltighet { font-size: 9.5pt; margin-top: 12px; font-weight: 600; }
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
          flexWrap: "wrap",
          gap: 8,
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Skriv ut
        </Button>
        <OffertPdfKnapp offert={offert} logoUrl={logoUrl} />
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/mina-sidor/offerter/${offertId}/redigera`}>
            <Pencil className="h-4 w-4 mr-2" />
            Redigera
          </Link>
        </Button>
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

          <div className="offert-info">
            <h1>OFFERT</h1>
            <table>
              <tbody>
                <tr>
                  <td>Offertnummer</td>
                  <td className="bold">{offert.offertnummer}</td>
                </tr>
                <tr>
                  <td>Offertdatum</td>
                  <td>{offert.offertdatum}</td>
                </tr>
                <tr>
                  <td>Gäller t.o.m.</td>
                  <td>{offert.giltigTill}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Kund */}
        <div className="kund-block">
          <h3>Offert till</h3>
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
          {offert.rotAvdrag && kund?.rotBostad && (
            <p style={{ marginTop: 4, fontSize: "9pt", color: "#555" }}>
              ROT-avdrag · {kund.rotBostad}
            </p>
          )}
        </div>

        {/* Arbetsbeskrivning */}
        {offert.beskrivning && (
          <div className="beskrivning">
            <h3>Arbetsbeskrivning</h3>
            <p>{offert.beskrivning}</p>
          </div>
        )}

        {/* Raderna – med fast pris finns inga */}
        {offert.rader.length > 0 && (
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
              {offert.rader.map((rad, i) => (
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

        {/* Summering */}
        <div className="summering">
          <table>
            <tbody>
              <tr>
                <td>
                  {offert.fastPris ? "Fast pris exkl. moms" : "Summa exkl. moms"}
                </td>
                <td>{kr(summa.exklMoms)}</td>
              </tr>
              {/* Arbetsdelen av ett fast pris – ROT räknas bara på den */}
              {offert.visaArbetskostnad && (
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
                <>
                  <tr className="moms-rad">
                    <td>Totalt inkl. moms</td>
                    <td>{kr(summa.totalInklMoms)}</td>
                  </tr>
                  <tr className="moms-rad">
                    <td>
                      Preliminärt ROT-avdrag {satser.rotProcent}% (av{" "}
                      {kr(summa.rotUnderlag)} arbete inkl. moms)*
                    </td>
                    <td style={{ color: "#dc2626" }}>−{kr(summa.rotAvdrag)}</td>
                  </tr>
                </>
              )}
              {summa.oresutjamning !== 0 && (
                <tr className="moms-rad">
                  <td>Öresutjämning</td>
                  <td>{kr(summa.oresutjamning)}</td>
                </tr>
              )}
              <tr className="total-rad">
                <td>
                  {summa.rotAvdrag > 0
                    ? "Att betala efter ROT-avdrag"
                    : "Att betala"}
                </td>
                <td>{kr(summa.attBetala)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Villkor och giltighet */}
        {offert.villkor && (
          <div className="villkor">
            <h4>Villkor</h4>
            {offert.villkor}
          </div>
        )}
        <p className="giltighet">
          Offerten gäller till och med {offert.giltigTill}.
        </p>
        {saljare.fSkatt && (
          <p className="fskatt">
            ✓ Godkänd för F-skatt · Momsreg.nr: {saljarensMomsNummer(saljare)}
          </p>
        )}
        {offert.rotAvdrag && (
          <p className="fskatt" style={{ marginTop: 4 }}>
            * ROT-avdraget är preliminärt: {satser.rotProcent}% av
            arbetskostnaden inkl. moms. Det förutsätter att du har rätt till
            avdraget och att Skatteverket godkänner det. Medges det inte, helt
            eller delvis, betalar du mellanskillnaden.
          </p>
        )}
      </div>
    </>
  );
}
