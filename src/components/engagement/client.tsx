"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buyProductAction, declareDealAction, respondDealAction, setLeaderboardOptOutAction, withdrawDealAction, type DealFormInput } from "@/app/actions/engagement";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toasts";
import { EIcon } from "./EIcon";

const pause = (ms: number) => new Promise((r) => setTimeout(r, typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : ms));

/* ---------- boutique ---------- */

/** Achat d'une ressource : récapitulatif, paiement simulé, puis accès immédiat aux fichiers. */
export function BuyButton({ productId, title, amount, label, demo }: { productId: string; title: string; amount: number; label: string; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"recap" | "busy" | "done">("recap");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const pay = async () => {
    setStage("busy");
    setError(null);
    const [r] = await Promise.all([buyProductAction(productId), pause(amount > 0 ? 1100 : 400)]);
    if (!r.ok) {
      setError(r.error);
      setStage("recap");
      return;
    }
    setStage("done");
    toast(r.message, "check");
    router.refresh();
  };
  return (
    <>
      <button
        className="btn btn-gold"
        onClick={() => {
          setStage("recap");
          setError(null);
          setOpen(true);
        }}
      >
        {amount > 0 ? <Icon name="wallet" /> : <Icon name="gift" />}
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={`Acheter ${title}`}>
        {stage === "done" ? (
          <div className="done">
            <div className="eyebrow">C’est à toi</div>
            <h2 className="sh-title">{title}</h2>
            <p className="sh-sub">Ta ressource est dans « Mes ressources ». Tu peux la télécharger dès maintenant, autant de fois que tu veux.</p>
            <div className="btn-row">
              <button className="btn btn-gold" onClick={() => setOpen(false)}>
                <EIcon name="download" />
                Voir mes fichiers
              </button>
              <button className="btn btn-ghost" onClick={() => router.push("/espace/boutique/mes-ressources")}>
                Mes ressources
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="eyebrow">Boutique du club</div>
            <h2 className="sh-title">{title}</h2>
            <p className="sh-sub">Accès immédiat après {amount > 0 ? "le paiement" : "confirmation"}, téléchargement depuis ton espace.</p>
            {error && (
              <div className="flash" role="alert">
                <Icon name="bell" />
                {error}
              </div>
            )}
            <div className="kv">
              <span>Ressource</span>
              <b>{title}</b>
            </div>
            <div className="kv">
              <span>Total</span>
              <b>{amount > 0 ? `${amount} $` : "Offert aux membres"}</b>
            </div>
            <button className="btn btn-gold btn-block" onClick={pay} disabled={stage === "busy"} style={{ marginTop: 18 }}>
              {stage === "busy" ? <span className="spin" /> : <Icon name="check" />}
              {amount > 0 ? `Payer ${amount} $` : "L’ajouter à mes ressources"}
            </button>
            {amount > 0 && (
              <p className="fine">
                <Icon name="lock" />
                {demo ? "Aperçu : paiement simulé, aucune somme n’est débitée." : "Paiement simulé pendant le lancement de la boutique."}
              </p>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}

/* ---------- parrainage ---------- */

/** Lien de parrainage : copier, ou partager (feuille de partage du téléphone). */
export function ShareLink({ url, code }: { url: string; code: string }) {
  const toast = useToast();
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copié`, "check");
    } catch {
      toast("Copie impossible : sélectionne le texte", "bell");
    }
  };
  const share = async () => {
    const data = { title: "Nomad Club", text: `Rejoins-moi au Nomad Club, le cercle des femmes entrepreneuses à Marrakech. Mon code : ${code}`, url };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        /* partage annulé */
      }
    } else void copy(`${data.text} ${url}`, "Message");
  };
  return (
    <>
      <div className="ref-link">
        <label className="sr" htmlFor="ref-url">
          Mon lien de parrainage
        </label>
        <input id="ref-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button className="btn btn-ink btn-xs" onClick={() => copy(url, "Lien")}>
          <EIcon name="copy" />
          Copier
        </button>
      </div>
      <div className="btn-row">
        <button className="btn btn-gold btn-sm" onClick={share}>
          <EIcon name="share" />
          Partager
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => copy(code, "Code")}>
          <EIcon name="copy" />
          Copier le code
        </button>
        <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`Rejoins-moi au Nomad Club : ${url}`)}`} target="_blank" rel="noreferrer">
          <Icon name="chat" />
          WhatsApp
        </a>
      </div>
    </>
  );
}

/* ---------- Espace Business ---------- */

const CATS = [
  ["prestation", "Prestation"],
  ["vente", "Vente"],
  ["partenariat", "Partenariat"],
  ["recommandation", "Recommandation"],
  ["autre", "Autre"],
] as const;

/** « Déclarer un deal » : formulaire dans une feuille. */
export function DeclareDealButton({ members, today }: { members: Array<{ id: string; name: string; job: string | null }>; today: string }) {
  const empty: DealFormInput = { partnerId: "", nature: "", category: "prestation", amount: "", dealDate: today, note: "" };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<DealFormInput>(empty);
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const set = (k: keyof DealFormInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await declareDealAction(f);
    setBusy(false);
    if (!r.ok) {
      setErr({ field: r.field, msg: r.error });
      return;
    }
    toast(r.message, "send");
    setOpen(false);
    setF(empty);
    router.refresh();
  };
  const fe = (k: string) => (err?.field === k ? " err" : "");
  return (
    <>
      <button
        className="btn btn-gold"
        onClick={() => {
          setErr(null);
          setOpen(true);
        }}
      >
        <Icon name="plus" />
        Déclarer un deal
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Déclarer un deal">
        <div className="eyebrow">Espace Business</div>
        <h2 className="sh-title">Déclarer un deal</h2>
        <p className="sh-sub">L’autre membre reçoit une demande de confirmation. Une fois confirmé, vous gagnez des points toutes les deux.</p>
        {err && !err.field && (
          <div className="flash" role="alert">
            <Icon name="bell" />
            {err.msg}
          </div>
        )}
        <form onSubmit={submit} noValidate>
          <div className={"field" + fe("partnerId")}>
            <label htmlFor="dl-partner">Avec qui ?</label>
            <select id="dl-partner" value={f.partnerId} onChange={set("partnerId")} required>
              <option value="">Choisir une membre</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.job ? ` · ${m.job}` : ""}
                </option>
              ))}
            </select>
            {err?.field === "partnerId" && <span className="err-msg">{err.msg}</span>}
          </div>
          <div className={"field" + fe("nature")}>
            <label htmlFor="dl-nature">Nature du deal</label>
            <input id="dl-nature" value={f.nature} onChange={set("nature")} placeholder="Ex. : refonte du site du concept-store" maxLength={200} />
            {err?.field === "nature" && <span className="err-msg">{err.msg}</span>}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="dl-cat">Type</label>
              <select id="dl-cat" value={f.category} onChange={set("category")}>
                {CATS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={"field" + fe("dealDate")}>
              <label htmlFor="dl-date">Date</label>
              <input id="dl-date" type="date" value={f.dealDate} max={today} onChange={set("dealDate")} />
              {err?.field === "dealDate" && <span className="err-msg">{err.msg}</span>}
            </div>
          </div>
          <div className={"field" + fe("amount")}>
            <label htmlFor="dl-amount">Montant estimé en $ (facultatif)</label>
            <input id="dl-amount" type="number" inputMode="numeric" min={0} step={50} value={f.amount} onChange={set("amount")} placeholder="Ex. : 1500" />
            {err?.field === "amount" && <span className="err-msg">{err.msg}</span>}
          </div>
          <div className="field">
            <label htmlFor="dl-note">Un mot (facultatif)</label>
            <textarea id="dl-note" value={f.note} onChange={set("note")} maxLength={600} placeholder="Comment vous vous êtes rencontrées…" />
          </div>
          <button className="btn btn-gold btn-block" type="submit" disabled={busy}>
            {busy ? <span className="spin" /> : <Icon name="send" />}
            Envoyer pour confirmation
          </button>
          <p className="fine">Le club ne prélève aucune commission et n’est pas partie au deal.</p>
        </form>
      </Sheet>
    </>
  );
}

/** Confirmer / refuser un deal reçu, ou retirer une déclaration en attente. */
export function DealActions({ dealId, mode }: { dealId: string; mode: "respond" | "withdraw" }) {
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const run = async (what: "yes" | "no" | "withdraw") => {
    setBusy(what);
    const r = what === "withdraw" ? await withdrawDealAction(dealId) : await respondDealAction(dealId, what === "yes");
    setBusy(null);
    toast(r.ok ? r.message : r.error, r.ok ? (what === "yes" ? "star" : "check") : "bell");
    router.refresh();
  };
  if (mode === "withdraw")
    return (
      <button className="btn btn-ghost btn-xs" onClick={() => run("withdraw")} disabled={!!busy}>
        {busy ? <span className="spin" /> : <Icon name="x" />}
        Retirer
      </button>
    );
  return (
    <>
      <button className="btn btn-gold btn-xs" onClick={() => run("yes")} disabled={!!busy}>
        {busy === "yes" ? <span className="spin" /> : <Icon name="check" />}
        Confirmer
      </button>
      <button className="btn btn-ghost btn-xs" onClick={() => run("no")} disabled={!!busy}>
        {busy === "no" ? <span className="spin" /> : null}
        Ce n’est pas ça
      </button>
    </>
  );
}

/** Apparaître ou non dans le classement. */
export function OptOutToggle({ optOut }: { optOut: boolean }) {
  const [v, setV] = useState(optOut);
  const toast = useToast();
  const router = useRouter();
  return (
    <label className="eg-check" style={{ margin: "14px 0 0" }}>
      <input
        type="checkbox"
        className="pref-switch"
        checked={!v}
        onChange={async (e) => {
          const next = !e.target.checked;
          setV(next);
          const r = await setLeaderboardOptOutAction(next);
          toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
          router.refresh();
        }}
      />
      Apparaître dans le classement
    </label>
  );
}
