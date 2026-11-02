import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/lancement/SignupForm";
import { getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { pendingReferralCode } from "@/lib/modules/engagement/referral";
import { inCircle } from "@/lib/permissions";
import "@/styles/lancement.css";

export const metadata: Metadata = {
  title: "Créer mon compte",
  description: "Rejoins le Nomad Club à Marrakech : crée ton compte gratuit ou demande ton adhésion en deux minutes.",
};
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ parcours?: string; invitation?: string }> };

/** Vague 2 — Inscription : fiche, CGU, choix compte gratuit / adhésion, puis lien magique. */
export default async function SignupPage({ searchParams }: Props) {
  const { parcours, invitation } = await searchParams;
  const viewer = await getViewer();
  const token = invitation && /^[0-9a-f]{48}$/.test(invitation) ? invitation : null;
  if (viewer.mode === "real" && viewer.profile) {
    if (token) redirect(`/invitation/${token}`);
    redirect(inCircle(viewer.profile) ? "/espace" : parcours === "adhesion" ? "/candidature" : "/connexion");
  }
  const repo = getRepo();
  const [settings, preview] = await Promise.all([repo.getLancementSettings(), token ? repo.previewRoleInvitation(token) : Promise.resolve(null)]);
  return (
    <div className="vscreen on">
      <section className="vsec">
        <div className="wrap">
          <div className="card lc-card">
            <div className="eyebrow">{preview ? "Invitation" : "Bienvenue"}</div>
            <h1 className="sh-title" style={{ fontSize: 38 }}>
              Créer mon compte
            </h1>
            <p className="sh-sub">
              {viewer.mode === "demo"
                ? "Aperçu avec des données d’exemple : le formulaire est vérifié, mais aucun compte n’est créé."
                : preview
                  ? "Crée ton compte avec l’adresse invitée : ton accès s’ouvre dès ta première connexion."
                  : settings.membershipMode === "validation"
                    ? "Deux minutes pour créer ton compte. L’adhésion se fait sur candidature, examinée par Julia et Nora."
                    : "Deux minutes pour créer ton compte, gratuit ou membre."}
            </p>
            <SignupForm
              parrain={await pendingReferralCode()}
              path={parcours === "adhesion" ? "apply" : "free"}
              invitation={preview?.state === "open" ? token : null}
              emailHint={preview?.state === "open" ? preview.emailHint : null}
              applyLabel={settings.membershipMode === "validation" ? "Demander l’adhésion" : "Adhérer au club"}
            />
            <p className="fine">
              Déjà un compte ? <Link href="/connexion">Me connecter</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
