"use client";

import { useEffect, useState } from "react";
import { normalize } from "@/lib/format";
import type { MemberStatus } from "@/lib/domain/founders";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Lingering } from "../ui/Lingering";
import { ActionButton } from "./ActionButton";

export type MemberRowView = {
  id: string;
  name: string;
  job: string;
  formule: string;
  status: MemberStatus;
  due: string;
  action: { type: "vir"; id: string } | { type: "rel"; key: string; label: string } | null;
};

const STL: Record<MemberStatus, string> = { active: "Active", renew: "À renouveler", lapsed: "Échue", pending: "En attente", free: "Compte gratuit", done: "Relancée" };
const FILTERS: Array<[string, string]> = [
  ["all", "Toutes"],
  ["Premium", "Premium"],
  ["Membre", "Membre"],
  ["renew", "À renouveler"],
  ["lapsed", "Échues"],
  ["pending", "En attente"],
  ["free", "Comptes gratuits"],
];

/** Fiches des membres : recherche, filtres et action directe (valider, relancer, inviter). */
export function MembersTable({ rows, initialQuery }: { rows: MemberRowView[]; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [f, setF] = useState("all");
  useEffect(() => setQ(initialQuery), [initialQuery]);
  const nq = normalize(q.trim());
  const list = rows.filter((m) => (f === "all" || m.formule === f || m.status === f) && (!nq || normalize(`${m.name} ${m.job}`).includes(nq)));
  return (
    <>
      <div className="dir-tools" style={{ paddingTop: 0 }}>
        <label className="search" style={{ background: "var(--s1)" }}>
          <Icon name="search" />
          <span className="sr">Chercher</span>
          <input id="f-msearch" autoComplete="off" placeholder="Chercher un nom, un métier…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="chips-row">
          {FILTERS.map(([k, label]) => (
            <button key={k} className={"fchip" + (f === k ? " on" : "")} onClick={() => setF(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <section className="card" style={{ padding: "10px 22px" }}>
        <div className="mtable">
          <div className="mrow head">
            <span>Nom</span>
            <span className="c-f">Formule</span>
            <span className="c-s">Statut</span>
            <span className="c-d">Échéance</span>
            <span className="act">Action</span>
          </div>
          <Lingering
            items={list.map((m, i) => {
              const key = m.action?.type === "vir" ? `vir:${m.action.id}` : m.action?.type === "rel" ? `rel:${m.action.key}` : `m:${m.id}`;
              return {
                key: m.id,
                node: (
                  <div className="mrow" data-row={key} style={{ animationDelay: `${Math.min(i, 30) * 0.02}s` }}>
                    <div className="who">
                      <Avatar name={m.name} />
                      <div style={{ minWidth: 0 }}>
                        <b>{m.name}</b>
                        <span>{m.job}</span>
                      </div>
                    </div>
                    <span className="c-f">{m.formule}</span>
                    <span className="c-s">
                      <span className={"st " + m.status}>{STL[m.status]}</span>
                    </span>
                    <span className="c-d">{m.due}</span>
                    <span className="act">
                      {m.action?.type === "vir" ? (
                        <ActionButton kind="vir" target={m.action.id} rowKey={key} label="Valider" />
                      ) : m.action?.type === "rel" ? (
                        <ActionButton kind={m.action.label === "Inviter" ? "invite" : "rel"} target={m.action.key} rowKey={key} label={m.action.label} />
                      ) : m.status === "done" ? (
                        <span className="st done">Relancée</span>
                      ) : (
                        <span className="muted" style={{ fontSize: 14 }}>
                          —
                        </span>
                      )}
                    </span>
                    <div className="m-meta" style={{ display: "none" }}>
                      <span className={"st " + m.status}>{STL[m.status]}</span>
                      <span>{m.formule}</span>
                      <span>{m.due}</span>
                    </div>
                  </div>
                ),
              };
            })}
            empty={
              <div className="empty">
                <Icon name="search" />
                Aucune fiche ne correspond.
              </div>
            }
          />
        </div>
      </section>
    </>
  );
}
