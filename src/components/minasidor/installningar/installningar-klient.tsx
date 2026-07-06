"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import authClient from "@/lib/auth-client";
import DeleteAccountButton from "./delete-account-button";

export default function InstallningarKlient() {
  return (
    <div className="space-y-8 max-w-xl">
      <BytLosenordForm />
      <Separator />
      <FarligZonSection />
    </div>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          Byt lösenord
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nuvarande">Nuvarande lösenord</Label>
            <Input
              id="nuvarande"
              type="password"
              autoComplete="current-password"
              value={nuvarandeLosenord}
              onChange={(e) => setNuvarandeLosenord(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nytt">Nytt lösenord</Label>
            <Input
              id="nytt"
              type="password"
              autoComplete="new-password"
              value={nyttLosenord}
              onChange={(e) => setNyttLosenord(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Minst 8 tecken</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bekrafta">Bekräfta nytt lösenord</Label>
            <Input
              id="bekrafta"
              type="password"
              autoComplete="new-password"
              value={bekraftaLosenord}
              onChange={(e) => setBekraftaLosenord(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sparar..." : "Byt lösenord"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FarligZonSection() {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-destructive">Farlig zon</p>
      <p className="text-xs text-muted-foreground">
        Raderar ditt konto, alla jobb, kunder, bilder och företagsuppgifter
        permanent.
      </p>
      <div className="mt-2">
        <DeleteAccountButton />
      </div>
    </div>
  );
}
