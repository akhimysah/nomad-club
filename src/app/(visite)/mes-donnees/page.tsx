import type { Metadata } from "next";
import Link from "next/link";
import { MyDataBody } from "@/components/securite/MyDataBody";
import { Screen } from "@/components/ui/Screen";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Mes données", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Lot 6 — Mes données pour tout compte connecté qui n'a pas l'espace membre
 * (compte gratuit, partenaire, pro). Les adhérentes ont la même page dans /espace/moi/donnees.
 */
export default async function PublicMyDataPage() {
  const v = await getViewer();
  return (
    <Screen group="visit" index={8} className="vscreen on" mobileOnly>
      <section className="vsec">
        <div className="wrap">
          <div className="eyebrow">Mon compte</div>
          <h1 className="h-sec">Mes données</h1>
          {v.profile ? (
            <>
              <p className="lead">Ce que le club sait de toi, ce que tu acceptes, et comment tout reprendre.</p>
              <MyDataBody viewer={v} profile={v.profile} exportHref="/api/moi/export" />
            </>
          ) : (
            <div className="card sec-login">
              <p className="lead">Connecte-toi pour consulter, télécharger ou supprimer tes données.</p>
              <Link className="btn btn-gold" href="/connexion?suite=/mes-donnees">
                Me connecter
              </Link>
              <p className="muted">
                Adhérente ? Tout est aussi dans ton espace, rubrique <b>Moi › Mes données</b>. Les règles : <Link href="/confidentialite">politique de confidentialité</Link>.
              </p>
            </div>
          )}
        </div>
      </section>
    </Screen>
  );
}
