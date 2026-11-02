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
- Carte (Lot 3) : Leaflet 1.9 + react-leaflet 5, tuiles OpenStreetMap (sans clé), chargées seulement côté navigateur (`next/dynamic`, `ssr: false`).

## Deux modes, choisis par les variables d'environnement

- **Mode démo** (par défaut, aucune clé) : données en mémoire côté serveur, initialisées depuis `src/lib/seed.ts` (toutes les données d'exemple du brief : rendez-vous, souvenirs, carnet, membres, salon, virements, relances, brouillons, encaissements, échéances, organisations, journal, notifications). Un sélecteur d'espace comme dans la maquette, à cinq entrées : Compte gratuit (visiteuse), Membre (Inès), Partenaire (Kenza, Bloom House), Pro (Loubna, ostéopathe), Fondatrices (Julia, admin). Le personnage est stocké en cookie `nc_demo_role` (`guest|member|partner|pro|admin` ; l'ancien `founder` est lu comme `admin`). Paiement simulé. Bandeau « Aperçu · données d'exemple ».
- **Mode réel** (si `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont définies) : Supabase pour tout, connexion par lien magique e-mail (et plus tard OTP WhatsApp), rôles lus dans la table `user_roles`. Une personne ne voit que les espaces que ses rôles ouvrent ; si elle en a plusieurs, un sélecteur « Mes espaces » apparaît dans la barre latérale (ordinateur) et dans l'en-tête (téléphone). Stripe actif si `STRIPE_SECRET_KEY` est définie, sinon paiement « virement déclaré » à valider par les fondatrices.
- Toute la logique métier passe par une interface unique `src/lib/data/repo.ts` (type `Repo`), avec deux implémentations : `demo-repo.ts` et `supabase-repo.ts`. `src/lib/data/index.ts` choisit selon l'env. Les pages et server actions n'appellent jamais Supabase directement.

## Rôles et permissions (Lot 0)

- Rôles **cumulables** : `member`, `moderator`, `admin`, `partner`, `pro` ; une personne sans rôle est `guest` (compte gratuit). Julia et Nora sont `admin` (l'ancien rôle `founder`). Exemple de cumul : Kenza = `member` + `partner`, Loubna = `member` + `pro`, Yasmine = `member` + `moderator`.
- `src/lib/permissions.ts` (module pur, importable partout, y compris le middleware) : liste des **capacités nommées** (`space.member`, `space.partner`, `space.pro`, `space.admin`, `events.book`, `events.manage`, `payments.validate`, `reminders.send`, `members.view_directory`, `members.manage`, `roles.manage`, `messages.post`, `messages.moderate`, `carnet.view`, `offers.view`, `offers.manage_own`, `offers.manage_all`, `listing.manage_own`, `organizations.manage_own`, `organizations.manage_all`, `crm.access`, `audit.view`, `crm.export` (Lot 5)), matrice `ROLE_CAPABILITIES` rôle → capacités, espaces (`SPACE_ACCESS` : préfixe d'adresse + capacité exigée), helpers `hasRole`, `isAdmin`, `inCircle`, `rolesCan`, `spacesFor`.
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

### 0005_partenaires.sql (Lot 3)

- `establishment_details` (photos ≤ 8, horaires, WhatsApp, catégorie du carnet, réduction membres) ; écriture par l'équipe (propriétaire et collaboratrices, nouvelle politique `organizations_staff_update`) et l'admin.
- `partner_offers` enrichie : `title`, `conditions`, `valid_from` / `valid_until`, `audience` `all|member|premium`, `status` `active|paused`. Les membres ne voient que les offres actives ; l'équipe gère les siennes.
- `offer_codes` (code `OF-XXXX-XXXX`, horodatage de création et de validation, validée par). Aucune écriture directe : `claim_offer_code(offer)` (membre du cercle, offre active, dans sa période, public Premium vérifié ; un seul code ouvert par membre et par offre) et `validate_offer_code(code)` (équipe de l'établissement ou admin, une seule fois ; renvoie le prénom, jamais les coordonnées).
- `org_stats_monthly` (vues, clics contact / WhatsApp / itinéraire) alimentée par `track_org_event(org, kind)` (les visites de l'équipe ne comptent pas) ; vue `offer_code_stats` (codes générés / validés par mois, `security_invoker`). Chaque établissement ne voit que ses chiffres.
- `pro_subscriptions` + `pro_subscription_payments` : lecture par l'équipe ; le cercle voit seulement les abonnements actifs (fiches visibles) ; écriture par le serveur (clé service). `refresh_pro_subscriptions()` passe les échéances dépassées en retard puis suspendues après 15 jours (service uniquement).
- `organization_invites` + `invite_org_member(org, email)` (propriétaire ou admin) + déclencheur sur `profiles` qui applique les invitations à la création du compte (`join_organization` : rattachement `staff` + rôle de l'espace).
- `member_locations` : consentement (`sharing`, `consented_at`), précision `area|approx`, affichage `name|anonymous`. Déclencheur : coordonnées arrondies à 0,005° (~550 m), tout est effacé quand le partage s'arrête. Le cercle ne voit que les positions partagées (même l'admin ne voit pas les autres).
- `audit_log` : l'équipe d'un établissement journalise ses opérations (`target_type = 'organization'`).

Code du module : `src/lib/modules/partenaires/` (`types`, `repo` (interface `PartenairesRepo`), `demo`, `supabase`, `seed`, `quartiers`, `domain` (règles pures : formules, statut effectif, disponibilité d'une offre, arrondi), `server` (droits sur un établissement, établissements visibles), `billing` (paiement simulé)). Actions : `src/app/actions/partenaires.ts`. Styles : `src/styles/partenaires.css`. Tests : `scripts/test-sql/partenaires.mjs`. Données SQL : `scripts/seed-sql/partenaires.mjs`.
### 0007_crm.sql (Lot 5)

- `crm_contacts` (kind `person|organization`, profile_id unique et facultatif, organization_id, prénom, nom, société, métier, e-mail, téléphone, instagram, ville, source, status, tags text[], notes, marketing_consent + consent_at, owner_id, created_by). Le déclencheur `crm_sync_profile` crée la fiche de chaque nouveau profil (et la migration celles des profils existants) ; la suppression d'un compte détache la fiche sans la supprimer.
- `crm_stages` (label, position, outcome `open|won|lost` ; six étapes par défaut à UUID fixes), `crm_deals` (contact, étape, titre, valeur, motif de perte, responsable, position dans la colonne, closed_at). Une étape utilisée ne peut pas être supprimée (`on delete restrict`).
- `crm_activities` (type `call|whatsapp|email|meeting|note|event|system`, body, occurred_at, author_id), `crm_tasks` (contact facultatif, titre, échéance, responsable, done_at, reminded_at), `crm_segments` (nom, description, filtres en jsonb).
- RLS : tout est réservé à `has_role('admin')` ; aucune autre personne (membre, partenaire, pro, modératrice, anonyme) ne lit ni n'écrit rien.
- `crm_merge_contacts(keep, drop)` (security definer, admin) : reprend activités, tâches et opportunités, complète les champs vides, réunit étiquettes et notes, garde le compte relié ; refuse de fusionner deux fiches reliées à deux comptes.
- Les contraintes fermées de `audit_log.target_type`, `notifications.type` et `notification_prefs.type` deviennent un format (`^[a-z_]{1,40}$`) pour que chaque lot ajoute ses valeurs ; les listes typées restent dans le code.
- Tests : `scripts/test-sql/crm.mjs` (synchronisation, RLS par rôle, fusion, journal / notifications, étapes).

## CRM (code, Lot 5)

- Module `src/lib/modules/crm/` : `types.ts`, `repo.ts` (interface `CrmRepo`, méthodes préfixées `crm*`, étendue par `Repo`), `demo-repo.ts` (mémoire, initialisée paresseusement depuis `seed.ts` du module et les profils de la démo) et `supabase-repo.ts`, `domain.ts` (statut calculé, lignes enrichies, filtres ↔ adresse, doublons, tâches), `stats.ts`, `csv.ts` (lecture `,` / `;`, écriture Excel avec neutralisation des formules), `message.ts` (texte personnalisé, lien wa.me), `sync.ts`, `load.ts` (chargement des pages + rappels de tâches), `validation.ts` (zod), `business-source.ts` (retombées des deals du Lot 4), `seed.ts` (contacts, pipeline, échanges, tâches et segments d'exemple ; repris par `npm run seed:sql`).
- Actions `src/app/actions/crm.ts` (toutes sous `crm.access`, journalisées `crm.*`) ; export `GET /fondatrices/crm/export` (`crm.export`, journalisé). Composants `src/components/crm/`, styles `src/styles/crm.css` (importés par le layout du CRM).
- Raccourcis clavier : `/` chercher, `n` nouveau contact, `g` + lettre pour changer d'onglet, `j` / `k` / `x` / Entrée dans la liste, `?` aide.
### 0006_engagement.sql (Lot 4)

- `engagement_settings` (une ligne : barème des points Business `deal_points_base`, `deal_points_per_thousand`, `deal_points_bonus_cap`, `simulated_payments` coupé par défaut) et `engagement_prefs` (par membre : `widgets` jsonb `[{id, enabled}]` dans l'ordre, `leaderboard_opt_out`).
- Boutique : `products` (slug, titre, catégorie, prix public / membre, extrait, statut `draft|published|archived`), `product_files` (chemin dans le bucket privé `ressources`, `is_preview`), `purchases` (un seul achat payé par produit et personne). RLS : le cercle voit les produits publiés ; les fichiers ne sont lisibles qu'après achat (ou aperçu) ; mêmes règles sur `storage.objects`. Achat simulé par `purchase_product_simulated(product)` (prix membre recalculé, refusé si le paiement simulé est coupé).
- Parrainage : `referral_codes` (créé par `my_referral_code()`), `referrals` (une filleule = une marraine, prénom + initiale figés), `referral_rewards` (configurables), `referral_reward_grants`. `claim_referral(code)` rattache une inscription ; le déclencheur `referral_on_member` (ajout du rôle `member`) convertit, attribue les récompenses actives, crédite les points et notifie.
- Espace Business : `business_deals` (déclarante, partenaire du cercle, nature, type, montant facultatif, statut `pending|confirmed|refused`) et `points_ledger`. Une membre ne déclare qu'en son nom et en attente ; seule la partenaire répond, via `respond_deal()` qui crédite les deux. `business_leaderboard()` exclut les membres retirées du classement.
- Les contraintes `notifications.type`, `notification_prefs.type` et `audit_log.target_type` sont **étendues** (fusion des valeurs existantes, indépendante de l'ordre des lots) par `nc_extend_check`.
- Tests : `scripts/test-sql/engagement.mjs` (49 vérifications) ; données : `src/lib/modules/engagement/seed.ts` → `scripts/seed-sql/engagement.mjs`.

## Module engagement (Lot 4, `src/lib/modules/engagement/`)

- `types.ts`, `repo.ts` (`EngagementRepo`, étendu par `Repo`), `demo.ts` (mémoire, mêmes règles que la base), `supabase.ts` (session + RLS, fonctions SQL, URL signées).
- `widgets.ts` (catalogue, ordre par défaut, validation des préférences), `weather.ts` (Open-Meteo, cache 30 min en mémoire, repli sur la dernière mesure), `prayer.ts` (Aladhan méthode 21, heures UTC converties dans le fuseau de l'appli, cache par jour, calcul astronomique local en repli), `quotes.ts`, `news-source.ts` (point de branchement du Lot 1).
- `billing.ts` : **seul** endroit du paiement de la boutique (simulé ; à remplacer au Lot 2). `download.ts` + routes `/espace/boutique/telecharger/[fileId]` et `/fondatrices/boutique/fichier/[fileId]` : vérification achat / aperçu / admin puis redirection signée ou PDF généré (`pdf.ts`).
- `referral-cookie.ts` (middleware : `?parrain=CODE` → cookie `nc_parrain` 30 jours), `referral.ts` (`claimReferral` appelé au retour du lien magique, à la réservation et à l'adhésion).
- `notifications.ts` (via `notify()`), `labels.ts` (libellés fusionnés dans les tables partagées), `stats.ts` (indicateurs admin), `points.ts` (barème, identique à `deal_points` en SQL).
- Interface : `src/components/engagement/*`, styles `src/styles/engagement.css` (jetons de la maquette noir et blanc).
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

## E-mails (vague 2)

- Migration `0011_emails.sql` : `email_log` (destinataire, modèle, objet, statut `sent|failed`, fournisseur, identifiant fournisseur, erreur, données du modèle, pièces jointes, renvoi de, auteur). Lecture `has_role('admin')` + politique restrictive `admin_mfa_ok()` ; aucune écriture par les comptes (clé service). Déclencheur `email_log_forget_profile` (adresse du profil remise à null par l'anonymisation → envois effacés) ; `purge_email_log(jours)` (clé service). Tests : `scripts/test-sql/emails.mjs`.
- Module `src/lib/modules/emails/` : `types.ts` (identifiants de modèles, `Mailer`, `OutgoingEmail`, journal), `config.ts` (`RESEND_API_KEY`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_UNSUBSCRIBE_SECRET`, adresse des liens), `layout.ts` (blocs HTML + texte, tables et styles en ligne), `templates.ts` (schémas zod tolérants, données d'exemple, essentiel ou non, préférence qui coupe le modèle), `render.ts`, `channel.ts` (règles pures du canal e-mail), `unsubscribe.ts` (jeton HMAC), `mailers/` (`resend`, `console`, `smtp`), `attachments.ts` (QR PNG en `cid:billet-qr`, `.ics` via `eventIcs`), `service.ts` (`prepareEmail`, `sendTemplate(s)`, `resendLogged`), `log-store.ts` (Supabase / mémoire), `notify-channel.ts`, `triggers.ts`, `unsubscribe-apply.ts`, `register.ts`.
- Branchements : `src/lib/mail-hook.ts` (`sendEmail`, mailer rangé sur `globalThis`, branchement à la demande), `src/instrumentation.ts`, `deliverExternally` dans `src/lib/notify.ts` (données riches par ligne via `notifyWith`, interface `notify(rows)` inchangée), `/auth/callback` (bienvenue), `actions/securite.ts` (suppression), `securite/export-route.ts` (export), `actions/partenaires.ts` (invitation), `actions/founders.ts` (relances).
- Routes : `/fondatrices/emails`, `/fondatrices/emails/apercu/[modele]`, `/e-mails/desinscription` (confirmation), `POST /api/emails/desinscription` (un clic), `/api/cron/emails` (renouvellements J-30/J-7/J-1, purge ; `vercel.json` 8 h UTC). Actions : `src/app/actions/emails.ts` (désinscription, renvoyer, m'envoyer un exemple). Styles : `src/styles/emails.css`. Tests : `npm run test:emails`. Mise en production : `docs/emails.md`.
## Contrats (vague 2, chantier 2b)

### 0010_contrats.sql

- `contract_templates` (kind `membership|partner|pro`, version, title, body_md, effective_from, is_active, notes) : une seule version active par type (index partiel), `activate_contract_template(id)` (admin). Un modèle utilisé par un contrat ne change plus (déclencheur `protect_contract_template`). Les trois modèles v1 sont insérés par la migration (bloc généré par `node scripts/contrats-templates-sql.mjs --write` depuis `templates.ts`).
- `contracts` (numéro unique `NC-(ADH|PAR|PRO)-AAAA-XXXXXX`, modèle + version recopiée, signataire, établissement, formule, montant, devise, échéances, échéancier jsonb, dates, variables jsonb, texte rendu, `pdf_sha256`, `pdf_path`, statut `pending|accepted|cancelled`, référence de souscription, source, relances). Déclencheur `protect_contract` : naissance « en attente », « accepté » seulement avec une preuve, contenu figé après acceptation, annulation définitive, suppression interdite d'un contrat accepté.
- `contract_acceptances` (une par contrat : signataire figée, horodatage, IP, navigateur, version, empreinte, fournisseur, phrase cochée) : **immuable** (déclencheur, y compris pour la clé service). Écriture uniquement par `accept_contract(contrat, empreinte, ip, ua, phrase)` (security definer : la signataire elle-même ou la clé service, contrat en attente, empreinte identique ; journalise `contract.accept`).
- RLS : modèles actifs lisibles par toute personne connectée, gestion admin ; contrats et preuves lisibles par la signataire, la propriétaire de l'établissement et l'admin (`can_read_contract`) ; écriture des contrats admin / clé service. Bucket privé `contrats` (lecture selon les mêmes droits).
- Tests : `scripts/test-sql/contrats.mjs` (56 vérifications, dont génération PDF : fichier valide, relu par pdf-lib, empreinte, rendu déterministe).

### Code

- Module `src/lib/modules/contrats/` : `types.ts`, `templates.ts` (textes v1 + liste des variables), `render.ts` (variables, notes `>>`, Markdown simplifié → blocs), `pdf.ts` (pdf-lib : contrat et certificat d'acceptation), `domain.ts` (numéro, échéancier, montants, variables, document + SHA-256), `repo.ts` (`ContratsRepo`, branché par `extends` dans `Repo`), `demo-repo.ts`, `supabase-repo.ts` (clé service pour générer, déposer, journaliser), `service.ts` (génération, `requireContractAcceptance`, `prepareContract`, `acceptContract`, `handleSubscriptionActivated`, relance, modèles, `serveContractPdf`), `signature.ts` (`SignatureProvider` : `simple`, emplacement Yousign), `register.ts` (abonnement à `onSubscriptionActivated`, chargé par `src/instrumentation.ts`), `emit.ts` (émissions provisoires depuis les parcours existants en attendant le chantier paiements), `seed.ts` + `seed-build.ts` (contrats d'exemple, démo et `scripts/seed-sql/contrats.mjs`), `labels.ts`, `views.ts`.
- `src/lib/payment-hooks.ts` : la liste des abonnés est portée par `globalThis` (partagée entre bundles).
- Actions `src/app/actions/contrats.ts` ; composants `src/components/contrats/` (`ContractStep` étape isolée, `useContractGate`, `ContractDocument`, `MyContracts`, `OrgContracts`, `ContractsCard`, `CrmContracts`, `admin`) ; styles `src/styles/contrats.css`. Capacité `contracts.manage` (admin).
- Routes : `/espace/moi/contrats`, `/partenaire/contrats`, `/pro/contrats`, `/fondatrices/contrats` (+ `/[id]`, `/modeles`, `/modeles/[id]`, `/nouveau`) ; PDF `…/contrats/[id]/pdf` (`?certificat=1`) sous chaque espace.
- Points à trancher : `docs/contrats/README.md`.

## Journal et notifications (code)

- `src/lib/audit.ts` : `audit(entry)` enregistre une opération (échec signalé dans les logs, jamais bloquant). Journalisés : validation de virement, création / modification / publication d'événement, relance, ajout / retrait de rôle ; Lot 3 : fiche établissement, invitation, création / modification / pause d'offre, validation de code, paiement / changement / arrêt d'abonnement pro.
- `src/lib/notify.ts` : point d'entrée unique `notify(rows)` puis aides par déclencheur (`bookingConfirmed`, `waitlistSpot`, `eventPublished`, `paymentValidated`, `roleGranted`). Enregistre les notifications in-app ; `deliverExternally` relaie par e-mail (vague 2, préférence `email`, essentiels toujours) et push (Lot 6, préférence `push`). En mode réel, les notifications pour une autre personne (ex. place libérée par une membre) passent par la clé service si elle est configurée.

## Routes

Visiteuse (public) : `/` (accueil vitrine + appli mobile), `/rendez-vous`, `/rendez-vous/[slug]` (détail + réservation), `/club` (déjà vécu, déroulé d'un lunch, citation), `/formules`, `/connexion`, `/billet/[code]`.
Membre : `/espace`, `/espace/agenda`, `/espace/cercle` (salon + annuaire), `/espace/cercle/[id]` (messages privés), `/espace/carnet`, `/espace/assistant`, `/espace/moi` (carte, adhésion, renouvellement, Premium, offres).
Membre : `/espace/notifications` (liste + préférences), cloche avec compteur dans l'en-tête (téléphone) et entrée « Notifications » dans la barre latérale.
Membre (Lot 3) : `/espace/offres`, `/espace/fiche/[slug]` (fiche établissement, « Utiliser l'offre »), `/espace/fiche/[slug]/aller?vers=telephone|email|site|instagram|whatsapp|itineraire` (compte le clic puis redirige), `/espace/carte` (carte + réglages de position). Onglets Carnet · Offres · Carte en haut des trois pages ; sur téléphone, elles passent par l'onglet Carnet.
Fondatrices (admin) : `/fondatrices`, `/fondatrices/a-traiter`, `/fondatrices/membres`, `/fondatrices/evenements` (+ création/édition, publication), `/fondatrices/encaissements`, `/fondatrices/crm` (contacts = profils + rôles + établissements, segments ; CRM complet au lot 5), `/fondatrices/roles` (Rôles et accès, matrice des droits), `/fondatrices/journal`, `/fondatrices/notifications`, `/fondatrices/plus` (téléphone : entrées sans onglet).
Partenaire (`space.partner`) : `/partenaire` (chiffres du mois, validation, offres, dernières utilisations), `/partenaire/offres` (+ `/nouvelle`, `/[id]`), `/partenaire/valider` (`?code=` ouvert par le QR de la membre), `/partenaire/statistiques`, `/partenaire/etablissement` (fiche + équipe), `/partenaire/notifications`. `?org=` choisit l'établissement quand on en gère plusieurs.
Pro (`space.pro`) : `/pro` (visibilité, abonnement, chiffres du mois), `/pro/fiche`, `/pro/abonnement` (formules, paiement simulé, historique), `/pro/statistiques`, `/pro/notifications`.
Fondatrices (admin) : `/fondatrices`, `/fondatrices/a-traiter`, `/fondatrices/membres`, `/fondatrices/evenements` (+ création/édition, publication), `/fondatrices/encaissements`, `/fondatrices/crm` (aperçu), `/fondatrices/crm/contacts` (+ `/[id]`, `/nouveau`, `/doublons`), `/fondatrices/crm/pipeline`, `/fondatrices/crm/taches`, `/fondatrices/crm/segments`, `/fondatrices/crm/statistiques`, `/fondatrices/crm/import`, `/fondatrices/crm/export` (CSV), `/fondatrices/roles` (Rôles et accès, matrice des droits), `/fondatrices/journal`, `/fondatrices/notifications`, `/fondatrices/plus` (téléphone : entrées sans onglet).
Partenaire (`space.partner`) : `/partenaire` (établissement + emplacements « Bientôt » : offres, code / QR, statistiques, contrat), `/partenaire/etablissement`, `/partenaire/notifications`.
Membre (Lot 4) : `/espace` (accueil à widgets + « Personnaliser »), `/espace/boutique`, `/espace/boutique/[slug]`, `/espace/boutique/mes-ressources`, `/espace/parrainage`, `/espace/business` ; entrées dans la barre latérale et dans « Moi » (téléphone).
Fondatrices (Lot 4) : `/fondatrices/boutique` (+ `/nouveau`, `/[id]`), `/fondatrices/parrainage`, `/fondatrices/business` (entrées dans « Plus » sur téléphone).
Pro (`space.pro`) : `/pro` (fiche + « Bientôt » : fiche carnet, abonnement, statistiques, contrat), `/pro/fiche`, `/pro/notifications`.
Les espaces Partenaire et Pro reprennent la version jour de l'espace fondatrices (`OrgSpaceLayout`, `OrgChrome`), sur ordinateur et téléphone. Une admin sans établissement y voit tous ceux du type.
API : `/api/checkout` (crée la session Stripe), `/api/stripe/webhook`.
Lot 6 : `/confidentialite`, `/mentions-legales`, `/mes-donnees` (tout compte connecté), `/connexion/double-authentification`, `/hors-ligne` (service worker), `/espace/moi/donnees` (+ `/export`), `/fondatrices/securite` (2FA, file des suppressions, protections), `/fondatrices/journal` (filtres, détail `?entree=`) + `/fondatrices/journal/export` (CSV), `/api/moi/export` (JSON), `/api/cron/securite`.
Garde d'accès dans `src/middleware.ts` (capacité par espace) + vérification côté serveur dans chaque layout et chaque server action (`requireCapability` / `checkCapability`).

## Actions (server actions, `src/app/actions/*`)

Réserver (avec contrôle des places et liste d'attente ; notification de confirmation), annuler (notification à la première de la liste d'attente), adhérer / renouveler / passer Premium, poster au salon, envoyer un message privé, valider un virement (un ou tous ; journal + notification), relancer (une, groupe ; journal), publier un brouillon (lieu obligatoire ; journal + notification aux membres), créer / modifier un événement (journal), ajouter / retirer un rôle (`actions/roles.ts` ; journal + notification), marquer des notifications comme lues et régler ses préférences (`actions/notifications.ts`) ; Lot 3 (`actions/partenaires.ts`) : utiliser une offre, valider un code, créer / modifier / mettre en pause une offre, modifier la fiche, inviter une collaboratrice, payer / changer / arrêter l'abonnement pro, régler / retirer sa position. Chaque action revalide les pages concernées.
Réserver (avec contrôle des places et liste d'attente ; notification de confirmation), annuler (notification à la première de la liste d'attente), adhérer / renouveler / passer Premium, poster au salon, envoyer un message privé, valider un virement (un ou tous ; journal + notification), relancer (une, groupe ; journal), publier un brouillon (lieu obligatoire ; journal + notification aux membres), créer / modifier un événement (journal), ajouter / retirer un rôle (`actions/roles.ts` ; journal + notification), marquer des notifications comme lues et régler ses préférences (`actions/notifications.ts`), CRM (`actions/crm.ts` : fiches, import, fusion, actions groupées, échanges, tâches, pipeline, étapes, segments). Chaque action revalide les pages concernées.
Réserver (avec contrôle des places et liste d'attente ; notification de confirmation), annuler (notification à la première de la liste d'attente), adhérer / renouveler / passer Premium, poster au salon, envoyer un message privé, valider un virement (un ou tous ; journal + notification), relancer (une, groupe ; journal), publier un brouillon (lieu obligatoire ; journal + notification aux membres), créer / modifier un événement (journal), ajouter / retirer un rôle (`actions/roles.ts` ; journal + notification), marquer des notifications comme lues et régler ses préférences (`actions/notifications.ts`). Lot 4 : `actions/engagement.ts` (préférences de widgets, achat, déclarer / confirmer / retirer un deal, retrait du classement) et `actions/engagement-admin.ts` (produits, fichiers, publication, récompenses, remise, barème, paiement simulé ; tout est journalisé). Chaque action revalide les pages concernées.

## Plus tard (non bloquant)

Envoi du billet et des relances sur WhatsApp (Twilio ou WhatsApp Business API, file `reminders`), assistant branché sur Claude, export comptable, CSP à nonce, purge automatique du journal (1 an) et des réservations invitées (1 an).
