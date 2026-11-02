import type { Metadata } from "next";
import { ContractsTabs } from "@/components/contrats/AdminTabs";
import { GenerateContractForm } from "@/components/contrats/admin";
import { FHead } from "@/components/founders/parts";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { fullName } from "@/lib/format";
import { MEMBERSHIP_PLAN_INFO, PARTNER_PLAN_INFO } from "@/lib/modules/contrats/domain";
import { PRO_PLAN_KEYS, PRO_PLANS } from "@/lib/modules/partenaires/domain";

export const metadata: Metadata = { title: "Générer un contrat" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ profil?: string; org?: string; type?: string }> };

/** Vague 2 · Contrats — génération manuelle (contrat partenaire préparé par les fondatrices, régularisation…). */
export default async function NewContractPage({ searchParams }: Props) {
  await requireCapability("contracts.manage", { next: "/fondatrices/contrats/nouveau" });
  const sp = await searchParams;
  const repo = getRepo();
  const [profiles, orgs] = await Promise.all([repo.listProfiles(), repo.listOrganizations()]);
  const teams = await Promise.all(orgs.map(async (o) => ({ o, team: (await repo.listOrganizationMembers(o.id)).map((m) => m.profileId) })));
  const people = profiles
    .filter((p) => p.firstName)
    .map((p) => ({ id: p.id, label: `${fullName(p).trim()}${p.email ? ` · ${p.email}` : ""}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  const plans = {
    membership: Object.values(MEMBERSHIP_PLAN_INFO).map((p) => ({ id: p.code, label: p.label })),
    partner: [{ id: PARTNER_PLAN_INFO.code, label: PARTNER_PLAN_INFO.label }],
    pro: PRO_PLAN_KEYS.map((k) => ({ id: k, label: `${PRO_PLANS[k].label} · ${PRO_PLANS[k].price} / mois` })),
  };
  const kind = sp.type === "partner" || sp.type === "pro" || sp.type === "membership" ? sp.type : undefined;
  return (
    <Screen group="founders" index={14} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Générer un contrat" sub="Le contrat part « à accepter » chez la signataire" />
        <ContractsTabs on="new" />
        <section className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Les contrats d’adhésion et d’abonnement pro se génèrent automatiquement à la souscription. Utilisez ce formulaire pour un contrat partenaire ou une régularisation : la signataire est prévenue et l’accepte depuis son espace.
          </p>
          <GenerateContractForm
            people={people}
            orgs={teams.map(({ o, team }) => ({ id: o.id, label: o.name, kinds: o.kinds, team }))}
            plans={plans}
            today={today()}
            defaults={{ kind, profileId: sp.profil, organizationId: sp.org }}
          />
        </section>
      </div>
    </Screen>
  );
}
