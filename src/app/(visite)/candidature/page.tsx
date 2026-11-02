import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withdrawApplicationAction } from "@/app/actions/lancement";
import { ApplicationForm } from "@/components/lancement/ApplicationForm";
import { Icon } from "@/components/ui/Icon";
import { getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { inCircle } from "@/lib/permissions";
import "@/styles/lancement.css";

export const metadata: Metadata = { title: "Candidature", robots: { index: false } };
export const dynamic = "force-dynamic";

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Casablanca" });

/** Vague 2 — Demande d'adhésion (mode « sur validation ») et suivi de sa réponse. */
export default async function ApplicationPage() {
  const viewer = await getViewer();
  if (viewer.mode === "real" && !viewer.profile) redirect("/inscription?parcours=adhesion");
  const repo = getRepo();
  const settings = await repo.getLancementSettings();
  const p = viewer.profile;
  const apps = p ? await repo.listMyApplications(p.id) : [];
  const last = apps[0] ?? null;

  let body: React.ReactNode;
  if (!p) {
    body = (
      <>
        <p className="sh-sub">Dans la vraie appli, une personne connectée dépose ici sa candidature. En démo, ouvre l’espace Fondatrices pour voir la file des candidatures.</p>
        <Link className="btn btn-gold" href="/fondatrices/candidatures">
          Voir les candidatures (Fondatrices)
        </Link>
      </>
    );
  } else if (inCircle(p)) {
    body = (
      <>
        <p className="sh-sub">Tu fais déjà partie du cercle.</p>
        <Link className="btn btn-gold" href="/espace">
          Ouvrir mon espace <Icon name="arrow-r" />
        </Link>
      </>
    );
  } else if (settings.membershipMode === "direct" || last?.status === "accepted") {
    body = (
      <>
        {last?.status === "accepted" && (
          <div className="flash" role="status">
            <Icon name="check" />
            <span>
              Ta candidature est acceptée{last.decidedAt ? ` (${dateFr(last.decidedAt)})` : ""}. Bienvenue !{last.decisionMessage ? ` « ${last.decisionMessage} »` : ""}
            </span>
          </div>
        )}
        <p className="sh-sub">Il ne te reste qu’à choisir ta formule pour activer ton adhésion.</p>
        <Link className="btn btn-gold" href="/formules">
          Choisir ma formule <Icon name="arrow-r" />
        </Link>
      </>
    );
  } else if (last?.status === "pending") {
    body = (
      <>
        <div className="flash" role="status">
          <Icon name="clock" />
          <span>Ta candidature du {dateFr(last.createdAt)} est entre les mains de Julia et Nora. Tu reçois leur réponse par e-mail et dans tes notifications.</span>
        </div>
        <dl className="lc-status" style={{ marginBottom: 18 }}>
          <div>
            <dt className="muted">Métier</dt>
            <dd>{last.job}{last.company ? ` · ${last.company}` : ""}</dd>
          </div>
          <div>
            <dt className="muted">À Marrakech depuis</dt>
            <dd>{last.marrakechSince}</dd>
          </div>
        </dl>
        <form action={withdrawApplicationAction}>
          <button className="lc-link-btn" type="submit">
            Retirer ma candidature
          </button>
        </form>
      </>
    );
  } else {
    body = (
      <>
        {last?.status === "refused" && (
          <div className="flash" role="status">
            <Icon name="bell" />
            <span>
              Réponse des fondatrices à ta précédente demande : « {last.decisionMessage} » Tu peux en déposer une nouvelle si ta situation a changé.
            </span>
          </div>
        )}
        <p className="sh-sub">Quelques mots pour te présenter : Julia et Nora lisent chaque candidature et te répondent rapidement.</p>
        <ApplicationForm job={p.job} marrakechSince={p.marrakechSince} />
      </>
    );
  }

  return (
    <div className="vscreen on">
      <section className="vsec">
        <div className="wrap">
          <div className="card lc-card">
            <div className="eyebrow">Adhésion</div>
            <h1 className="sh-title" style={{ fontSize: 38 }}>
              {p && inCircle(p) ? "Déjà membre" : "Demander l’adhésion"}
            </h1>
            {body}
          </div>
        </div>
      </section>
    </div>
  );
}
