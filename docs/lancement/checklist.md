# Checklist de mise en production

Du dépôt à l'appli ouverte aux premières membres. À suivre dans l'ordre ; chaque étape dit **qui** la fait (équipe technique ou fondatrices) et **comment vérifier**.

> Rien n'est déployé automatiquement par ce dépôt. Les textes juridiques (CGU, confidentialité, mentions légales, contrats) sont des **brouillons** à faire valider par un juriste avant l'ouverture.

## 0. Décisions à prendre avant (fondatrices)

- [ ] Encaissement : société en France / UE (Stripe) ou au Maroc (virement déclaré en attendant un prestataire local). Voir `docs/ROADMAP.md`, « Décisions ».
- [ ] Devise affichée (`NEXT_PUBLIC_CURRENCY` : USD, EUR ou MAD).
- [ ] Nom de domaine et adresse d'envoi des e-mails (ex. `bonjour@nomadclub.ma`).
- [ ] **Mode d'adhésion** au lancement : *sur validation* (candidature examinée, réglage par défaut) ou *directe*. Se change à tout moment dans Fondatrices → Candidatures.
- [ ] Textes juridiques complétés (passages `[À COMPLÉTER]`) et validés : `/cgu`, `/confidentialite`, `/mentions-legales`, contrats.

## 1. Supabase (équipe technique)

