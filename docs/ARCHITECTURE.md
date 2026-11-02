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
- `src/lib/permissions.ts` (module pur, importable partout, y compris le middleware) : liste des **capacités nommées** (`space.member`, `space.partner`, `space.pro`, `space.admin`, `events.book`, `events.manage`, `payments.validate`, `reminders.send`, `members.view_directory`, `members.manage`, `roles.manage`, `messages.post`, `messages.moderate`, `carnet.view`, `offers.view`, `offers.manage_own`, `offers.manage_all`, `listing.manage_own`, `organizations.manage_own`, `organizations.manage_all`, `crm.access`, `audit.view`), matrice `ROLE_CAPABILITIES` rôle → capacités, espaces (`SPACE_ACCESS` : préfixe d'adresse + capacité exigée), helpers `hasRole`, `isAdmin`, `inCircle`, `rolesCan`, `spacesFor`.
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

## Journal et notifications (code)

- `src/lib/audit.ts` : `audit(entry)` enregistre une opération (échec signalé dans les logs, jamais bloquant). Journalisés : validation de virement, création / modification / publication d'événement, relance, ajout / retrait de rôle ; Lot 3 : fiche établissement, invitation, création / modification / pause d'offre, validation de code, paiement / changement / arrêt d'abonnement pro.
- `src/lib/notify.ts` : point d'entrée unique `notify(rows)` puis aides par déclencheur (`bookingConfirmed`, `waitlistSpot`, `eventPublished`, `paymentValidated`, `roleGranted`). Enregistre les notifications in-app ; `deliverExternally` est l'endroit prévu pour l'e-mail et le push (préférences `email` / `push` déjà stockées). En mode réel, les notifications pour une autre personne (ex. place libérée par une membre) passent par la clé service si elle est configurée.

## Routes

Visiteuse (public) : `/` (accueil vitrine + appli mobile), `/rendez-vous`, `/rendez-vous/[slug]` (détail + réservation), `/club` (déjà vécu, déroulé d'un lunch, citation), `/formules`, `/connexion`, `/billet/[code]`.
Membre : `/espace`, `/espace/agenda`, `/espace/cercle` (salon + annuaire), `/espace/cercle/[id]` (messages privés), `/espace/carnet`, `/espace/assistant`, `/espace/moi` (carte, adhésion, renouvellement, Premium, offres).
Membre : `/espace/notifications` (liste + préférences), cloche avec compteur dans l'en-tête (téléphone) et entrée « Notifications » dans la barre latérale.
Membre (Lot 3) : `/espace/offres`, `/espace/fiche/[slug]` (fiche établissement, « Utiliser l'offre »), `/espace/fiche/[slug]/aller?vers=telephone|email|site|instagram|whatsapp|itineraire` (compte le clic puis redirige), `/espace/carte` (carte + réglages de position). Onglets Carnet · Offres · Carte en haut des trois pages ; sur téléphone, elles passent par l'onglet Carnet.
Fondatrices (admin) : `/fondatrices`, `/fondatrices/a-traiter`, `/fondatrices/membres`, `/fondatrices/evenements` (+ création/édition, publication), `/fondatrices/encaissements`, `/fondatrices/crm` (contacts = profils + rôles + établissements, segments ; CRM complet au lot 5), `/fondatrices/roles` (Rôles et accès, matrice des droits), `/fondatrices/journal`, `/fondatrices/notifications`, `/fondatrices/plus` (téléphone : entrées sans onglet).
Partenaire (`space.partner`) : `/partenaire` (chiffres du mois, validation, offres, dernières utilisations), `/partenaire/offres` (+ `/nouvelle`, `/[id]`), `/partenaire/valider` (`?code=` ouvert par le QR de la membre), `/partenaire/statistiques`, `/partenaire/etablissement` (fiche + équipe), `/partenaire/notifications`. `?org=` choisit l'établissement quand on en gère plusieurs.
Pro (`space.pro`) : `/pro` (visibilité, abonnement, chiffres du mois), `/pro/fiche`, `/pro/abonnement` (formules, paiement simulé, historique), `/pro/statistiques`, `/pro/notifications`.
Les espaces Partenaire et Pro reprennent la version jour de l'espace fondatrices (`OrgSpaceLayout`, `OrgChrome`), sur ordinateur et téléphone. Une admin sans établissement y voit tous ceux du type.
API : `/api/checkout` (crée la session Stripe), `/api/stripe/webhook`.
Garde d'accès dans `src/middleware.ts` (capacité par espace) + vérification côté serveur dans chaque layout et chaque server action (`requireCapability` / `checkCapability`).

## Actions (server actions, `src/app/actions/*`)

Réserver (avec contrôle des places et liste d'attente ; notification de confirmation), annuler (notification à la première de la liste d'attente), adhérer / renouveler / passer Premium, poster au salon, envoyer un message privé, valider un virement (un ou tous ; journal + notification), relancer (une, groupe ; journal), publier un brouillon (lieu obligatoire ; journal + notification aux membres), créer / modifier un événement (journal), ajouter / retirer un rôle (`actions/roles.ts` ; journal + notification), marquer des notifications comme lues et régler ses préférences (`actions/notifications.ts`) ; Lot 3 (`actions/partenaires.ts`) : utiliser une offre, valider un code, créer / modifier / mettre en pause une offre, modifier la fiche, inviter une collaboratrice, payer / changer / arrêter l'abonnement pro, régler / retirer sa position. Chaque action revalide les pages concernées.

## Plus tard (non bloquant)

Envoi du billet et des relances sur WhatsApp (Twilio ou WhatsApp Business API, file `reminders`), assistant branché sur Claude, PWA hors ligne, export comptable.
