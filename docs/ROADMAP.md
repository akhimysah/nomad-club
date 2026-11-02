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
| Dashboard membre | Accueil fixe | Widgets obligatoires / facultatifs (actualités, événements, météo, agenda, heures de prière) |
| Carte interactive | Rien | Carte, consentement de géolocalisation, établissements partenaires |
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
- [x] Actualités (publications avec image, épinglage, commentaires optionnels, réactions) : `/espace/actualites`, bloc sur l'accueil, administration dans `/fondatrices/communaute/actualites`.
- [x] Événements + notifications (nouvel événement, rappel J-1 automatique par cron `/api/cron/rappels` ou manuel, liste d'attente libérée : la personne en attente peut prendre la place), vue calendrier mensuelle, ajout au calendrier (.ics).
- [x] Messagerie : groupes thématiques (création par l'admin ou la modération, adhésion libre ou sur demande, groupes privés), modération par mots-clés (masquer / signaler automatiquement, y compris en privé), signalements par les membres, file de modération (`/espace/moderation`, `/fondatrices/communaute/moderation`).
- [x] Annuaire : fiche profil complète (`/espace/moi/profil`), filtres secteur / nationalité / compétence, réglages de confidentialité appliqués côté base (`directory_list()`).

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
