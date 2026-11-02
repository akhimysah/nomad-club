"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fold } from "@/lib/modules/communaute/domain";
import type { DirectoryEntry } from "@/lib/modules/communaute/types";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { Photo } from "./Photo";

const options = (values: Array<string | null | undefined>) => [...new Set(values.filter((v): v is string => !!v && !!v.trim()))].sort((a, b) => a.localeCompare(b, "fr"));

const httpUrl = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);
const instaUrl = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://instagram.com/${s.replace(/^@/, "")}`);
const waUrl = (s: string) => `https://wa.me/${s.replace(/\D/g, "")}`;

/** Lot 1 — Annuaire des membres : recherche, filtres (secteur, nationalité, compétence) et fiche complète. */
export function Annuaire({ entries, activeCount, premiumCount }: { entries: DirectoryEntry[]; activeCount: number; premiumCount: number }) {
  const [q, setQ] = useState("");
  const [badge, setBadge] = useState<"all" | "Premium" | "Fondatrice">("all");
  const [sector, setSector] = useState("");
  const [nationality, setNationality] = useState("");
  const [skill, setSkill] = useState("");
  const [person, setPerson] = useState<DirectoryEntry | null>(null);

  const sectors = useMemo(() => options(entries.map((e) => e.sector)), [entries]);
  const nationalities = useMemo(() => options(entries.map((e) => e.nationality)), [entries]);
  const skills = useMemo(() => options(entries.flatMap((e) => e.skills)), [entries]);

  const nq = fold(q.trim());
  const list = entries.filter((e) => {
    if (badge !== "all" && e.badge !== badge) return false;
    if (sector && e.sector !== sector) return false;
    if (nationality && e.nationality !== nationality) return false;
    if (skill && !e.skills.some((s) => fold(s) === fold(skill))) return false;
    if (!nq) return true;
    return fold([e.name, e.job, e.company, e.sector, e.nationality, e.skills.join(" "), e.offering, e.lookingFor].filter(Boolean).join(" ")).includes(nq);
  });
  const filtered = !!(sector || nationality || skill || badge !== "all" || nq);
  const chips: Array<[typeof badge, string, number]> = [
    ["all", "Toutes", entries.length],
    ["Premium", "Premium", entries.filter((d) => d.badge === "Premium").length],
    ["Fondatrice", "Fondatrices", entries.filter((d) => d.badge === "Fondatrice").length],
  ];

  return (
    <>
      <div className="dir-tools">
        <label className="search">
          <Icon name="search" />
          <span className="sr">Chercher une membre</span>
          <input id="dir-search" autoComplete="off" placeholder="Un prénom, un métier, une compétence…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="cm-filters">
          <label className="sr" htmlFor="f-sector">
            Secteur
          </label>
          <select id="f-sector" className={sector ? "on" : undefined} value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">Tous les secteurs</option>
            {sectors.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="sr" htmlFor="f-nat">
            Nationalité
          </label>
          <select id="f-nat" className={nationality ? "on" : undefined} value={nationality} onChange={(e) => setNationality(e.target.value)}>
            <option value="">Toutes nationalités</option>
            {nationalities.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="sr" htmlFor="f-skill">
            Compétence
          </label>
          <select id="f-skill" className={skill ? "on" : undefined} value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Toutes compétences</option>
            {skills.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="chips-row">
          {chips.map(([k, label, n]) => (
            <button key={k} className={"fchip" + (badge === k ? " on" : "")} onClick={() => setBadge(k)}>
              {label}
              <small>{n}</small>
            </button>
          ))}
          {filtered && (
            <button
              className="fchip"
              onClick={() => {
                setQ("");
                setBadge("all");
                setSector("");
                setNationality("");
                setSkill("");
              }}
            >
              Effacer les filtres
            </button>
          )}
        </div>
      </div>
      <div className="chat-log" style={{ gap: 0, paddingTop: 0 }}>
        <div className="dir-list">
          {list.length ? (
            list.map((d, i) => (
              <button key={d.id} className="person" style={{ animation: `fadeIn .4s ${Math.min(i, 20) * 0.03}s both` }} onClick={() => setPerson(d)}>
                <Photo name={d.name} src={d.photo} founder={d.badge === "Fondatrice"} />
                <span style={{ minWidth: 0 }}>
                  <b>{d.name}</b>
                  <span className="sub">{[d.job ?? "Membre du club", d.company, d.limited ? null : d.nationality].filter(Boolean).join(" · ")}</span>
                </span>
                {d.badge && (
                  <span className="chip gold">
                    {d.badge === "Premium" && <Icon name="crown" />}
                    {d.badge}
                  </span>
                )}
                <Icon name="chev-r" className="go" />
              </button>
            ))
          ) : (
            <div className="empty">
              <Icon name="search" />
              Personne ne correspond. Essaie un autre mot ou retire un filtre.
            </div>
          )}
          <p className="dir-note">
            {list.length} fiche{list.length > 1 ? "s" : ""} · {activeCount} adhérentes actives, dont {premiumCount} Premium. Chacune choisit ce qu’elle montre.{" "}
            <Link className="link" href="/espace/moi/profil">
              Ma fiche
            </Link>
          </p>
        </div>
      </div>

      <Sheet open={!!person} onClose={() => setPerson(null)} label={person?.name ?? "Membre"}>
        {person && (
          <div style={{ textAlign: "center" }}>
            <Photo name={person.name} src={person.photo} founder={person.badge === "Fondatrice"} size="xl" />
            <h2 className="sh-title" style={{ marginTop: 14 }}>
              {person.name}
            </h2>
            <p className="sh-sub" style={{ marginBottom: 12 }}>
              {[person.job, person.company].filter(Boolean).join(" · ") || "Membre du club"}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
              {person.nationality && <span className="chip">{person.nationality}</span>}
              {person.marrakechSince && <span className="chip">À Marrakech depuis {person.marrakechSince}</span>}
              {person.sector && <span className="chip">{person.sector}</span>}
              {person.badge && <span className="chip gold">{person.badge}</span>}
            </div>
            {person.limited && <p className="cm-note">Cette membre ne partage que son nom et son métier.</p>}
            {person.bio && <p style={{ margin: "0 0 14px", color: "var(--tx2)" }}>{person.bio}</p>}
            {person.skills.length > 0 && (
              <div className="cm-skills">
                {person.skills.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {(person.lookingFor || person.offering || person.whatsapp || person.email || person.instagram || person.linkedin || person.website) && (
              <div className="cm-card-kv">
                {person.lookingFor && (
                  <div className="kv">
                    <span>Ce que je cherche</span>
                    <b>{person.lookingFor}</b>
                  </div>
                )}
                {person.offering && (
                  <div className="kv">
                    <span>Ce que je propose</span>
                    <b>{person.offering}</b>
                  </div>
                )}
                {person.whatsapp && (
                  <div className="kv">
                    <span>WhatsApp</span>
                    <b>
                      <a className="link" href={waUrl(person.whatsapp)} target="_blank" rel="noreferrer">
                        {person.whatsapp}
                      </a>
                    </b>
                  </div>
                )}
                {person.email && (
                  <div className="kv">
                    <span>E-mail</span>
                    <b>
                      <a className="link" href={`mailto:${person.email}`}>
                        {person.email}
                      </a>
                    </b>
                  </div>
                )}
                {person.instagram && (
                  <div className="kv">
                    <span>Instagram</span>
                    <b>
                      <a className="link" href={instaUrl(person.instagram)} target="_blank" rel="noreferrer">
                        {person.instagram}
                      </a>
                    </b>
                  </div>
                )}
                {person.linkedin && (
                  <div className="kv">
                    <span>LinkedIn</span>
                    <b>
                      <a className="link" href={httpUrl(person.linkedin)} target="_blank" rel="noreferrer">
                        {person.linkedin.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    </b>
                  </div>
                )}
                {person.website && (
                  <div className="kv">
                    <span>Site</span>
                    <b>
                      <a className="link" href={httpUrl(person.website)} target="_blank" rel="noreferrer">
                        {person.website.replace(/^https?:\/\//, "")}
                      </a>
                    </b>
                  </div>
                )}
              </div>
            )}
            <Link className="btn btn-gold btn-block" href={`/espace/cercle/${person.id}`} onClick={() => setPerson(null)}>
              <Icon name="chat" />
              Écrire à {person.firstName}
            </Link>
            <p className="fine">Messages privés entre membres.</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
