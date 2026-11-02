import Link from "next/link";
import "@/styles/partenaires.css";
import type { OrganizationMemberView } from "@/lib/data/repo";
import { fullName, monthShortName, num } from "@/lib/format";
import { AUDIENCE_LABEL } from "@/lib/modules/partenaires/domain";
import type { MonthlyStats, Offer, OfferStats, OrgInvite } from "@/lib/modules/partenaires/types";
import type { OrgEntry } from "@/lib/org-space";
import { ymdLong } from "@/lib/format";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { InviteForm, OfferStatusButton } from "./OrgForms";

const monthLabel = (m: string) => monthShortName(Number(m.slice(5, 7)) - 1);

/** Choix de l'établissement quand on en gère plusieurs (ou en tant qu'administratrice). */
export function OrgPicker({ orgs, current, base }: { orgs: OrgEntry[]; current: string | null; base: string }) {
  if (orgs.length < 2) return null;
  return (
    <nav className="seg-chips org-pick" aria-label="Établissement">
      {orgs.map((o) => (
        <Link key={o.organization.id} href={`${base}?org=${o.organization.id}`} className={"seg-chip" + (o.organization.id === current ? " on" : "")}>
          {o.organization.name}
        </Link>
      ))}
    </nav>
  );
}

export function NoOrg() {
  return (
    <div className="empty">
      <Icon name="pin" />
      Aucun établissement n’est encore relié à ton compte. Julia et Nora s’en occupent.
    </div>
  );
}

