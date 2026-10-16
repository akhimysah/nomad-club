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

- **Mode démo** (par défaut, aucune clé) : données en mémoire côté serveur, initialisées depuis `src/lib/seed.ts` (toutes les données d'exemple du brief : rendez-vous, souvenirs, carnet, membres, salon, virements, relances, brouillons, encaissements, échéances). Un sélecteur d'espace (Compte gratuit / Membre / Fondatrices) comme dans la maquette, stocké en cookie `nc_demo_role`. Paiement simulé. Bandeau « Aperçu · données d'exemple ».
- **Mode réel** (si `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont définies) : Supabase pour tout, connexion par lien magique e-mail (et plus tard OTP WhatsApp), rôles lus dans `profiles.role`. Stripe actif si `STRIPE_SECRET_KEY` est définie, sinon paiement « virement déclaré » à valider par les fondatrices.
- Toute la logique métier passe par une interface unique `src/lib/data/repo.ts` (type `Repo`), avec deux implémentations : `demo-repo.ts` et `supabase-repo.ts`. `src/lib/data/index.ts` choisit selon l'env. Les pages et server actions n'appellent jamais Supabase directement.

## Modèle de données (supabase/migrations/0001_init.sql)

- `profiles` (id = auth.users.id, first_name, last_name, whatsapp, email, job, country, bio, role: `guest|member|founder`, plan: `free|member|premium`, plan_ends_at, avatar_url, created_at)
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
- RLS : lecture publique des événements publiés, souvenirs, formules ; carnet, annuaire, salon et messages réservés aux membres ; tout en écriture pour `role = founder` ; chacune lit/écrit ses propres réservations, profil, messages.
- `supabase/seed.sql` : mêmes données que `src/lib/seed.ts`.

## Routes

Visiteuse (public) : `/` (accueil vitrine + appli mobile), `/rendez-vous`, `/rendez-vous/[slug]` (détail + réservation), `/club` (déjà vécu, déroulé d'un lunch, citation), `/formules`, `/connexion`, `/billet/[code]`.
Membre : `/espace`, `/espace/agenda`, `/espace/cercle` (salon + annuaire), `/espace/cercle/[id]` (messages privés), `/espace/carnet`, `/espace/assistant`, `/espace/moi` (carte, adhésion, renouvellement, Premium, offres).
Fondatrices : `/fondatrices`, `/fondatrices/a-traiter`, `/fondatrices/membres`, `/fondatrices/evenements` (+ création/édition, publication), `/fondatrices/encaissements`.
API : `/api/checkout` (crée la session Stripe), `/api/stripe/webhook`.
Garde d'accès dans `src/middleware.ts` + vérification côté serveur dans chaque layout.

## Actions (server actions, `src/app/actions/*`)

Réserver (avec contrôle des places et liste d'attente), annuler, adhérer / renouveler / passer Premium, poster au salon, envoyer un message privé, valider un virement (un ou tous), relancer (une, groupe), publier un brouillon (lieu obligatoire), créer / modifier un événement. Chaque action revalide les pages concernées.

## Plus tard (non bloquant)

Envoi du billet et des relances sur WhatsApp (Twilio ou WhatsApp Business API, file `reminders`), assistant branché sur Claude, PWA hors ligne, export comptable.
