"use client";

import { useState } from "react";
import { sendRemindersAction } from "@/app/actions/communaute";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

/** Lot 1 — Envoie tout de suite le rappel aux inscrites d'un rendez-vous (une seule fois par personne). */
export function RemindButton({ eventId, label = "Rappel aux inscrites" }: { eventId?: string; label?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await sendRemindersAction(eventId);
        setBusy(false);
        toast(r.ok ? r.message : r.error, r.ok ? "bell" : "x");
      }}
    >
      {busy ? <span className="spin" /> : <Icon name="bell" />}
      {label}
    </button>
  );
}
