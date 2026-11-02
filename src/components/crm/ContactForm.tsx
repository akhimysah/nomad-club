"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveContactAction } from "@/app/actions/crm";
import { CONTACT_SOURCES, CONTACT_STATUSES, SOURCE_LABEL, STATUS_LABEL, type ContactSource, type ContactStatus } from "@/lib/modules/crm/types";
import type { ContactForm as Form } from "@/lib/modules/crm/validation";
import { useRun } from "./useRun";

export type ContactFormValues = {
  kind: "person" | "organization";
  firstName: string;
  lastName: string;
  company: string;
  job: string;
  email: string;
  phone: string;
  instagram: string;
  city: string;
  source: ContactSource;
  status: ContactStatus;
  tags: string;
  notes: string;
  marketingConsent: boolean;
  ownerId: string;
};

/** Création ou modification d'une fiche. Pour un compte de l'appli, le statut est calculé (adhésion, rôles). */
export function ContactForm({
  id,
  initial,
  owners,
  linked,
  onDone,
}: {
  id: string | null;
  initial: ContactFormValues;
  owners: Array<{ id: string; first: string }>;
  /** Fiche reliée à un compte : nom, e-mail et téléphone viennent du profil. */
  linked?: boolean;
  onDone?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);
  const { run, busy } = useRun();
  const router = useRouter();
  const set = <K extends keyof ContactFormValues>(k: K, val: ContactFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const text = (k: "firstName" | "lastName" | "company" | "job" | "email" | "phone" | "instagram" | "city", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="cf">
      <span>{label}</span>
      <input className="ci" value={v[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={err?.field === k} {...props} />
    </label>
  );
  const submit = () => {
    const form: Form = { ...v, tags: v.tags.split(/[,\s]+/).filter(Boolean), ownerId: v.ownerId || null };
    setErr(null);
    run(() => saveContactAction(form, id), {
      onOk: (r) => {
        onDone?.();
        if (!id && r.id) router.push(`/fondatrices/crm/contacts/${r.id}`);
      },
    }).then((r) => {
      if (!r.ok) setErr({ field: r.field, msg: r.error });
    });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
      }}
    >
      <div className="cgrid">
        <label className="cf">
          <span>Type</span>
          <select value={v.kind} onChange={(e) => set("kind", e.target.value as ContactFormValues["kind"])}>
            <option value="person">Personne</option>
            <option value="organization">Organisation</option>
          </select>
        </label>
        {text("firstName", "Prénom", { autoFocus: !id, disabled: linked, title: linked ? "Repris du compte" : undefined })}
        {text("lastName", "Nom", { disabled: linked })}
        {text("company", v.kind === "organization" ? "Organisation" : "Société / établissement")}
        {text("job", "Métier / fonction")}
        {text("email", "E-mail", { type: "email", disabled: linked })}
        {text("phone", "Téléphone / WhatsApp", { type: "tel", disabled: linked })}
        {text("instagram", "Instagram", { placeholder: "@compte" })}
        {text("city", "Ville")}
        <label className="cf">
          <span>Source</span>
          <select value={v.source} onChange={(e) => set("source", e.target.value as ContactSource)}>
            {CONTACT_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="cf">
          <span>Statut{linked ? " (calculé)" : ""}</span>
          <select value={v.status} onChange={(e) => set("status", e.target.value as ContactStatus)} disabled={linked} title={linked ? "Pour un compte de l’appli, le statut suit l’adhésion et les rôles." : undefined}>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="cf">
          <span>Suivi par</span>
          <select value={v.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
            <option value="">Personne</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.first}
              </option>
            ))}
          </select>
        </label>
        <label className="cf wide">
          <span>Étiquettes (séparées par des virgules)</span>
          <input className="ci" value={v.tags} onChange={(e) => set("tags", e.target.value)} placeholder="entrepreneure, padel" />
        </label>
        <label className="cf wide">
          <span>Notes</span>
          <textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} rows={4} maxLength={8000} />
        </label>
        <label className="check wide">
          <input type="checkbox" checked={v.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
          Accepte de recevoir les messages du club (consentement marketing)
        </label>
      </div>
      {err && (
        <p className="err-msg" role="alert">
          {err.msg}
        </p>
      )}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn-ink btn-sm" disabled={busy}>
          {busy ? <span className="spin" /> : null}
          {id ? "Enregistrer" : "Créer la fiche"}
        </button>
        {onDone && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
            Annuler
          </button>
        )}
        <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>
          <kbd className="k">⌘</kbd> <kbd className="k">Entrée</kbd> pour enregistrer
        </span>
      </div>
    </form>
  );
}
