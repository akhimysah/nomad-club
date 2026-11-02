"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelMyBooking } from "@/app/actions/booking";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { Ticket, type TicketData } from "../ui/Ticket";
import { useToast } from "../ui/Toasts";

/** Feuille « Mon billet » : billet qui pivote, QR à présenter à l'accueil. */
export function TicketSheet({
  open,
  onClose,
  ticket,
  demo,
  pending,
  cancelId,
}: {
  open: boolean;
  onClose: () => void;
  ticket: TicketData | null;
  demo: boolean;
  pending?: boolean;
  /** Réservation annulable par la personne connectée. */
  cancelId?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} label="Mon billet">
      {ticket && (
        <div className="done">
          <div className="eyebrow">Mon billet</div>
          <h2 className="sh-title">{ticket.title}</h2>
          <p className="sh-sub">
            {pending ? "Paiement en attente : ton billet sera confirmé dès réception. " : "Présente ce QR à l’accueil. "}
            {demo ? "Billet simulé." : ""}
          </p>
          <Ticket t={ticket} pending={pending} />
          <p className="fine">
            <Icon name="swap" />
            Incline ton billet pour voir le reflet doré.
          </p>
          {cancelId && (
            <p style={{ textAlign: "center", margin: "6px 0 0" }}>
              <button
                className="link"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await cancelMyBooking(cancelId);
                  setBusy(false);
                  onClose();
                  toast("Réservation annulée. Ta place est libérée.", "check");
                  router.refresh();
                }}
              >
                {busy ? "Annulation…" : "Annuler ma réservation"}
              </button>
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
