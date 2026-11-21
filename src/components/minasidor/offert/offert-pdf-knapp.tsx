"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { OffertData } from "@/lib/offert";
import { OffertPdf } from "./offert-pdf";

interface Props {
  offert: OffertData;
  logoUrl: string;
}

export function OffertPdfKnapp({ offert, logoUrl }: Props) {
  return (
    // En länk som ser ut som en knapp – ingen <button> inuti länken
    <PDFDownloadLink
      document={<OffertPdf offert={offert} logoUrl={logoUrl} />}
      fileName={`offert-${offert.offertnummer}.pdf`}
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
