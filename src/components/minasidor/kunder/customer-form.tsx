"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User,
  Building2,
  Phone,
  Mail,
  MapPinned,
  Hash,
  IdCard,
  Home,
  Users,
  Key,
  Receipt,
} from "lucide-react";

import { createCustomer, updateCustomer } from "@/lib/job-actions";
import { anropaAction } from "@/lib/anropa-action";
import { customerSchema, type Customer } from "@/lib/job-schema";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormKnappar,
  FormSection,
  ToggleRow,
} from "@/components/minasidor/formular";

type CustomerFormInput = z.input<typeof customerSchema>;
type CustomerFormOutput = z.output<typeof customerSchema>;

interface Props {
  defaultValues?: Partial<CustomerFormInput> & { id?: string };
  mode: "create" | "edit";
  /**
   * I en dialog (t.ex. "Skapa ny kund" i jobbformuläret): anropas med den
   * sparade kunden i stället för att gå till kundregistret.
   */
  onSparad?: (kund: Customer) => void;
  /** I en dialog: stänger dialogen. Annars leder Avbryt till kundregistret. */
  onAvbryt?: () => void;
}

export default function CustomerForm({
  defaultValues,
  mode,
  onSparad,
  onAvbryt,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const iDialog = onSparad != null;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CustomerFormInput, unknown, CustomerFormOutput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      typ: "privat",
      namn: "",
      adress: "",
      postnummer: "",
      ort: "",
      telefon: "",
      epost: "",
      personnummer: "",
      foretagsnamn: "",
      kontaktperson: "",
      orgNummer: "",
      fastighetsbeteckning: "",
      lagenhetsnummer: "",
      bostadsrattsforening: "",
      brfOrgNummer: "",
      omvandByggmoms: false,
      momsNummer: "",
      ...defaultValues,
    },
  });

  const typ = useWatch({ control, name: "typ" });
  const omvandByggmoms = useWatch({ control, name: "omvandByggmoms" });
  const arPrivat = typ === "privat";

  async function onSubmit(data: CustomerFormOutput) {
    startTransition(async () => {
      if (mode === "edit" && defaultValues?.id) {
        const id = defaultValues.id;
        const result = await anropaAction(() => updateCustomer(id, data));
        if (result.ok) {
          toast.success("Kund uppdaterad");
          router.push("/mina-sidor/kunder");
        } else {
          toast.error(result.error ?? "Något gick fel");
        }
        return;
      }

      const result = await anropaAction(() => createCustomer(data));
      if (!result.ok) {
        toast.error(result.error ?? "Något gick fel");
        return;
      }
      toast.success("Kund sparad");
      if (onSparad && "kund" in result) {
        onSparad(result.kund);
      } else {
        router.push("/mina-sidor/kunder");
      }
    });
  }

  const knappar = (
    <>
      {onAvbryt ? (
        <Button type="button" variant="outline" size="lg" onClick={onAvbryt}>
          Avbryt
        </Button>
      ) : (
        <Button variant="outline" size="lg" asChild>
          <Link
            href="/mina-sidor/kunder"
            onClick={(e) => {
              if (isDirty && !window.confirm("Vill du lämna utan att spara?")) {
                e.preventDefault();
              }
            }}
          >
            Avbryt
          </Link>
        </Button>
      )}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending
          ? "Sparar..."
          : mode === "edit"
            ? "Uppdatera kund"
            : "Spara kund"}
      </Button>
    </>
  );

  return (
    <form
      noValidate
      // stopPropagation: i en dialog ligger formuläret inuti jobbformuläret i
      // React-trädet, och submit skulle annars bubbla upp och spara jobbet
      onSubmit={(e) => {
        e.stopPropagation();
        handleSubmit(onSubmit)(e);
      }}
      className="space-y-6"
    >
      {/* Typ */}
      <FormSection icon={Users} title="Kundtyp">
        <div className="flex flex-wrap gap-x-6 gap-y-3" role="radiogroup">
          <label className="flex min-h-9 cursor-pointer items-center gap-2">
            <input
              type="radio"
              value="privat"
              {...register("typ")}
              className="size-4 accent-primary"
            />
            <span className="text-sm font-medium">Privatperson</span>
          </label>
          <label className="flex min-h-9 cursor-pointer items-center gap-2">
            <input
              type="radio"
              value="foretag"
              {...register("typ")}
              className="size-4 accent-primary"
            />
            <span className="text-sm font-medium">Företagskund</span>
          </label>
        </div>
      </FormSection>

      {/* Kontaktuppgifter */}
      <FormSection
        icon={arPrivat ? User : Building2}
        title={arPrivat ? "Personuppgifter" : "Företagsuppgifter"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Namn *"
            icon={<User className="h-3.5 w-3.5" />}
            error={errors.namn?.message}
          >
            <Input
              {...register("namn")}
              autoComplete="name"
              placeholder={
                arPrivat ? "Anna Andersson" : "Kontaktpersonens namn"
              }
            />
          </Field>

          {!arPrivat && (
            <>
              <Field
                label="Företagsnamn"
                icon={<Building2 className="h-3.5 w-3.5" />}
              >
                <Input
                  {...register("foretagsnamn")}
                  autoComplete="organization"
                  placeholder="Svensson AB"
                />
              </Field>
              <Field
                label="Kontaktperson"
                icon={<User className="h-3.5 w-3.5" />}
              >
                <Input
                  {...register("kontaktperson")}
                  placeholder="Anna Andersson"
                />
              </Field>
              <Field
                label="Organisationsnummer"
                icon={<Hash className="h-3.5 w-3.5" />}
              >
                <Input
                  {...register("orgNummer")}
                  inputMode="numeric"
                  placeholder="556677-8899"
                />
              </Field>
            </>
          )}

          {arPrivat && (
            <Field
              label="Personnummer"
              icon={<IdCard className="h-3.5 w-3.5" />}
              error={errors.personnummer?.message}
            >
              <Input
                {...register("personnummer")}
                inputMode="numeric"
                autoComplete="off"
                placeholder="ÅÅÅÅMMDD-XXXX"
              />
            </Field>
          )}

          <Field
            label="Telefon"
            icon={<Phone className="h-3.5 w-3.5" />}
            error={errors.telefon?.message}
          >
            <Input
              type="tel"
              autoComplete="tel"
              {...register("telefon")}
              placeholder="070-123 45 67"
            />
          </Field>

          <Field
            label="E-post"
            icon={<Mail className="h-3.5 w-3.5" />}
            error={errors.epost?.message}
          >
            <Input
              type="email"
              autoComplete="email"
              {...register("epost")}
              placeholder="anna@exempel.se"
            />
          </Field>
        </div>
      </FormSection>

      {/* Adress */}
      <FormSection icon={MapPinned} title="Adress">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Gatuadress"
              icon={<MapPinned className="h-3.5 w-3.5" />}
            >
              <Input
                {...register("adress")}
                autoComplete="street-address"
                placeholder="Storgatan 1"
              />
            </Field>
          </div>
          <Field
            label="Postnummer"
            icon={<MapPinned className="h-3.5 w-3.5" />}
          >
            <Input
              {...register("postnummer")}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="123 45"
            />
          </Field>
          <Field label="Ort" icon={<MapPinned className="h-3.5 w-3.5" />}>
            <Input
              {...register("ort")}
              autoComplete="address-level2"
              placeholder="Stockholm"
            />
          </Field>
        </div>
      </FormSection>

      {/* Moms – bara företagskunder */}
      {!arPrivat && (
        <FormSection
          icon={Receipt}
          title="Moms"
          description="Omvänd byggmoms gäller när kunden själv säljer byggtjänster (t.ex. en annan VVS-firma eller ett byggföretag). Fakturan blir då utan moms och kunden redovisar momsen."
        >
          <div className="space-y-4">
            <ToggleRow
              id="omvand-byggmoms"
              label="Omvänd byggmoms (omvänd betalningsskyldighet)"
              checked={Boolean(omvandByggmoms)}
              onChange={(v) =>
                setValue("omvandByggmoms", v, { shouldDirty: true })
              }
            />
            <Field
              label={
                omvandByggmoms
                  ? "Kundens momsregistreringsnummer *"
                  : "Kundens momsregistreringsnummer"
              }
              icon={<Receipt className="h-3.5 w-3.5" />}
              error={errors.momsNummer?.message}
              className="sm:max-w-sm"
            >
              <Input
                {...register("momsNummer")}
                placeholder="SE556677889901"
              />
            </Field>
          </div>
        </FormSection>
      )}

      {/* ROT-uppgifter */}
      {arPrivat && (
        <FormSection
          icon={Home}
          title="ROT-uppgifter"
          description="Krävs för ROT-avdrag: fastighetsbeteckning för villa/fritidshus, eller för bostadsrätt föreningens organisationsnummer och lägenhetsnumret."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Fastighetsbeteckning"
                icon={<Home className="h-3.5 w-3.5" />}
              >
                <Input
                  {...register("fastighetsbeteckning")}
                  placeholder="Berga 1:23"
                />
              </Field>
            </div>
            <Field
              label="Bostadsrättsförening"
              icon={<Building2 className="h-3.5 w-3.5" />}
            >
              <Input
                {...register("bostadsrattsforening")}
                placeholder="BRF Solrosen"
              />
            </Field>
            <Field
              label="Föreningens org.nr"
              icon={<Hash className="h-3.5 w-3.5" />}
              error={errors.brfOrgNummer?.message}
            >
              <Input
                {...register("brfOrgNummer")}
                inputMode="numeric"
                placeholder="769600-1234"
              />
            </Field>
            <Field
              label="Lägenhetsnummer"
              icon={<Key className="h-3.5 w-3.5" />}
            >
              <Input
                {...register("lagenhetsnummer")}
                inputMode="numeric"
                placeholder="1101"
              />
            </Field>
          </div>
        </FormSection>
      )}

      {iDialog ? (
        <div className="flex justify-end gap-2">{knappar}</div>
      ) : (
        <FormKnappar>{knappar}</FormKnappar>
      )}
    </form>
  );
}
