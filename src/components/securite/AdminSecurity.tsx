"use client";

import { useState, useTransition } from "react";
import { anonymizeAction, rejectDeletionAction, setMfaEnforcedAction } from "@/app/actions/securite";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

export type QueueItem = {
  id: string;
  name: string;
  reason: string | null;
  requested: string;
  scheduled: string;
  due: boolean;
  status: "pending" | "cancelled" | "done" | "rejected";
  processed: string | null;
  note: string | null;
};

const STATUS_LABEL: Record<QueueItem["status"], string> = { pending: "En attente", cancelled: "Annulée par la membre", done: "Anonymisé", rejected: "Refusée" };

/** Lot 6 — file des demandes de suppression (administratrices). */
export function DeletionQueue({ items }: { items: QueueItem[] }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const pending = items.filter((i) => i.status === "pending");
  const past = items.filter((i) => i.status !== "pending");

  return (
    <>
      {pending.length === 0 && (
        <div className="empty">
          <Icon name="check" />
          Aucune demande de suppression en attente.
        </div>
      )}
      <ul className="sec-queue">
        {pending.map((i) => (
          <li key={i.id}>
            <Avatar name={i.name} />
            <span className="who">
              <b>{i.name}</b>
              <span>
                Demandée le {i.requested} · {i.due ? <b className="urg">délai de grâce écoulé</b> : `délai de grâce jusqu’au ${i.scheduled}`}
              </span>
              {i.reason && <q>{i.reason}</q>}
              {rejecting === i.id && (
                <form
                  className="sec-reject"
                  onSubmit={(e) => {
                    e.preventDefault();
                    start(async () => {
                      const r = await rejectDeletionAction(i.id, note);
                      toast(r.ok ? r.message : r.error, r.ok ? "check" : "lock");
                      if (r.ok) {
                        setRejecting(null);
                        setNote("");
                      }
                    });
                  }}
                >
                  <label className="field">
                    <span>Motif (visible dans le journal)</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ex. adhésion impayée à régler avant suppression" />
                  </label>
                  <div className="btn-row">
                    <button className="btn btn-ink btn-xs" type="submit" disabled={busy}>
                      Refuser la demande
                    </button>
                    <button className="btn btn-ghost btn-xs" type="button" onClick={() => setRejecting(null)}>
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </span>
            <span className="sec-queue-act">
              {confirm === i.id ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ink btn-xs"
                    aria-busy={busy}
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const r = await anonymizeAction(i.id, !i.due);
                        toast(r.ok ? r.message : r.error, r.ok ? "check" : "lock");
                        setConfirm(null);
                      })
                    }
                  >
                    Confirmer l’anonymisation
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirm(null)}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-ink btn-xs" onClick={() => setConfirm(i.id)}>
                    {i.due ? "Anonymiser" : "Anonymiser dès maintenant"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setRejecting(i.id)}>
                    Refuser
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      {past.length > 0 && (
        <details className="sec-history">
          <summary>Demandes traitées ({past.length})</summary>
          <ul>
            {past.map((i) => (
              <li key={i.id}>
                <time>{i.processed ?? i.requested}</time>
                <span>
                  {i.name} · <b>{STATUS_LABEL[i.status]}</b>
                  {i.note ? ` · ${i.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** Lot 6 — exiger la double authentification côté base (politiques RLS restrictives de 0008). */
export function MfaEnforceToggle({ enforced, disabled }: { enforced: boolean; disabled: string | null }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [on, setOn] = useState(enforced);
  return (
    <label className="pref-row sec-consent">
      <span>
        <b>Exiger aussi côté base de données</b>
        <span>
          Sans session en double authentification, la base refuse alors les changements de rôles, la lecture du journal et la file de suppression, même en
          contournant l’appli. À activer quand les deux fondatrices ont enrôlé leur téléphone.
        </span>
        {disabled && <span className="sec-when">{disabled}</span>}
      </span>
      <input
        type="checkbox"
        className="pref-switch"
        checked={on}
        disabled={busy || Boolean(disabled)}
        onChange={(e) => {
          const v = e.target.checked;
          setOn(v);
          start(async () => {
            const r = await setMfaEnforcedAction(v);
            toast(r.ok ? r.message : r.error, r.ok ? "lock" : "x");
            if (!r.ok) setOn(!v);
          });
        }}
      />
    </label>
  );
}
