"use client";

import { useCallback, useRef, useState } from "react";
import { contractRequirementAction } from "@/app/actions/contrats";
import type { PrepareRequest } from "@/lib/modules/contrats/service";
import { Sheet } from "../ui/Sheet";
import { ContractStep } from "./ContractStep";

/**
 * Garde « Contrat » à placer devant un paiement, sans toucher au reste du parcours :
 *
 *   const { gate, sheet } = useContractGate();
 *   if (!(await gate({ kind: "pro", plan, organizationId }))) return; // contrat non accepté : on s'arrête
 *   await payer();
 *   …
 *   return <>{sheet}…</>;
 *
 * Si un contrat accepté couvre déjà la souscription, `gate` répond tout de suite `true`.
 */
export function useContractGate() {
  const [req, setReq] = useState<PrepareRequest | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setReq(null);
  }, []);

  const gate = useCallback(async (r: PrepareRequest): Promise<boolean> => {
    const need = await contractRequirementAction(r.kind, r.plan, r.organizationId ?? null);
    if (!need.required) return true;
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setReq(r);
    });
  }, []);

  const sheet = (
    <Sheet open={!!req} onClose={() => finish(false)} label="Contrat">
      {req && <ContractStep request={req} onAccepted={() => finish(true)} onCancel={() => finish(false)} />}
    </Sheet>
  );

  return { gate, sheet };
}