1. Créer le projet (région UE, ex. Francfort). Noter l'URL, la clé `anon` et la clé `service_role`.
2. Appliquer les migrations **dans l'ordre** : `supabase/migrations/0001_init.sql` → `0012_lancement.sql` (CLI : `supabase db push`, ou éditeur SQL, un fichier après l'autre). **Ne pas** appliquer `supabase/seed.sql` (données d'exemple).
3. Authentication → Providers → Email : activé, « Confirm email » activé. Authentication → URL Configuration :
   - Site URL = l'adresse publique (ex. `https://app.nomadclub.ma`) ;
   - Redirect URLs : `https://app.nomadclub.ma/auth/callback` (et l'adresse de prévisualisation Vercel si besoin).
4. Authentication → Email Templates : modèle « Magic Link » en français (lien `{{ .ConfirmationURL }}`). Authentication → SMTP : brancher le SMTP du domaine (Resend SMTP par exemple) — le SMTP intégré de Supabase est limité à quelques envois par heure.
5. Authentication → Multi-Factor : activer **TOTP** (exigé pour l'espace fondatrices).
6. Authentication → Rate Limits : garder les limites par défaut (l'appli limite aussi de son côté).
7. Vérifier : `select count(*) from public.lancement_settings;` renvoie 1.

## 2. Variables d'environnement (équipe technique)

Dans Vercel → Settings → Environment Variables (Production), voir `.env.example` :

| Variable | Obligatoire | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui | activent le mode réel |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | secrète ; notifications croisées, Stripe, cron |
| `NEXT_PUBLIC_SITE_URL` | oui | `https://…`, sans barre finale |
| `NEXT_PUBLIC_DEMO=false` | oui | interdit le sélecteur démo et les données d'exemple, même si Supabase venait à manquer |
| `CRON_SECRET` | oui | `openssl rand -hex 32` |
| `ADMIN_MFA_REQUIRED=true` | oui | |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | si Stripe | sinon virement déclaré (`NEXT_PUBLIC_TRANSFER_IBAN`, `NEXT_PUBLIC_TRANSFER_HOLDER`) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_UNSUBSCRIBE_SECRET` | recommandé | voir `docs/emails.md` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | facultatif | `node scripts/vapid-keys.mjs` |
| `SENTRY_DSN` | facultatif | surveillance des erreurs (aucune donnée personnelle envoyée) |
| `MAINTENANCE_MODE` | non | `true` = page de maintenance partout |

**Vérifier** : copier les variables dans un fichier local non commité puis

```bash
npm run check:env -- --file chemin/vers/variables --production
```

0 erreur exigée. Les avertissements (Stripe en test, push désactivé…) sont à lire et accepter consciemment.

## 3. Domaine, e-mails, Stripe (équipe technique)

- [ ] Domaine branché sur Vercel, HTTPS actif.
- [ ] Domaine d'envoi vérifié chez Resend (SPF, DKIM, DMARC). Envoyer un e-mail de test depuis `/fondatrices` (modèles, voir `docs/emails.md`).
- [ ] Stripe (si retenu) : webhook `https://…/api/stripe/webhook`, événements `checkout.session.completed` et `checkout.session.expired`. Faire un paiement **en mode test** de bout en bout avant de passer aux clés live.
- [ ] Vercel Cron actif (`vercel.json` : rappels J-1, sécurité).

## 4. Déploiement et vérifications techniques

1. Déployer (Vercel, branche `main`).
2. `https://…/statut` : « Tout fonctionne », mode **réel**, base **joignable**. `https://…/api/statut` renvoie 200 (à brancher sur un outil de surveillance externe : UptimeRobot, Better Stack…).
3. `https://…/robots.txt` liste les espaces privés en `Disallow` et pointe vers `sitemap.xml` ; `https://…/sitemap.xml` contient les pages publiques et les rendez-vous publiés.
4. Partager l'adresse dans WhatsApp / LinkedIn : l'aperçu montre le logo et le texte du club (`/opengraph-image`).
5. Une adresse inconnue affiche la page 404 du club ; `MAINTENANCE_MODE=true` (puis redéploiement) affiche la maintenance, `/statut` reste joignable. Remettre `false`.

## 5. Première administratrice (équipe technique, avec Julia)

```bash
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run admin:create -- julia@… --prenom Julia
```

- Crée le compte (confirmé, sans mot de passe), le profil et le rôle `admin`, journalisé. Relancer la commande ne change rien. Si une admin existe déjà, la commande refuse une autre adresse sauf `--force`.
- Julia ouvre `/connexion`, reçoit le lien, accepte les CGU, puis **active la double authentification** (`/connexion/double-authentification`).
- Nora : elle crée son compte sur `/inscription`, puis Julia lui donne le rôle Administratrice dans Fondatrices → Rôles et accès (ou `npm run admin:create -- nora@… --force`). Nora active aussi sa 2FA.

## 6. Paramétrage par les fondatrices

- [ ] Fondatrices → Candidatures : choisir le mode d'adhésion.
- [ ] Fondatrices → Événements : créer et publier les premiers rendez-vous (lieu, photo, prix, places).
- [ ] Fondatrices → Rôles et accès → **Inviter par e-mail** : modératrices, partenaires (avec leur établissement), pros du carnet. Le lien est à usage unique (14 jours) ; s'il n'y a pas encore d'e-mails, il s'affiche une fois pour être copié dans WhatsApp.
- [ ] Partenaires et pros : vérifier leur fiche et leurs offres dans leurs espaces.
- [ ] Fondatrices → Sécurité : « exiger la 2FA côté base » une fois les deux admins équipées.

## 7. Répétition générale (fondatrices + une amie testeuse)

Avec une vraie adresse e-mail, sur téléphone :

1. `/inscription` → fiche, CGU, « Demander l'adhésion » → lien reçu → onboarding (fiche, confidentialité, notifications, installation de l'appli).
2. `/candidature` → déposer la candidature. Côté fondatrices : notification, Candidatures → **Accepter** avec un message.
3. La testeuse reçoit la réponse (notification + e-mail), choisit sa formule sur `/formules` et paie (Stripe test ou virement → Fondatrices → Encaissements → valider).
4. Elle devient membre : espace membre, annuaire, réservation d'un rendez-vous, billet.
5. Refuser une seconde candidature test (message obligatoire) ; inviter une partenaire test et accepter l'invitation.
6. Mes données : export JSON, demande de suppression puis annulation.
7. Supprimer les comptes de test (Fondatrices → Sécurité → suppression, ou Supabase).

## 8. Sauvegardes et suivi

- [ ] Planifier `scripts/backup.sh` (hors Vercel) et faire un exercice de restauration (`docs/securite/sauvegardes.md`).
- [ ] Surveillance : `/api/statut` toutes les 5 minutes ; Sentry si `SENTRY_DSN`.
- [ ] Après l'ouverture : relire le journal (Fondatrices → Journal) la première semaine, répondre aux candidatures sous 48 h.

## En cas de problème

| Symptôme | Piste |
|---|---|
| Page « Configuration manquante » | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` absentes au moment du build : corriger puis **redéployer** (les `NEXT_PUBLIC_*` sont figées au build). |
| Le lien magique ne revient pas sur le site | Redirect URLs Supabase ; `NEXT_PUBLIC_SITE_URL`. |
| Lien magique jamais reçu | SMTP Supabase (limite), spam, DKIM. |
| Une fondatrice ne voit pas son espace | 2FA non activée (redirigée vers la double authentification) ; rôle `admin` absent (`npm run admin:create`). |
| « L'adhésion se fait sur candidature » au paiement | Mode *sur validation* : accepter la candidature, ou passer en adhésion directe. |
| Couper l'accès en urgence | `MAINTENANCE_MODE=true` puis redéployer. |
