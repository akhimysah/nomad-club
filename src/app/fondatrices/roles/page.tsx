import type { Metadata } from "next";
import Link from "next/link";
import { FHead } from "@/components/founders/parts";
import { RoleEditor } from "@/components/founders/RoleEditor";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { fullName, messageTime, normalize } from "@/lib/format";
import { CAPABILITIES, GRANTABLE_ROLES, hasRole, ROLE_CAPABILITIES, ROLE_HINT, ROLE_LABEL, type Capability } from "@/lib/permissions";

export const metadata: Metadata = { title: "Rôles et accès" };
export const dynamic = "force-dynamic";

const CAP_LABEL: Record<Capability, string> = {
  "space.member": "Espace membre",
  "space.partner": "Espace partenaire",
  "space.pro": "Espace pro",
  "space.admin": "Espace fondatrices",
  "events.book": "Réserver un rendez-vous",
  "events.manage": "Créer et publier les rendez-vous",
  "payments.validate": "Valider les virements",
  "reminders.send": "Relancer",
  "members.view_directory": "Voir l’annuaire",
  "members.manage": "Gérer les fiches membres",
  "roles.manage": "Gérer les rôles",
  "messages.post": "Écrire au salon et en privé",
  "messages.moderate": "Modérer la messagerie",
  "carnet.view": "Voir le carnet",
  "offers.view": "Voir les offres",
  "offers.manage_own": "Gérer ses offres",
  "offers.manage_all": "Gérer toutes les offres",
  "listing.manage_own": "Gérer sa fiche pro",
  "organizations.manage_own": "Gérer son établissement",
  "organizations.manage_all": "Gérer tous les établissements",
  "crm.access": "CRM",
  "audit.view": "Journal des opérations",
  // --- Lot 4 ---
  "dashboard.customize": "Personnaliser son accueil",
  "shop.buy": "Acheter des ressources",
  "shop.manage": "Gérer la boutique",
  "referral.use": "Parrainer",
  "referral.manage": "Gérer le parrainage",
  "business.use": "Déclarer des deals",
  "business.manage": "Piloter l’Espace Business",
};

type Props = { searchParams: Promise<{ q?: string; tous?: string }> };

/** Rôles et accès : ajouter / retirer des rôles (cumulables), avec la matrice des droits et l'historique. */
export default async function RolesPage({ searchParams }: Props) {
  const v = await requireCapability("roles.manage", { next: "/fondatrices/roles" });
  const { q, tous } = await searchParams;
  const repo = getRepo();
  const [profiles, log] = await Promise.all([repo.listProfiles(), repo.listAudit({ limit: 200 })]);
  const needle = normalize(q ?? "");
  // par défaut : les personnes qui ont un rôle autre que « membre » (équipe, partenaires, pros) ; recherche = tout le monde
  const showAll = Boolean(tous) || Boolean(needle);
  const rows = profiles
    .filter((p) => (showAll ? true : p.roles.some((r) => r !== "member")))
    .filter((p) => !needle || normalize(`${fullName(p)} ${p.job ?? ""} ${p.email ?? ""}`).includes(needle))
    .sort((a, b) => Number(hasRole(b, "admin")) - Number(hasRole(a, "admin")) || fullName(a).localeCompare(fullName(b), "fr"));
  const names = new Map(profiles.map((p) => [p.id, fullName(p)]));
  const roleLog = log.filter((e) => e.action === "role.grant" || e.action === "role.revoke").slice(0, 8);
  const now = nowMs();

  return (
    <Screen group="founders" index={6} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Rôles et accès" sub="Les rôles se cumulent : membre, pro et partenaire à la fois" />
        <section className="card">
          <div className="card-h">
            <h2>{showAll ? `${rows.length} personne${rows.length > 1 ? "s" : ""}` : "Équipe, partenaires et pros"}</h2>
            {showAll && !needle ? (
              <Link className="muted" href="/fondatrices/roles">
                Voir seulement les rôles particuliers
              </Link>
            ) : (
              <Link className="muted" href="/fondatrices/roles?tous=1">
                Voir les {profiles.length} fiches
              </Link>
            )}
          </div>
          <form className="search" role="search" action="/fondatrices/roles" style={{ margin: "10px 0 6px" }}>
            <Icon name="search" />
            <input name="q" defaultValue={q ?? ""} placeholder="Chercher une personne pour lui donner un rôle" autoComplete="off" aria-label="Chercher une personne" />
          </form>
          {rows.map((p) => (
            <div key={p.id} className="rrow">
              <span className="who">
                <Avatar name={fullName(p)} founder={hasRole(p, "admin")} />
                <span>
                  <b>{fullName(p)}</b>
                  <span>{p.job ?? p.email ?? "—"}</span>
                </span>
              </span>
              <RoleEditor key={p.roles.join()} profileId={p.id} name={fullName(p)} initial={p.roles} self={p.id === v.profile.id} />
            </div>
          ))}
          {!rows.length && <div className="empty">Personne ne correspond à cette recherche.</div>}
        </section>

        <section className="card" style={{ marginTop: 22 }}>
          <div className="card-h">
            <h2>Derniers changements</h2>
            <Link className="muted" href="/fondatrices/journal">
              Tout le journal
            </Link>
          </div>
          <ul className="log">
            {roleLog.map((e) => (
              <li key={e.id}>
                <Avatar name={(e.actorId && names.get(e.actorId)) || "Système"} founder />
                <span>
                  <b>{e.summary}</b>
                  <span>par {(e.actorId && names.get(e.actorId)) || "le système"}</span>
                </span>
                <time>{messageTime(e.createdAt, now)}</time>
              </li>
            ))}
            {!roleLog.length && <li className="empty">Aucun changement de rôle.</li>}
          </ul>
        </section>
        <section className="card" style={{ marginTop: 22 }}>
          <div className="card-h">
            <h2>Qui peut faire quoi</h2>
          </div>
          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col">Droit</th>
                  {GRANTABLE_ROLES.map((r) => (
                    <th key={r} scope="col" title={ROLE_HINT[r]}>
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map((c) => (
                  <tr key={c}>
                    <td>{CAP_LABEL[c]}</td>
                    {GRANTABLE_ROLES.map((r) => (
                      <td key={r}>{ROLE_CAPABILITIES[r].includes(c) ? <Icon name="check" /> : <span className="muted">·</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Screen>
  );
}
