"use client";

import Link from "next/link";
import { useState } from "react";
import { addActivityAction, createTaskAction, mergeContactsAction, moveDealAction, rescheduleTaskAction, saveDealAction, toggleTaskAction } from "@/app/actions/crm";
import { ACTIVITY_LABEL, type ActivityType } from "@/lib/modules/crm/types";
import { Icon } from "../ui/Icon";
import { ContactForm, type ContactFormValues } from "./ContactForm";
import { useRun } from "./useRun";

type Owner = { id: string; first: string };

/** Coordonnées : lecture, puis formulaire en place. */
export function DetailsCard({ id, initial, owners, linked, children }: { id: string; initial: ContactFormValues; owners: Owner[]; linked: boolean; children: React.ReactNode }) {
  const [edit, setEdit] = useState(false);
  return (
    <section className="card">
      <div className="card-h">
        <h2>Coordonnées</h2>
        {!edit && (
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEdit(true)}>
            <Icon name="edit" />
            Modifier
          </button>
        )}
      </div>
      {edit ? <ContactForm id={id} initial={initial} owners={owners} linked={linked} onDone={() => setEdit(false)} /> : children}
    </section>
  );
}

const TYPES: ActivityType[] = ["call", "whatsapp", "email", "meeting", "note", "event"];

/** Ajouter un échange à l'historique (appel, WhatsApp, e-mail, rendez-vous, note, événement). */
export function ActivityComposer({ contactId, today }: { contactId: string; today: string }) {
  const [type, setType] = useState<ActivityType>("call");
  const [body, setBody] = useState("");
  const [day, setDay] = useState(today);
  const { run, busy } = useRun();
  const submit = () => run(() => addActivityAction({ contactId, type, body, occurredOn: day }), { onOk: () => setBody("") });
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="types" role="group" aria-label="Type d’échange">
        {TYPES.map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
            {ACTIVITY_LABEL[t]}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ce qui s’est dit, la suite à donner…"
        rows={3}
        aria-label="Compte rendu"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      <div className="row">
        <input className="ci" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} aria-label="Date de l’échange" />
        <button className="btn btn-ink btn-sm" disabled={busy || !body.trim()}>
          Ajouter
        </button>
      </div>
    </form>
  );
}

export type TaskView = { id: string; title: string; due: string; dueOn: string; late: boolean; owner: string; contact: { id: string; name: string } | null; done: boolean };

