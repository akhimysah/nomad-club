"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addKeywordAction, moderateReportAction, removeKeywordAction, type ModerationKind } from "@/app/actions/communaute";
import { KEYWORD_ACTION_LABEL } from "@/lib/modules/communaute/domain";
import type { KeywordAction, ModerationKeyword, ReportView } from "@/lib/modules/communaute/types";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

export type ReportItem = ReportView & { time: string; resolvedLabel: string | null };

const SOURCE_LABEL = { member: "Signalé par une membre", keyword: "Mot-clé", moderator: "Modération" } as const;
const RESOLUTION_LABEL = { hidden: "Masqué", restored: "Rétabli", warned: "Autrice avertie", dismissed: "Classé sans suite" } as const;

function ReportRow({ r }: { r: ReportItem }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<ModerationKind | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = async (kind: ModerationKind) => {
    if (busy) return;
    if (kind === "warn" && !window.confirm(`Envoyer un avertissement à ${r.authorName} ?`)) return;
    setBusy(kind);
    const res = await moderateReportAction(r.id, kind);
    setBusy(null);
    toast(res.ok ? res.message : res.error, res.ok ? "check" : "bell");
    if (res.ok) {
      setDone(res.message);
      router.refresh();
    }
  };
  const open = r.status === "open" && !done;
  const btn = (kind: ModerationKind, label: string, cls = "btn btn-ghost btn-xs") => (
    <button type="button" className={cls} onClick={() => run(kind)} disabled={!!busy}>
      {busy === kind && <span className="spin" />}
      {label}
    </button>
  );
  return (
    <li className={"cm-report" + (open ? "" : " done")}>
      <Avatar name={r.authorName} />
      <div style={{ minWidth: 0 }}>
        <div className="head">
          <b>{r.authorName}</b>
          <span className="chip">{r.channelLabel}</span>
          <span className={"chip" + (r.source === "keyword" ? " rose" : "")}>
            {SOURCE_LABEL[r.source]}
            {r.keyword ? ` · ${r.keyword}` : ""}
          </span>
          {r.hidden && <span className="chip solid">Masqué</span>}
          <span className="why">{r.time}</span>
        </div>
        <div className="quote-box">« {r.messageBody} »</div>
        <div className="why">
          {r.reporterName ? `${r.reporterName} : ` : ""}
          {r.reason || "Sans motif"}
          {!open && ` · ${done ?? (r.resolution ? RESOLUTION_LABEL[r.resolution] : "")}${r.resolvedLabel ? ` · ${r.resolvedLabel}` : ""}`}
        </div>
        {open && (
          <div className="cm-acts" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            {r.hidden ? btn("restore", "Rétablir le message") : btn("hide", "Masquer", "btn btn-ink btn-xs")}
            {btn("warn", "Avertir l’autrice")}
            {btn("dismiss", r.hidden ? "Garder masqué, clore" : "Classer sans suite")}
          </div>
        )}
      </div>
    </li>
  );
}

/** Lot 1 — File de modération : signalements des membres et des mots-clés. */
export function ModerationQueue({ open, resolved }: { open: ReportItem[]; resolved: ReportItem[] }) {
  return (
    <>
      <section className="card">
        <div className="card-h">
          <h2>À traiter</h2>
          <span className="muted">
            {open.length} signalement{open.length > 1 ? "s" : ""}
          </span>
        </div>
        {open.length ? (
          <ul className="cm-list">
            {open.map((r) => (
              <ReportRow key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <Icon name="check" />
            Rien à modérer. Le cercle est bienveillant !
          </div>
        )}
      </section>
      {resolved.length > 0 && (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="card-h">
            <h2>Déjà traités</h2>
            <span className="muted">les plus récents</span>
          </div>
          <ul className="cm-list">
            {resolved.map((r) => (
              <ReportRow key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Lot 1 — Liste des mots-clés : masquer et signaler, ou signaler seulement. */
export function KeywordsManager({ keywords }: { keywords: ModerationKeyword[] }) {
  const router = useRouter();
  const toast = useToast();
  const [word, setWord] = useState("");
  const [action, setAction] = useState<KeywordAction>("hide");
  const [busy, setBusy] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || word.trim().length < 2) return;
    setBusy(true);
    const r = await addKeywordAction(word, action);
    setBusy(false);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) {
      setWord("");
      router.refresh();
    }
  };
  const remove = async (k: ModerationKeyword) => {
    const r = await removeKeywordAction(k.id);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) router.refresh();
  };
  const group = (a: KeywordAction) => keywords.filter((k) => k.action === a);
  return (
    <section className="card">
      <div className="card-h">
        <h2>Mots-clés</h2>
        <span className="muted">appliqués au salon, aux groupes et aux messages privés</span>
      </div>
      <form className="cm-inline" onSubmit={add} style={{ marginTop: 12 }}>
        <label className="sr" htmlFor="kw-word">
          Mot-clé
        </label>
        <input id="kw-word" placeholder="Un mot ou une expression" value={word} maxLength={60} onChange={(e) => setWord(e.target.value)} />
        <label className="sr" htmlFor="kw-action">
          Action
        </label>
        <select id="kw-action" value={action} onChange={(e) => setAction(e.target.value as KeywordAction)}>
          <option value="hide">{KEYWORD_ACTION_LABEL.hide}</option>
          <option value="flag">{KEYWORD_ACTION_LABEL.flag}</option>
        </select>
        <button className="btn btn-ink btn-sm" disabled={busy || word.trim().length < 2}>
          {busy ? <span className="spin" /> : <Icon name="plus" />}
          Ajouter
        </button>
      </form>
      {(["hide", "flag"] as const).map((a) => (
        <div key={a}>
          <div className="mini-h">{KEYWORD_ACTION_LABEL[a]}</div>
          <div className="cm-kw">
            {group(a).map((k) => (
              <span key={k.id} className={"chip" + (a === "hide" ? " rose" : "")}>
                {k.keyword}
                <button type="button" aria-label={`Retirer ${k.keyword}`} onClick={() => remove(k)}>
                  <Icon name="x" />
                </button>
              </span>
            ))}
            {!group(a).length && <span className="muted" style={{ fontSize: 14 }}>Aucun mot-clé.</span>}
          </div>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 13.5, margin: "16px 0 0" }}>
        Majuscules et accents sont ignorés. Un message masqué affiche « Message masqué par la modération » ; son texte reste lisible ici.
      </p>
    </section>
  );
}
