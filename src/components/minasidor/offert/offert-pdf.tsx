import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { formateraAntal } from "@/lib/job-schema";
import {
  fakturaAPris,
  fakturaKr as kr,
  saljarensMomsNummer,
} from "@/lib/faktura";
import type { OffertData } from "@/lib/offert";

// Samma utseende som fakturans PDF (faktura-pdf.tsx), men med offertens
// uppgifter och utan betalningsuppgifter.

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
    padding: 57,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 12,
    marginBottom: 18,
  },
  logo: { maxHeight: 50, maxWidth: 130, objectFit: "contain", marginBottom: 6 },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 15 },
  companyDetails: { fontSize: 8, color: "#555", marginTop: 3, lineHeight: 1.5 },

  infoRight: { alignItems: "flex-end" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 20 },
  infoRow: { flexDirection: "row", marginTop: 2 },
  infoLabel: { fontSize: 8, color: "#777", width: 80 },
  infoValue: { fontSize: 8, width: 70, textAlign: "right" },
  infoValueBold: { fontFamily: "Helvetica-Bold" },

  label: {
    fontSize: 7,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  kundBold: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  kundText: { fontSize: 10, lineHeight: 1.5 },
  kundSub: { fontSize: 8, color: "#555", marginTop: 3 },
  beskrivning: { fontSize: 10, lineHeight: 1.5 },

  tableWrap: { marginBottom: 16 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 4,
  },
  th: { fontSize: 7, color: "#888", textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 5,
    alignItems: "flex-start",
  },
  // Inget flex: 1 – i en kolumn blir höjden då 0 och raden under (artikelnr,
  // återförsäljare) ritas ovanpå
  tdDesc: { fontSize: 9 },
  tdDescSub: { fontSize: 8, color: "#888" },
  tdRight: { fontSize: 9, textAlign: "right" },
  tdBold: { fontFamily: "Helvetica-Bold" },

  summWrap: { alignItems: "flex-end", marginBottom: 18 },
  summBox: { width: 270 },
  summRow: { flexDirection: "row", paddingVertical: 3 },
  summLabel: { flex: 1, fontSize: 9, paddingRight: 8 },
  summValue: { fontSize: 9, textAlign: "right" },
  summMuted: { fontSize: 8, color: "#555" },
  summRot: { fontSize: 8, color: "#dc2626" },
  summDivider: {
    borderTopWidth: 1.5,
    borderTopColor: "#1a1a1a",
    marginTop: 4,
    paddingTop: 6,
  },
  summTotalLabel: { fontFamily: "Helvetica-Bold", fontSize: 11, flex: 1 },
  summTotalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    textAlign: "right",
  },

  villkor: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    marginTop: 8,
  },
  villkorText: { fontSize: 8.5, color: "#333", lineHeight: 1.5 },
  giltighet: { fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 10 },
  fskatt: { fontSize: 8, color: "#555", marginTop: 6 },
});

