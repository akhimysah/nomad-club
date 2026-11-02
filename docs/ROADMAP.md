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
| Sécurité | RLS Supabase, 5 rôles cumulables + capacités, journal d'audit (Lot 0) ; RGPD, 2FA admin, sauvegardes, PWA, push (Lot 6) | Validation juridique des textes, mise en service en mode réel |

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

### Lot 6 — Sécurité, conformité, évolution (branche `lot-6-securite`)
- [x] Audit de sécurité écrit (`docs/securite/audit.md`) : 10 constats corrigés (2FA admin, énumération des billets, redirection ouverte, limitation de fréquence, en-têtes HTTP, fonctions internes exposées, assistant, etc.), 6 constats restants documentés.
- [x] RGPD : consentements horodatés et retirables (carte, communications, annuaire, droit à l'image), export JSON de toutes ses données, demande de suppression avec délai de grâce de 30 jours puis anonymisation par une administratrice (paiements conservés), registre et durées de conservation (`docs/securite/donnees.md`), brouillons de politique de confidentialité et mentions légales (à faire valider par un juriste).
- [x] Sécurité des comptes : double authentification TOTP (Supabase MFA) exigée pour l'espace fondatrices en mode réel, option « exiger aussi côté base » (RLS restrictives), appareils connectés et « déconnecter partout », limitation de fréquence (réservations, lien magique, messages, paiement, billets, assistant), en-têtes de sécurité (CSP…).
- [x] Journal consultable : filtres (personne, type, période), recherche, détail d'une entrée, export CSV ; connexions admin, exports et suppressions journalisés.
- [x] Sauvegardes : `scripts/backup.sh` (pg_dump chiffré, rotation, restauration) + procédure et exercice de reprise (`docs/securite/sauvegardes.md`).
- [x] PWA : service worker (cache des pages publiques et de l'espace membre, page hors ligne, cache vidé à la déconnexion), manifeste complet, aide à l'installation iPhone / Android, notifications push Web (VAPID, sans dépendance) reliées aux préférences « push ».
- [~] API pour applis natives : l'export (`/api/moi/export`) et les règles sont prêts ; les applis natives pourront utiliser Supabase directement (RLS) avec le même jeton. Une API REST dédiée reste à concevoir avec le besoin réel.
- [ ] À faire en mode réel : activer MFA TOTP dans Supabase, générer les clés VAPID, `CRON_SECRET`, planifier `scripts/backup.sh`, faire valider les textes juridiques, brancher le consentement `directory` sur l'annuaire et `geolocation` sur la carte (Lot 3) à la fusion.

## Décisions à prendre avec la cliente

1. **Paiement** : Stripe n'accepte pas les entreprises immatriculées au Maroc. Le club encaisse-t-il via une société en France / UE (Stripe OK) ou au Maroc (CMI, PayPal…) ?
2. **Devise** : dollars US (comme la maquette), dirhams ou euros ?
3. **Signature des contrats** : acceptation électronique simple (case + horodatage) suffit-elle au départ, ou signature qualifiée via un prestataire ?
4. **Hébergement** : Vercel + Supabase (prévu), ou le VPS Hostinger déjà utilisé pour le carnet ?
5. **Charte graphique** : noir et blanc actuel, ou l'une des pistes Riad Sauge / Majorelle / Nuit Rose ?
6. **E-mails** : adresse d'envoi (ex. bonjour@nomadclub…) et nom de domaine.
