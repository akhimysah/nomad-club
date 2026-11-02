"use client";

import { useState } from "react";
import { reportMessageAction } from "@/app/actions/communaute";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toasts";

const REASONS = ["Publicité non sollicitée", "Propos blessants", "Arnaque ou fraude", "Hors charte du club", "Informations personnelles"];

/** Lot 1 — Signaler un message : motif au choix ou libre, envoyé à la modération. */
export function ReportSheet({ target, onClose }: { target: { id: string; author: string; body: string } | null; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!target || busy) return;
    setBusy(true);
    const r = await reportMessageAction(target.id, reason);
    setBusy(false);
    if (!r.ok) {
      toast(r.error, "bell");
      return;
    }
    toast(r.message, "check");
    setReason("");
    onClose();
  };
  return (
    <Sheet open={!!target} onClose={onClose} label="Signaler un message">
      {target && (
        <div>
          <h2 className="sh-title">Signaler ce message</h2>
          <p className="sh-sub">
            De {target.author} : « {target.body.length > 140 ? target.body.slice(0, 139) + "…" : target.body} »
          </p>
          <div className="cm-reasons" style={{ marginTop: 16 }}>
            {REASONS.map((r) => (
              <button key={r} type="button" className={"fchip" + (reason === r ? " on" : "")} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="report-reason">Motif</label>
            <textarea id="report-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Explique en quelques mots" />
          </div>
          <button type="button" className="btn btn-gold btn-block" onClick={send} disabled={busy || reason.trim().length < 2}>
            {busy ? <span className="spin" /> : <Icon name="send" />}
            Envoyer à la modération
          </button>
          <p className="fine">
            <Icon name="lock" />
            Ton signalement reste confidentiel.
          </p>
        </div>
      )}
    </Sheet>
  );
}
