import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/securite/LegalPage";

export const metadata: Metadata = {
  title: "Conditions d’utilisation",
  description: "Conditions générales d’utilisation de l’appli du Nomad Club (brouillon à faire valider).",
};

/** Vague 2 — conditions générales d'utilisation (BROUILLON, à faire valider par un juriste). Version « 2026-11-brouillon ». */
export default function TermsPage() {
  return (
    <LegalPage eyebrow="Informations" title="Conditions générales d’utilisation" updated="2 novembre 2026">
      <h2>1. Objet</h2>
      <p>
        Ces conditions encadrent l’utilisation de l’application web du Nomad Club, club de femmes et d’entrepreneuses à Marrakech édité par <b>[À COMPLÉTER : raison sociale]</b>{" "}
        (voir les <Link href="/mentions-legales">mentions légales</Link>). Créer un compte vaut acceptation de ces conditions et de la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>. La version acceptée et sa date sont conservées.
      </p>

      <h2>2. Comptes</h2>
      <p>
        Le compte est personnel. Il se crée avec une adresse e-mail valide : la connexion se fait par un lien envoyé à cette adresse, sans mot de passe. Tu t’engages à donner des
        informations exactes (prénom, nom, WhatsApp, pays) et à les tenir à jour. Les fondatrices peuvent suspendre un compte en cas d’usage contraire à ces conditions, après
        t’en avoir informée sauf urgence.
      </p>

      <h2>3. Compte gratuit et adhésion</h2>
      <p>
        Le compte gratuit donne accès à l’agenda, aux réservations au tarif public et aux actualités. L’adhésion (Membre ou Premium) est annuelle ; [À COMPLÉTER : adhésion sur
        candidature examinée par les fondatrices, ou directe]. Elle ouvre l’annuaire, les messages privés, les offres des partenaires et les tarifs membres. Les prix, les modalités
        de paiement, de renouvellement et de remboursement figurent dans [À COMPLÉTER : conditions générales d’adhésion et de vente].
      </p>

      <h2>4. Règles du cercle</h2>
      <p>
        Bienveillance, discrétion et respect : pas de démarchage insistant, de propos discriminants, de harcèlement ni de contenus illicites dans le salon, les groupes et les messages
        privés. Les informations de l’annuaire servent uniquement aux échanges entre membres, jamais à de la prospection de masse. La modération peut masquer un message et, en cas de
        manquement répété, suspendre l’accès au cercle.
      </p>

      <h2>5. Partenaires et professionnelles</h2>
      <p>
        Les offres des partenaires et les fiches du carnet d’adresses relèvent de la responsabilité des établissements. Le club n’est pas partie aux contrats conclus entre membres
        (Espace Business) ni avec les partenaires, et ne prélève aucune commission sur les deals déclarés.
      </p>

      <h2>6. Contenus</h2>
      <p>
        Tu restes propriétaire de ce que tu publies (photo, fiche, messages) et autorises le club à l’afficher dans l’appli pour le fonctionnement du service. Le droit à l’image lors
        des rendez-vous se règle dans tes consentements, modifiables à tout moment.
      </p>

      <h2>7. Disponibilité et responsabilité</h2>
      <p>
        Le club fait de son mieux pour que l’appli soit disponible et sûre, sans pouvoir garantir l’absence d’interruption. [À COMPLÉTER : limitation de responsabilité conforme au
        droit applicable.]
      </p>

      <h2>8. Données personnelles</h2>
      <p>
        Tout est décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>. Tu peux consulter, télécharger et supprimer tes données depuis{" "}
        <Link href="/mes-donnees">Mes données</Link>.
      </p>

      <h2>9. Modification et droit applicable</h2>
      <p>
        En cas de modification importante, la nouvelle version te sera présentée à ta connexion. Droit applicable et juridiction compétente : [À COMPLÉTER]. Contact : [À COMPLÉTER :
        e-mail du club].
      </p>
    </LegalPage>
  );
}
