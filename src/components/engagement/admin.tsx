"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import {
  addProductFileAction,
  deliverGrantAction,
  removeProductFileAction,
  saveBusinessSettingsAction,
  saveProductAction,
  saveRewardAction,
  setProductStatusAction,
  setSimulatedPaymentsAction,
  type AdminResult,
  type ProductFormState,
} from "@/app/actions/engagement-admin";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toasts";
import type { EngagementSettings, Product, ProductStatus, ReferralReward } from "@/lib/modules/engagement/types";

/** Exécute une action admin, affiche le résultat et rafraîchit la page. */
function useRun() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<AdminResult>) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) router.refresh();
    return r.ok;
  };
  return { busy, run };
}

/* ---------- boutique ---------- */

export function ProductForm({ product }: { product: Product | null }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProductAction, null);
  const p = product;
  const err = (k: string) => (state && !state.ok && state.field === k ? " err" : "");
  const msg = (k: string) => (state && !state.ok && state.field === k ? <span className="err-msg">{state.error}</span> : null);
  return (
    <form action={action} className="card">
      {p && <input type="hidden" name="id" value={p.id} />}
      {state && !state.ok && !state.field && (
        <div className="flash" role="alert">
          <Icon name="bell" />
          {state.error}
        </div>
      )}
      <div className="form-grid">
        <div className={"field full" + err("title")}>
          <label htmlFor="pf-title">Titre</label>
          <input id="pf-title" name="title" defaultValue={p?.title ?? ""} required maxLength={140} />
          {msg("title")}
        </div>
        <div className="field full">
          <label htmlFor="pf-sub">Sous-titre</label>
          <input id="pf-sub" name="subtitle" defaultValue={p?.subtitle ?? ""} maxLength={200} />
        </div>
        <div className={"field" + err("slug")}>
          <label htmlFor="pf-slug">Adresse (slug)</label>
          <input id="pf-slug" name="slug" defaultValue={p?.slug ?? ""} placeholder="déduite du titre" maxLength={80} />
          {msg("slug")}
        </div>
        <div className="field">
          <label htmlFor="pf-cat">Type</label>
          <select id="pf-cat" name="category" defaultValue={p?.category ?? "guide"}>
            <option value="guide">Guide</option>
            <option value="modele">Modèles</option>
            <option value="formation">Atelier</option>
            <option value="carnet">Carnet</option>
          </select>
        </div>
        <div className={"field" + err("price")}>
          <label htmlFor="pf-price">Prix public ($)</label>
          <input id="pf-price" name="price" type="number" min={0} step={1} defaultValue={p?.price ?? 29} required />
          {msg("price")}
        </div>
        <div className={"field" + err("priceMember")}>
          <label htmlFor="pf-pm">Prix membre ($)</label>
          <input id="pf-pm" name="priceMember" type="number" min={0} step={1} defaultValue={p?.priceMember ?? 22} required />
          {msg("priceMember")}
        </div>
        <div className={"field" + err("coverImage")}>
          <label htmlFor="pf-cover">Image de couverture</label>
          <input id="pf-cover" name="coverImage" defaultValue={p?.coverImage ?? ""} placeholder="/img/lunch-fer7.jpg" maxLength={300} />
          {msg("coverImage")}
        </div>
        <div className="field">
          <label htmlFor="pf-pages">Pages</label>
          <input id="pf-pages" name="pages" type="number" min={1} defaultValue={p?.pages ?? ""} />
        </div>
        <div className="field full">
          <label htmlFor="pf-desc">Description</label>
          <textarea id="pf-desc" name="description" defaultValue={p?.description ?? ""} maxLength={6000} style={{ height: 140 }} />
        </div>
        <div className="field full">
          <label htmlFor="pf-prev">Extrait lisible avant achat</label>
          <textarea id="pf-prev" name="previewText" defaultValue={p?.previewText ?? ""} maxLength={3000} />
        </div>
      </div>
      <button className="btn btn-gold" type="submit" disabled={pending}>
        {pending ? <span className="spin" /> : <Icon name="check" />}
        {p ? "Enregistrer" : "Créer le brouillon"}
      </button>
    </form>
  );
}

export function ProductStatusButtons({ id, status }: { id: string; status: ProductStatus }) {
  const { busy, run } = useRun();
  const btn = (s: ProductStatus, label: string, cls: string) => (
    <button className={`btn ${cls} btn-sm`} disabled={!!busy} onClick={() => run(s, () => setProductStatusAction(id, s))}>
      {busy === s && <span className="spin" />}
      {label}
    </button>
  );
  return (
    <div className="btn-row">
      {status !== "published" && btn("published", "Publier", "btn-gold")}
      {status === "published" && btn("archived", "Retirer de la boutique", "btn-ghost")}
      {status === "archived" && btn("draft", "Repasser en brouillon", "btn-ghost")}
    </div>
  );
}

