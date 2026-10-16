"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckoutSheet, type CheckoutConfig, type PayEnv } from "./CheckoutSheet";

type OpenFn = (config: CheckoutConfig, env: PayEnv) => void;
const Ctx = createContext<OpenFn>(() => {});

/**
 * Tunnel de paiement monté une seule fois pour toute l'appli : il reste ouvert même quand la page
 * se met à jour derrière (ex. le bouton « Renouveler » disparaît une fois l'adhésion renouvelée).
 */
export function CheckoutHost({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ config: CheckoutConfig; env: PayEnv } | null>(null);
  const [open, setOpen] = useState(false);
  const openCheckout = useCallback<OpenFn>((config, env) => {
    setState({ config, env });
    setOpen(true);
  }, []);
  return (
    <Ctx.Provider value={openCheckout}>
      {children}
      {state && <CheckoutSheet config={open ? state.config : null} env={state.env} open={open} onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

export function useCheckout(): OpenFn {
  return useContext(Ctx);
}
