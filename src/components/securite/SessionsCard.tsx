"use client";

import { useTransition } from "react";
import { signOutEverywhereAction } from "@/app/actions/securite";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

export type SessionRow = { id: string; device: string; last: string; aal: string | null };

/** Lot 6 — appareils connectés et « déconnecter partout ». */
export function SessionsCard({ sessions, demo, listed }: { sessions: SessionRow[]; demo: boolean; listed: boolean }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <>
      {listed ? (
        <ul className="sec-sessions">
          {sessions.map((s) => (
            <li key={s.id}>
              <span className="so-ic">
                <Icon name="phone" />
              </span>
              <span>
                <b>{s.device}</b>
                <span>
                  Dernière activité : {s.last}
                  {s.aal === "aal2" ? " · double authentification" : ""}
                </span>
              </span>
            </li>
          ))}
          {!sessions.length && <li className="empty">Aucune autre session.</li>}
        </ul>
      ) : (
        <p className="muted">La liste détaillée des appareils n’est pas disponible ici ; tu peux quand même tout déconnecter.</p>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        aria-busy={busy}
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await signOutEverywhereAction();
            if (r) toast(r.ok ? r.message : r.error, r.ok ? "check" : "lock");
          })
        }
      >
        <Icon name="lock" />
        Déconnecter tous mes appareils
      </button>
      {demo && <p className="muted sec-note">Démo : appareils fictifs.</p>}
    </>
  );
}
