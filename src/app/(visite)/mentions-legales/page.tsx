import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/securite/LegalPage";

export const metadata: Metadata = { title: "Mentions légales" };

/** Lot 6 — mentions légales (BROUILLON, à faire valider par un juriste). */
export default function LegalNoticePage() {
  return (
    <LegalPage eyebrow="Informations" title="Mentions légales" updated="2 novembre 2026">
      <h2>Éditeur</h2>
      <p>
        <b>[À COMPLÉTER : raison sociale]</b>, [À COMPLÉTER : forme juridique et capital], immatriculée [À COMPLÉTER : RC / ICE au Maroc, ou RCS / SIREN en France] sous le
        numéro [À COMPLÉTER], siège : [À COMPLÉTER : adresse], Marrakech, Maroc.
        <br />
        Directrices de la publication : Julia [À COMPLÉTER] et Nora [À COMPLÉTER], fondatrices.
        <br />
        Contact : [À COMPLÉTER : e-mail] · [À COMPLÉTER : téléphone].
      </p>

      <h2>Hébergement</h2>
      <p>
        Application : [À COMPLÉTER : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — ou Hostinger International Ltd, si l’appli est hébergée sur le VPS].
        <br />
        Base de données : Supabase Inc. [À COMPLÉTER : région du projet].
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement des données respecte la loi marocaine n° 09-08 (CNDP) et, lorsqu’il s’applique, le RGPD. [À COMPLÉTER : numéro de déclaration CNDP.] Tout est détaillé
        dans la <Link href="/confidentialite">politique de confidentialité</Link> ; tes données se consultent et se téléchargent dans <Link href="/mes-donnees">Mes données</Link>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom Nomad Club, le logo, les textes et les photographies sont la propriété du club ou de leurs auteurs [À COMPLÉTER : crédits photo]. Toute reproduction sans accord
        est interdite.
      </p>

      <h2>Conditions</h2>
      <p>
        Adhésions, réservations et paiements : [À COMPLÉTER : lien vers les conditions générales d’adhésion et de vente, droit de rétractation, politique d’annulation et de
        remboursement]. Droit applicable et juridiction compétente : [À COMPLÉTER].
      </p>
    </LegalPage>
  );
}
