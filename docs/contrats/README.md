# Contrats — points à faire trancher (cliente et juriste)

Chantier 2b de la vague 2 (branche `v2-contrats`, migration `0010_contrats.sql`, module `src/lib/modules/contrats/`).
Les trois modèles fournis sont des **BROUILLONS à faire valider par un juriste** : ils ont été rédigés pour
l'application, couvrent les sujets demandés, mais n'ont aucune valeur juridique tant qu'ils n'ont pas été relus,
complétés et validés. Rien ne doit partir en production avec des mentions entre crochets.

## Comment modifier un texte

1. `/fondatrices/contrats/modeles` → « Nouvelle version » (pré-remplie depuis la version active).
2. Compléter les mentions entre crochets, supprimer la variante `[MAROC]` ou `[FRANCE]` inutile, retirer les notes `>>` traitées.
3. Enregistrer (la version est inactive), relire l'aperçu, puis « Activer ». Les contrats déjà générés gardent leur version ;
   un modèle utilisé par un contrat ne peut plus être modifié (la base le refuse).
4. Quand la version validée existe, mettre aussi à jour `src/lib/modules/contrats/templates.ts` si l'on veut qu'une
   installation neuve démarre avec elle (`node scripts/contrats-templates-sql.mjs --write` recopie le texte dans la migration).

Syntaxe : `#` titre, `##` article, `-` liste, `**gras**`, `>` encadré, `>>` **note interne** (visible uniquement en
back-office, jamais dans le contrat ni le PDF), `{{variable}}` (liste dans l'éditeur), `[À COMPLÉTER]` surligné.

## Décisions de la cliente

| # | Sujet | Choix par défaut dans l'appli | À décider |
|---|---|---|---|
| 1 | **Entité qui contracte** | `[RAISON SOCIALE]`, `[FORME JURIDIQUE]`, `[CAPITAL]`, `[SIÈGE]`, `[ICE / SIREN]`, `[REPRÉSENTANTE LÉGALE]` | Société marocaine ou française ? (lié au choix du prestataire de paiement : Stripe exige une entité UE) |
| 2 | **Droit applicable et tribunal** | `[DROIT APPLICABLE : Maroc ou France]`, `[TRIBUNAL COMPÉTENT]` | Garder une seule variante `[MAROC]` / `[FRANCE]` dans chaque article |
| 3 | **Devise** | `NEXT_PUBLIC_CURRENCY` (USD par défaut), figée dans chaque contrat | USD, MAD ou EUR ; TVA (`[TVA : préciser le régime applicable]`, HT / TTC pour les pros) |
| 4 | **Adhésion en plusieurs fois** | 1, 3 ou 12 échéances mensuelles, arrondi sur la première | Frais de paiement fractionné ? Délai avant suspension en cas d'impayé (`[15]` jours) |
| 5 | **Renouvellement adhésion** | Sans reconduction tacite, un nouveau contrat par renouvellement | Confirmer (évite l'obligation d'information L215-1 en droit français) |
| 6 | **Résiliation anticipée** | Échéances restantes `[restent dues / sont annulées]`, remboursement `[au prorata ou non]` | Trancher ; éviter toute clause abusive |
| 7 | **Partenaires** | Partenariat gratuit, 1 an reconductible, préavis `[30]` jours | Gratuit ou payant ? Durée et préavis |
| 8 | **Pros** | Grille `[PRIX MENSUEL PRO]` (Essentiel 29, Visibilité 49, Vitrine 89 dans l'appli), mensuel tacite, arrêt à fin de période, masquage puis suspension à 15 jours | Prix définitifs, HT/TTC, pénalités de retard, plafond de responsabilité (3 mois) |
| 9 | **Signature** | Acceptation électronique simple (case + horodatage + IP + navigateur + version + SHA-256 du PDF) | Suffisant au départ, ou signature avancée / qualifiée (Yousign, Docusign) ? L'interface `SignatureProvider` est prête (`signature.ts`) |
| 10 | **Coordonnées** | `[E-MAIL DE CONTACT DU CLUB]`, `[E-MAIL DE CONTACT DONNÉES PERSONNELLES]`, `[HÉBERGEURS ET PAYS]` | Adresses définitives |
| 11 | **Durées de conservation** | Données d'adhésion + `[3]` ans, contrats et paiements `[10 ans — à confirmer]` | Alignées sur `docs/securite/donnees.md` |

## Points juridiques à faire valider par le juriste

**Selon l'entité (Maroc / France)** — chaque endroit est marqué `[MAROC]` / `[FRANCE]` dans les textes et commenté par une note `>>` :

- **Rétractation** (adhésion, art. 6) : Maroc loi 31-08 art. 36 (7 jours, 30 jours si informations art. 29 manquantes) ;
  France art. L221-18 et s. (14 jours, montant proportionnel art. L221-25 si exécution demandée avant la fin du délai,
  **formulaire type de rétractation à annexer**). Applicabilité au contrat d'adhésion conclu en ligne.
- **Contrats partenaire et pro** : pas de rétractation entre professionnels, sauf exception française L221-3 (≤ 5 salariés,
  contrat hors activité principale conclu hors établissement).
- **Données personnelles** : Maroc loi 09-08, déclaration CNDP (`[N° DE DÉCLARATION CNDP]`) et **autorisation de transfert
  à l'étranger** (hébergement Supabase / Vercel, art. 43-44) ; France RGPD, CNIL, encadrement des transferts hors UE.
- **Preuve de l'acceptation électronique** : Maroc loi 53-05 ; France art. 1366 et 1367 du Code civil. Le niveau
  « simple » est-il suffisant pour des contrats de 12 mois avec échéancier ?
- **Clauses abusives** : résiliation, clause pénale, limitation de responsabilité de l'adhésion (loi 31-08 art. 15 et s. ;
  Code de la consommation L212-1 et R212-1).
- **Médiation de la consommation** (France) : médiateur obligatoire `[NOM ET COORDONNÉES DU MÉDIATEUR]`.
- **Clause attributive de juridiction** : valable entre professionnels, encadrée face à une consommatrice.

**Sur le fond, quel que soit le pays :**

- Espace Business : la mention « aucune commission, le club n'est pas partie aux deals ni responsable de leur exécution »
  est-elle suffisante (qualification d'intermédiaire, apport d'affaires) ?
- Parrainage : récompenses sans valeur monétaire, modifiables pour l'avenir — conforme aux règles sur les loteries / avantages ?
- Droit à l'image : consentement séparé et retirable (déjà dans l'appli, `Mes données`), durée et territoire à préciser ?
- Professions réglementées dans le carnet (santé, droit…) : règles de publicité propres à chaque ordre.
- Géolocalisation : consentement exprès, position approximative, effacement au retrait — formulation à valider.
- Statistiques fournies aux partenaires et pros : agrégées et non identifiantes.
- Usage des marques (club, partenaires, pros) : licence limitée à la durée du contrat.

