"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { anropaAction } from "@/lib/anropa-action";
import OffertForm from "@/components/minasidor/offert/offert-form";
import { createOffert } from "@/lib/offert-actions";
import type { Customer, OffertInput } from "@/lib/job-schema";

interface Props {
  customers: Customer[];
  materialPaslag: number;
  defaultValues: Partial<OffertInput> &
    Pick<OffertInput, "offertdatum" | "giltigTill">;
}

export default function NyOffertKlient({
  customers,
  materialPaslag,
  defaultValues,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(data: OffertInput) {
    startTransition(async () => {
      const result = await anropaAction(() => createOffert(data));
      if (result.ok) {
        toast.success(`Offert ${result.nummer} sparad`);
        router.push("/mina-sidor/offerter");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <OffertForm
      onSubmit={handleSubmit}
      defaultValues={defaultValues}
      submitLabel="Spara offert"
      isPending={isPending}
      customers={customers}
      materialPaslag={materialPaslag}
    />
  );
}
