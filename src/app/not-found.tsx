import type { Metadata } from "next";
import Link from "next/link";
import { ErrorScreen } from "@/components/lancement/ErrorScreen";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

/** Page 404 au design de la marque (vague 2 : écran commun aux pages d'erreur). */
export default function NotFound() {
  return (
    <ErrorScreen code="Erreur 404" title="Cette page n’existe pas, ou plus." label="Page introuvable">
      <p className="sh-sub">Le lien a peut-être changé. Retrouve les prochains rendez-vous du club.</p>
      <div className="btn-row">
        <Link className="btn btn-gold" href="/rendez-vous">
          Voir l’agenda
        </Link>
        <Link className="btn btn-ghost" href="/">
          Accueil
        </Link>
      </div>
    </ErrorScreen>
  );
}
