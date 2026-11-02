import type { Metadata } from "next";
import Link from "next/link";
import { ContactsTable, type TableRow } from "@/components/crm/ContactsTable";
import { SaveSegmentButton } from "@/components/crm/SegmentButtons";
import { Icon } from "@/components/ui/Icon";
import { daysBetween, ymdOf } from "@/lib/clock";
import { ymdShort, ymdShortYear } from "@/lib/format";
import { allTags, describeFilter, filterFromParams, filterRows, filterToQuery, findDuplicates, isEmptyFilter } from "@/lib/modules/crm/domain";
import { loadCrm, ownerName } from "@/lib/modules/crm/load";
import { CONTACT_SOURCES, CONTACT_STATUSES, SOURCE_LABEL, STATUS_LABEL, type ContactRow } from "@/lib/modules/crm/types";

export const metadata: Metadata = { title: "Contacts" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SP> };

const SORTS: Record<string, { label: string; cmp: (a: ContactRow, b: ContactRow) => number }> = {
  name: { label: "Contact", cmp: (a, b) => a.name.localeCompare(b.name, "fr") },
  status: { label: "Statut", cmp: (a, b) => STATUS_LABEL[a.status].localeCompare(STATUS_LABEL[b.status], "fr") || a.name.localeCompare(b.name, "fr") },
  last: { label: "Dernier échange", cmp: (a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "") },
  created: { label: "Ajout", cmp: (a, b) => b.contact.createdAt.localeCompare(a.contact.createdAt) },
  exp: { label: "Adhésion · étape", cmp: (a, b) => (a.planEndsAt ?? "9999").localeCompare(b.planEndsAt ?? "9999") },
};

const PAGE = 150;

