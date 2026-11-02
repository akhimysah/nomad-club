"use client";

import { useOptimistic, useTransition } from "react";
import { setConsentAction } from "@/app/actions/securite";
import { CONSENT_LABEL } from "@/lib/modules/securite/consents";
import type { ConsentState } from "@/lib/modules/securite/types";
import { useToast } from "../ui/Toasts";

/** Lot 6 — interrupteurs de consentement (chaque changement est horodaté et retirable à tout moment). */
export function ConsentList({ states }: { states: Array<ConsentState & { when: string | null }> }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [shown, setShown] = useOptimistic(states, (cur, p: { kind: ConsentState["kind"]; granted: boolean }) =>
    cur.map((s) => (s.kind === p.kind ? { ...s, granted: p.granted, isDefault: false } : s)),
  );
  return (
    <div className="sec-consents">
      {shown.map((s) => {
        const l = CONSENT_LABEL[s.kind];
        return (
          <label key={s.kind} className="pref-row sec-consent">
            <span>
              <b>{l.label}</b>
              <span>{l.hint}</span>
              <span className="sec-when">{s.isDefault ? "Réglage par défaut, pas encore choisi" : s.when ? `Choisi le ${s.when}` : ""}</span>
            </span>
            <input
              type="checkbox"
              className="pref-switch"
              checked={s.granted}
              aria-label={`${l.label} : ${s.granted ? "accepté" : "refusé"}`}
              onChange={(e) => {
                const granted = e.target.checked;
                start(async () => {
                  setShown({ kind: s.kind, granted });
                  const r = await setConsentAction(s.kind, granted);
                  toast(r.ok ? r.message : r.error, r.ok ? "check" : "lock");
                });
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
