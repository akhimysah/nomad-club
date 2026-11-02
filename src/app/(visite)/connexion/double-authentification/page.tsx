import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaPanel } from "@/components/securite/MfaPanel";
import { Icon } from "@/components/ui/Icon";
import { isRealMode } from "@/lib/env";
import { safeRedirectPath } from "@/lib/modules/securite/request";
import "@/styles/securite.css";

export const metadata: Metadata = { title: "Double authentification", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ suite?: string }> };

/**
 * Lot 6 — double authentification des administratrices (mode réel, Supabase MFA TOTP).
 * Le middleware y envoie une administratrice dont la session n'est pas en AAL2 quand elle ouvre /fondatrices.
 */
export default async function MfaPage({ searchParams }: Props) {
  const { suite } = await searchParams;
  const next = safeRedirectPath(suite, "/fondatrices");
  let mode: "enroll" | "verify" | "done" | "demo" = "demo";
  if (isRealMode()) {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("profile_id", user.id);
    if (!(roles ?? []).some((r) => r.role === "admin")) redirect("/connexion");
    const [{ data: aal }, { data: factors }] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors()]);
    mode = aal?.currentLevel === "aal2" ? "done" : (factors?.totp.length ?? 0) > 0 ? "verify" : "enroll";
  }
  return (
    <div className="vscreen on">
      <section className="vsec">
        <div className="wrap">
          <div className="card login-card">
            <div className="eyebrow">Espace fondatrices</div>
            <h1 className="sh-title" style={{ fontSize: 34 }}>
              Double authentification
            </h1>
            {mode === "demo" && (
              <>
                <p className="sh-sub">
                  En mode réel, l’espace fondatrices demande, en plus du lien magique, un code à 6 chiffres donné par une application d’authentification sur le téléphone.
                  En démo, l’écran est simulé dans l’espace fondatrices.
                </p>
                <Link className="btn btn-gold" href="/fondatrices/securite">
                  Voir la démonstration <Icon name="arrow-r" />
                </Link>
              </>
            )}
            {mode === "done" && (
              <>
                <p className="sh-sub">Ta session est déjà protégée par la double authentification.</p>
                <Link className="btn btn-gold" href={next}>
                  Continuer <Icon name="arrow-r" />
                </Link>
              </>
            )}
            {mode === "enroll" && (
              <>
                <p className="sh-sub">
                  Pour protéger les données des membres, l’espace fondatrices exige un second facteur. Une seule fois : scanne le QR code avec ton application, puis saisis le
                  code affiché.
                </p>
                <MfaPanel mode="enroll" suite={next} />
              </>
            )}
            {mode === "verify" && (
              <>
                <p className="sh-sub">Saisis le code à 6 chiffres affiché par ton application d’authentification.</p>
                <MfaPanel mode="verify" suite={next} />
                <p className="muted sec-note">Téléphone perdu ? L’autre fondatrice peut réinitialiser ton facteur depuis Supabase (Authentication › Users).</p>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