## Fonctionnement (rappel technique)

- **Génération** : un contrat par souscription (`onSubscriptionActivated`), ou à l'étape « Contrat » d'un parcours avant le
  paiement, ou depuis le back-office. Numéro unique `NC-ADH|PAR|PRO-AAAA-XXXXXX`, variables remplies, notes internes retirées,
  PDF (pdf-lib, rendu déterministe), empreinte SHA-256 stockée.
- **Acceptation** : la signataire lit le contrat (aperçu + PDF), coche « J'ai lu et j'accepte » ; la fonction SQL
  `accept_contract()` vérifie que c'est bien elle, que le contrat est en attente et que l'empreinte est identique, enregistre
  la preuve (horodatage, IP et navigateur relevés par le serveur, version, empreinte, phrase cochée) et journalise.
  La preuve est **immuable** (déclencheur : ni modification ni suppression, même par la clé service) ; un contrat accepté
  ne change plus (seules la référence de souscription, les relances et la résiliation restent possibles).
- **Certificat d'acceptation** : PDF récapitulatif téléchargeable (`?certificat=1`).
- **Envoi** : `sendEmail({ template: "contract_accepted", attachments: [PDF] })` (et `contract_ready`, `contract_reminder`),
  sans effet tant que le chantier e-mails n'a pas branché son expéditeur. Notifications in-app dans tous les cas.
- **Archivage** : bucket privé Supabase `contrats` (URL signées de 60 s) en mode réel ; régénération à la volée en démo
  (empreinte vérifiée à chaque téléchargement).

## Avant la mise en production

- [ ] Textes validés par le juriste, mentions entre crochets complétées, une seule variante Maroc / France, nouvelle version activée.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurée (génération depuis le webhook de paiement, dépôt des PDF, journal).
- [ ] Bucket `contrats` créé (fait par la migration si le schéma `storage` existe).
- [ ] Modèles d'e-mails `contract_ready`, `contract_reminder`, `contract_accepted` (chantier e-mails).
- [ ] Le chantier paiements émet `emitSubscriptionActivated` (Stripe, virement validé, abonnement pro) et retire les
      émissions provisoires de `src/lib/modules/contrats/emit.ts` (appelées dans `actions/membership.ts`,
      `actions/founders.ts`, `actions/partenaires.ts`) s'il les remplace ; l'étape « Contrat » reçoit le nombre d'échéances choisi.
- [ ] Ne pas changer la version de `pdf-lib` sans re-tester : en mode réel le PDF déposé fait foi, mais la régénération
      (démo, fichier manquant) suppose un rendu identique.
