# Revue du mode réel (Supabase)

Vague 2, chantier « Inscription et lancement » — 2 novembre 2026.

Jusqu'ici, l'appli avait surtout tourné en **mode démo** (données en mémoire). Cette revue vérifie que tout ce que montre la démo fonctionne aussi branché sur Supabase, avec les vraies règles d'accès (RLS), **sans** compte Supabase : la base est rejouée localement.

## Méthode

Trois niveaux, tous rejouables sans réseau :

1. **Schéma** — `scripts/lib/schema-usage.mjs` : chaque table, colonne et fonction SQL citée par le code (`.from()`, `.select()`, filtres, clés insérées, `.rpc()`) doit exister après les migrations 0001 → 0012.
2. **Intégration** — `npm run test:reel` (`scripts/test-mode-reel.mjs`) : PGlite (Postgres en WebAssembly) applique les migrations et `seed.sql` ; `scripts/lib/postgrest-pglite.mjs` traduit les appels `supabase-js` en SQL exécuté **sous le rôle et le JWT** de la personne (RLS active, `auth.uid()`, `aal`). Le **vrai code** de l'appli (repo Supabase, server actions, modules) est importé tel quel, avec des bouchons minimes pour `next/headers`, `next/cache` et `next/navigation`. **125 vérifications** : inscription et profil, réservations et liste d'attente, adhésion et encaissements, cercle et messages, communauté, partenaires / carnet / carte, engagement, CRM, sécurité et RGPD, écritures rares, inscription et lancement (0012), première administratrice, variables d'environnement, et « aucune construction PostgREST non gérée ».
3. **Pages** — `scripts/faux-supabase.mjs` expose la même base en HTTP (port 54329) ; l'appli est **construite et lancée en production** (`next build` puis `next start`, `NEXT_PUBLIC_DEMO=false`) contre ce faux Supabase, puis `scripts/parcours-reel.mjs` ouvre **79 pages** avec six personnages (visiteuse, compte gratuit, membre, partenaire, pro, admin) : statut HTTP attendu et absence de page d'erreur.

Résultat au moment de la revue : 125/125 vérifications, 79/79 pages sans erreur, aucun appel non géré par la couche de compatibilité, aucune erreur dans les journaux du serveur.

## Constats corrigés

| # | Constat | Gravité | Correction |
|---|---|---|---|
| 1 | Salon et groupes : `profiles` joint depuis `messages` et `chat_group_members` est **ambigu** (deux clés étrangères vers `profiles`) ; PostgREST renvoie `PGRST201` et les pages du cercle, des groupes et de la modération auraient été vides en production. | Bloquant | Clé précisée (`profiles!messages_author_id_fkey`, `profiles!chat_group_members_profile_id_fkey`) dans `supabase-repo.ts` et `modules/communaute/supabase.ts`. |
| 2 | CRM → statistiques : les retombées des deals (Espace Business) restaient vides en mode réel. | Moyen | `modules/crm/business-source.ts` lit les deals confirmés via le repo (RLS admin). |
| 3 | Inscription : le compte n'était créé qu'avec un e-mail ; prénom, nom, WhatsApp, pays, CGU et source n'étaient jamais enregistrés. | Bloquant pour le lancement | `0012_lancement.sql` : `handle_new_user` lit les métadonnées de l'inscription (nettoyées, bornées, sans effet sur les droits) ; `member_onboarding` (CGU horodatées + version, source, parcours, étapes). |
| 4 | Adhésion : n'importe quel compte pouvait payer une adhésion, sans le filtre « sur validation » demandé par les fondatrices. | Moyen | Candidatures (`membership_applications`, `decide_membership_application`), garde `can_join_membership()` côté serveur sur `joinAction` et `/api/checkout` ; réglage *sur validation / directe*. |
| 5 | Aucun moyen de créer la première administratrice sans SQL à la main. | Bloquant pour le lancement | `npm run admin:create` (clé service, idempotent, journalisé, refuse une seconde admin sans `--force`). |
| 6 | Rôles partenaire / pro / modératrice : attribuables seulement à un compte déjà existant. | Moyen | Invitations à usage unique par e-mail (jeton aléatoire, seule l'empreinte SHA-256 est stockée, 14 jours, adresse vérifiée à l'acceptation, révocables, journalisées). |
| 7 | Sans Supabase, l'appli bascule silencieusement en démo : en production, une variable manquante aurait affiché le sélecteur démo et des données fictives. | Élevé | `NEXT_PUBLIC_DEMO=false` : page « Configuration manquante » (503), `getRepo()` refuse de servir la démo. `npm run check:env` détecte aussi les clés inversées, une clé secrète en `NEXT_PUBLIC_`, un site en http. |
| 8 | Pages publiques indexables mais espaces privés aussi (aucun `robots.txt`). | Moyen | `robots.txt`, `sitemap.xml`, `X-Robots-Tag: noindex` sur les espaces privés, métadonnées Open Graph. |

## Ce qui reste à vérifier sur le vrai Supabase

La couche locale imite PostgREST et GoTrue ; elle ne remplace pas un essai sur le projet réel :

- **Envoi du lien magique** (SMTP, modèle français, Redirect URLs) et retour sur `/auth/callback` → onboarding.
- **MFA TOTP** réel (QR code, `aal2`), et l'option « exiger la 2FA côté base ».
- **Realtime** n'est pas utilisé ; rien à vérifier.
- **Stockage** : les photos de profil sont en data URL dans `profiles.avatar_url` (≤ 1 Mo), pas dans Supabase Storage ; à revoir si les volumes grossissent.
- **Stripe** : webhook réel en mode test (la couche locale n'appelle pas Stripe).
- **Performances** : quelques pages fondatrices chargent des listes complètes (profils, journal limité à 200) ; acceptable pour quelques centaines de membres, à paginer au-delà.
- **Tâches planifiées** Vercel Cron avec `CRON_SECRET`.

La répétition générale de `docs/lancement/checklist.md` (§7) couvre ces points.

## Risques connus

- Les métadonnées d'inscription viennent du navigateur : elles ne donnent **aucun** droit (pas de rôle, pas de plan), sont tronquées et nettoyées par `handle_new_user`. Un compte créé hors formulaire (connexion directe) n'a pas accepté les CGU : `/bienvenue` les lui demande avant tout.
- La garde d'adhésion laisse passer en cas de panne de la base (une adhésion payée par erreur se rembourse ; un club bloqué ne se rattrape pas). Le journal permet de le repérer.
- Les e-mails d'invitation et de réponse aux candidatures utilisent les modèles `role_invitation`, `application_accepted`, `application_refused` : si le chantier e-mails ne les définit pas, l'envoi échoue proprement (le lien d'invitation s'affiche alors une fois à l'admin, et la réponse à une candidature reste visible dans les notifications de l'appli).

## Rejouer la revue

`test:reel` demande Node 22.6 ou plus récent (`--experimental-strip-types`).

```bash
npm run test:sql        # migrations et RLS
npm run test:reel       # intégration du vrai code sous RLS (125 vérifications)

# pages en production contre la base locale
node scripts/faux-supabase.mjs                         # terminal 1 (affiche les clés)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
SUPABASE_SERVICE_ROLE_KEY=… ADMIN_MFA_REQUIRED=false NEXT_PUBLIC_DEMO=false \
NEXT_PUBLIC_SITE_URL=http://localhost:3204 sh -c 'npx next build && npx next start -p 3204'   # terminal 2
node scripts/parcours-reel.mjs                          # terminal 3
```
