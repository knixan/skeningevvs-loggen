"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OffertData } from "@/lib/offert";
import { OffertPdf } from "./offert-pdf";

interface Props {
  offert: OffertData;
  logoUrl: string;
}

export function OffertPdfKnapp({ offert, logoUrl }: Props) {
  return (
    <PDFDownloadLink
      document={<OffertPdf offert={offert} logoUrl={logoUrl} />}
      fileName={`offert-${offert.offertnummer}.pdf`}
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
