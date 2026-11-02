import type { Metadata } from "next";
import { FHead } from "@/components/founders/parts";
import { ApplicationsBoard, MembershipModeSwitch } from "@/components/lancement/Admin";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";

export const metadata: Metadata = { title: "Candidatures" };
export const dynamic = "force-dynamic";

/** Vague 2 — Candidatures d'adhésion : accepter (la personne choisit sa formule et paie) ou refuser avec un message. */
export default async function ApplicationsPage() {
  await requireCapability("members.manage", { next: "/fondatrices/candidatures" });
  const repo = getRepo();
  const [apps, settings] = await Promise.all([repo.listApplications(), repo.getLancementSettings()]);
  const pending = apps.filter((a) => a.status === "pending").length;
  return (
    <Screen group="founders" index={2} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Candidatures" sub={pending ? `${pending} demande${pending > 1 ? "s" : ""} en attente` : "Demandes d’adhésion"} />
        <section className="card" aria-labelledby="mode-h">
          <div className="card-h">
            <h2 id="mode-h">Mode d’adhésion</h2>
            <span className="muted">{settings.membershipMode === "validation" ? "Candidature puis paiement" : "Paiement direct"}</span>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Sur validation : une nouvelle personne dépose une candidature ; une fois acceptée, elle choisit sa formule et paie. Directe : elle paie tout de suite depuis la page des formules.
          </p>
          <MembershipModeSwitch mode={settings.membershipMode} />
        </section>
        <section className="card" aria-labelledby="apps-h" style={{ marginTop: 22 }}>
          <div className="card-h">
            <h2 id="apps-h">À examiner</h2>
            <span className="muted">Chaque décision est journalisée et notée sur la fiche CRM</span>
          </div>
          <ApplicationsBoard apps={apps} />
        </section>
      </div>
    </Screen>
  );
}
