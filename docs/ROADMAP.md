# Feuille de route : du prototype au cahier des charges

Référence : `docs/CAHIER-DES-CHARGES.md`. Architecture de départ : `docs/ARCHITECTURE.md` (Next.js 15 + Supabase + Stripe, modes démo / réel, interface `Repo`).

## Ce qui existe déjà (prototype fonctionnel en mode démo)

| Besoin du cahier des charges | Déjà là | Manque |
|---|---|---|
| Événements | Agenda, détail, réservation, liste d'attente, billet QR, brouillons, publication | Notifications, actualités/publications |
| Messagerie | Salon général, messages privés | Groupes thématiques, modération par mots-clés, signalements |
| Annuaire | Annuaire filtrable | Fiche profil complète, confidentialité |
| Carnet d'adresses | 10 adresses dans l'appli + carnet autonome de 157 adresses (site + serveur sur le VPS Hostinger) | Fiches pros payantes, abonnement mensuel, dashboard pro, statistiques de visibilité, fusion avec l'appli |
| Offres partenaires | Liste simple d'offres | Fiches établissements, utilisation (code / QR), statistiques, dashboard partenaire |
| Adhésion | Annuelle Membre / Premium, renouvellement, virement déclaré, Stripe Checkout | Paiement en plusieurs fois, historique complet, échéancier |
| Contrats | Rien | Génération PDF, acceptation / signature, envoi par e-mail, archivage |
| Dashboard membre | Accueil à widgets personnalisables (Lot 4) | Branchement des actualités du Lot 1 |
| Carte interactive | Rien | Carte, consentement de géolocalisation, établissements partenaires |
| Ressources digitales | Boutique, mes ressources, téléchargements sécurisés, gestion admin (Lot 4) | Vrai paiement (Lot 2) |
| Parrainage | Codes, lien, suivi, récompenses automatiques (Lot 4) | Remise automatique du mois offert (Lot 2) |
| Espace Business | Deals confirmés par les deux, points, classement, retombées (Lot 4) | Statistiques croisées au CRM (Lot 5) |
| Administration | Espace Fondatrices (à traiter, membres, événements, encaissements) | Rôles fins, modération, contenus, partenaires, journal des opérations |
| CRM | Chiffres et relances dans l'espace Fondatrices | Contacts / prospects, pipeline, segments, actions de suivi, statistiques de conversion et de renouvellement |
| Sécurité | RLS Supabase, 5 rôles cumulables + capacités, journal d'audit (Lot 0) | RGPD, sauvegardes, 2FA admin |

## Découpage en lots

Chaque lot est livrable seul, testable en mode démo puis en mode réel.

### Lot 0 — Socle (en premier, tout le reste s'appuie dessus)
- [x] Rôles et permissions : `admin`, `moderator`, `member`, `partner`, `pro` (+ `guest`), cumulables (un pro peut être aussi partenaire). Table `user_roles`, fonctions `has_role()` / `has_any_role()`, permissions centralisées côté code (`src/lib/permissions.ts`), page Rôles et accès.
- [x] Organisations / établissements (`organizations`, `organization_members`) reliés aux comptes partenaires et pros.
- [x] Journal des opérations importantes (`audit_log`) + page Journal.
- [x] Notifications in-app (`notifications`) + préférences (`notification_prefs`), couche `src/lib/notify.ts` prête pour e-mail et push.
- [x] Navigation multi-espaces : Membre, Partenaire, Pro, Admin (ordinateur et téléphone), CRM (page provisoire).
- [~] Mode réel Supabase : migrations 0001 → 0003 + seed testées avec `npm run test:sql` (PGlite : schéma, RLS, fonctions). Reste à faire tourner l'appli sur un vrai projet Supabase (connexion par lien magique, PostgREST, clé service).

