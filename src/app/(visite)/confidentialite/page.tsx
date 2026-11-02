import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/securite/LegalPage";

export const metadata: Metadata = { title: "Politique de confidentialité" };

/** Lot 6 — politique de confidentialité (BROUILLON, à faire valider par un juriste). */
export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Tes données" title="Politique de confidentialité" updated="2 novembre 2026">
      <h2>1. Qui est responsable de tes données ?</h2>
      <p>
        Le responsable du traitement est <b>[À COMPLÉTER : raison sociale du club, forme juridique, numéro d’immatriculation, adresse du siège]</b>, représenté par Julia [À
        COMPLÉTER] et Nora [À COMPLÉTER], fondatrices du Nomad Club. Contact pour tes données : <b>[À COMPLÉTER : adresse e-mail dédiée]</b>.
      </p>
      <p>
        Le club est basé à Marrakech et accueille des membres de plusieurs pays. Nous appliquons la <b>loi marocaine n° 09-08</b> relative à la protection des personnes
        physiques à l’égard du traitement des données à caractère personnel, sous le contrôle de la <b>CNDP</b> (Commission nationale de contrôle de la protection des données
        à caractère personnel), et le <b>Règlement général sur la protection des données (RGPD)</b> de l’Union européenne lorsqu’il s’applique (membres résidant dans l’UE,
        société ou prestataires européens). [À COMPLÉTER : numéro de déclaration ou d’autorisation CNDP.]
      </p>

      <h2>2. Quelles données, pour quoi faire ?</h2>
      <table className="sec-table">
        <thead>
          <tr>
            <th>Données</th>
            <th>Pourquoi</th>
            <th>Base</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Prénom, nom, e-mail, numéro WhatsApp</td>
            <td>Créer ton compte, te connecter (lien magique), t’envoyer ton billet et les infos de tes rendez-vous</td>
            <td>Contrat (adhésion, réservation)</td>
          </tr>
          <tr>
            <td>Métier, pays, ancienneté à Marrakech, bio, photo</td>
            <td>Ta fiche dans l’annuaire du cercle</td>
            <td>Consentement (retirable)</td>
          </tr>
          <tr>
            <td>Réservations, paiements, adhésions</td>
            <td>Gérer tes places, tes paiements et ton adhésion ; comptabilité</td>
            <td>Contrat et obligation légale</td>
          </tr>
          <tr>
            <td>Messages du salon et messages privés</td>
            <td>Faire vivre le cercle ; modération</td>
            <td>Contrat et intérêt légitime (sécurité)</td>
          </tr>
          <tr>
            <td>Quartier approximatif</td>
            <td>Carte des membres (jamais ta position exacte)</td>
            <td>Consentement (retirable)</td>
          </tr>
          <tr>
            <td>Photos des rendez-vous</td>
            <td>Souvenirs dans l’appli et réseaux du club</td>
            <td>Consentement (droit à l’image)</td>
          </tr>
          <tr>
            <td>Nouvelles du club</td>
            <td>E-mails et messages sur la vie du club</td>
            <td>Consentement (retirable)</td>
          </tr>
          <tr>
            <td>Journal des opérations, adresse IP, appareil</td>
            <td>Sécurité des comptes, preuve des opérations sensibles, lutte contre les abus</td>
            <td>Intérêt légitime et obligation légale</td>
          </tr>
        </tbody>
      </table>
      <p>Nous ne vendons ni ne louons tes données. Aucune publicité, aucun profilage.</p>

      <h2>3. Qui y a accès ?</h2>
      <p>
        Les fondatrices (administratrices) ; les modératrices pour les messages du salon ; les autres membres pour ta fiche d’annuaire si tu l’acceptes ; les établissements
        partenaires uniquement pour les offres que tu utilises. Nos prestataires techniques, qui agissent sur nos instructions :
      </p>
      <ul>
        <li>Hébergement de l’appli : [À COMPLÉTER : Vercel Inc. (États-Unis) ou VPS Hostinger] ;</li>
        <li>Base de données et connexion : Supabase [À COMPLÉTER : région du projet, ex. Union européenne (Francfort)] ;</li>
        <li>Paiement en ligne : [À COMPLÉTER : Stripe, CMI ou autre] — le club ne voit jamais ton numéro de carte ;</li>
        <li>Envoi d’e-mails et de messages : [À COMPLÉTER].</li>
      </ul>
      <p>
        Certains prestataires sont situés hors du Maroc et de l’Union européenne : ces transferts sont encadrés par [À COMPLÉTER : clauses contractuelles types, autorisation
        de la CNDP].
      </p>

      <h2>4. Combien de temps ?</h2>
      <ul>
        <li>Compte et fiche : tant que tu es membre, puis 3 ans après la fin de ta dernière adhésion (pour te proposer de revenir), sauf demande de suppression ;</li>
        <li>Paiements et factures : 10 ans (obligations comptables) [À COMPLÉTER : durée selon le pays de la société] ;</li>
        <li>Messages : tant que le compte existe ; effacés à la suppression du compte ;</li>
        <li>Journal de sécurité : 1 an ; historique des consentements : tant que le compte existe ;</li>
        <li>Réservations sans compte (prénom + WhatsApp) : 1 an après le rendez-vous.</li>
      </ul>

      <h2>5. Tes droits</h2>
      <p>
        Tu peux à tout moment accéder à tes données, les rectifier, les télécharger (portabilité), retirer un consentement, t’opposer à un traitement ou demander leur
        suppression. Le plus simple : <Link href="/mes-donnees">Mes données</Link> (ou, pour les adhérentes, <b>Moi › Mes données</b>) — téléchargement immédiat, réglages,
        suppression avec un délai de grâce de 30 jours. Tu peux aussi écrire à [À COMPLÉTER : e-mail]. Nous répondons sous un mois.
      </p>
      <p>
        Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la <b>CNDP</b> (www.cndp.ma) ou, si tu résides dans l’Union européenne, l’autorité de ton pays (en
        France : la CNIL).
      </p>

      <h2>6. Traceurs (cookies)</h2>
      <p>
        L’appli n’utilise <b>aucun cookie publicitaire ni de mesure d’audience</b>. Elle dépose seulement des cookies strictement nécessaires : ta session de connexion, le
        souvenir de tes billets réservés sans compte et, en démonstration, l’espace choisi. Ils sont exemptés de consentement : il n’y a donc pas de bandeau cookies. Si un outil
        de mesure est ajouté un jour, un bandeau te demandera ton accord avant tout dépôt.
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Connexion sans mot de passe par lien magique, double authentification pour les administratrices, chiffrement des échanges (HTTPS), accès limité aux données nécessaires
        à chaque rôle, journal des opérations sensibles, sauvegardes régulières. En cas de violation de données présentant un risque, nous te prévenons ainsi que l’autorité
        compétente dans les délais légaux.
      </p>
    </LegalPage>
  );
}
