"use client";

import Link from "next/link";
import { useState } from "react";
import { moveDealAction, saveDealAction, saveStagesAction } from "@/app/actions/crm";
import { money } from "@/lib/format";
import type { StageOutcome } from "@/lib/modules/crm/types";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";
import { useRun } from "./useRun";

export type KStage = { id: string; label: string; outcome: StageOutcome };
export type KCard = { id: string; stageId: string; position: number; title: string; value: number; contactId: string; name: string; owner: string; lostReason: string | null; age: string };

/**
 * Pipeline en colonnes : glisser-déposer une carte (souris) ou la déplacer avec son menu « Étape »
 * (clavier, lecteur d'écran, téléphone). Vers « Perdu », le motif est demandé.
 */
export function Kanban({ stages, cards }: { stages: KStage[]; cards: KCard[] }) {
  const [local, setLocal] = useState(cards);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; stageId: string; position: number } | null>(null);
  const [reason, setReason] = useState("");
  const toast = useToast();
  const { run } = useRun();
  const [synced, setSynced] = useState(cards);
  if (synced !== cards) {
    setSynced(cards);
    setLocal(cards);
  }

  const lost = (stageId: string) => stages.find((s) => s.id === stageId)?.outcome === "lost";
  const move = async (id: string, stageId: string, position: number, why: string | null = null) => {
    const card = local.find((c) => c.id === id);
    if (!card) return;
    if (lost(stageId) && !why && !card.lostReason) {
      setAsking({ id, stageId, position });
      setReason("");
      return;
    }
    const before = local;
    setLocal((l) => {
      const rest = l.filter((c) => c.id !== id);
      const col = rest.filter((c) => c.stageId === stageId).sort((a, b) => a.position - b.position);
      col.splice(Math.min(position, col.length), 0, { ...card, stageId, lostReason: lost(stageId) ? why ?? card.lostReason : null });
      const pos = new Map(col.map((c, i) => [c.id, i]));
      return [...rest.filter((c) => c.stageId !== stageId), ...col].map((c) => (pos.has(c.id) ? { ...c, position: pos.get(c.id)! } : c));
    });
    const r = await run(() => moveDealAction(id, stageId, position, why));
    if (!r.ok) setLocal(before);
  };

  return (
    <>
      <div className="kanban" role="list" aria-label="Pipeline">
        {stages.map((s) => {
          const col = local.filter((c) => c.stageId === s.id).sort((a, b) => a.position - b.position);
          const total = col.reduce((a, c) => a + c.value, 0);
          return (
            <section
              key={s.id}
              role="listitem"
              aria-label={`${s.label}, ${col.length} opportunité${col.length > 1 ? "s" : ""}`}
              className={"kcol " + s.outcome + (over === s.id ? " over" : "")}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                setOver(s.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain") || drag;
                if (!id) return;
                // position : avant la carte survolée, sinon en fin de colonne
                const target = (e.target as HTMLElement).closest<HTMLElement>("[data-card]");
                const idx = target ? col.findIndex((c) => c.id === target.dataset.card) : col.length;
                move(id, s.id, idx < 0 ? col.length : idx);
                setDrag(null);
              }}
            >
              <div className="kcol-h">
                <b>{s.label}</b>
                <span>
                  {col.length} · {money(total)}
                </span>
              </div>
              {col.map((c) => (
                <article
                  key={c.id}
                  data-card={c.id}
                  className={"kcard" + (drag === c.id ? " dragging" : "")}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", c.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDrag(c.id);
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setOver(null);
                  }}
                >
                  <Link className="n" href={`/fondatrices/crm/contacts/${c.contactId}`} draggable={false}>
                    {c.name}
                  </Link>
                  <div className="m">
                    <span>{c.title}</span>
                    <b>{c.value ? money(c.value) : "—"}</b>
                  </div>
                  <div className="m">
                    <span>{c.owner}</span>
                    <span>{c.age}</span>
                  </div>
                  {c.lostReason && s.outcome === "lost" && <div className="lost">Motif : {c.lostReason}</div>}
                  <select
                    aria-label={`Étape de ${c.name}`}
                    value={c.stageId}
                    onChange={(e) => move(c.id, e.target.value, local.filter((x) => x.stageId === e.target.value).length)}
                  >
                    {stages.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.id === c.stageId ? `Étape : ${x.label}` : `→ ${x.label}`}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
              {asking && asking.stageId === s.id && !col.some((c) => c.id === asking.id) && (
                <form
                  className="lostbox kcard"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!reason.trim()) return toast("Indiquez le motif de perte.", "bell");
                    const a = asking;
                    setAsking(null);
                    move(a.id, a.stageId, a.position, reason.trim());
                  }}
                >
                  <b style={{ fontSize: 14 }}>{local.find((c) => c.id === asking.id)?.name} : pourquoi perdue ?</b>
                  <input className="ci" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif de perte" aria-label="Motif de perte" maxLength={300} />
                  <span className="btn-row">
                    <button className="btn btn-ink btn-xs">Valider</button>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setAsking(null)}>
                      Annuler
                    </button>
                  </span>
                </form>
              )}
              {!col.length && !(asking && asking.stageId === s.id) && <div className="kempty">Déposez une carte ici</div>}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Ajouter une opportunité au pipeline (contact existant). */
export function NewDeal({ stages, contacts, me }: { stages: KStage[]; contacts: Array<{ id: string; name: string }>; me: string }) {
  const [who, setWho] = useState("");
  const [title, setTitle] = useState("Adhésion Membre");
  const [value, setValue] = useState("670");
  const [stage, setStage] = useState(stages[0]?.id ?? "");
  const { run, busy } = useRun();
  const contact = contacts.find((c) => c.name === who);
  return (
    <form
      className="newtask"
      style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) 110px minmax(0,1fr) auto" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!contact) return;
        run(() => saveDealAction({ contactId: contact.id, stageId: stage, title, value: Number(value) || 0, ownerId: me, expectedClose: null }, null), { onOk: () => setWho("") });
      }}
    >
      <input className="ci" list="crm-deal-contacts" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Contact (nom)" aria-label="Contact" />
      <datalist id="crm-deal-contacts">
        {contacts.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <input className="ci" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Opportunité" />
      <input className="ci" type="number" min={0} step={10} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Valeur estimée" />
      <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Étape">
        {stages
          .filter((s) => s.outcome === "open")
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
      </select>
      <button className="btn btn-ink btn-sm" disabled={busy || !contact}>
        <Icon name="plus" />
        Ajouter
      </button>
    </form>
  );
}

