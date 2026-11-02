import { FHead } from "@/components/founders/parts";
import { NoOrg, OrgPicker } from "@/components/partenaires/OrgBlocks";
import { Screen } from "@/components/ui/Screen";
import { getRepo } from "@/lib/data";
import { loadOrgContext } from "@/lib/modules/partenaires/server";
import { KIND_LONG } from "@/lib/modules/contrats/labels";
import { toMyItems } from "@/lib/modules/contrats/views";
import type { OrganizationKind } from "@/lib/types";
import { Icon } from "../ui/Icon";
import { MyContracts } from "./MyContracts";
import { PrepareContractButton } from "./PrepareContractButton";
import "@/styles/contrats.css";

const BASE: Record<OrganizationKind, string> = { partner: "/partenaire/contrats", pro: "/pro/contrats" };

/** « Contrats » des espaces Partenaire et Pro : contrats de l'établissement, acceptation, PDF, certificat. */
export async function OrgContractsScreen({ kind, org, index }: { kind: OrganizationKind; org?: string; index: number }) {
  const base = BASE[kind];
  const { viewer, orgs, entry, asAdmin } = await loadOrgContext(kind, base, org);
  const repo = getRepo();
  const orgId = entry?.organization.id ?? null;
  const all = asAdmin ? await repo.listContracts({ kind, organizationId: orgId ?? undefined }) : await repo.listMyContracts(viewer.profile.id);
  const list = all.filter((c) => c.kind === kind && (!orgId || c.organizationId === orgId));
  const covered = list.some((c) => c.status !== "cancelled");
  const sub = kind === "pro" && orgId ? await repo.getSubscription(orgId) : null;
  const canSign = !asAdmin && !!orgId;
  return (
    <Screen group={kind} index={index} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Contrats" sub={entry ? entry.organization.name : KIND_LONG[kind]} />
        <OrgPicker orgs={orgs} current={orgId} base={base} />
        {!entry ? (
          <NoOrg />
        ) : (
          <div className="f-col">
            <section className="card">
              <div className="card-h">
                <h2>{KIND_LONG[kind]}</h2>
              </div>
              <MyContracts items={toMyItems(list, base)} empty="Aucun contrat pour cet établissement pour l’instant." />
              {canSign && !covered && (kind === "partner" || sub) && (
                <div style={{ marginTop: 14 }}>
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    {kind === "partner" ? "Le contrat de partenariat encadre tes offres aux membres. Lis-le et accepte-le en ligne." : "Ton abonnement au carnet n’a pas encore de contrat accepté."}
                  </p>
                  <PrepareContractButton request={kind === "partner" ? { kind: "partner", plan: "partenaire", organizationId: orgId } : { kind: "pro", plan: sub!.plan, organizationId: orgId }} label="Lire et accepter le contrat" />
                </div>
              )}
            </section>
            <section className="card">
              <p className="rule" style={{ margin: 0 }}>
                <Icon name="lock" />
                <span>
                  Chaque contrat est accepté en ligne : nous conservons la date, l’heure, l’adresse IP, le navigateur, la version du contrat et l’empreinte numérique du PDF. Le certificat d’acceptation récapitule cette preuve.
                </span>
              </p>
            </section>
          </div>
        )}
      </div>
    </Screen>
  );
}
