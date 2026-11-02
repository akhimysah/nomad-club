import type { Metadata } from "next";
import Link from "next/link";
import { FHead } from "@/components/founders/parts";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability, viewerCan } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { dayMonthShort, fullName, hour } from "@/lib/format";
import { AUDIT_FAMILIES, auditLabel, parseAuditFilters } from "@/lib/modules/securite/audit-view";
import "@/styles/securite.css";

export const metadata: Metadata = { title: "Journal des opérations" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Lot 6 — journal consultable : filtres (personne, type, période), recherche, détail d'une entrée, export CSV. */
export default async function JournalPage({ searchParams }: Props) {
  const v = await requireCapability("audit.view", { next: "/fondatrices/journal" });
  const sp = await searchParams;
  const filters = parseAuditFilters(sp);
  const selected = typeof sp.entree === "string" ? sp.entree.slice(0, 64) : null;
  const repo = getRepo();
  const [log, profiles, entry] = await Promise.all([
    repo.searchAudit({ ...filters, limit: 300 }),
    repo.listProfiles(),
    selected ? repo.getAuditEntry(selected) : Promise.resolve(null),
  ]);
  const names = new Map(profiles.map((p) => [p.id, fullName(p)]));
  const actors = [...new Set((await repo.searchAudit({ limit: 1000 })).map((e) => e.actorId).filter((x): x is string => !!x))]
    .map((id) => ({ id, name: names.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const qs = new URLSearchParams();
  if (filters.actorId) qs.set("qui", filters.actorId);
  if (filters.action) qs.set("type", filters.action);
  if (filters.fromYmd) qs.set("du", filters.fromYmd);
  if (filters.toYmd) qs.set("au", filters.toYmd);
  if (filters.q) qs.set("q", filters.q);
  const base = qs.toString();
  const withEntry = (id: string) => `/fondatrices/journal?${base ? base + "&" : ""}entree=${encodeURIComponent(id)}`;
  const filtered = Boolean(base);
  const who = (id: string | null) => (id && names.get(id)) || (id ? "Compte supprimé" : "Système");

  return (
    <Screen group="founders" index={7} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Journal des opérations" sub="Qui a fait quoi, et quand" />

        <form className="card sec-filters" method="get" action="/fondatrices/journal" role="search" aria-label="Filtrer le journal">
          <label className="field">
            <span>Recherche</span>
            <input name="q" type="search" defaultValue={filters.q ?? ""} placeholder="Nom, rendez-vous, montant…" maxLength={80} />
          </label>
          <label className="field">
            <span>Personne</span>
            <select name="qui" defaultValue={filters.actorId ?? ""}>
              <option value="">Tout le monde</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Type d’action</span>
            <select name="type" defaultValue={filters.action ?? ""}>
              <option value="">Toutes</option>
              {AUDIT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Du</span>
            <input name="du" type="date" defaultValue={filters.fromYmd ?? ""} />
          </label>
          <label className="field">
            <span>Au</span>
            <input name="au" type="date" defaultValue={filters.toYmd ?? ""} />
          </label>
          <div className="sec-filter-actions">
            <button className="btn btn-ink btn-sm" type="submit">
              <Icon name="search" />
              Filtrer
            </button>
            {filtered && (
              <Link className="btn btn-ghost btn-sm" href="/fondatrices/journal">
                Effacer
              </Link>
            )}
            {viewerCan(v, "audit.export") && (
              <a className="btn btn-ghost btn-sm" href={`/fondatrices/journal/export${base ? "?" + base : ""}`} download>
                <Icon name="arrow-r" />
                Export CSV
              </a>
            )}
          </div>
        </form>

        {entry && (
          <section className="card sec-entry" aria-labelledby="entry-h" style={{ marginTop: 18 }}>
            <div className="card-h">
              <h2 id="entry-h">{entry.summary}</h2>
              <Link className="link" href={`/fondatrices/journal${base ? "?" + base : ""}`}>
                Fermer <Icon name="x" />
              </Link>
            </div>
            <div className="kv">
              <span>Action</span>
              <b>
                {auditLabel(entry.action)} <code>{entry.action}</code>
              </b>
            </div>
            <div className="kv">
              <span>Par</span>
              <b>{who(entry.actorId)}</b>
            </div>
            <div className="kv">
              <span>Quand</span>
              <b>
                {dayMonthShort(entry.createdAt)} · {hour(entry.createdAt)} <code>{entry.createdAt}</code>
              </b>
            </div>
            <div className="kv">
              <span>Cible</span>
              <b>
                {entry.targetType}
                {entry.targetId ? ` · ${names.get(entry.targetId) ?? entry.targetId}` : ""}
              </b>
            </div>
            <div className="kv" style={{ gridTemplateColumns: "1fr" }}>
              <span>Détails</span>
              <pre className="sec-json">{JSON.stringify(entry.details, null, 2)}</pre>
            </div>
          </section>
        )}

        <section className="card" style={{ marginTop: 18 }}>
          <div className="card-h">
            <h2>
              {log.length} opération{log.length > 1 ? "s" : ""}
              {filtered ? " trouvée" + (log.length > 1 ? "s" : "") : ""}
            </h2>
            <span className="muted">Le journal ne se modifie ni ne s’efface.</span>
          </div>
          <ul className="log">
            {log.map((e) => {
              const name = who(e.actorId);
              return (
                <li key={e.id} className={e.id === selected ? "on" : undefined}>
                  <Avatar name={name} founder={e.actorId ? Boolean(profiles.find((p) => p.id === e.actorId)?.roles.includes("admin")) : false} />
                  <Link href={withEntry(e.id)} className="sec-log-link" scroll={false}>
                    <b>{e.summary}</b>
                    <span>
                      {auditLabel(e.action)} · par {name}
                    </span>
                  </Link>
                  <time dateTime={e.createdAt}>
                    {dayMonthShort(e.createdAt)} · {hour(e.createdAt)}
                  </time>
                </li>
              );
            })}
            {!log.length && <li className="empty">{filtered ? "Aucune opération ne correspond à ces filtres." : "Le journal est vide."}</li>}
          </ul>
        </section>
      </div>
    </Screen>
  );
}