/** Étapes configurables : renommer, réordonner, ajouter, retirer (une étape utilisée ne peut pas être retirée). */
export function StageEditor({ stages, used }: { stages: KStage[]; used: string[] }) {
  const [list, setList] = useState<Array<{ id: string | null; label: string; outcome: StageOutcome; key: string }>>(stages.map((s) => ({ ...s, key: s.id })));
  const { run, busy } = useRun();
  const swap = (i: number, j: number) =>
    setList((l) => {
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveStagesAction(list.map(({ id, label, outcome }) => ({ id, label, outcome }))));
      }}
    >
      <div className="stage-ed">
        {list.map((s, i) => (
          <div key={s.key} className="srow">
            <span style={{ display: "flex", gap: 4 }}>
              <button type="button" onClick={() => swap(i, i - 1)} disabled={i === 0} aria-label={`Monter ${s.label}`}>
                <Icon name="chev-l" />
              </button>
              <button type="button" onClick={() => swap(i, i + 1)} disabled={i === list.length - 1} aria-label={`Descendre ${s.label}`}>
                <Icon name="chev-r" />
              </button>
            </span>
            <input className="ci" value={s.label} onChange={(e) => setList((l) => l.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} aria-label="Nom de l’étape" maxLength={60} />
            <select value={s.outcome} onChange={(e) => setList((l) => l.map((x, k) => (k === i ? { ...x, outcome: e.target.value as StageOutcome } : x)))} aria-label="Type d’étape">
              <option value="open">En cours</option>
              <option value="won">Gagnée (adhérente)</option>
              <option value="lost">Perdue</option>
            </select>
            <button type="button" onClick={() => setList((l) => l.filter((_, k) => k !== i))} disabled={!!s.id && used.includes(s.id)} aria-label={`Retirer ${s.label}`} title={s.id && used.includes(s.id) ? "Étape utilisée" : "Retirer"}>
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setList((l) => [...l, { id: null, label: "Nouvelle étape", outcome: "open", key: `new-${l.length}-${Date.now()}` }])}>
          <Icon name="plus" />
          Ajouter une étape
        </button>
        <button className="btn btn-ink btn-sm" disabled={busy}>
          Enregistrer les étapes
        </button>
      </div>
    </form>
  );
}