/** Contacts : filtres combinables, segments, sélection et actions groupées, import / export CSV. */
export default async function ContactsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { rows, data, owners, today } = await loadCrm();
  const filter = filterFromParams(sp);
  const segId = typeof sp.seg === "string" ? sp.seg : null;
  const segment = segId ? data.segments.find((s) => s.id === segId) ?? null : null;
  const sortKey = typeof sp.sort === "string" && SORTS[sp.sort] ? sp.sort : "name";
  const limit = Math.min(5000, Math.max(PAGE, Number(sp.n) || PAGE));
  const list = filterRows(rows, filter, today).sort(SORTS[sortKey].cmp);
  const shown = list.slice(0, limit);
  const query = filterToQuery(filter);
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(query);
    if (segId) p.set("seg", segId);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  };
  const dups = findDuplicates(rows).length;
  const stages = new Map(data.stages.map((s) => [s.id, s.label]));
  const chips = describeFilter(filter, {
    owner: (id) => ownerName(owners, id),
    stage: (id) => stages.get(id) ?? "?",
    status: (s) => STATUS_LABEL[s],
    source: (s) => SOURCE_LABEL[s],
  });

  const tableRows: TableRow[] = shown.map((r) => ({
    id: r.contact.id,
    name: r.name,
    firstName: r.profile?.firstName || r.contact.firstName,
    sub: [r.organizationName, r.contact.job ?? r.profile?.job].filter(Boolean).join(" · "),
    email: r.email,
    phone: r.phone,
    status: r.status,
    source: SOURCE_LABEL[r.contact.source],
    tags: r.contact.tags,
    owner: ownerName(owners, r.contact.ownerId),
    account: !!r.profile,
    consent: r.contact.marketingConsent,
    where:
      r.planEndsAt && (r.status === "adherente" || r.status === "ancienne")
        ? `${r.status === "adherente" ? "jusqu’au" : "échue le"} ${ymdShortYear(r.planEndsAt)}`
        : r.stage
          ? r.stage.label
          : "—",
    last: r.lastActivityAt ? (daysBetween(ymdOf(r.lastActivityAt), today) === 0 ? "aujourd’hui" : ymdShort(ymdOf(r.lastActivityAt))) : "—",
  }));
  const sortLinks = [
    { key: "name", className: "" },
    { key: "status", className: "" },
    { key: "source", label: "Source", className: "hide-m" },
    { key: "tags", label: "Étiquettes", className: "hide-m" },
    { key: "owner", label: "Suivi par", className: "hide-m" },
    { key: "exp", className: "hide-m" },
    { key: "last", className: "hide-m" },
  ].map((c) => ({
    key: c.key,
    label: c.label ?? SORTS[c.key].label,
    href: SORTS[c.key] ? `?${qs({ sort: c.key })}` : "",
    on: sortKey === c.key,
    className: c.className,
  }));

  const sel = (name: string, value: string | undefined, options: Array<[string, string]>, label: string) => (
    <label className="cf">
      <span>{label}</span>
      <select name={name} defaultValue={value ?? ""}>
        <option value="">Tous</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <div className="crm-head">
        <div>
          <div className="eyebrow">
            {list.length} contact{list.length > 1 ? "s" : ""}
            {list.length !== rows.length ? ` sur ${rows.length}` : ""}
          </div>
          <h1>{segment ? segment.name : "Contacts"}</h1>
        </div>
        <div className="actions">
          {dups > 0 && (
            <Link className="btn btn-ghost btn-sm" href="/fondatrices/crm/contacts/doublons">
              {dups} doublon{dups > 1 ? "s" : ""} probable{dups > 1 ? "s" : ""}
            </Link>
          )}
          <Link className="btn btn-ghost btn-sm" href="/fondatrices/crm/import">
            Importer
          </Link>
          <a className="btn btn-ghost btn-sm" href={`/fondatrices/crm/export?${query}`}>
            Exporter
          </a>
          <Link className="btn btn-ink btn-sm" href="/fondatrices/crm/contacts/nouveau">
            <Icon name="plus" />
            Nouveau contact
          </Link>
        </div>
      </div>

      {data.segments.length > 0 && (
        <nav className="seg-row" aria-label="Segments enregistrés">
          <Link href="/fondatrices/crm/contacts" className={"seg-chip" + (!segId && isEmptyFilter(filter) ? " on" : "")}>
            Tous <b>{rows.length}</b>
          </Link>
          {data.segments.map((s) => (
            <Link key={s.id} href={`/fondatrices/crm/contacts?${filterToQuery(s.filters)}&seg=${s.id}`} className={"seg-chip" + (s.id === segId ? " on" : "")}>
              {s.name} <b>{filterRows(rows, s.filters, today).length}</b>
            </Link>
          ))}
        </nav>
      )}

      <section className="card">
        <form action="/fondatrices/crm/contacts" role="search">
          <div className="cfilters">
            <label className="search">
              <Icon name="search" />
              <input name="q" defaultValue={filter.q ?? ""} placeholder="Nom, e-mail, société, étiquette… ( / )" aria-label="Chercher" autoComplete="off" data-crm-search />
            </label>
            {sel("status", filter.status?.join(","), CONTACT_STATUSES.map((s) => [s, STATUS_LABEL[s]]), "Statut")}
            {sel("source", filter.source?.join(","), CONTACT_SOURCES.map((s) => [s, SOURCE_LABEL[s]]), "Source")}
            {sel("tag", filter.tags?.[0], allTags(data.contacts).map((t) => [t, "#" + t]), "Étiquette")}
            {sel("owner", filter.owner, [...owners.map((o): [string, string] => [o.id, o.first]), ["none", "Sans responsable"]], "Suivi par")}
            {sel("stage", filter.stage, data.stages.map((s): [string, string] => [s.id, s.label]), "Étape")}
            <button className="btn btn-ink btn-sm">Filtrer</button>
          </div>
          <details className="cmore" open={filter.expiresWithin !== undefined || filter.lapsedYear !== undefined || !!filter.eventNoMembership || filter.quietDays !== undefined || filter.consent !== undefined || filter.hasAccount !== undefined}>
            <summary>
              Plus de filtres <Icon name="chev-d" />
            </summary>
            <div className="cgrid">
              <label className="cf">
                <span>Adhésion qui expire dans (jours)</span>
                <input className="ci" type="number" min={0} max={400} name="exp" defaultValue={filter.expiresWithin ?? ""} placeholder="ex. 30" />
              </label>
              <label className="cf">
                <span>Anciennes membres de l’année</span>
                <input className="ci" type="number" min={2015} max={2100} name="lapsed" defaultValue={filter.lapsedYear ?? ""} placeholder="ex. 2025" />
              </label>
              <label className="cf">
                <span>Sans échange depuis (jours)</span>
                <input className="ci" type="number" min={1} max={3650} name="quiet" defaultValue={filter.quietDays ?? ""} placeholder="ex. 60" />
              </label>
              {sel("consent", filter.consent === undefined ? undefined : filter.consent ? "1" : "0", [["1", "Accepte les messages"], ["0", "Sans consentement"]], "Consentement")}
              {sel("account", filter.hasAccount === undefined ? undefined : filter.hasAccount ? "1" : "0", [["1", "Avec compte appli"], ["0", "Sans compte"]], "Compte")}
              <label className="check" style={{ alignSelf: "end", height: 38 }}>
                <input type="checkbox" name="evt" value="1" defaultChecked={!!filter.eventNoMembership} />
                Venues à un événement sans adhérer
              </label>
            </div>
          </details>
        </form>

        {chips.length > 0 && (
          <div className="fchips">
            {chips.map((c) => (
              <span key={c} className="fchip">
                {c}
              </span>
            ))}
            <Link href="/fondatrices/crm/contacts" className="link" style={{ fontSize: 14 }}>
              Effacer
            </Link>
            {!segment && <SaveSegmentButton filters={filter} />}
          </div>
        )}

        <ContactsTable rows={tableRows} owners={owners} tags={allTags(data.contacts)} today={today} sortLinks={sortLinks} />

        <div className="list-foot">
          <span>
            {shown.length < list.length ? `${shown.length} affichés sur ${list.length}` : `${list.length} contact${list.length > 1 ? "s" : ""}`} · <kbd className="k">j</kbd> <kbd className="k">k</kbd> pour parcourir, <kbd className="k">x</kbd> pour
            sélectionner
          </span>
          {shown.length < list.length && (
            <Link className="btn btn-ghost btn-sm" href={`?${qs({ n: String(limit + PAGE), sort: sortKey })}`} scroll={false}>
              Afficher plus
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