export function AddFileForm({ productId, demo }: { productId: string; demo: boolean }) {
  const { busy, run } = useRun();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className="eg-inline"
      style={{ marginTop: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("productId", productId);
        if (await run("add", () => addProductFileAction(fd))) ref.current?.reset();
      }}
    >
      <div className="field">
        <label htmlFor="af-label">Nom du fichier</label>
        <input id="af-label" name="label" placeholder="Le guide (PDF)" maxLength={140} required />
      </div>
      <div className="field">
        <label htmlFor="af-file">Fichier{demo ? " (facultatif en démo)" : ""}</label>
        <input id="af-file" name="file" type="file" accept=".pdf,.zip,.docx,.xlsx,.pptx,.epub" style={{ paddingTop: 16 }} />
      </div>
      <label className="eg-check" style={{ margin: "0 0 18px" }}>
        <input type="checkbox" name="isPreview" />
        Aperçu gratuit
      </label>
      <button className="btn btn-ink btn-sm" type="submit" disabled={!!busy} style={{ marginBottom: 8 }}>
        {busy ? <span className="spin" /> : <Icon name="plus" />}
        Ajouter
      </button>
    </form>
  );
}

export function RemoveFileButton({ fileId }: { fileId: string }) {
  const { busy, run } = useRun();
  return (
    <button className="btn btn-ghost btn-xs" disabled={!!busy} onClick={() => confirm("Retirer ce fichier ?") && run("rm", () => removeProductFileAction(fileId))}>
      <Icon name="x" />
      Retirer
    </button>
  );
}

export function SimulatedPaymentsToggle({ enabled, demo }: { enabled: boolean; demo: boolean }) {
  const { busy, run } = useRun();
  return (
    <label className="eg-check" style={{ margin: 0 }}>
      <input type="checkbox" className="pref-switch" checked={demo || enabled} disabled={demo || !!busy} onChange={(e) => run("sim", () => setSimulatedPaymentsAction(e.target.checked))} />
      Paiement simulé de la boutique {demo ? "(toujours actif en démo)" : enabled ? "activé" : "coupé"}
    </label>
  );
}

/* ---------- parrainage ---------- */

export function DeliverGrantButton({ id }: { id: string }) {
  const { busy, run } = useRun();
  return (
    <button className="btn btn-ink btn-xs" disabled={!!busy} onClick={() => run("d", () => deliverGrantAction(id))}>
      {busy ? <span className="spin" /> : <Icon name="check" />}
      Marquer remise
    </button>
  );
}

export function RewardEditor({ reward }: { reward: ReferralReward | null }) {
  const { busy, run } = useRun();
  const [f, setF] = useState({ kind: reward?.kind ?? "free_month", label: reward?.label ?? "", description: reward?.description ?? "", points: String(reward?.points ?? 0), active: reward?.active ?? true });
  return (
    <form
      className="eg-inline"
      style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run("s", () => saveRewardAction({ id: reward?.id ?? null, ...f }));
        if (ok && !reward) setF({ ...f, label: "", description: "" });
      }}
    >
      <div className="field" style={{ maxWidth: 170 }}>
        <label>Type</label>
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}>
          <option value="free_month">Mois offert</option>
          <option value="invitation">Invitation</option>
          <option value="points">Points</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <div className="field">
        <label>Libellé</label>
        <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} maxLength={120} placeholder="Un mois d’adhésion offert" />
      </div>
      {f.kind === "points" && (
        <div className="field" style={{ maxWidth: 110 }}>
          <label>Points</label>
          <input type="number" min={1} value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} />
        </div>
      )}
      <div className="field">
        <label>Description</label>
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={400} />
      </div>
      <label className="eg-check" style={{ margin: "0 0 18px" }}>
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        Active
      </label>
      <button className={"btn btn-sm " + (reward ? "btn-ghost" : "btn-ink")} type="submit" disabled={!!busy} style={{ marginBottom: 8 }}>
        {busy ? <span className="spin" /> : <Icon name={reward ? "check" : "plus"} />}
        {reward ? "Enregistrer" : "Ajouter"}
      </button>
    </form>
  );
}

/* ---------- Espace Business ---------- */

export function BusinessSettingsForm({ s }: { s: EngagementSettings }) {
  const { busy, run } = useRun();
  const [f, setF] = useState({ dealPointsBase: String(s.dealPointsBase), dealPointsPerThousand: String(s.dealPointsPerThousand), dealPointsBonusCap: String(s.dealPointsBonusCap) });
  const input = (k: keyof typeof f, label: string) => (
    <div className="field">
      <label htmlFor={`bs-${k}`}>{label}</label>
      <input id={`bs-${k}`} type="number" min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run("s", () => saveBusinessSettingsAction(f));
      }}
    >
      {input("dealPointsBase", "Points par deal confirmé")}
      {input("dealPointsPerThousand", "Bonus par tranche de 1 000 $")}
      {input("dealPointsBonusCap", "Bonus maximum")}
      <button className="btn btn-gold btn-sm" type="submit" disabled={!!busy}>
        {busy ? <span className="spin" /> : <Icon name="check" />}
        Enregistrer le barème
      </button>
      <p className="fine">S’applique aux deals confirmés à partir de maintenant.</p>
    </form>
  );
}
