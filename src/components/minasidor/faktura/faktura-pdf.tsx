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
  formateraPeriod,
  saljarensMomsNummer,
  type FakturaData,
} from "@/lib/faktura";

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

  fakturaRight: { alignItems: "flex-end" },
  fakturaTitle: { fontFamily: "Helvetica-Bold", fontSize: 20 },
  fakturaRow: { flexDirection: "row", marginTop: 2 },
  fakturaLabel: { fontSize: 8, color: "#777", width: 90 },
  fakturaValue: { fontSize: 8, width: 70, textAlign: "right" },
  fakturaValueBold: { fontFamily: "Helvetica-Bold" },

  kundLabel: {
    fontSize: 7,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  kundBold: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  kundText: { fontSize: 10, lineHeight: 1.5 },
  kundSub: { fontSize: 8, color: "#555", marginTop: 3 },

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
  tdDesc: { flex: 1, fontSize: 9 },
  tdDescSub: { fontSize: 8, color: "#888" },
  tdRight: { fontSize: 9, textAlign: "right" },
  tdBold: { fontFamily: "Helvetica-Bold" },
  noteRow: { paddingTop: 8, paddingBottom: 4 },
  noteText: { fontSize: 8, color: "#555" },
  noteBold: { fontFamily: "Helvetica-Bold" },

  summWrap: { alignItems: "flex-end", marginBottom: 18 },
  summBox: { width: 230 },
  summRow: { flexDirection: "row", paddingVertical: 3 },
  summLabel: { flex: 1, fontSize: 9 },
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

  payGrid: { flexDirection: "row", gap: 20, marginBottom: 16 },
  payBlock: { flex: 1 },
  payLabel: {
    fontSize: 7,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  payText: { fontSize: 9, lineHeight: 1.6 },

  fakturatext: {
    fontSize: 8,
    color: "#555",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    marginTop: 8,
  },
  fskatt: { fontSize: 8, color: "#555", marginTop: 6 },
  omvand: { fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 6 },
});

