import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { SpaceButton } from "@/components/shell/SpaceButton";
import { SPACES } from "@/components/shell/spaces";
import { Icon } from "@/components/ui/Icon";
import { LoginForm } from "@/components/visit/LoginForm";
import { getViewer, viewerCan, viewerSpaces } from "@/lib/auth";
import { fullName, PLAN_LABEL } from "@/lib/format";
import { pendingReferralCode } from "@/lib/modules/engagement/referral"; // --- Lot 4 ---
import { ROLE_LABEL, SPACE_ORDER, spaceOfPath } from "@/lib/permissions";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ suite?: string; erreur?: string; adhesion?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { suite, erreur, adhesion } = await searchParams;
  const next = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/espace";
  const viewer = await getViewer();
  const spaces = viewerSpaces(viewer);
  return (
    <div className="vscreen on">
      <section className="vsec">
        <div className="wrap">
          <div className="card login-card">
            <div className="eyebrow">Espace adhérentes</div>
            <h1 className="sh-title" style={{ fontSize: 38 }}>
              Connexion
            </h1>
            {adhesion === "merci" && (
              <div className="flash">
                <Icon name="check" />
                Merci ! Ton paiement est bien reçu. Ton adhésion s’active dans un instant : connecte-toi avec ton e-mail pour ouvrir ton espace.
              </div>
            )}
            {viewer.mode === "demo" ? (
              <>
                <p className="sh-sub">
                  Ceci est un aperçu avec des données d’exemple : pas besoin de te connecter. Choisis l’espace à visiter. Dans la vraie appli, tu recevras un lien de connexion par e-mail.
                </p>
                {SPACE_ORDER.map((s) => (
                  <SpaceButton key={s} space={s} demo className="space-opt" href={s !== "visit" && spaceOfPath(next) === s ? next : undefined}>
                    <span className="so-ic">
                      <Icon name={SPACES[s].icon} />
                    </span>
                    <span>
                      <b>{SPACES[s].label}</b>
                      <small>{SPACES[s].sub}</small>
                    </span>
                    <Icon name="chev-r" className="chk" />
                  </SpaceButton>
                ))}
              </>
            ) : viewer.profile ? (
              <>
                <p className="sh-sub">
                  Tu es connectée : <b>{fullName(viewer.profile)}</b> · {viewer.profile.roles.length ? viewer.profile.roles.map((r) => ROLE_LABEL[r]).join(", ") : PLAN_LABEL[viewer.profile.plan]}.
                </p>
                <div className="btn-row">
                  {spaces.filter((s) => s !== "visit").map((s) => (
                    <Link key={s} className="btn btn-gold" href={spaceOfPath(next) === s ? next : SPACES[s].home}>
                      {spaces.length > 2 ? `Espace ${SPACES[s].label}` : "Ouvrir mon espace"} <Icon name="arrow-r" />
                    </Link>
                  ))}
                  {!viewerCan(viewer, "space.member") && (
                    <Link className="btn btn-gold" href="/formules">
                      Adhérer au club
                    </Link>
                  )}
                  {/* --- Lancement --- compte gratuit : sa fiche, ses réglages, l'appli */}
                  {!viewerCan(viewer, "space.member") && (
                    <Link className="btn btn-ghost" href="/bienvenue?etape=profile">
                      Ma fiche et mes réglages
                    </Link>
                  )}
                  <Link className="btn btn-ghost" href={`/compte/mot-de-passe?suite=${encodeURIComponent(next)}`}>
                    <Icon name="lock" /> Mon mot de passe
                  </Link>
                  <form action={signOut}>
                    <button className="btn btn-ghost" type="submit">
                      Me déconnecter
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <p className="sh-sub">Avec ton mot de passe, ou un lien reçu par e-mail.</p>
                {erreur && (
                  <div className="flash">
                    <Icon name="bell" />
                    Ce lien a expiré ou a déjà servi. Demande-en un nouveau.
                  </div>
                )}
                <LoginForm next={next} parrain={await pendingReferralCode() /* --- Lot 4 --- */} />
                {/* --- Lancement --- */}
                <p className="fine">
                  Pas encore de compte ? <Link href="/inscription">Créer mon compte</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
