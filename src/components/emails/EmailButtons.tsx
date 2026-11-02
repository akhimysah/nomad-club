"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { resendEmailAction, sendTestEmailAction } from "@/app/actions/emails";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

/** Renvoyer un e-mail du journal (mêmes données, nouvelle ligne dans le journal). */
export function ResendEmailButton({ id, disabled }: { id: string; disabled?: string | null }) {
  const [busy, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={busy || Boolean(disabled)}
      title={disabled ?? undefined}
      onClick={() =>
        start(async () => {
          const r = await resendEmailAction(id);
          toast(r.ok ? r.message : r.error, r.ok ? "send" : "bell");
          if (r.ok) router.refresh();
        })
      }
    >
      <Icon name="refresh" />
      {busy ? "Envoi…" : "Renvoyer"}
    </button>
  );
}

/** Envoie l'exemple d'un modèle à sa propre adresse. */
export function SendTestEmailButton({ template, email }: { template: string; email: string | null }) {
  const [busy, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn btn-ink btn-sm"
      disabled={busy || !email}
      title={email ? `Envoyer cet exemple à ${email}` : "Votre compte n’a pas d’adresse e-mail"}
      onClick={() =>
        start(async () => {
          const r = await sendTestEmailAction(template);
          toast(r.ok ? r.message : r.error, r.ok ? "send" : "bell");
        })
      }
    >
      <Icon name="send" />
      {busy ? "Envoi…" : "M’envoyer un exemple"}
    </button>
  );
}
