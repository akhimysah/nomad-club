"use client";

import { useState } from "react";
import { claimOfferAction, type ClaimView } from "@/app/actions/partenaires";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toasts";

const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** « Utiliser l'offre » : code personnel horodaté et QR à présenter au comptoir. */
export function UseOfferButton({ offerId, title, orgName, conditions, disabledReason }: { offerId: string; title: string; orgName: string; conditions: string | null; disabledReason: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<Extract<ClaimView, { ok: true }> | null>(null);
  const toast = useToast();
  if (disabledReason) {
    return (
      <button className="btn btn-ghost btn-sm" type="button" aria-disabled="true" disabled>
        <Icon name="lock" />
        {disabledReason}
      </button>
    );
  }
  const run = async () => {
    setBusy(true);
    const r = await claimOfferAction(offerId);
    setBusy(false);
    if (!r.ok) {
      toast(r.error, "bell");
      return;
    }
    setView(r);
    setOpen(true);
  };
  return (
    <>
      <button className="btn btn-gold btn-sm" type="button" onClick={run} disabled={busy} data-offer={offerId}>
        <Icon name="ticket" />
        {busy ? "Un instant…" : "Utiliser l’offre"}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={`Code pour ${title}`}>
        {view && (
          <div className="code-sheet">
            <div className="eyebrow">{orgName}</div>
            <h2>{title}</h2>
            <div className="code-qr" aria-label="QR code à présenter">
              <svg viewBox={`-1 -1 ${view.qr.size + 2} ${view.qr.size + 2}`} shapeRendering="crispEdges" role="img" aria-label={`QR du code ${view.code}`}>
                <path d={view.qr.d} fill="#111" />
              </svg>
            </div>
            <div className="code-big">{view.code}</div>
            <div className="code-when">
              <Icon name="clock" />
              Code créé {when(view.createdAt)}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
              Montre ce code ou ce QR au comptoir : l’équipe le valide dans son espace. Il est personnel et ne sert qu’une fois.
            </p>
            {conditions && <p className="rule" style={{ margin: 0, textAlign: "left" }}><Icon name="check" /><span>{conditions}</span></p>}
          </div>
        )}
      </Sheet>
    </>
  );
}