/** Ritar bara upp offerten – alla belopp är färdigräknade i `offert`. */
export function OffertPdf({
  offert,
  logoUrl,
}: {
  offert: OffertData;
  logoUrl: string;
}) {
  const { saljare, kund, summa, satser } = offert;

  const info: [string, string, boolean?][] = [
    ["Offertnummer", String(offert.offertnummer), true],
    ["Offertdatum", offert.offertdatum],
    ["Gäller t.o.m.", offert.giltigTill],
  ];

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* ── Header ── */}
        <View style={S.header}>
          <View>
            {logoUrl && (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image, not an HTML img
              <Image src={logoUrl} style={S.logo} />
            )}
            <Text style={S.companyName}>{saljare.namn}</Text>
            <View style={S.companyDetails}>
              {saljare.orgNummer ? (
                <Text>Org.nr {saljare.orgNummer}</Text>
              ) : null}
              {saljare.adress ? <Text>{saljare.adress}</Text> : null}
              {saljare.postnummer || saljare.ort ? (
                <Text>
                  {saljare.postnummer} {saljare.ort}
                </Text>
              ) : null}
              {saljare.telefon ? <Text>{saljare.telefon}</Text> : null}
              {saljare.epost ? <Text>{saljare.epost}</Text> : null}
            </View>
          </View>

          <View style={S.infoRight}>
            <Text style={S.title}>OFFERT</Text>
            <View style={{ marginTop: 8 }}>
              {info.map(([label, value, bold]) => (
                <View style={S.infoRow} key={label}>
                  <Text style={S.infoLabel}>{label}</Text>
                  <Text style={[S.infoValue, bold ? S.infoValueBold : {}]}>
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Kund ── */}
        <View style={{ marginBottom: 18 }}>
          <Text style={S.label}>Offert till</Text>
          <Text style={S.kundBold}>{kund?.namn || "Okänd kund"}</Text>
          {kund?.kontaktperson ? (
            <Text style={S.kundText}>{kund.kontaktperson}</Text>
          ) : null}
          {kund?.adress ? <Text style={S.kundText}>{kund.adress}</Text> : null}
          {kund?.postnummer || kund?.ort ? (
            <Text style={S.kundText}>
              {kund.postnummer} {kund.ort}
            </Text>
          ) : null}
          {kund?.epost ? <Text style={S.kundText}>{kund.epost}</Text> : null}
          {kund?.telefon ? (
            <Text style={S.kundText}>{kund.telefon}</Text>
          ) : null}
          {offert.rotAvdrag && kund?.rotBostad ? (
            <Text style={S.kundSub}>ROT-avdrag · {kund.rotBostad}</Text>
          ) : null}
        </View>

        {/* ── Arbetsbeskrivning ── */}
        {offert.beskrivning ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={S.label}>Arbetsbeskrivning</Text>
            <Text style={S.beskrivning}>{offert.beskrivning}</Text>
          </View>
        ) : null}

        {/* ── Rader – med fast pris finns inga ── */}
        {offert.rader.length > 0 && (
          <View style={S.tableWrap}>
            <View style={S.tableHead}>
              <Text style={[S.th, { flex: 1 }]}>Beskrivning</Text>
              <Text style={[S.th, { width: 44, textAlign: "right" }]}>
                Antal
              </Text>
              <Text style={[S.th, { width: 62, textAlign: "right" }]}>
                À-pris
              </Text>
              <Text style={[S.th, { width: 68, textAlign: "right" }]}>
                Belopp
              </Text>
            </View>

            {offert.rader.map((rad, i) => (
              <View style={S.row} key={i}>
                <View style={{ flex: 1 }}>
                  <Text style={S.tdDesc}>{rad.beskrivning}</Text>
                  {rad.detalj ? (
                    <Text style={S.tdDescSub}>{rad.detalj}</Text>
                  ) : null}
                </View>
                <Text style={[S.tdRight, { width: 44 }]}>
                  {formateraAntal(rad.antal, rad.enhet)}
                </Text>
                <Text style={[S.tdRight, { width: 62 }]}>
                  {fakturaAPris(rad)}
                </Text>
                <Text style={[S.tdRight, S.tdBold, { width: 68 }]}>
                  {kr(rad.belopp)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Summering ── */}
        <View style={S.summWrap} wrap={false}>
          <View style={S.summBox}>
            <View style={S.summRow}>
              <Text style={S.summLabel}>
                {offert.fastPris ? "Fast pris exkl. moms" : "Summa exkl. moms"}
              </Text>
              <Text style={S.summValue}>{kr(summa.exklMoms)}</Text>
            </View>
            {/* Arbetsdelen av ett fast pris – ROT räknas bara på den */}
            {offert.visaArbetskostnad && (
              <View style={S.summRow}>
                <Text style={[S.summLabel, S.summMuted]}>
                  varav arbetskostnad exkl. moms
                </Text>
                <Text style={[S.summValue, S.summMuted]}>
                  {kr(summa.arbetskostnad)}
                </Text>
              </View>
            )}
            <View style={S.summRow}>
              <Text style={[S.summLabel, S.summMuted]}>
                {offert.omvandMoms
                  ? "Moms 0 % – omvänd betalningsskyldighet"
                  : `Moms ${satser.momsProcent}%`}
              </Text>
              <Text style={[S.summValue, S.summMuted]}>{kr(summa.moms)}</Text>
            </View>
            {summa.rotAvdrag > 0 && (
              <>
                <View style={S.summRow}>
                  <Text style={[S.summLabel, S.summMuted]}>
                    Totalt inkl. moms
                  </Text>
                  <Text style={[S.summValue, S.summMuted]}>
                    {kr(summa.totalInklMoms)}
                  </Text>
                </View>
                <View style={S.summRow}>
                  <Text style={[S.summLabel, S.summMuted]}>
                    Preliminärt ROT-avdrag {satser.rotProcent}% (av{" "}
                    {kr(summa.rotUnderlag)} inkl. moms)*
                  </Text>
                  {/* Vanligt bindestreck – U+2212 finns inte i typsnittet */}
                  <Text style={[S.summValue, S.summRot]}>
                    -{kr(summa.rotAvdrag)}
                  </Text>
                </View>
              </>
            )}
            {summa.oresutjamning !== 0 && (
              <View style={S.summRow}>
                <Text style={[S.summLabel, S.summMuted]}>Öresutjämning</Text>
                <Text style={[S.summValue, S.summMuted]}>
                  {kr(summa.oresutjamning)}
                </Text>
              </View>
            )}
            <View style={[S.summRow, S.summDivider]}>
              <Text style={S.summTotalLabel}>
                {summa.rotAvdrag > 0
                  ? "Att betala efter ROT-avdrag"
                  : "Att betala"}
              </Text>
              <Text style={S.summTotalValue}>{kr(summa.attBetala)}</Text>
            </View>
          </View>
        </View>

        {/* ── Villkor och giltighet ── */}
        {offert.villkor ? (
          <View style={S.villkor}>
            <Text style={S.label}>Villkor</Text>
            <Text style={S.villkorText}>{offert.villkor}</Text>
          </View>
        ) : null}
        <Text style={S.giltighet}>
          Offerten gäller till och med {offert.giltigTill}.
        </Text>
        {(saljare.fSkatt || saljarensMomsNummer(saljare)) && (
          // Inget "✓" – PDF:ens standardtypsnitt har bara tecknen i WinAnsi
          <Text style={S.fskatt}>
            {[
              saljare.fSkatt && "Godkänd för F-skatt",
              saljarensMomsNummer(saljare) &&
                `Momsreg.nr: ${saljarensMomsNummer(saljare)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
        {offert.rotAvdrag && (
          <Text style={S.fskatt}>
            * ROT-avdraget är preliminärt: {satser.rotProcent}% av
            arbetskostnaden inkl. moms. Det förutsätter att du har rätt till
            avdraget och att Skatteverket godkänner det. Medges det inte, helt
            eller delvis, betalar du mellanskillnaden.
          </Text>
        )}
      </Page>
    </Document>
  );
}
