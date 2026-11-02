"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { openPortalAction, payNextInstallmentAction, refundAction, replayEventAction, runPaymentsNowAction, type PayActionResult } from "@/app/actions/paiements";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toasts";
import { formatMoney } from "@/lib/modules/paiements/money";

function useRun() {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const run = async (key: string, fn: () => Promise<PayActionResult>) => {
    setBusy(key);
    const r = await fn();
    if (r.ok && r.url) {
      window.location.href = r.url;
      return;
    }
    setBusy(null);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    router.refresh();
  };
  return { busy, run };
}

/** « Gérer ma carte » : portail client du prestataire (changer de carte, factures, résilier). */
export function PortalButton({ organizationId, label = "Gérer ma carte", className = "btn btn-ghost btn-sm" }: { organizationId?: string; label?: string; className?: string }) {
  const { busy, run } = useRun();
  return (
    <button className={className} type="button" disabled={!!busy} onClick={() => run("portal", () => openPortalAction(organizationId))}>
      <Icon name="card" />
      {busy ? "Ouverture…" : label}
    </button>
  );
}

/** Démo : régler la prochaine échéance, ou simuler un refus de carte. */
export function PayNowButtons({ planId, demo }: { planId: string; demo: boolean }) {
  const { busy, run } = useRun();
  if (!demo) return null;
  return (
    <div className="btn-row">
      <button className="btn btn-ink btn-sm" type="button" disabled={!!busy} onClick={() => run("pay", () => payNextInstallmentAction(planId))}>
        <Icon name="wallet" />
        {busy === "pay" ? "Paiement…" : "Régler la prochaine échéance"}
      </button>
      <button className="btn btn-ghost btn-sm" type="button" disabled={!!busy} onClick={() => run("fail", () => payNextInstallmentAction(planId, true))}>
        Simuler un refus de carte
      </button>
    </div>
  );
}

/** Fondatrices : rembourser tout ou partie d'un encaissement. */
export function RefundButton({ transactionId, left, label }: { transactionId: string; left: number; label: string }) {
  const { busy, run } = useRun();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(left));
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(true)} aria-label={`Rembourser ${label}`}>
        Rembourser
      </button>
    );
  return (
    <form
      className="pay-refund"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(amount.replace(",", "."));
        if (!window.confirm(`Rembourser ${formatMoney(n)} (${label}) ? Le montant repart sur la carte.`)) return;
        void run("refund", () => refundAction(transactionId, n, reason)).then(() => setOpen(false));
      }}
    >
      <label>
        <span className="sr-only">Montant</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Montant à rembourser" />
      </label>
      <label>
        <span className="sr-only">Motif</span>
        <input placeholder="Motif (facultatif)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} aria-label="Motif du remboursement" />
      </label>
      <button className="btn btn-ink btn-sm" type="submit" disabled={!!busy}>
        {busy ? "…" : "Confirmer"}
      </button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)}>
        Annuler
      </button>
    </form>
  );
}

/** Fondatrices : rejouer un événement de prestataire en échec. */
export function ReplayButton({ provider, eventId }: { provider: string; eventId: string }) {
  const { busy, run } = useRun();
  return (
    <button className="btn btn-ghost btn-sm" type="button" disabled={!!busy} onClick={() => run("replay", () => replayEventAction(provider, eventId))}>
      <Icon name="refresh" />
      {busy ? "…" : "Rejouer"}
    </button>
  );
}

/** Fondatrices : lancer la tâche du jour (relances, suspensions, rappels de renouvellement). */
export function RunNowButton() {
  const { busy, run } = useRun();
  return (
    <button className="btn btn-ghost btn-sm" type="button" disabled={!!busy} onClick={() => run("run", () => runPaymentsNowAction())}>
      <Icon name="refresh" />
      {busy ? "En cours…" : "Lancer les relances du jour"}
    </button>
  );
}
