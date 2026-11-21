"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, KeyRound, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormSection } from "@/components/minasidor/formular";
import authClient from "@/lib/auth-client";
import DeleteAccountButton from "./delete-account-button";
import AhlsellPrislista, { type AhlsellStatus } from "./ahlsell-prislista";

export default function InstallningarKlient({
  ahlsell,
}: {
  ahlsell: AhlsellStatus;
}) {
  return (
    <div className="space-y-6">
      <AhlsellPrislista status={ahlsell} />
      <ExportSection />
      <BytLosenordForm />
      <FarligZonSection />
    </div>
  );
}

/** Export inför bokslut, revision eller byte av system. */
function ExportSection() {
  const ar = new Date().getFullYear();
  return (
    <FormSection
      icon={Download}
      title="Exportera"
      description="Fakturor och kundregister som CSV-filer, t.ex. inför bokslut eller till revisorn. Fakturorna finns också som PDF under Fakturor."
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/export/fakturor?ar=${ar}`} download>
            <Download className="h-4 w-4" />
            Fakturor {ar}
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/export/fakturor?ar=${ar - 1}`} download>
            <Download className="h-4 w-4" />
            Fakturor {ar - 1}
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/export/fakturor?ar=alla" download>
            <Download className="h-4 w-4" />
            Alla fakturor
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/export/kunder" download>
            <Download className="h-4 w-4" />
            Kundregister
          </a>
        </Button>
      </div>
    </FormSection>
  );
}

function BytLosenordForm() {
  const [nuvarandeLosenord, setNuvarandeLosenord] = useState("");
  const [nyttLosenord, setNyttLosenord] = useState("");
  const [bekraftaLosenord, setBekraftaLosenord] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (nyttLosenord.length < 8) {
      toast.error("Nytt lösenord måste vara minst 8 tecken");
      return;
    }
    if (nyttLosenord !== bekraftaLosenord) {
      toast.error("Lösenorden matchar inte");
      return;
    }

    startTransition(async () => {
      const { error } = await authClient.changePassword({
        currentPassword: nuvarandeLosenord,
        newPassword: nyttLosenord,
        revokeOtherSessions: true,
      });

      if (error) {
        toast.error(error.message ?? "Kunde inte byta lösenord");
        return;
      }

      toast.success("Lösenord bytt");
      setNuvarandeLosenord("");
      setNyttLosenord("");
      setBekraftaLosenord("");
    });
  }

  return (
    <FormSection icon={KeyRound} title="Byt lösenord">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nuvarande lösenord" htmlFor="nuvarande">
            <Input
              id="nuvarande"
              type="password"
              autoComplete="current-password"
              value={nuvarandeLosenord}
              onChange={(e) => setNuvarandeLosenord(e.target.value)}
              required
            />
          </Field>
          <Field label="Nytt lösenord" htmlFor="nytt">
            <Input
              id="nytt"
              type="password"
              autoComplete="new-password"
              value={nyttLosenord}
              onChange={(e) => setNyttLosenord(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Minst 8 tecken</p>
          </Field>
          <Field label="Bekräfta nytt lösenord" htmlFor="bekrafta">
            <Input
              id="bekrafta"
              type="password"
              autoComplete="new-password"
              value={bekraftaLosenord}
              onChange={(e) => setBekraftaLosenord(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sparar..." : "Byt lösenord"}
          </Button>
        </form>
    </FormSection>
  );
}

function FarligZonSection() {
  return (
    <FormSection
      icon={TriangleAlert}
      title="Farlig zon"
      tone="destructive"
      description="Raderar ditt konto, alla jobb, kunder, bilder och företagsuppgifter permanent."
    >
      <DeleteAccountButton />
    </FormSection>
  );
}
