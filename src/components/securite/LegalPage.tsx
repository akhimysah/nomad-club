import { Icon } from "../ui/Icon";
import "@/styles/securite.css";

/** Lot 6 — gabarit des pages juridiques (brouillons à faire valider). */
export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="vscreen on">
      <section className="vsec">
        <div className="wrap sec-legal">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="h-sec">{title}</h1>
          <p className="muted">Version du {updated}.</p>
          <div className="flash sec-draft" role="note">
            <Icon name="edit" />
            <span>
              <b>Brouillon à faire valider par un juriste.</b> Ce texte est un point de départ : les passages [À COMPLÉTER] dépendent de choix du club (société, hébergement,
              paiement). Il ne constitue pas un avis juridique.
            </span>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
