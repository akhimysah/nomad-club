"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PrepareRequest } from "@/lib/modules/contrats/service";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toasts";
import { ContractStep } from "./ContractStep";

/** Ouvre l'étape « Contrat » pour une souscription (contrat partenaire, contrat d'un abonnement pro en cours…). */
export function PrepareContractButton({ request, label, className = "btn btn-ink btn-sm" }: { request: PrepareRequest; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <button className={className} type="button" onClick={() => setOpen(true)}>
        <Icon name="edit" />
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Contrat">
        {open && (
          <ContractStep
            request={request}
            continueLabel="Accepter le contrat"
            onAccepted={() => {
              setOpen(false);
              toast("Contrat accepté. Ta copie PDF est disponible.", "check");
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </Sheet>
    </>
  );
}
