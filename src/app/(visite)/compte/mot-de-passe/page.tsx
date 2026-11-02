import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/account/PasswordForm";
import { getViewer } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/modules/securite/request";

export const metadata: Metadata = { title: "Mon mot de passe", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ suite?: string }> };

/** Choisir ou changer son mot de passe : ouvert à toute personne connectée (membres, fondatrices, partenaires…). */
export default async function PasswordPage({ searchParams }: Props) {
  const { suite } = await searchParams;
  const back = safeRedirectPath(suite, "/espace");
  const v = await getViewer();
  if (v.mode === "real" && !v.profile) redirect(`/connexion?suite=${encodeURIComponent("/compte/mot-de-passe")}`);
  return (
    <div className="vscreen on">
      <section className="vsec">
        <div className="wrap">
          <div className="card login-card pw-page">
            <div className="eyebrow">Mon compte</div>
            <h1 className="sh-title" style={{ fontSize: 38 }}>
              Mon mot de passe
            </h1>
            <p className="sh-sub">Choisis un mot de passe pour te connecter sans attendre d’e-mail.</p>
            <PasswordForm back={back} />
          </div>
        </div>
      </section>
    </div>
  );
}
