"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { FakturaData } from "@/lib/faktura";
import { FakturaPdf } from "./faktura-pdf";

interface Props {
  faktura: FakturaData;
  logoUrl: string;
}

export function PdfKnapp({ faktura, logoUrl }: Props) {
  const typ = faktura.krediterar ? "kreditfaktura" : "faktura";
  return (
    // PDFDownloadLink är en länk – den ser ut som en knapp, men innehåller
    // ingen <button> (knapp i länk är ogiltig HTML och ger två tab-stopp)
    <PDFDownloadLink
      document={<FakturaPdf faktura={faktura} logoUrl={logoUrl} />}
      fileName={`${typ}-${faktura.fakturanummer ?? "forhandsgranskning"}.pdf`}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {({ loading }) => (
        <>
          <Download className="h-4 w-4" />
          {loading ? "Skapar PDF..." : "Ladda ner PDF"}
        </>
      )}
    </PDFDownloadLink>
  );
}
