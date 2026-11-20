"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FakturaData } from "@/lib/faktura";
import { FakturaPdf } from "./faktura-pdf";

interface Props {
  faktura: FakturaData;
  logoUrl: string;
}

export function PdfKnapp({ faktura, logoUrl }: Props) {
  return (
    <PDFDownloadLink
      document={<FakturaPdf faktura={faktura} logoUrl={logoUrl} />}
      fileName={`faktura-${faktura.fakturanummer ?? "forhandsgranskning"}.pdf`}
    >
      {({ loading }) => (
        <Button variant="outline" size="sm" disabled={loading} asChild={false}>
          <Download className="h-4 w-4 mr-2" />
          {loading ? "Skapar PDF..." : "Ladda ner PDF"}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
