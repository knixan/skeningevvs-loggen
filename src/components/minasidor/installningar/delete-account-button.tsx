"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { anropaAction } from "@/lib/anropa-action";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteAccount } from "@/lib/job-actions";
import authClient from "@/lib/auth-client";

const BEKRAFTELSE_ORD = "RADERA";

export default function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await anropaAction(() => deleteAccount());
      if (!result.ok) {
        toast.error(result.error ?? "Något gick fel");
        return;
      }
      await authClient.signOut();
      router.push("/");
      toast.success("Ditt konto och all data har raderats.");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setInput("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Ta bort konto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ta bort konto permanent?</DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            <span className="block">
              Detta raderar <strong>all din data</strong> permanent —
              företagsuppgifter, alla jobb, kunder, bilder och ditt konto.
              Åtgärden kan inte ångras.
            </span>
            <span className="block rounded-md border border-varning/30 bg-varning/10 px-3 py-2 text-varning">
              Fakturor ska sparas i sju år enligt bokföringslagen. Även de
              utfärdade fakturorna raderas.{" "}
              <strong>Ladda ner dem först:</strong>{" "}
              <a
                href="/api/export/fakturor?ar=alla"
                className="underline"
                download
              >
                alla fakturor (CSV)
              </a>
              ,{" "}
              <a href="/api/export/kunder" className="underline" download>
                kundregistret (CSV)
              </a>{" "}
              och fakturorna som PDF från{" "}
              <a href="/mina-sidor/fakturor" className="underline">
                Fakturor
              </a>
              .
            </span>
            <span className="block pt-1">
              Skriv <strong>{BEKRAFTELSE_ORD}</strong> för att bekräfta.
            </span>
          </DialogDescription>
        </DialogHeader>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={BEKRAFTELSE_ORD}
          className="mt-1"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button
            variant="destructive"
            disabled={input !== BEKRAFTELSE_ORD || isPending}
            onClick={handleDelete}
          >
            {isPending ? "Raderar..." : "Radera allt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