### Lot 1 — Communauté
- Actualités (publications avec image, épinglage, commentaires optionnels).
- Événements + notifications (nouvel événement, rappel J-1, liste d'attente libérée).
- Messagerie : groupes thématiques (création par l'admin, adhésion libre ou sur demande), modération par mots-clés (masquer / signaler automatiquement), signalements par les membres, file de modération pour les modératrices.
- Annuaire : fiche profil complète, réglages de confidentialité.

### Lot 2 — Adhésions, paiements, contrats
- Adhésion annuelle payable en 1, 3 ou 12 fois (échéancier), relances d'échéances.
- Abonnements mensuels des pros.
- Contrats : modèles distincts adhérente / partenaire / pro, génération PDF, acceptation électronique horodatée (preuve : IP, date, version du contrat), envoi par e-mail, archivage dans chaque espace. Signature électronique qualifiée possible ensuite via un prestataire (Yousign, Docusign).
- Historique : paiements, contrats, échéances, renouvellements.

### Lot 3 — Partenaires, carnet pro, carte
- Fiches établissements, offres partenaires, utilisation par code ou QR à présenter, statistiques (vues, utilisations).
- Carnet pro payant : fiche, abonnement, statistiques de visibilité. Fusion du carnet de 157 adresses dans l'appli.
- Dashboard partenaire et dashboard pro (un même compte peut avoir les deux).
- Carte interactive : établissements partenaires + membres ayant consenti (position approximative par quartier, retirable à tout moment).

### Lot 4 — Engagement (branche `lot-4-engagement`, migration `0006_engagement.sql`, module `src/lib/modules/engagement/`)
- [x] Dashboard membre à widgets : obligatoires (prochain rendez-vous, actualités, prochains événements) et facultatifs (adhésion, météo Open-Meteo, heures de prière Aladhan méthode Maroc avec calcul local en repli, mon agenda, salon, offres, points Business, parrainage, citation du jour, assistant, adresse du carnet). Activation et ordre enregistrés par membre (glisser-déposer, boutons, clavier). Les actualités affichent des exemples en démo et une liste vide en réel tant que le Lot 1 n'est pas fusionné (`news-source.ts`, un seul endroit à brancher).
- [x] Ressources digitales : boutique (prix public / prix membre), fiche avec extrait et aperçu gratuit, achat avec paiement **simulé** isolé dans `billing.ts` (à remplacer au Lot 2 ; coupé par défaut en production), accès immédiat, « Mes ressources », téléchargements vérifiés côté serveur (URL signées Supabase Storage de 60 s ; PDF d'exemple au nom de l'acheteuse en démo). Admin : produits, fichiers, publication, ventes.
- [x] Parrainage : code personnel, lien `?parrain=CODE` mémorisé 30 jours, champ code à l'inscription (connexion, réservation, adhésion), suivi des filleules ; récompenses configurables attribuées automatiquement quand la filleule devient membre (points crédités, autres à remettre par l'admin), notifications.
- [x] Espace Business : déclaration d'un deal avec une autre membre, confirmation par elle (fonction SQL `respond_deal`), points pour les deux selon un barème réglable, classement (retrait possible), historique ; mention « aucune commission, le club n'est pas partie aux deals ». Admin : volume, deals par mois et par type, membres les plus connectées, barème.
- [ ] À faire à la fusion : brancher les actualités du Lot 1 dans `news-source.ts`, régénérer `supabase/seed.sql`, créer le bucket privé `ressources` sur le vrai projet Supabase (la migration le fait si le schéma `storage` existe).

### Lot 5 — CRM et pilotage
- Contacts uniques (prospects, adhérentes, anciennes membres, pros, partenaires), sources, statuts, étiquettes.
- Pipeline prospects → adhérentes, tâches et relances, historique d'échanges.
- Segments et actions groupées.
- Statistiques : conversion, renouvellement, revenus, retombées des deals.

### Lot 6 — Sécurité, conformité, évolution
- RGPD : consentements, export et suppression des données, durée de conservation.
- Sauvegardes, sécurité des comptes (2FA admin), journal consultable.
- PWA complète (installation, notifications push), API prête pour des applis natives.

## Décisions à prendre avec la cliente

1. **Paiement** : Stripe n'accepte pas les entreprises immatriculées au Maroc. Le club encaisse-t-il via une société en France / UE (Stripe OK) ou au Maroc (CMI, PayPal…) ?
2. **Devise** : dollars US (comme la maquette), dirhams ou euros ?
3. **Signature des contrats** : acceptation électronique simple (case + horodatage) suffit-elle au départ, ou signature qualifiée via un prestataire ?
4. **Hébergement** : Vercel + Supabase (prévu), ou le VPS Hostinger déjà utilisé pour le carnet ?
5. **Charte graphique** : noir et blanc actuel, ou l'une des pistes Riad Sauge / Majorelle / Nuit Rose ?
6. **E-mails** : adresse d'envoi (ex. bonjour@nomadclub…) et nom de domaine.
