"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import OffertForm from "@/components/minasidor/offert/offert-form";
import { updateOffert } from "@/lib/offert-actions";
import type { Customer, Offert, OffertInput } from "@/lib/job-schema";

interface Props {
  offert: Offert;
  customers: Customer[];
  materialPaslag: number;
}

export default function RedigeraOffertKlient({
  offert,
  customers,
  materialPaslag,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(data: OffertInput) {
    startTransition(async () => {
      const result = await updateOffert(offert.id, data);
      if (result.ok) {
        toast.success(`Offert ${offert.offertnummer} uppdaterad`);
        router.push("/mina-sidor/offerter");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const defaultValues: OffertInput = {
    customerId: offert.customerId,
    status: offert.status,
    offertdatum: offert.offertdatum,
    giltigTill: offert.giltigTill,
    timpris: offert.timpris,
    milersattning: offert.milersattning,
    beraknadeTimmar: offert.beraknadeTimmar,
    beraknadStracka: offert.beraknadStracka,
    rotAvdrag: offert.rotAvdrag,
    fastPris: offert.fastPris,
    fastPrisArbete: offert.fastPrisArbete,
    artiklar: offert.artiklar,
    ovrigaKostnader: offert.ovrigaKostnader,
    beskrivning: offert.beskrivning,
    villkor: offert.villkor,
    internaAnteckningar: offert.internaAnteckningar,
  };

  return (
    <OffertForm
      onSubmit={handleSubmit}
      defaultValues={defaultValues}
      submitLabel="Uppdatera offert"
      isPending={isPending}
      customers={customers}
      materialPaslag={materialPaslag}
    />
  );
}
