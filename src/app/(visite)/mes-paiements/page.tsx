import type { Metadata } from "next";
import Link from "next/link";
import { MyPaymentsBody } from "@/components/paiements/MyPaymentsBody";
import { Screen } from "@/components/ui/Screen";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Mes paiements", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Vague 2 · paiements — « Mes paiements » pour tout compte connecté : compte gratuit (billets), adhérente
 * dont l'accès est suspendu pour impayé (elle doit pouvoir régulariser), pro, partenaire.
 */
export default async function PublicPaymentsPage() {
  const v = await getViewer();
  return (
    <Screen group="visit" index={8} className="vscreen on" mobileOnly>
      <section className="vsec">
        <div className="wrap">
          <div className="eyebrow">Mon compte</div>
          <h1 className="h-sec">Mes paiements</h1>
          {v.profile ? (
            <>
              <p className="lead">Tes paiements, tes échéances et tes reçus.</p>
              <MyPaymentsBody profileId={v.profile.id} demo={v.mode === "demo"} />
            </>
          ) : (
            <div className="card sec-login">
              <p className="lead">Connecte-toi pour voir tes paiements, tes échéances et télécharger tes reçus.</p>
              <Link className="btn btn-gold" href="/connexion?suite=/mes-paiements">
                Me connecter
              </Link>
            </div>
          )}
        </div>
      </section>
    </Screen>
  );
}
