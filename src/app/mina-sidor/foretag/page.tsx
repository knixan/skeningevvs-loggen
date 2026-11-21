import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server-hjalp";
import { companySchema } from "@/lib/job-schema";
import { getCompanySettings } from "@/lib/queries";
import { Sida, SidHuvud, SidLaddar } from "@/components/minasidor/sida";
import CompanySettingsForm from "@/components/minasidor/foretag/company-settings-form";

export default function ForetagsuppgifterPage() {
  return (
    <Sida>
      <Suspense
        fallback={<SidLaddar />}
      >
        <ForetagInnehall />
      </Suspense>
    </Sida>
  );
}

async function ForetagInnehall() {
  const session = await getSession();
  if (!session?.user) redirect("/logga-in");

  // Företaget skapas först när något sparas – tills dess visas ett tomt
  // formulär med standardvärdena.
  const company = (await getCompanySettings()) ?? {
    ...companySchema.parse({ name: "Mitt företag" }),
    id: "",
    logoUrl: "",
    logoKey: "",
  };

  return (
    <>
      <SidHuvud
        titel="Företagsuppgifter"
        beskrivning="Uppgifterna står på fakturor och offerter."
      />
      <CompanySettingsForm company={company} />
    </>
  );
}
