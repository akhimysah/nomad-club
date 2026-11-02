import type { Metadata } from "next";
import Link from "next/link";
import { FHead } from "@/components/founders/parts";
import { RoleChips } from "@/components/founders/RoleChips";
import { SoonCards } from "@/components/org/SoonCards";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { fullName, normalize, PLAN_LABEL, ymdShortYear } from "@/lib/format";
import { hasAnyRole, hasRole, isGuest } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

const SEGMENTS: Array<{ key: string; label: string; test: (p: Profile) => boolean }> = [
  { key: "tous", label: "Tous", test: () => true },
  { key: "adherentes", label: "Adhérentes", test: (p) => hasRole(p, "member") },
  { key: "gratuits", label: "Comptes gratuits", test: isGuest },
  { key: "partenaires", label: "Partenaires", test: (p) => hasRole(p, "partner") },
  { key: "pros", label: "Pros", test: (p) => hasRole(p, "pro") },
  { key: "equipe", label: "Équipe", test: (p) => hasAnyRole(p, ["admin", "moderator"]) },
];

type Props = { searchParams: Promise<{ segment?: string; q?: string }> };

/** CRM (page d'accueil provisoire) : tous les contacts connus, avec leurs rôles. Le vrai CRM arrive au lot 5. */
export default async function CrmPage({ searchParams }: Props) {
  await requireCapability("crm.access", { next: "/fondatrices/crm" });
  const { segment, q } = await searchParams;
  const repo = getRepo();
  const [profiles, orgs] = await Promise.all([repo.listProfiles(), repo.listOrganizations()]);
  const members = (await Promise.all(orgs.map((o) => repo.listOrganizationMembers(o.id)))).flat();
  const orgOf = new Map<string, string[]>();
  members.forEach((m) => orgOf.set(m.profileId, [...(orgOf.get(m.profileId) ?? []), orgs.find((o) => o.id === m.organizationId)?.name ?? ""]));

  const seg = SEGMENTS.find((s) => s.key === segment) ?? SEGMENTS[0];
  const needle = normalize(q ?? "");
  const t = today();
  const rows = profiles
    .filter(seg.test)
    .filter((p) => !needle || normalize(`${fullName(p)} ${p.job ?? ""} ${p.email ?? ""} ${(orgOf.get(p.id) ?? []).join(" ")}`).includes(needle))
    .sort((a, b) => fullName(a).localeCompare(fullName(b), "fr"));
  const href = (key: string) => `/fondatrices/crm?segment=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <Screen group="founders" index={5} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="CRM" sub={`${profiles.length} contacts · ${orgs.length} établissements`} />
        <nav className="seg-chips" aria-label="Segments">
          {SEGMENTS.map((s) => (
            <Link key={s.key} href={href(s.key)} className={"seg-chip" + (s.key === seg.key ? " on" : "")} aria-current={s.key === seg.key ? "page" : undefined}>
              {s.label} <b>{profiles.filter(s.test).length}</b>
            </Link>
          ))}
        </nav>
        <section className="card">
          <form className="search" role="search" action="/fondatrices/crm" style={{ marginBottom: 14 }}>
            <input type="hidden" name="segment" value={seg.key} />
            <Icon name="search" />
            <input name="q" defaultValue={q ?? ""} placeholder="Chercher un nom, un métier, un établissement" autoComplete="off" aria-label="Chercher un contact" />
          </form>
          <div className="crow head">
            <span>Contact</span>
            <span>Rôles</span>
            <span className="c-plan">Formule</span>
            <span className="c-contact-col">Coordonnées</span>
          </div>
          {rows.map((p) => {
            const orgNames = orgOf.get(p.id);
            const expired = p.planEndsAt && p.planEndsAt < t;
            return (
              <div key={p.id} className="crow">
                <span className="who">
                  <Avatar name={fullName(p)} founder={hasRole(p, "admin")} />
                  <span>
                    <b>{fullName(p)}</b>
                    <span>{orgNames?.length ? orgNames.join(", ") : (p.job ?? "—")}</span>
                  </span>
                </span>
                <RoleChips roles={p.roles} />
                <span className="c-plan">
                  {PLAN_LABEL[p.plan]}
                  {p.planEndsAt && <span className="c-contact">{expired ? "échue le " : "jusqu’au "}{ymdShortYear(p.planEndsAt)}</span>}
                </span>
                <span className="c-contact-col">
                  <span className="c-contact">{p.email ?? "—"}</span>
                  <span className="c-contact">{p.whatsapp ?? ""}</span>
                </span>
              </div>
            );
          })}
          {!rows.length && <div className="empty">Aucun contact dans ce segment.</div>}
        </section>
        <h2 className="mini-h" style={{ margin: "30px 0 12px" }}>
          Le CRM complet
        </h2>
        <SoonCards
          items={[
            { icon: "user", title: "Prospects et demandes", text: "Fiches contact uniques, sources, statuts et étiquettes.", lot: "lot 5" },
            { icon: "refresh", title: "Pipeline et relances", text: "Du prospect à l’adhérente, tâches et historique d’échanges.", lot: "lot 5" },
            { icon: "users", title: "Segments et actions", text: "Segments enregistrés et actions groupées.", lot: "lot 5" },
            { icon: "wallet", title: "Statistiques", text: "Conversion, renouvellement, revenus et retombées des deals.", lot: "lot 5" },
          ]}
        />
      </div>
    </Screen>
  );
}
