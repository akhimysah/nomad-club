# Audit de sécurité — Nomad Club (Lot 6)

Date : 2 novembre 2026. Périmètre : code du socle (Lot 0, commit `4438650`) — server actions, routes API, middleware, migrations 0001 à 0003, mode démo. Méthode : relecture du code et des politiques RLS, tests SQL (`npm run test:sql`), vérifications HTTP sur le serveur local.

Légende de gravité : **Élevée** (exploitable à distance, données ou droits en jeu), **Moyenne** (exploitable sous conditions), **Faible** (durcissement).

## Constats corrigés dans ce lot

| # | Gravité | Constat | Correction |
|---|---|---|---|
| 1 | Élevée | **L'espace admin ne reposait que sur l'e-mail** : quiconque accède à la boîte d'une fondatrice (lien magique) obtient tous les droits (paiements, rôles, données des membres). | Double authentification TOTP (Supabase MFA) exigée en mode réel pour `/fondatrices` : redirection par le middleware vers `/connexion/double-authentification`, et `getViewer()` retire le rôle `admin` d'une session AAL1 (les server actions sont donc protégées aussi). Option côté base : `security_settings.admin_mfa_enforced` + politiques RLS restrictives (rôles, journal, file de suppression). |
| 2 | Élevée | **Énumération des billets** : `get_ticket` est appelable sans compte et les codes n'avaient que 4 caractères aléatoires (≈ 920 000 combinaisons par date) ; la réponse contenait l'identifiant du compte de la titulaire. | Codes à 6 caractères (≈ 887 millions par date) côté SQL et démo, anciens codes toujours valides ; `get_ticket` ne renvoie plus `profile_id` ; page `/billet/[code]` limitée à 30 consultations / 10 min par IP. |
| 3 | Moyenne | **Redirection ouverte** : `safeNext()` (connexion, retour du lien magique) acceptait `/\evil.com`, que les navigateurs lisent comme `//evil.com`. | `safeRedirectPath()` (`src/lib/modules/securite/request.ts`) refuse `//`, `/\`, les caractères de contrôle et les chaînes trop longues ; utilisée par la connexion, le callback et la double authentification. |
| 4 | Moyenne | **Aucune limitation de fréquence** : envoi de liens magiques (inondation d'une boîte, coûts e-mail), réservations sans compte (places bloquées en masse), messages, création de sessions Stripe, assistant. | `rateLimit()` (`rate-limit.ts`) : fenêtres fixes par IP, par compte ou par e-mail ; compteurs partagés en base (`rate_limit_hit`, clé service) en mode réel, mémoire sinon. Règles centralisées dans `RATE_LIMITS`. |
| 5 | Moyenne | **Aucun en-tête de sécurité** : l'appli pouvait être affichée dans un cadre (clickjacking sur les boutons de validation), pas de CSP, pas de HSTS. | `next.config.ts` → `securityHeaders()` : CSP adaptée (Supabase, Stripe, OSM, Open-Meteo, Aladhan), `frame-ancestors 'none'` + `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS en production ; `X-Powered-By` retiré. |
| 6 | Moyenne | **Fonctions internes exposées** : Supabase donne `EXECUTE` à `anon` sur toutes les fonctions du schéma public, dont `new_ticket_code` et les fonctions de déclencheurs. | `revoke execute` sur les fonctions internes (0008) ; vérifié par les tests SQL. |
| 7 | Moyenne | **L'assistant répondait aux visiteuses avec les données du cercle** : `askAssistant` (sans contrôle d'accès) lisait annuaire, carnet et offres. En mode réel la RLS filtrait, mais en démo une visiteuse obtenait les noms et métiers des membres. | L'assistant ne charge annuaire, carnet et offres que pour le cercle ; limitation de fréquence. |
| 8 | Faible | Retrait d'un rôle silencieux (une membre ne voit pas qu'un accès lui a été retiré). | Notification `role_changed` au retrait. |
| 9 | Faible | Entrées des routes non bornées (`/api/checkout` : chaînes de taille libre ; e-mail sans longueur maximale). | Longueurs maximales (zod) sur checkout, e-mail, réservation, assistant. |
| 10 | Faible | Pas de trace des connexions administratrices ni des exports. | Journal : `auth.admin_login`, `auth.mfa_*`, `data.export`, `audit.export`, `account.*`, `consent.update`, `security.settings`. Politique `audit_log_self_insert` : une personne ne journalise que ses propres opérations sensibles, sur sa propre fiche. |

## Constats restants (acceptés ou à traiter plus tard)

| # | Gravité | Constat | Recommandation |
|---|---|---|---|
| R1 | Moyenne | `book_event` est appelable directement avec la clé `anon` publique (c'est voulu : réservation sans compte). La limitation de fréquence de l'appli ne s'applique pas à un appel direct à Supabase. | Si des abus apparaissent : déplacer la réservation invitée derrière une route serveur seule autorisée (révoquer `anon` sur `book_event`, appeler la fonction avec la clé service après `rateLimit`), ou ajouter une limite par numéro WhatsApp dans la fonction SQL. |
| R2 | Faible | La CSP autorise `'unsafe-inline'` pour les scripts (Next.js injecte des scripts d'hydratation en ligne). | Passer à une CSP à nonce via le middleware quand le rendu dynamique de toutes les pages est acceptable. Le risque XSS reste faible : React échappe tout, aucun `dangerouslySetInnerHTML` sur du contenu utilisateur. |
| R3 | Faible | Le mode démo permet de se mettre dans la peau de n'importe quel rôle (sélecteur d'espace). C'est son rôle, mais un déploiement démo public ne doit **jamais** contenir de vraies données. | Garder les déploiements démo avec les données d'exemple uniquement ; le mode réel s'active par les variables Supabase. |
| R4 | Faible | Compteurs de fréquence en mémoire si la clé service manque : propres à chaque instance Vercel. | Toujours configurer `SUPABASE_SERVICE_ROLE_KEY` en production. |
| R5 | Faible | Le délai de grâce de suppression (30 jours) est indicatif : l'anonymisation est une action manuelle des administratrices (la tâche planifiée compte les demandes échues, sans rien effacer seule). | Choix volontaire (vérifier d'abord une dette, un litige) ; à revoir avec la cliente. |
| R6 | Faible | `deleteUser` (soft delete Supabase Auth) n'est appelé que si la clé service est présente ; sinon le compte de connexion survit à l'anonymisation (l'e-mail du profil est effacé, pas celui d'`auth.users`). | Clé service obligatoire en production. |

## Points vérifiés sans anomalie

- Webhook Stripe : signature vérifiée (`constructEvent`), montants toujours recalculés côté serveur (`priceFor`, `membershipAmount`, `book_event`).
- RLS : chaque table métier est protégée ; les tests SQL simulent anonyme, membre, partenaire seule, compte gratuit et admin (78 vérifications).
- Profil : `protect_profile` empêche une membre de modifier formule, échéance et numéro de carte.
- Journal : ni modification ni suppression (`revoke update, delete, truncate`).
- Messages : lecture et écriture limitées au cercle et aux participantes du fil.
- Cookies : `httpOnly`, `sameSite=lax` (billets invités, persona de démo) ; session Supabase gérée par `@supabase/ssr`.
- Aucun secret côté client : seules les variables `NEXT_PUBLIC_*` (URL et clé anon Supabase, clé VAPID publique) sont exposées.

## Comment revérifier

```bash
npm run test:sql          # RLS et fonctions, dont la section « Lot 6 »
npm run build && npm start
curl -sI http://localhost:3000/ | grep -iE 'content-security|x-frame|strict-transport'
```
