import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { SpaceButton } from "@/components/shell/SpaceButton";
import { SPACES } from "@/components/shell/spaces";
import { Icon } from "@/components/ui/Icon";
import { LoginForm } from "@/components/visit/LoginForm";
import { getViewer } from "@/lib/auth";
import { fullName, PLAN_LABEL } from "@/lib/format";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ suite?: string; erreur?: string; adhesion?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { suite, erreur, adhesion } = await searchParams;
  const next = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/espace";
  const viewer = await getViewer();
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
                {(["visit", "member", "founders"] as const).map((s) => (
                  <SpaceButton key={s} space={s} demo className="space-opt" href={s === "member" && next.startsWith("/espace") ? next : s === "founders" && next.startsWith("/fondatrices") ? next : undefined}>
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
                  Tu es connectée : <b>{fullName(viewer.profile)}</b> · {viewer.role === "founder" ? "Fondatrice" : PLAN_LABEL[viewer.profile.plan]}.
                </p>
                <div className="btn-row">
                  {viewer.role !== "guest" && (
                    <Link className="btn btn-gold" href={viewer.role === "founder" && next.startsWith("/fondatrices") ? next : "/espace"}>
                      Ouvrir mon espace <Icon name="arrow-r" />
                    </Link>
                  )}
                  {viewer.role === "guest" && (
                    <Link className="btn btn-gold" href="/formules">
                      Adhérer au club
                    </Link>
                  )}
                  <form action={signOut}>
                    <button className="btn btn-ghost" type="submit">
                      Me déconnecter
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <p className="sh-sub">Entre ton e-mail : tu reçois un lien pour te connecter, sans mot de passe.</p>
                {erreur && (
                  <div className="flash">
                    <Icon name="bell" />
                    Ce lien a expiré ou a déjà servi. Demande-en un nouveau.
                  </div>
                )}
                <LoginForm next={next} />
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
