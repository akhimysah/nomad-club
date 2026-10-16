"use client";

import Link from "next/link";
import { useState } from "react";
import type { PaidPlan } from "@/lib/types";
import { CheckoutSheet, type CheckoutConfig, type PayEnv } from "../events/CheckoutSheet";

/** Bouton « Adhérer » d'une formule : ouvre le tunnel d'adhésion (ou la connexion en mode réel). */
export function JoinButton({ plan, amount, env, needLogin, children }: { plan: PaidPlan; amount: number; env: PayEnv; needLogin: boolean; children: React.ReactNode }) {
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  if (needLogin)
    return (
      <Link className="btn btn-gold btn-block" href={`/connexion?suite=${encodeURIComponent("/formules")}`}>
        {children}
      </Link>
    );
  return (
    <>
      <button className="btn btn-gold btn-block" onClick={() => setConfig({ kind: "join", ctx: "visit", amount, plan })}>
        {children}
      </button>
      <CheckoutSheet config={config} env={env} open={!!config} onClose={() => setConfig(null)} />
    </>
  );
}
