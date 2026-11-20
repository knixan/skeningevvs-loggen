"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Briefcase, Handshake, Trash2 } from "lucide-react";
import { deleteOffert, skapaJobbFranOffert } from "@/lib/offert-actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * "Gör om till jobb" – eller en länk till jobbet om offerten redan har
 * gjorts om. Efteråt öppnas det nya jobbet för redigering.
 */
export function SkapaJobbKnapp({
  offertId,
  offertnummer,
  jobId,
}: {
  offertId: string;
  offertnummer: number;
  jobId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (jobId) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/mina-sidor/jobb/${jobId}/redigera`}>
          <Briefcase className="h-4 w-4" />
          Visa jobb
        </Link>
      </Button>
    );
  }

  function skapaJobb() {
    startTransition(async () => {
      const result = await skapaJobbFranOffert(offertId);
      if (result.ok) {
        toast.success(`Jobb skapat från offert ${offertnummer}`);
        router.push(`/mina-sidor/jobb/${result.jobId}/redigera`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={isPending}>
          <Handshake className="h-4 w-4" />
          {isPending ? "Skapar..." : "Gör om till jobb"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Gör om offert {offertnummer} till jobb?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ett nytt jobb skapas med offertens kund, priser, artiklar och
            övriga kostnader, och offerten markeras som accepterad. Den
            beräknade arbetstiden och körsträckan blir inte loggad tid – den
            står som en anteckning på jobbet.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={skapaJobb}>Skapa jobb</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TaBortOffertKnapp({
  offertId,
  offertnummer,
}: {
  offertId: string;
  offertnummer: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function taBort() {
    startTransition(async () => {
      const result = await deleteOffert(offertId);
      if (result.ok) {
        toast.success(`Offert ${offertnummer} borttagen`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ta bort offert"
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta bort offert {offertnummer}?</AlertDialogTitle>
          <AlertDialogDescription>
            Offerten och dess rader tas bort. Ett jobb som skapats från
            offerten finns kvar. Offertnumret återanvänds inte. Åtgärden kan
            inte ångras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={taBort}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Ta bort
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
