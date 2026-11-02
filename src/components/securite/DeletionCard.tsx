"use client";

import { useState, useTransition } from "react";
import { cancelDeletionAction, requestDeletionAction } from "@/app/actions/securite";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

type Pending = { requestedAt: string; scheduledFor: string } | null;

/** Lot 6 — demande de suppression du compte, avec délai de grâce et annulation. */
export function DeletionCard({ pending, graceDays, blocked }: { pending: Pending; graceDays: number; blocked: string | null }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<Pending>(pending);

  if (state)
    return (
      <div className="sec-danger on">
        <p>
          <b>Suppression demandée le {state.requestedAt}.</b> Ton compte sera anonymisé à partir du <b>{state.scheduledFor}</b> par les fondatrices. D’ici là,
          tout fonctionne normalement et tu peux changer d’avis.
        </p>
        <button
          type="button"
          className="btn btn-ink btn-sm"
          aria-busy={busy}
          onClick={() =>
            start(async () => {
              const r = await cancelDeletionAction();
              toast(r.ok ? r.message : r.error, r.ok ? "check" : "lock");
              if (r.ok) setState(null);
            })
          }
        >
          <Icon name="refresh" />
          Annuler ma demande
        </button>
      </div>
    );

  return (
    <div className="sec-danger">
      <ul className="sec-bullets">
        <li>Délai de grâce de {graceDays} jours : tu peux annuler à tout moment.</li>
        <li>Ensuite, ton profil, tes coordonnées, tes consentements et le texte de tes messages sont effacés.</li>
        <li>Les paiements et factures sont conservés le temps exigé par la loi (comptabilité), sans tes coordonnées.</li>
        <li>Pense à télécharger tes données avant.</li>
      </ul>
      {blocked ? (
        <p className="muted">{blocked}</p>
      ) : step === "idle" ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("confirm")}>
          Supprimer mon compte…
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await requestDeletionAction(reason);
              toast(r.ok ? r.message : r.error, r.ok ? "check" : "lock");
              if (r.ok && r.request) setState({ requestedAt: new Date(r.request.requestedAt).toLocaleDateString("fr-FR"), scheduledFor: new Date(r.request.scheduledFor).toLocaleDateString("fr-FR") });
            });
          }}
        >
          <label className="field">
            <span>Un mot pour les fondatrices (facultatif)</span>
            <textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Ce qui te fait partir, ce qu’on pourrait améliorer…" />
          </label>
          <div className="btn-row">
            <button type="submit" className="btn btn-ink btn-sm" aria-busy={busy} disabled={busy}>
              Confirmer la demande
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("idle")}>
              Garder mon compte
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
