import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acceptInvitationAction } from "@/app/actions/lancement";
import { LoginForm } from "@/components/visit/LoginForm";
import { Icon } from "@/components/ui/Icon";
import { getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { fullName } from "@/lib/format";
import { invitationRoleLabel } from "@/lib/modules/lancement/server";
import "@/styles/lancement.css";

export const metadata: Metadata = { title: "Invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ erreur?: string }> };

const STATE_TEXT = {
  used: "Cette invitation a déjà servi. Si c’était toi, connecte-toi : ton accès est ouvert.",
  revoked: "Cette invitation a été annulée par les fondatrices.",
  expired: "Cette invitation a expiré (14 jours). Demande-en une nouvelle à Julia ou Nora.",
} as const;

/** Vague 2 — Lien d'invitation à usage unique : crée ton compte ou connecte-toi, puis accepte le rôle. */
export default async function InvitationPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { erreur } = await searchParams;
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();
  const viewer = await getViewer();
  const preview = await getRepo().previewRoleInvitation(token);
  if (!preview) notFound();
  const role = invitationRoleLabel(preview.role);
  const next = `/invitation/${token}`;

  return (
    <div className="vscreen on">
      <section className="vsec">
        <div className="wrap">
          <div className="card lc-card">
            <div className="eyebrow">Invitation</div>
            <h1 className="sh-title" style={{ fontSize: 36 }}>
              Tu es invitée comme {role}
            </h1>
            <p className="sh-sub">
              {preview.organization ? `Pour ${preview.organization}. ` : ""}Invitation envoyée à {preview.emailHint}.
            </p>
            {erreur && (
              <div className="flash" role="alert">
                <Icon name="bell" />
                <span>{erreur}</span>
              </div>
            )}
            {preview.state !== "open" ? (
              <>
                <div className="flash" role="status">
                  <Icon name="lock" />
                  <span>{STATE_TEXT[preview.state]}</span>
                </div>
                <Link className="btn btn-gold" href="/connexion">
                  Me connecter
                </Link>
              </>
            ) : viewer.profile ? (
              <form action={acceptInvitationAction}>
                <input type="hidden" name="token" value={token} />
                <p className="sh-sub">
                  Connectée en tant que <b>{fullName(viewer.profile)}</b>
                  {viewer.profile.email ? ` (${viewer.profile.email})` : ""}.
                </p>
                <button className="btn btn-gold btn-block" type="submit">
                  <Icon name="check" />
                  Accepter et ouvrir mon espace
                </button>
              </form>
            ) : viewer.mode === "demo" ? (
              <p className="sh-sub">En démo, choisis un espace en haut de l’écran : dans la vraie appli, la personne invitée crée son compte ici.</p>
            ) : (
              <>
                <Link className="btn btn-gold btn-block" href={`/inscription?invitation=${token}`}>
                  Créer mon compte
                </Link>
                <p className="fine" style={{ marginBottom: 14 }}>
                  Déjà un compte avec cette adresse ? Reçois un lien de connexion :
                </p>
                <LoginForm next={next} />
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
