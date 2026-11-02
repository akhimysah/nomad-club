"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { bulkAction } from "@/app/actions/crm";
import { fillTemplate, whatsappLink } from "@/lib/modules/crm/message";
import type { ContactStatus } from "@/lib/modules/crm/types";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toasts";
import { StatusChip, Tags } from "./bits";
import { useRun } from "./useRun";

export type TableRow = {
  id: string;
  name: string;
  firstName: string;
  sub: string;
  email: string | null;
  phone: string | null;
  status: ContactStatus;
  source: string;
  tags: string[];
  owner: string;
  account: boolean;
  consent: boolean;
  /** Adhésion ou étape du pipeline. */
  where: string;
  last: string;
};

type Mode = null | "tag" | "untag" | "owner" | "task" | "message";

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(t.tagName));
};

/** Liste dense des contacts : sélection (cases, x, maj-clic), navigation j/k, actions groupées. */
export function ContactsTable({
  rows,
  owners,
  tags,
  today,
  sortLinks,
}: {
  rows: TableRow[];
  owners: Array<{ id: string; first: string }>;
  tags: string[];
  today: string;
  sortLinks: Array<{ key: string; label: string; href: string; on: boolean; className?: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const { run, busy } = useRun();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [last, setLast] = useState<number | null>(null);
  const [focus, setFocus] = useState(-1);
  const [mode, setMode] = useState<Mode>(null);
  const [tag, setTag] = useState("");
  const [owner, setOwner] = useState(owners[0]?.id ?? "");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(today);
  const [taskOwner, setTaskOwner] = useState(owners[0]?.id ?? "");
  const [template, setTemplate] = useState("Bonjour {prenom}, ");
  const [onlyConsent, setOnlyConsent] = useState(true);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const selected = rows.filter((r) => sel.has(r.id));
  const all = sel.size > 0 && sel.size === rows.length;

  const toggle = (i: number, shift: boolean) => {
    setSel((cur) => {
      const next = new Set(cur);
      const id = ids[i];
      const on = !next.has(id);
      if (shift && last !== null) {
        const [a, b] = [Math.min(last, i), Math.max(last, i)];
        for (let k = a; k <= b; k++) {
          if (on) next.add(ids[k]);
          else next.delete(ids[k]);
        }
      } else if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    setLast(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setFocus((f) => Math.max(0, Math.min(rows.length - 1, f + (e.key === "j" ? 1 : -1))));
      } else if (e.key === "x" && focus >= 0) {
        e.preventDefault();
        toggle(focus, e.shiftKey);
      } else if (e.key === "Enter" && focus >= 0) {
        router.push(`/fondatrices/crm/contacts/${rows[focus].id}`);
      } else if (e.key === "Escape") {
        setSel(new Set());
        setMode(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (focus >= 0) document.querySelector(`[data-row-i="${focus}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  const done = () => {
    setMode(null);
    setSel(new Set());
  };
  const go = () => {
    const list = [...sel];
    if (mode === "tag" || mode === "untag") return run(() => bulkAction({ kind: mode, ids: list, tag }), { onOk: done });
    if (mode === "owner") return run(() => bulkAction({ kind: "owner", ids: list, ownerId: owner || null }), { onOk: done });
    if (mode === "task") return run(() => bulkAction({ kind: "task", ids: list, title: taskTitle, dueOn: taskDue, ownerId: taskOwner || null }), { onOk: done });
  };

  const recipients = selected.filter((r) => !onlyConsent || r.consent);
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copié${what.endsWith("s") ? "s" : ""}`, "check");
    } catch {
      toast("Copie impossible : sélectionnez le texte à la main.", "bell");
    }
  };

  return (
    <>
      <div className="ctable-wrap">
        <table className="ctable">
          <thead>
            <tr>
              <th className="cb">
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  checked={all}
                  ref={(el) => {
                    if (el) el.indeterminate = sel.size > 0 && !all;
                  }}
                  onChange={() => setSel(all ? new Set() : new Set(ids))}
                />
              </th>
              {sortLinks.map((s) => (
                <th key={s.key} className={s.className}>
                  {s.href ? (
                    <Link href={s.href} className={s.on ? "on" : undefined} scroll={false}>
                      {s.label}
                      {s.on && <Icon name="chev-d" />}
                    </Link>
                  ) : (
                    s.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} data-row-i={i} className={(sel.has(r.id) ? "sel " : "") + (focus === i ? "kfocus" : "")}>
                <td className="cb">
                  <input type="checkbox" aria-label={`Sélectionner ${r.name}`} checked={sel.has(r.id)} onChange={(e) => toggle(i, (e.nativeEvent as MouseEvent).shiftKey)} />
                </td>
                <td>
                  <Link href={`/fondatrices/crm/contacts/${r.id}`} className="who" onFocus={() => setFocus(i)}>
                    <Avatar name={r.name} />
                    <span>
                      <b>{r.name}</b>
                      <small>
                        {r.sub || r.email || "—"}
                        {r.account && (
                          <span className="acct">
                            {" · "}
                            <Icon name="user" />
                            compte
                          </span>
                        )}
                      </small>
                    </span>
                  </Link>
                </td>
                <td>
                  <StatusChip status={r.status} />
                </td>
                <td className="hide-m muted">{r.source}</td>
                <td className="hide-m">
                  <Tags tags={r.tags} />
                </td>
                <td className="hide-m">{r.owner}</td>
                <td className="hide-m muted">{r.where}</td>
                <td className="hide-m muted">{r.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty">
          <Icon name="search" />
          Aucun contact ne correspond à ces filtres.
        </div>
      )}

      {sel.size > 0 && (
        <div className="bulk" role="region" aria-label="Actions groupées">
          <b>
            {sel.size} sélectionné{sel.size > 1 ? "s" : ""}
          </b>
          {(
            [
              ["tag", "Étiquette"],
              ["untag", "Retirer une étiquette"],
              ["owner", "Assigner"],
              ["task", "Créer une tâche"],
              ["message", "Préparer un message"],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" className={"btn" + (mode === m ? " on" : "")} onClick={() => setMode(mode === m ? null : m)} aria-pressed={mode === m}>
              {label}
            </button>
          ))}
          <a className="btn" href={`/fondatrices/crm/export?ids=${[...sel].join(",")}`}>
            Exporter
          </a>
          <button type="button" className="btn" onClick={() => setSel(new Set())}>
            <Icon name="x" />
            Désélectionner
          </button>
          {(mode === "tag" || mode === "untag") && (
            <form
              className="bulk-form"
              onSubmit={(e) => {
                e.preventDefault();
                go();
              }}
            >
              <input className="ci" list="crm-tags" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Étiquette (ex. padel)" aria-label="Étiquette" autoFocus />
              <datalist id="crm-tags">
                {tags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <button className="btn btn-go" disabled={busy || !tag.trim()}>
                {mode === "tag" ? "Ajouter" : "Retirer"} à {sel.size}
              </button>
            </form>
          )}
          {mode === "owner" && (
            <form
              className="bulk-form"
              onSubmit={(e) => {
                e.preventDefault();
                go();
              }}
            >
              <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Responsable">
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.first}
                  </option>
                ))}
                <option value="">Sans responsable</option>
              </select>
              <button className="btn btn-go" disabled={busy}>
                Assigner {sel.size} contact{sel.size > 1 ? "s" : ""}
              </button>
            </form>
          )}
          {mode === "task" && (
            <form
              className="bulk-form"
              onSubmit={(e) => {
                e.preventDefault();
                go();
              }}
            >
              <input className="ci" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Ex. Relancer pour le renouvellement" aria-label="Tâche" autoFocus />
              <input className="ci" type="date" value={taskDue} min={today} onChange={(e) => setTaskDue(e.target.value)} aria-label="Échéance" style={{ flex: "0 0 160px" }} />
              <select value={taskOwner} onChange={(e) => setTaskOwner(e.target.value)} aria-label="Responsable" style={{ flex: "0 0 130px" }}>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.first}
                  </option>
                ))}
              </select>
              <button className="btn btn-go" disabled={busy || !taskTitle.trim()}>
                Créer {sel.size} tâche{sel.size > 1 ? "s" : ""}
              </button>
            </form>
          )}
        </div>
      )}

      <Sheet open={mode === "message"} onClose={() => setMode(null)} label="Préparer un message">
        <div className="crm">
          <h2 style={{ font: "500 26px/1.15 var(--serif)", margin: "0 0 6px" }}>Préparer un message</h2>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 14.5 }}>
            Rien n’est envoyé automatiquement : copiez le texte ou ouvrez WhatsApp pour chaque personne. <b>{"{prenom}"}</b> est remplacé par son prénom.
          </p>
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} aria-label="Message" rows={5} />
          <label className="check" style={{ margin: "10px 0 0" }}>
            <input type="checkbox" checked={onlyConsent} onChange={(e) => setOnlyConsent(e.target.checked)} />
            Seulement les personnes qui acceptent les messages ({selected.filter((r) => r.consent).length} sur {selected.length})
          </label>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(template, "Texte")}>
              Copier le texte
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!recipients.some((r) => r.email)}
              onClick={() =>
                copy(
                  recipients
                    .map((r) => r.email)
                    .filter(Boolean)
                    .join(", "),
                  "E-mails",
                )
              }
            >
              Copier les e-mails
            </button>
          </div>
          <ul className="msg-list">
            {recipients.map((r) => {
              const text = fillTemplate(template, { name: r.name, firstName: r.firstName });
              const wa = whatsappLink(r.phone, text);
              return (
                <li key={r.id}>
                  <span>
                    {r.name}
                    <small>{r.phone ?? r.email ?? "pas de coordonnées"}</small>
                  </span>
                  <span className="acts">
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => copy(text, "Message")}>
                      Copier
                    </button>
                    {wa ? (
                      <a className="btn btn-ink btn-xs" href={wa} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    ) : null}
                  </span>
                </li>
              );
            })}
            {!recipients.length && <li>Personne dans la sélection n’accepte les messages.</li>}
          </ul>
        </div>
      </Sheet>
    </>
  );
}