/** Liste de tâches cochables, avec report rapide (+1 j, +1 sem.). */
export function TaskList({ tasks, today, empty }: { tasks: TaskView[]; today: string; empty?: string }) {
  const { run } = useRun();
  const shift = (ymd: string, d: number) => {
    const base = ymd < today ? today : ymd;
    return new Date(Date.parse(base + "T00:00:00Z") + d * 86400000).toISOString().slice(0, 10);
  };
  if (!tasks.length) return <div className="empty">{empty ?? "Aucune tâche."}</div>;
  return (
    <ul className="tasks">
      {tasks.map((t) => (
        <li key={t.id} className={"task" + (t.done ? " done" : "")}>
          <input type="checkbox" checked={t.done} onChange={(e) => run(() => toggleTaskAction(t.id, e.target.checked))} aria-label={`${t.done ? "Rouvrir" : "Terminer"} : ${t.title}`} />
          <span>
            <b>{t.title}</b>
            <small>
              <span className={t.late && !t.done ? "late" : undefined}>{t.due}</span>
              {" · "}
              {t.owner}
              {t.contact && (
                <>
                  {" · "}
                  <Link href={`/fondatrices/crm/contacts/${t.contact.id}`}>{t.contact.name}</Link>
                </>
              )}
            </small>
          </span>
          {!t.done && (
            <span className="t-act">
              <button type="button" onClick={() => run(() => rescheduleTaskAction(t.id, shift(t.dueOn, 1)))} title="Reporter d’un jour">
                +1 j
              </button>
              <button type="button" onClick={() => run(() => rescheduleTaskAction(t.id, shift(t.dueOn, 7)))} title="Reporter d’une semaine">
                +1 sem.
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Nouvelle tâche (avec ou sans contact). */
export function NewTask({ contactId, owners, me, today, contacts }: { contactId: string | null; owners: Owner[]; me: string; today: string; contacts?: Array<{ id: string; name: string }> }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(today);
  const [owner, setOwner] = useState(me);
  const [who, setWho] = useState("");
  const { run, busy } = useRun();
  const target = contactId ?? contacts?.find((c) => c.name === who)?.id ?? null;
  return (
    <form
      className="newtask"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createTaskAction({ contactId: target, title, dueOn: due, ownerId: owner }), {
          onOk: () => {
            setTitle("");
            setWho("");
          },
        });
      }}
    >
      <input className="ci" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle tâche (ex. rappeler jeudi)" aria-label="Nouvelle tâche" maxLength={200} />
      <input className="ci" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Échéance" />
      <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Responsable">
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.first}
          </option>
        ))}
      </select>
      <button className="btn btn-ink btn-sm" disabled={busy || !title.trim()}>
        <Icon name="plus" />
        Ajouter
      </button>
      {contacts && (
        <>
          <input className="ci" list="crm-task-contacts" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Contact (facultatif)" aria-label="Contact" style={{ gridColumn: "1 / span 2" }} />
          <datalist id="crm-task-contacts">
            {contacts.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </>
      )}
    </form>
  );
}

type StageOpt = { id: string; label: string; outcome: "open" | "won" | "lost" };

/** Opportunité de la fiche : étape (menu), valeur, motif de perte ; ou ajout au pipeline. */
export function DealBox({
  contactId,
  deal,
  stages,
  me,
}: {
  contactId: string;
  deal: { id: string; stageId: string; title: string; value: number; lostReason: string | null; ownerId: string | null } | null;
  stages: StageOpt[];
  me: string;
}) {
  const { run, busy } = useRun();
  const [stage, setStage] = useState(deal?.stageId ?? stages[0]?.id ?? "");
  const [title, setTitle] = useState(deal?.title ?? "Adhésion Membre");
  const [value, setValue] = useState(String(deal?.value ?? 670));
  const [reason, setReason] = useState(deal?.lostReason ?? "");
  const isLost = stages.find((s) => s.id === stage)?.outcome === "lost";
  const save = () =>
    deal && stage !== deal.stageId && title === deal.title && Number(value) === deal.value
      ? run(() => moveDealAction(deal.id, stage, 0, reason || null))
      : run(() => saveDealAction({ contactId, stageId: stage, title, value: Number(value) || 0, ownerId: deal?.ownerId ?? me, expectedClose: null, lostReason: reason || null }, deal?.id ?? null));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="cgrid">
        <label className="cf">
          <span>Étape</span>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="cf">
          <span>Opportunité</span>
          <input className="ci" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        </label>
        <label className="cf">
          <span>Valeur estimée ($)</span>
          <input className="ci" type="number" min={0} step={10} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        {isLost && (
          <label className="cf wide">
            <span>Motif de perte</span>
            <input className="ci" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Budget, quitte Marrakech, pas le bon moment…" maxLength={300} required />
          </label>
        )}
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-ink btn-sm" disabled={busy}>
          {deal ? "Enregistrer" : "Ajouter au pipeline"}
        </button>
        {deal && (
          <Link className="btn btn-ghost btn-sm" href="/fondatrices/crm/pipeline">
            Voir le pipeline
          </Link>
        )}
      </div>
    </form>
  );
}

/** Fusionner un doublon dans cette fiche. */
export function MergeBox({ keepId, candidates, others }: { keepId: string; candidates: Array<{ id: string; name: string; reason: string }>; others: Array<{ id: string; name: string }> }) {
  const [drop, setDrop] = useState(candidates[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const { run, busy } = useRun();
  const target = drop || others.find((o) => o.name === search)?.id || "";
  const name = candidates.find((c) => c.id === target)?.name ?? others.find((o) => o.id === target)?.name ?? "";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!target) return;
        if (window.confirm(`Verser la fiche « ${name} » dans celle-ci ? Ses échanges, tâches et opportunités seront repris, puis elle sera supprimée.`)) run(() => mergeContactsAction(keepId, target));
      }}
    >
      {candidates.length > 0 ? (
        <ul className="tasks">
          {candidates.map((c) => (
            <li key={c.id} className="task" style={{ gridTemplateColumns: "28px minmax(0,1fr)" }}>
              <input type="radio" name="drop" checked={drop === c.id} onChange={() => setDrop(c.id)} aria-label={c.name} />
              <span>
                <b>
                  <Link href={`/fondatrices/crm/contacts/${c.id}`}>{c.name}</Link>
                </b>
                <small>{c.reason}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ fontSize: 14, margin: "4px 0 10px" }}>
          Aucun doublon probable. Pour fusionner une autre fiche, cherchez-la :
        </p>
      )}
      <div className="btn-row" style={{ marginTop: 10 }}>
        {!candidates.length && (
          <>
            <input className="ci" list="crm-merge" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom de la fiche à verser ici" aria-label="Fiche à fusionner" style={{ flex: 1, minWidth: 180 }} />
            <datalist id="crm-merge">
              {others.map((o) => (
                <option key={o.id} value={o.name} />
              ))}
            </datalist>
          </>
        )}
        <button className="btn btn-ghost btn-sm" disabled={busy || !target}>
          Fusionner dans cette fiche
        </button>
      </div>
    </form>
  );
}
