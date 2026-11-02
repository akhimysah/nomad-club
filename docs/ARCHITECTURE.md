# Nomad Club : architecture

Appli web du Nomad Club (club de femmes entrepreneuses à Marrakech, fondé par Julia et Nora).
Design de référence : `design/maquette-noir-blanc.html` (maquette validée par la cliente, à reproduire fidèlement, y compris la version téléphone avec barre du bas).
Contenu et données d'exemple : `design/contenu-et-donnees.md`.

## Pile

- Next.js 15 (App Router, TypeScript, `src/`), CSS maison (pas de Tailwind) : tokens et styles repris de la maquette dans `src/app/globals.css` + CSS modules par composant si utile.
- Polices : Playfair Display (titres) + Albert Sans (interface) via `next/font/google`.
- Base de données et connexion : Supabase (Postgres + Auth + RLS).
- Paiement : Stripe Checkout (mode test d'abord) + webhook.
- Hébergement visé : Vercel.
- Validation : zod.

## Deux modes, choisis par les variables d'environnement

- **Mode démo** (par défaut, aucune clé) : données en mémoire côté serveur, initialisées depuis `src/lib/seed.ts` (toutes les données d'exemple du brief : rendez-vous, souvenirs, carnet, membres, salon, virements, relances, brouillons, encaissements, échéances, organisations, journal, notifications). Un sélecteur d'espace comme dans la maquette, à cinq entrées : Compte gratuit (visiteuse), Membre (Inès), Partenaire (Kenza, Bloom House), Pro (Loubna, ostéopathe), Fondatrices (Julia, admin). Le personnage est stocké en cookie `nc_demo_role` (`guest|member|partner|pro|admin` ; l'ancien `founder` est lu comme `admin`). Paiement simulé. Bandeau « Aperçu · données d'exemple ».
- **Mode réel** (si `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont définies) : Supabase pour tout, connexion par lien magique e-mail (et plus tard OTP WhatsApp), rôles lus dans la table `user_roles`. Une personne ne voit que les espaces que ses rôles ouvrent ; si elle en a plusieurs, un sélecteur « Mes espaces » apparaît dans la barre latérale (ordinateur) et dans l'en-tête (téléphone). Stripe actif si `STRIPE_SECRET_KEY` est définie, sinon paiement « virement déclaré » à valider par les fondatrices.
- Toute la logique métier passe par une interface unique `src/lib/data/repo.ts` (type `Repo`), avec deux implémentations : `demo-repo.ts` et `supabase-repo.ts`. `src/lib/data/index.ts` choisit selon l'env. Les pages et server actions n'appellent jamais Supabase directement.

## Rôles et permissions (Lot 0)

- Rôles **cumulables** : `member`, `moderator`, `admin`, `partner`, `pro` ; une personne sans rôle est `guest` (compte gratuit). Julia et Nora sont `admin` (l'ancien rôle `founder`). Exemple de cumul : Kenza = `member` + `partner`, Loubna = `member` + `pro`, Yasmine = `member` + `moderator`.
- `src/lib/permissions.ts` (module pur, importable partout, y compris le middleware) : liste des **capacités nommées** (`space.member`, `space.partner`, `space.pro`, `space.admin`, `events.book`, `events.manage`, `payments.validate`, `reminders.send`, `members.view_directory`, `members.manage`, `roles.manage`, `messages.post`, `messages.moderate`, `carnet.view`, `offers.view`, `offers.manage_own`, `offers.manage_all`, `listing.manage_own`, `organizations.manage_own`, `organizations.manage_all`, `crm.access`, `audit.view` ; Lot 6 : `audit.export`, `privacy.process_deletions`, `security.manage`), matrice `ROLE_CAPABILITIES` rôle → capacités, espaces (`SPACE_ACCESS` : préfixe d'adresse + capacité exigée), helpers `hasRole`, `isAdmin`, `inCircle`, `rolesCan`, `spacesFor`.
- Gardes serveur dans `src/lib/auth.ts` : `requireCapability(cap)` (layouts, pages : redirige), `checkCapability(cap)` (server actions : renvoie null), `viewerCan`, `viewerSpaces` ; `requireMember` / `requireFounder` sont des raccourcis.
- Middleware (`src/middleware.ts` → `src/lib/supabase/middleware.ts`) : en mode réel, lit les rôles dans `user_roles` et vérifie la capacité exigée par l'espace de l'adresse.
- La page **Rôles et accès** (`/fondatrices/roles`) ajoute / retire des rôles (jamais son propre accès admin, jamais la dernière admin) ; chaque changement est journalisé et la personne reçoit une notification.

## Modèle de données

### 0001_init.sql

- `profiles` (id = auth.users.id, first_name, last_name, whatsapp, email, job, country, bio, plan: `free|member|premium`, plan_ends_at, avatar_url, created_at). La colonne `role` a été remplacée par `user_roles` (0003).
- `places` (carnet : slug, name, kind, area, note, category: `manger|sortir|bien-etre-sport|famille`, recommended_by, club_event_label, club_event_date, url)
- `events` (slug, title, starts_at, ends_at, place_id, address, description, program jsonb, capacity, price_public, price_member, premium_free bool, status: `draft|published|cancelled`, image, image_caption, featured bool)
- `bookings` (event_id, profile_id nullable, guest_first_name, guest_whatsapp, status: `pending|paid|offered|waitlist|cancelled`, amount, method: `card|transfer|free`, ticket_code unique, stripe_session_id, created_at)
- `payments` (profile_id, kind: `booking|membership`, booking_id nullable, plan nullable, amount, method, status: `declared|validated|refunded`, declared_at, validated_at, validated_by)
- `memberships` (profile_id, plan, starts_at, ends_at, status)
- `memories` (souvenirs « Déjà vécu » : title, place, date_label, participants, image)
- `messages` (channel: `general` ou `dm:<uuidA>:<uuidB>`, author_id, body, created_at)
- `reminders` (profile_id, reason: `renewal|expired|unpaid`, due_at, sent_at, answered bool, scheduled_for)
- `partner_offers` (title, partner, detail)
- Vues utiles pour les fondatrices : remplissage par événement, encaissements par mois, échéances par mois, actions à traiter.
- RLS : lecture publique des événements publiés, souvenirs, formules ; carnet, annuaire, salon et messages réservés au cercle (member, moderator, admin) ; tout en écriture pour `has_role('admin')` ; chacune lit/écrit ses propres réservations, profil, messages.

### 0002_carnet_annuaire.sql

- Informations pratiques des lieux et les 157 adresses de l'annuaire.

### 0003_socle.sql (Lot 0)

- `user_roles` (profile_id, role, granted_by, granted_at ; clé (profile_id, role)). Reprise de l'ancien `profiles.role` (`founder` → `admin`, `member` → `member`), puis suppression de la colonne. Déclencheur : on ne retire jamais la dernière admin.
- Fonctions `security definer` : `has_role(text)`, `has_any_role(text[])` (personne connectée), `user_has_any_role(uuid, text[])` (autre personne), `is_org_member(uuid, text[])`, `shares_organization(uuid)`. `is_founder()` / `is_member()` sont supprimées : toutes les politiques et fonctions (`validate_payment`, `protect_profile`, `apply_membership`, vues `founder_actions`, `dues_by_month`) utilisent les rôles. `apply_membership` donne le rôle `member`. `cancel_booking` renvoie `{event_id, waitlist_profile_id}` pour prévenir la première de la liste d'attente.
- `organizations` (slug, name, kinds `partner|pro` (les deux possibles), category, description, address, area (quartier), lat/lng optionnelles, contact_name, phone, email, website, instagram, status `active|pending|suspended`, place_id vers le carnet) et `organization_members` (organization_id, profile_id, role `owner|staff`). `partner_offers.organization_id` relie une offre à son établissement. RLS : l'admin gère tout ; la propriétaire modifie sa fiche (pas le statut, les types ni le slug) ; les membres de l'établissement le voient ; le cercle voit les établissements actifs.
- `audit_log` (actor_id, action `domaine.verbe`, target_type, target_id, summary, details jsonb, created_at). Lecture : admin ; écriture : en son propre nom (admin, modératrice) ; ni modification ni suppression.
- `notifications` (recipient_id, type `booking_confirmed|waitlist_spot|event_published|payment_validated|role_changed`, title, body, link interne, read_at, created_at) et `notification_prefs` (profile_id, type, in_app, email, push). Chacune lit / marque comme lues / règle les siennes ; seule `read_at` est modifiable. Déclencheur : une notification coupée (`in_app = false`) n'est pas enregistrée.
- `supabase/seed.sql` : généré par `npm run seed:sql` depuis `src/lib/seed.ts` (mêmes données que la démo, y compris rôles, organisations, journal et notifications).
- `npm run test:sql` (`scripts/test-sql.mjs`) : banc de test PGlite (Postgres en WebAssembly, sans serveur) qui simule le schéma `auth` de Supabase, exécute toutes les migrations puis le seed, et vérifie rôles, RLS (en simulant des personnes via `request.jwt.claim.sub` + `set role authenticated`), fonctions métier et reprise de l'ancien rôle unique.

### 0008_securite.sql (Lot 6)

- Durcissements : `revoke execute` sur les fonctions internes et de déclencheurs ; codes de billet à 6 caractères ; `get_ticket` ne renvoie plus `profile_id`.
- `security_settings` (une ligne : `admin_mfa_enforced`), `session_aal()` (claim `aal` du JWT), `admin_mfa_ok()` ; politiques RLS **restrictives** : quand la base exige la 2FA, une admin en AAL1 ne modifie pas `user_roles`, ne lit pas `audit_log` ni la file de suppression.
- `consents` (historique horodaté, jamais modifié ; `seq` pour l'ordre), vue `current_consents`, `consent_default(kind)`, `has_consent(profile, kind)` (pour les autres lots).
- `deletion_requests` (pending / cancelled / done / rejected, `scheduled_for` = +30 jours) ; fonctions `request_account_deletion`, `cancel_account_deletion` (journalisées), `anonymize_account(profile, request)` (admin en AAL2 si exigé, ou clé service ; refuse un compte admin et soi-même ; efface coordonnées, textes des messages, notifications, préférences, consentements, push, rôles ; conserve paiements et réservations).
- `push_subscriptions` (endpoint, clés p256dh / auth ; chacune gère les siens).
- `rate_limits` + `rate_limit_hit(key, limit, window)` et `purge_rate_limits()` (clé service seulement).
- `my_sessions()` : sessions de la personne connectée (lit `auth.sessions`).
- Politique `audit_log_self_insert` : une personne journalise ses propres opérations sensibles (export, consentement, connexion, 2FA…) sur sa propre fiche.
- Tests : section « Lot 6 » de `npm run test:sql` (`scripts/test-sql/securite.mjs`).

## Sécurité et conformité (Lot 6, code)

Module `src/lib/modules/securite/` : `types.ts`, `repo.ts` (`SecuriteRepo`, branché par `extends` dans `Repo`), `demo-repo.ts`, `supabase-repo.ts`, `seed.ts` (démo : consentements d'Inès, demande de suppression de Chloé).

- **Limitation de fréquence** (`rate-limit.ts`) : `rateLimit(name, subject?)`, règles dans `RATE_LIMITS` (booking, magicLinkIp, magicLinkEmail, message, report (pour le Lot 1), checkout, ticketLookup, assistant, dataExport, account, mfa). Magasin Postgres en mode réel avec clé service, mémoire sinon, remplaçable (`setRateLimitStore`). Une panne du magasin laisse passer.
- **En-têtes HTTP** (`headers.ts`, appliqués par `next.config.ts`) : CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS (production). Origines supplémentaires : `CSP_EXTRA_*`.
- **Double authentification** (`mfa-core.ts` pur, `mfa.ts`) : exigée en mode réel pour `space.admin` (sauf `ADMIN_MFA_REQUIRED=false`). Le middleware redirige une admin en AAL1 vers `/connexion/double-authentification` ; `getViewer()` retire le rôle `admin` d'une session AAL1 (`enforceAdminMfa`). Après le lien magique, `sign-in.ts` journalise la connexion admin.
- **Redirections** : `safeRedirectPath()` (`request.ts`) partout où une adresse `suite` est suivie.
- **RGPD** : `consents.ts` (libellés, valeurs par défaut), `export.ts` (`buildPersonalExport`) + `export-route.ts`. À compléter par chaque lot qui ajoute des données personnelles (export + anonymisation), voir `docs/securite/donnees.md`.
- **Journal** : `audit-view.ts` (libellés partiels, familles, `parseAuditFilters`, `auditMatches` pour la démo, `auditCsv` avec neutralisation des formules). Nouvelles actions : type `SecuriteAuditAction`.
- **Push Web** (`push.ts`) : chiffrement RFC 8291 et JWT VAPID avec `node:crypto` (aucune dépendance) ; `deliverPush` est appelé par `deliverExternally` dans `notify.ts`, respecte la préférence `push`, supprime les abonnements expirés. Clés : `node scripts/vapid-keys.mjs`.
- **PWA** : `public/sw.js` (statiques en cache d'abord ; pages en réseau d'abord avec copie, jamais pour fondatrices / partenaire / pro / API / messages / données ; page `/hors-ligne` ; cache vidé à la déconnexion `?au-revoir`), `PwaRegister` (enregistrement en production, invitation d'installation), `InstallHelp` (bouton natif Android, marche à suivre iPhone), manifeste complet (`id`, `scope`, raccourcis).
- Capacités ajoutées : `audit.export`, `privacy.process_deletions`, `security.manage` (admin). Styles : `src/styles/securite.css`.
- Tâche planifiée : `vercel.json` → `/api/cron/securite` (quotidienne, `Authorization: Bearer CRON_SECRET`) : purge des compteurs, nombre de suppressions échues.
- Sauvegardes : `scripts/backup.sh` (voir `docs/securite/sauvegardes.md`). Audit : `docs/securite/audit.md`.
- Tests sans serveur : `npm run test:securite` (`scripts/test-securite.mts` : redirections, 2FA, en-têtes, CSV, push).
- **Applis natives** : elles pourront s'authentifier avec Supabase Auth (même lien magique / OTP, même 2FA) et lire les données directement sous RLS ; l'export RGPD est exposé en `GET /api/moi/export` (session par cookie aujourd'hui ; à ouvrir au jeton `Authorization: Bearer` le jour où une appli native existe).

## Journal et notifications (code)

- `src/lib/audit.ts` : `audit(entry)` enregistre une opération (échec signalé dans les logs, jamais bloquant). Journalisés : validation de virement, création / modification / publication d'événement, relance, ajout / retrait de rôle.
- `src/lib/notify.ts` : point d'entrée unique `notify(rows)` puis aides par déclencheur (`bookingConfirmed`, `waitlistSpot`, `eventPublished`, `paymentValidated`, `roleGranted`). Enregistre les notifications in-app ; `deliverExternally` est l'endroit prévu pour l'e-mail et le push (préférences `email` / `push` déjà stockées). En mode réel, les notifications pour une autre personne (ex. place libérée par une membre) passent par la clé service si elle est configurée.

## Routes

Visiteuse (public) : `/` (accueil vitrine + appli mobile), `/rendez-vous`, `/rendez-vous/[slug]` (détail + réservation), `/club` (déjà vécu, déroulé d'un lunch, citation), `/formules`, `/connexion`, `/billet/[code]`.
Membre : `/espace`, `/espace/agenda`, `/espace/cercle` (salon + annuaire), `/espace/cercle/[id]` (messages privés), `/espace/carnet`, `/espace/assistant`, `/espace/moi` (carte, adhésion, renouvellement, Premium, offres).
Membre : `/espace/notifications` (liste + préférences), cloche avec compteur dans l'en-tête (téléphone) et entrée « Notifications » dans la barre latérale.
Fondatrices (admin) : `/fondatrices`, `/fondatrices/a-traiter`, `/fondatrices/membres`, `/fondatrices/evenements` (+ création/édition, publication), `/fondatrices/encaissements`, `/fondatrices/crm` (contacts = profils + rôles + établissements, segments ; CRM complet au lot 5), `/fondatrices/roles` (Rôles et accès, matrice des droits), `/fondatrices/journal`, `/fondatrices/notifications`, `/fondatrices/plus` (téléphone : entrées sans onglet).
Partenaire (`space.partner`) : `/partenaire` (établissement + emplacements « Bientôt » : offres, code / QR, statistiques, contrat), `/partenaire/etablissement`, `/partenaire/notifications`.
Pro (`space.pro`) : `/pro` (fiche + « Bientôt » : fiche carnet, abonnement, statistiques, contrat), `/pro/fiche`, `/pro/notifications`.
Les espaces Partenaire et Pro reprennent la version jour de l'espace fondatrices (`OrgSpaceLayout`, `OrgChrome`), sur ordinateur et téléphone. Une admin sans établissement y voit tous ceux du type.
API : `/api/checkout` (crée la session Stripe), `/api/stripe/webhook`.
Lot 6 : `/confidentialite`, `/mentions-legales`, `/mes-donnees` (tout compte connecté), `/connexion/double-authentification`, `/hors-ligne` (service worker), `/espace/moi/donnees` (+ `/export`), `/fondatrices/securite` (2FA, file des suppressions, protections), `/fondatrices/journal` (filtres, détail `?entree=`) + `/fondatrices/journal/export` (CSV), `/api/moi/export` (JSON), `/api/cron/securite`.
Garde d'accès dans `src/middleware.ts` (capacité par espace) + vérification côté serveur dans chaque layout et chaque server action (`requireCapability` / `checkCapability`).

## Actions (server actions, `src/app/actions/*`)

Réserver (avec contrôle des places et liste d'attente ; notification de confirmation), annuler (notification à la première de la liste d'attente), adhérer / renouveler / passer Premium, poster au salon, envoyer un message privé, valider un virement (un ou tous ; journal + notification), relancer (une, groupe ; journal), publier un brouillon (lieu obligatoire ; journal + notification aux membres), créer / modifier un événement (journal), ajouter / retirer un rôle (`actions/roles.ts` ; journal + notification), marquer des notifications comme lues et régler ses préférences (`actions/notifications.ts`). Chaque action revalide les pages concernées.

## Plus tard (non bloquant)

Envoi du billet et des relances sur WhatsApp (Twilio ou WhatsApp Business API, file `reminders`), assistant branché sur Claude, export comptable, CSP à nonce, purge automatique du journal (1 an) et des réservations invitées (1 an).
