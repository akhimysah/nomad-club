"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { activateTemplateAction, cancelContractAction, createTemplateAction, generateContractAction, remindContractAction, type FormState } from "@/app/actions/contrats";
import { parseBlocks } from "@/lib/modules/contrats/render";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";
import { ContractDocument } from "./ContractDocument";

function useRun() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    toast(r.message, r.ok ? "check" : "bell");
    if (r.ok) router.refresh();
    return r.ok;
  };
  return { busy, run };
}

export function RemindButton({ id, className = "btn btn-ghost btn-sm" }: { id: string; className?: string }) {
  const { busy, run } = useRun();
  return (
    <button className={className} type="button" disabled={busy} onClick={() => run(() => remindContractAction(id))}>
      <Icon name="bell" />
      {busy ? "Envoi…" : "Relancer"}
    </button>
  );
}

export function CancelContractForm({ id, accepted }: { id: string; accepted: boolean }) {
  const { busy, run } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(true)}>
        {accepted ? "Résilier" : "Annuler le contrat"}
      </button>
    );
  return (
    <form
      className="ct-editor"
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", width: "100%" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => cancelContractAction(id, reason))) setOpen(false);
      }}
    >
      <input aria-label="Motif" placeholder="Motif (obligatoire)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: "1 1 220px" }} maxLength={500} />
      <button className="btn btn-ink btn-sm" type="submit" disabled={busy || reason.trim().length < 3}>
        Confirmer
      </button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)}>
        Retour
      </button>
    </form>
  );
}

export function ActivateTemplateButton({ id, version }: { id: string; version: number }) {
  const { busy, run } = useRun();
  return (
    <button className="btn btn-ink btn-sm" type="button" disabled={busy} onClick={() => run(() => activateTemplateAction(id))}>
      <Icon name="check" />
      {busy ? "Activation…" : `Activer la version ${version}`}
    </button>
  );
}

/** Nouvelle version d'un modèle : texte prérempli depuis une version existante, aperçu en direct. */
export function TemplateEditor({
  kind,
  kindLabel,
  initialTitle,
  initialBody,
  today,
  variables,
}: {
  kind: string;
  kindLabel: string;
  initialTitle: string;
  initialBody: string;
  today: string;
  variables: Array<{ key: string; label: string }>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTemplateAction, null);
  const [body, setBody] = useState(initialBody);
  const [preview, setPreview] = useState(false);
  const router = useRouter();
  const blocks = useMemo(() => (preview ? parseBlocks(body) : []), [preview, body]);
  useEffect(() => {
    if (state?.ok && state.id) router.push(`/fondatrices/contrats/modeles/${state.id}`);
  }, [state, router]);
  return (
    <form action={action} className="ct-editor">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid">
        <label>
          <span>Type</span>
          <input value={kindLabel} disabled />
        </label>
        <label>
          <span>Titre</span>
          <input name="title" defaultValue={initialTitle} required minLength={3} maxLength={160} />
        </label>
        <label>
          <span>Mise en vigueur le</span>
          <input name="effectiveFrom" type="date" defaultValue={today} required />
        </label>
      </div>
      <label>
        <span>Notes de version (internes)</span>
        <input name="notes" placeholder="Ex. articles 5 et 6 relus par Me X le …" maxLength={2000} />
      </label>
      <div className="btn-row" style={{ margin: "14px 0 8px" }}>
        <button className={"btn btn-sm " + (preview ? "btn-ghost" : "btn-ink")} type="button" onClick={() => setPreview(false)}>
          Texte
        </button>
        <button className={"btn btn-sm " + (preview ? "btn-ink" : "btn-ghost")} type="button" onClick={() => setPreview(true)}>
          Aperçu
        </button>
      </div>
      <textarea name="bodyMd" value={body} onChange={(e) => setBody(e.target.value)} hidden={preview} spellCheck aria-label="Texte du modèle (Markdown)" />
      {preview && (
        <div className="card" style={{ maxHeight: 640, overflowY: "auto" }}>
          <ContractDocument blocks={blocks} notes />
        </div>
      )}
      <p className="muted" style={{ fontSize: 13.5, margin: "10px 0 0" }}>
        Syntaxe : « # » titre, « ## » article, « - » liste, **gras**, « &gt; » encadré, « &gt;&gt; » note interne (jamais dans le contrat), [À COMPLÉTER] surligné. Variables :
      </p>
      <div className="ct-vars">
        {variables.map((v) => (
          <code key={v.key} title={v.label}>{`{{${v.key}}}`}</code>
        ))}
      </div>
      {state && <p className={"ct-msg" + (state.ok ? "" : " err")}>{state.message}</p>}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn-ink" type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer la nouvelle version"}
        </button>
      </div>
    </form>
  );
}

type Opt = { id: string; label: string };

/** Génération manuelle d'un contrat (back-office) : il part « à accepter » chez la signataire. */
export function GenerateContractForm({
  people,
  orgs,
  plans,
  today,
  defaults,
}: {
  people: Opt[];
  orgs: Array<Opt & { kinds: string[]; team: string[] }>;
  plans: Record<string, Opt[]>;
  today: string;
  defaults: { kind?: string; profileId?: string; organizationId?: string };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(generateContractAction, null);
  const [kind, setKind] = useState(defaults.kind ?? "membership");
  const [profileId, setProfileId] = useState(defaults.profileId ?? "");
  const router = useRouter();
  const orgOptions = orgs.filter((o) => o.kinds.includes(kind === "pro" ? "pro" : "partner") && (!profileId || o.team.includes(profileId)));
  useEffect(() => {
    if (state?.ok && state.id) router.push(`/fondatrices/contrats/${state.id}`);
  }, [state, router]);
  return (
    <form action={action} className="ct-editor">
      <div className="grid">
        <label>
          <span>Type</span>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="membership">Adhésion</option>
            <option value="partner">Partenaire</option>
            <option value="pro">Carnet pro</option>
          </select>
        </label>
        <label>
          <span>Signataire</span>
          <select name="profileId" value={profileId} onChange={(e) => setProfileId(e.target.value)} required>
            <option value="">Choisir…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {kind !== "membership" && (
          <label>
            <span>Établissement</span>
            <select name="organizationId" defaultValue={defaults.organizationId ?? ""} required>
              <option value="">Choisir…</option>
              {orgOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Formule</span>
          <select name="plan" key={kind}>
            {(plans[kind] ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {kind === "membership" && (
          <label>
            <span>Échéances</span>
            <select name="installments" defaultValue="1">
              <option value="1">Comptant</option>
              <option value="3">3 fois</option>
              <option value="12">12 fois</option>
            </select>
          </label>
        )}
        <label>
          <span>Début</span>
          <input name="startsOn" type="date" defaultValue={today} required />
        </label>
        <label>
          <span>Montant (vide = tarif)</span>
          <input name="amount" inputMode="decimal" placeholder="tarif de la formule" />
        </label>
      </div>
      {state && <p className={"ct-msg" + (state.ok ? "" : " err")}>{state.message}</p>}
      <button className="btn btn-ink" type="submit" disabled={pending}>
        {pending ? "Génération…" : "Générer le contrat"}
      </button>
    </form>
  );
}