export function Kpi({ label, icon, value, sub }: { label: string; icon: Parameters<typeof Icon>[0]["name"]; value: number | string; sub?: string }) {
  return (
    <div className="card p-kpi">
      <div className="lbl">
        <Icon name={icon} />
        {label}
      </div>
      <div className="val">{typeof value === "number" ? num(value) : value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

const trend = (cur: number, prev: number) => (prev ? `${cur >= prev ? "+" : ""}${Math.round(((cur - prev) / prev) * 100)} % vs mois dernier` : "Premier mois");

/** Indicateurs du mois en cours (vues, codes ou clics). */
export function MonthKpis({ rows, mode, offersActive }: { rows: MonthlyStats[]; mode: "partner" | "pro"; offersActive?: number }) {
  const cur = rows[rows.length - 1];
  const prev = rows[rows.length - 2] ?? cur;
  if (!cur) return null;
  return mode === "partner" ? (
    <div className="p-kpis">
      <Kpi icon="user" label="Vues de la fiche" value={cur.views} sub={trend(cur.views, prev.views)} />
      <Kpi icon="ticket" label="Codes générés" value={cur.codesGenerated} sub={trend(cur.codesGenerated, prev.codesGenerated)} />
      <Kpi icon="check" label="Codes validés" value={cur.codesValidated} sub={cur.codesGenerated ? `${Math.round((cur.codesValidated / cur.codesGenerated) * 100)} % des codes` : "—"} />
      <Kpi icon="gift" label="Offres en ligne" value={offersActive ?? 0} />
    </div>
  ) : (
    <div className="p-kpis">
      <Kpi icon="user" label="Vues de la fiche" value={cur.views} sub={trend(cur.views, prev.views)} />
      <Kpi icon="phone" label="Clics contact" value={cur.contactClicks} sub="Téléphone, e-mail, site" />
      <Kpi icon="chat" label="Clics WhatsApp" value={cur.whatsappClicks} sub={trend(cur.whatsappClicks, prev.whatsappClicks)} />
      <Kpi icon="arrow-r" label="Itinéraires" value={cur.directionsClicks} sub={trend(cur.directionsClicks, prev.directionsClicks)} />
    </div>
  );
}

/** Statistiques par mois : barres + tableau. */
export function StatsBlock({ rows, mode }: { rows: MonthlyStats[]; mode: "partner" | "pro" }) {
  const series: Array<{ key: keyof MonthlyStats; label: string; cls: string }> =
    mode === "partner"
      ? [
          { key: "views", label: "Vues de la fiche", cls: "" },
          { key: "codesGenerated", label: "Codes générés", cls: "b3" },
          { key: "codesValidated", label: "Codes validés", cls: "b2" },
        ]
      : [
          { key: "views", label: "Vues de la fiche", cls: "" },
          { key: "whatsappClicks", label: "WhatsApp", cls: "b2" },
          { key: "contactClicks", label: "Contact", cls: "b3" },
        ];
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => Number(r[s.key]))));
  const cols: Array<{ key: keyof MonthlyStats; label: string }> =
    mode === "partner"
      ? [
          { key: "views", label: "Vues" },
          { key: "codesGenerated", label: "Codes" },
          { key: "codesValidated", label: "Validés" },
          { key: "directionsClicks", label: "Itinéraires" },
        ]
      : [
          { key: "views", label: "Vues" },
          { key: "contactClicks", label: "Contact" },
          { key: "whatsappClicks", label: "WhatsApp" },
          { key: "directionsClicks", label: "Itinéraires" },
        ];
  const total = (k: keyof MonthlyStats) => rows.reduce((a, r) => a + Number(r[k]), 0);
  return (
    <section className="card">
      <div className="card-h">
        <h2>Mois par mois</h2>
        <span className="muted">6 derniers mois</span>
      </div>
      <div className="stat-bars" role="img" aria-label="Graphique des statistiques par mois">
        {rows.map((r, i) => (
          <div key={r.month} className="col">
            <b>{num(r.views)}</b>
            <div className="bars">
              {series.map((s) => (
                <i key={s.key} className={s.cls} style={{ height: `${Math.max(2, (Number(r[s.key]) / max) * 100)}%`, animationDelay: `${i * 0.05}s` }} title={`${s.label} : ${r[s.key]}`} />
              ))}
            </div>
            <span>{monthLabel(r.month)}</span>
          </div>
        ))}
      </div>
      <div className="stat-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i className={s.cls} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="table-scroll">
        <table className="stat-table">
          <thead>
            <tr>
              <th>Mois</th>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td>
                  {monthLabel(r.month)} {r.month.slice(0, 4)}
                </td>
                {cols.map((c) => (
                  <td key={c.key}>{num(Number(r[c.key]))}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td>Total</td>
              {cols.map((c) => (
                <td key={c.key}>{num(total(c.key))}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Liste des offres d'un établissement (avec pause / reprise et lien d'édition). */
export function OffersList({ offers, stats, orgId, compact }: { offers: Offer[]; stats: OfferStats[]; orgId: string; compact?: boolean }) {
  if (!offers.length) return <div className="empty">Aucune offre pour l’instant. Crée la première : elle sera visible tout de suite par les membres.</div>;
  return (
    <div>
      {offers.map((o) => {
        const st = stats.find((s) => s.offerId === o.id);
        return (
          <div key={o.id} className={"offer-row" + (o.status === "paused" ? " paused" : "")}>
            <span className="o-badge">{o.badge}</span>
            <span>
              <b>{o.title}</b>
              <span className="meta">
                <span>{o.status === "paused" ? "En pause" : "En ligne"}</span>
                <span>{AUDIENCE_LABEL[o.audience]}</span>
                {o.validUntil && <span>Jusqu’au {ymdLong(o.validUntil)}</span>}
                {st && (
                  <span>
                    {num(st.generated)} codes · {num(st.validated)} validés
                  </span>
                )}
              </span>
            </span>
            {!compact && (
              <span className="acts">
                <Link className="btn btn-ghost btn-xs" href={`/partenaire/offres/${o.id}?org=${orgId}`}>
                  <Icon name="edit" />
                  Modifier
                </Link>
                <OfferStatusButton offerId={o.id} paused={o.status === "paused"} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ROLE: Record<string, string> = { owner: "Propriétaire", staff: "Équipe" };

/** Équipe de l'établissement, invitations en attente, formulaire d'invitation (propriétaire). */
export function TeamCard({ members, invites, orgId, canInvite }: { members: OrganizationMemberView[]; invites: OrgInvite[]; orgId: string; canInvite: boolean }) {
  const pending = invites.filter((i) => !i.acceptedAt);
  return (
    <section className="card">
      <div className="card-h">
        <h2>Équipe</h2>
        <span className="muted">{members.length} personne{members.length > 1 ? "s" : ""}</span>
      </div>
      {members.map((m) => {
        const n = m.profile ? fullName(m.profile) : "Membre de l’équipe";
        return (
          <div key={m.profileId} className="team-li">
            <Avatar name={n} />
            <span>
              <b>{n}</b>
              <span>{m.profile?.email ?? ""}</span>
            </span>
            <span className={m.role === "owner" ? "chip solid" : "chip"}>{ROLE[m.role]}</span>
          </div>
        );
      })}
      {pending.map((i) => (
        <div key={i.id} className="team-li">
          <Avatar name={i.email} />
          <span>
            <b>{i.email}</b>
            <span>Invitée le {new Date(i.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
          </span>
          <span className="chip gold">En attente</span>
        </div>
      ))}
      {canInvite ? <InviteForm organizationId={orgId} /> : <p className="muted" style={{ fontSize: 14, margin: "12px 0 0" }}>Seule la propriétaire invite de nouvelles personnes.</p>}
    </section>
  );
}
