import Link from "next/link";
import type { OrgEntry } from "@/lib/org-space";
import type { Organization, OrganizationMemberRole, PartnerOffer, Place } from "@/lib/types";
import type { OrganizationMemberView } from "@/lib/data/repo";
import { fullName } from "@/lib/format";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";

const STATUS: Record<Organization["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "chip solid" },
  pending: { label: "En attente de validation", cls: "chip gold" },
  suspended: { label: "Suspendue", cls: "chip rose" },
};

const MEMBER_ROLE: Record<OrganizationMemberRole, string> = { owner: "Propriétaire", staff: "Équipe" };

/** Carte de présentation d'un établissement (accueil des espaces Partenaire et Pro). */
export function OrgCard({ entry, href }: { entry: OrgEntry; href: string }) {
  const o = entry.organization;
  return (
    <section className="card org-card">
      <div>
        <div className="eyebrow">{o.category}</div>
        <h2>{o.name}</h2>
        {o.description && <p className="muted" style={{ margin: 0 }}>{o.description}</p>}
        <div className="org-meta">
          {(o.address || o.area) && (
            <span>
              <Icon name="pin" />
              {[o.address, o.area].filter(Boolean).join(", ")}
            </span>
          )}
          {o.phone && (
            <span>
              <Icon name="phone" />
              {o.phone}
            </span>
          )}
          {o.instagram && (
            <span>
              <Icon name="globe" />
              {o.instagram}
            </span>
          )}
          <span>
            <Icon name="user" />
            {entry.role ? MEMBER_ROLE[entry.role] : "Accès administratrice"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
        <span className={STATUS[o.status].cls}>{STATUS[o.status].label}</span>
        <Link className="btn btn-ghost btn-sm" href={href}>
          Voir la fiche <Icon name="arrow-r" />
        </Link>
      </div>
    </section>
  );
}

/** Fiche détaillée d'un établissement et son équipe. */
export function OrgDetails({ o, members, place, offers }: { o: Organization; members: OrganizationMemberView[]; place: Place | null; offers: PartnerOffer[] }) {
  const rows: Array<[string, string | null]> = [
    ["Catégorie", o.category || null],
    ["Type", o.kinds.map((k) => (k === "partner" ? "Partenaire (offres)" : "Professionnelle du carnet")).join(" · ")],
    ["Adresse", o.address],
    ["Quartier", o.area],
    ["Coordonnées", o.lat != null && o.lng != null ? `${o.lat.toFixed(4)}, ${o.lng.toFixed(4)}` : null],
    ["Contact", o.contactName],
    ["Téléphone", o.phone],
    ["E-mail", o.email],
    ["Site", o.website],
    ["Instagram", o.instagram],
    ["Dans le carnet", place ? `${place.name} (${place.area})` : null],
  ];
  return (
    <div className="f-grid">
      <section className="card">
        <div className="card-h">
          <h2>{o.name}</h2>
          <span className={STATUS[o.status].cls}>{STATUS[o.status].label}</span>
        </div>
        {o.description && <p className="muted">{o.description}</p>}
        <dl className="org-kv">
          {rows.map(([k, val]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{val ?? <span className="muted">À compléter</span>}</dd>
            </div>
          ))}
        </dl>
        <p className="rule" style={{ marginTop: 18 }}>
          <Icon name="edit" />
          <span>La modification de la fiche par l’établissement arrive avec le lot 3. En attendant, écris à Julia et Nora.</span>
        </p>
      </section>
      <div className="f-col">
        <section className="card">
          <div className="card-h">
            <h2>Équipe</h2>
          </div>
          <ul className="log">
            {members.map((m) => {
              const n = m.profile ? fullName(m.profile) : "Membre de l’équipe";
              return (
                <li key={m.profileId}>
                  <Avatar name={n} />
                  <span>
                    <b>{n}</b>
                    <span>{MEMBER_ROLE[m.role]}</span>
                  </span>
                  <span />
                </li>
              );
            })}
          </ul>
        </section>
        {o.kinds.includes("partner") && (
          <section className="card">
            <div className="card-h">
              <h2>Offre aux membres</h2>
            </div>
            {offers.length ? (
              offers.map((of) => (
                <div key={of.id} className="offer" style={{ cursor: "default" }}>
                  <span className="o-badge">{of.badge}</span>
                  <span>
                    <b>{of.partner}</b>
                    <span>{of.detail}</span>
                  </span>
                </div>
              ))
            ) : (
              <div className="empty">Aucune offre en ligne pour l’instant.</div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
