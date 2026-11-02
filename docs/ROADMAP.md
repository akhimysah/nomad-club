# Feuille de route : du prototype au cahier des charges

Référence : `docs/CAHIER-DES-CHARGES.md`. Architecture de départ : `docs/ARCHITECTURE.md` (Next.js 15 + Supabase + Stripe, modes démo / réel, interface `Repo`).

## Ce qui existe déjà (prototype fonctionnel en mode démo)

| Besoin du cahier des charges | Déjà là | Manque |
|---|---|---|
| Événements | Agenda, détail, réservation, liste d'attente, billet QR, brouillons, publication | Notifications, actualités/publications |
| Messagerie | Salon général, messages privés | Groupes thématiques, modération par mots-clés, signalements |
| Annuaire | Annuaire filtrable | Fiche profil complète, confidentialité |
| Carnet d'adresses | Carnet du club + annuaire de 157 adresses dans l'appli, filtres catégorie et quartier, fiches des pros abonnées (Lot 3) | Paiement réel de l'abonnement pro (Lot 2) |
| Offres partenaires | Fiches établissements, offres, code personnel + QR, validation au comptoir, statistiques, dashboard partenaire (Lot 3) | Contrat partenaire (Lot 2) |
| Adhésion | Annuelle Membre / Premium, renouvellement, virement déclaré, Stripe Checkout | Paiement en plusieurs fois, historique complet, échéancier |
| Contrats | Rien | Génération PDF, acceptation / signature, envoi par e-mail, archivage |
| Dashboard membre | Accueil fixe | Widgets obligatoires / facultatifs (actualités, événements, météo, agenda, heures de prière) |
| Carte interactive | Carte Leaflet / OpenStreetMap : partenaires, pros, membres consentantes en position approximative (Lot 3) | — |
| Ressources digitales | Rien | Boutique, paiement, accès automatique aux fichiers |
| Parrainage | Rien | Codes, suivi, récompenses |
| Espace Business | Rien | Déclaration de deals, points, retombées |
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

### Lot 3 — Partenaires, carnet pro, carte (branche `lot-3-partenaires`)
- [x] Fiches établissements complètes (photos, horaires, WhatsApp, catégorie du carnet, position) modifiables par la propriétaire et son équipe ; invitation de collaboratrices par e-mail (compte existant : tout de suite ; sinon à la création du compte).
- [x] Offres partenaires (titre, avantage, conditions, période, public : toutes / Membre / Premium, pause) ; page Offres côté membre ; « Utiliser l'offre » donne un code personnel horodaté `OF-XXXX-XXXX` + QR ; validation au comptoir par saisie, scan caméra ou lien du QR, une seule fois, uniquement par l'établissement concerné.
- [x] Statistiques mensuelles cloisonnées par établissement : vues de fiche, clics contact / WhatsApp / itinéraire, codes générés / validés ; 6 mois de données d'exemple.
- [x] Carnet pro : abonnement mensuel (Essentiel 29 $, Visibilité 49 $, Vitrine 89 $), statut actif / en retard / suspendu (15 jours de grâce), fiche masquée si non payé ; **paiement simulé** derrière `src/lib/modules/partenaires/billing.ts` (`paySubscription`) à brancher au Lot 2. Fiches pros fusionnées dans le carnet (badge « Pro du réseau », Vitrine en tête), filtre par quartier.
- [x] Dashboards partenaire et pro (un même compte peut avoir les deux, ex. Maison Amaj).
- [x] Carte interactive (Leaflet + OpenStreetMap, sans clé) : partenaires, pros, membres ayant consenti, en position approximative (quartier ou ~500 m, arrondie aussi en base), anonyme possible, retirable à tout moment (la position est alors effacée) ; repli en liste si la carte ne charge pas.
- Reste : contrats (Lot 2), paiement réel de l'abonnement pro (Lot 2), planifier `refresh_pro_subscriptions()` chaque nuit (pg_cron) en mode réel, envoi d'e-mail des invitations d'équipe.

### Lot 4 — Engagement
- Dashboard membre à widgets : obligatoires (actualités, prochains événements) et facultatifs (météo, agenda, heures de prière, offres, deals), réorganisables.
- Ressources digitales : boutique, paiement, accès automatique et téléchargements sécurisés.
- Parrainage : code personnel, suivi des inscriptions, récompenses.
- Espace Business : déclaration de deals entre membres (confirmés par les deux parties), points, classement, retombées.

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