/** Ritar bara upp fakturan – alla belopp är färdigräknade i `faktura`. */
export function FakturaPdf({
  faktura,
  logoUrl,
}: {
  faktura: FakturaData;
  logoUrl: string;
}) {
  const { saljare, kund, summa, satser } = faktura;
  const arKredit = faktura.krediterar != null;
  const momsNr = saljarensMomsNummer(saljare);
  // Gamla fakturor sparade personnumret även utan ROT – visa det bara med ROT
  const visaPersonnummer = faktura.rotAvdrag && kund?.personnummer;

  type InfoRad = [string, string, boolean?];
  const fakturaRader: InfoRad[] = [
    [
      arKredit ? "Kreditfakturanr" : "Fakturanummer",
      String(faktura.fakturanummer ?? "–"),
      true,
    ],
    ["Fakturadatum", faktura.fakturadatum],
    ...(faktura.krediterar
      ? [
          [
            "Avser faktura",
            `${faktura.krediterar.fakturanummer} (${faktura.krediterar.fakturadatum})`,
          ] as InfoRad,
        ]
      : []),
    ...(faktura.utfortPeriod
      ? [["Utfört", formateraPeriod(faktura.utfortPeriod)] as InfoRad]
      : []),
    ...(arKredit
      ? []
      : [
          ["Förfallodatum", faktura.forfallodatum] as InfoRad,
          [`Betalningsvillkor`, `${saljare.forfallodagar} dagar netto`] as InfoRad,
          ...(saljare.drojsmalsranta > 0
            ? [[`Dröjsmålsränta`, `${saljare.drojsmalsranta}%`] as InfoRad]
            : []),
        ]),
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

          <View style={S.fakturaRight}>
            <Text style={S.fakturaTitle}>
              {faktura.fakturanummer == null
                ? "FÖRHANDSGRANSKNING"
                : arKredit
                  ? "KREDITFAKTURA"
                  : "FAKTURA"}
            </Text>
            <View style={{ marginTop: 8 }}>
              {fakturaRader.map(([label, value, bold]) => (
                <View style={S.fakturaRow} key={label}>
                  <Text style={S.fakturaLabel}>{label}</Text>
                  <Text
                    style={[S.fakturaValue, bold ? S.fakturaValueBold : {}]}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Kund ── */}
        <View style={{ marginBottom: 18 }}>
          <Text style={S.kundLabel}>Faktureras till</Text>
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
          {kund?.momsNummer ? (
            <Text style={S.kundSub}>Köparens momsreg.nr: {kund.momsNummer}</Text>
          ) : null}
          {visaPersonnummer ? (
            <Text style={S.kundSub}>Personnummer: {kund?.personnummer}</Text>
          ) : null}
          {faktura.rotAvdrag && kund?.rotBostad ? (
            <Text style={S.kundSub}>ROT-avdrag · {kund.rotBostad}</Text>
          ) : null}
        </View>

        {/* ── Fakturarader – med fast pris finns inga ── */}
        {faktura.rader.length > 0 && (
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

            {faktura.rader.map((rad, i) => (
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

        {faktura.utfortArbete && (
          <View style={faktura.fastPris ? { marginBottom: 16 } : S.noteRow}>
            <Text style={S.noteText}>
              <Text style={S.noteBold}>Utfört arbete: </Text>
              {faktura.utfortArbete}
            </Text>
          </View>
        )}

        {/* ── Summering ── */}
        <View style={S.summWrap}>
          <View style={S.summBox}>
            <View style={S.summRow}>
              <Text style={S.summLabel}>
                {faktura.fastPris ? "Fast pris exkl. moms" : "Summa exkl. moms"}
              </Text>
              <Text style={S.summValue}>{kr(summa.exklMoms)}</Text>
            </View>
            {/* Arbetsdelen av ett fast pris – ROT räknas bara på den */}
            {faktura.visaArbetskostnad && (
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
                {faktura.omvandMoms
                  ? "Moms 0 % - omvänd betalningsskyldighet"
                  : `Moms ${satser.momsProcent}%`}
              </Text>
              <Text style={[S.summValue, S.summMuted]}>{kr(summa.moms)}</Text>
            </View>
            {summa.rotAvdrag !== 0 && (
              <View style={S.summRow}>
                <Text style={[S.summLabel, S.summMuted]}>
                  ROT-avdrag {satser.rotProcent}% (av {kr(summa.rotUnderlag)}{" "}
                  inkl. moms)*
                </Text>
                <Text style={[S.summValue, S.summRot]}>
                  {kr(-summa.rotAvdrag)}
                </Text>
              </View>
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
                {arKredit ? "Att kreditera" : "Att betala"}
              </Text>
              <Text style={S.summTotalValue}>{kr(summa.attBetala)}</Text>
            </View>
          </View>
        </View>

        {/* ── Betalningsuppgifter ── */}
        {arKredit ? (
          <Text style={[S.payText, { marginBottom: 16 }]}>
            Kreditfakturan tar ut faktura {faktura.krediterar?.fakturanummer}.
            Har den redan betalats återbetalar vi beloppet.
          </Text>
        ) : null}
        {!arKredit && (saljare.bankgiro || saljare.plusgiro || saljare.swish) && (
          <View style={S.payGrid}>
            <View style={S.payBlock}>
              <Text style={S.payLabel}>Betalningsuppgifter</Text>
              {saljare.bankgiro ? (
                <Text style={S.payText}>Bankgiro: {saljare.bankgiro}</Text>
              ) : null}
              {saljare.plusgiro ? (
                <Text style={S.payText}>Plusgiro: {saljare.plusgiro}</Text>
              ) : null}
              {saljare.swish ? (
                <Text style={S.payText}>Swish: {saljare.swish}</Text>
              ) : null}
            </View>
            <View style={S.payBlock}>
              <Text style={S.payLabel}>Ange vid betalning</Text>
              <Text style={S.payText}>
                Fakturanummer {faktura.fakturanummer ?? "–"}
              </Text>
            </View>
          </View>
        )}

        {/* ── Footer ── */}
        {saljare.fakturatext ? (
          <Text style={S.fakturatext}>{saljare.fakturatext}</Text>
        ) : null}
        {faktura.omvandMoms ? (
          <Text style={S.omvand}>Omvänd betalningsskyldighet</Text>
        ) : null}
        {saljare.fSkatt || momsNr ? (
          <Text style={S.fskatt}>
            {[
              saljare.fSkatt && "Godkänd för F-skatt",
              momsNr && `Momsreg.nr: ${momsNr}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}
        {faktura.rotAvdrag && (
          <Text style={S.fskatt}>
            {arKredit
              ? `* ROT-avdraget på faktura ${faktura.krediterar?.fakturanummer} krediteras.`
              : `* ROT-avdrag: Avser ${satser.rotProcent}% av arbetskostnad inkl. moms. Hantverkaren ansöker om utbetalning hos Skatteverket.`}
          </Text>
        )}
      </Page>
    </Document>
  );
}
