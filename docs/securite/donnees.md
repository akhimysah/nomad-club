# Données personnelles — registre et règles (Lot 6)

Brouillon technique à faire valider par un juriste (loi marocaine 09-08 / CNDP et RGPD). La version lisible par les membres est la page `/confidentialite`.

## Ce que le club garde, et combien de temps

| Données | Où | Durée de conservation proposée | À la suppression du compte |
|---|---|---|---|
| Profil (prénom, nom, e-mail, WhatsApp, métier, pays, bio, photo) | `profiles` | Durée de l'adhésion + 3 ans | Effacé (« Ancienne membre ») |
| Compte de connexion | `auth.users` | Idem | Supprimé (soft delete, clé service) |
| Rôles, rattachements à un établissement | `user_roles`, `organization_members` | Idem | Supprimés |
| Réservations | `bookings` | 10 ans (pièces comptables) | Conservées, sans coordonnées invitée |
| Paiements, adhésions | `payments`, `memberships` | 10 ans | Conservés (obligation comptable) |
| Messages | `messages` | Durée du compte | Texte remplacé par « Message retiré » |
| Notifications, préférences | `notifications`, `notification_prefs` | Durée du compte | Supprimées |
| Consentements (historique horodaté) | `consents` | Durée du compte | Supprimés |
| Abonnements push | `push_subscriptions` | Jusqu'à désabonnement ou expiration | Supprimés |
| Relances | `reminders` | 2 ans | Supprimées |
| Journal des opérations | `audit_log` | 1 an (purge à automatiser) | Conservé (preuve), sans données de profil |
| Réservations sans compte (prénom + WhatsApp) | `bookings.guest_*` | 1 an après le rendez-vous (purge à automatiser) | — |
| Compteurs de fréquence (clé contenant une IP) | `rate_limits` | 1 jour (`purge_rate_limits`, tâche quotidienne) | — |
| Sauvegardes | hors Supabase (chiffrées) | 30 jours (rotation) | Disparaissent au bout de 30 jours |

## Consentements

Quatre types (`consents.kind`) : `geolocation` (quartier sur la carte), `communications` (nouvelles du club), `directory` (fiche dans l'annuaire), `image` (droit à l'image). Chaque choix est une ligne horodatée, jamais modifiée ; l'état courant est la dernière ligne (`current_consents`, `has_consent(profile, kind)`).

Valeurs par défaut tant que la personne n'a rien choisi (`consent_default`, à valider avec la cliente) : annuaire **visible** (cœur de l'adhésion, retirable), tout le reste **refusé**.

**Pour les autres lots** : avant d'afficher une membre sur la carte (Lot 3) ou dans un export public, appeler `has_consent(profile_id, 'geolocation')` côté SQL, ou `consentStates()` côté code. Le retrait de `directory` doit masquer la fiche de l'annuaire (à brancher lors de la fusion : filtre dans `listDirectory`).

## Droits des personnes

| Droit | Où |
|---|---|
| Accès, portabilité | « Télécharger mes données » (JSON) : `/espace/moi/donnees` (adhérentes) ou `/mes-donnees` (tout compte) ; API `/api/moi/export` |
| Rectification | Les fondatrices modifient la fiche (Membres / CRM) ; à terme, édition par la membre |
| Retrait du consentement | Interrupteurs dans « Mes données » |
| Effacement | « Supprimer mon compte » : délai de grâce de 30 jours, annulable, puis anonymisation par une administratrice (`/fondatrices/securite`) |
| Information | `/confidentialite`, `/mentions-legales` (pied de page) |

**Pour les autres lots** : toute nouvelle table contenant des données personnelles doit être ajoutée (1) à l'export (`src/lib/modules/securite/export.ts`), (2) à l'anonymisation (`anonymize_account` en SQL et `demoSecuriteRepo.anonymizeAccount`), (3) à ce tableau.

## Cookies

Uniquement des cookies strictement nécessaires (session Supabase, billets réservés sans compte, persona de démo) : pas de bandeau de consentement. Ajouter un outil de mesure d'audience imposerait un bandeau et un consentement préalable.

## Violation de données

1. Couper l'accès (révoquer la clé concernée dans Supabase / Vercel, `signOut` global des comptes touchés).
2. Consigner les faits (journal, logs Vercel et Supabase).
3. Évaluer le risque ; prévenir l'autorité compétente (CNDP ; CNIL si membres en France — 72 h pour le RGPD) et les personnes concernées si le risque est élevé.
