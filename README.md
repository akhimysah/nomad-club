# Nomad Club, l'appli

L'appli web du Nomad Club, le club de femmes et d'entrepreneuses à Marrakech fondé par Julia et Nora.
Elle reprend la maquette noir et blanc validée (`design/maquette-noir-blanc.html`), sur ordinateur et sur téléphone.

Trois espaces :

- **Compte gratuit** (visiteuse) : accueil, agenda, réservation d'une place, billet avec QR code, le club, les formules.
- **Membre** : accueil avec compte à rebours, agenda, cercle (salon, annuaire, messages privés), carnet d'adresses, assistant, carte de membre et adhésion.
- **Fondatrices** : vue d'ensemble, actions à traiter (virements, relances, brouillons), membres, événements, encaissements.

---

## 1. Lancer l'appli sur son ordinateur

Il faut [Node.js](https://nodejs.org) (version 20 ou plus récente).

Dans un terminal, dans le dossier du projet :

```bash
npm install      # une seule fois : installe ce dont l'appli a besoin
npm run dev      # lance l'appli
```

Puis ouvrez **http://localhost:3000** dans votre navigateur. Pour arrêter : `Ctrl + C` dans le terminal.

## 2. Le mode démo (par défaut)

Sans aucun réglage, l'appli tourne en **mode démo** :

- Un bandeau en haut indique « Aperçu privé · données d'exemple » et permet de passer d'un espace à l'autre :
  **Compte gratuit**, **Membre** (Inès Laurent) ou **Fondatrices** (Julia et Nora).
- Toutes les données d'exemple sont chargées : rendez-vous, carnet, membres, salon, virements, relances, encaissements.
  La date de référence est le **mercredi 14 octobre 2026**.
- Tout fonctionne vraiment : réserver une place, rejoindre une liste d'attente, poster au salon, écrire en privé,
  renouveler, passer Premium, valider un virement, relancer, publier un brouillon, créer un événement.
  Les compteurs se recalculent à chaque action.
- Les paiements sont **simulés** et aucun message ne part (pas de WhatsApp, pas d'e-mail).
- Les données sont gardées en mémoire : elles reviennent à l'état d'origine quand on relance `npm run dev`.

## 3. Passer en mode réel

Le mode réel s'active tout seul dès que les variables Supabase sont renseignées.
Les réglages se mettent dans un fichier **`.env.local`** à la racine du projet (en local) ou dans Vercel (en ligne).
Le modèle commenté est dans **`.env.example`** : copiez-le en `.env.local` et remplissez-le au fur et à mesure.

### 3.1 Supabase (base de données et connexion)

1. Créez un compte sur [supabase.com](https://supabase.com), puis un **nouveau projet** (région Europe, par exemple Paris ou Francfort). Notez le mot de passe de la base.
2. Dans le projet, ouvrez **SQL Editor** et exécutez, **dans l'ordre**, chaque fichier de `supabase/migrations/`
   (`0001_init.sql`, puis `0002_carnet_annuaire.sql`, puis `0003_socle.sql`) : collez son contenu et cliquez sur **Run**.
   Cela crée les tables, les rôles, les règles de sécurité et les fonctions.
3. (Facultatif, pour tester) Toujours dans SQL Editor, exécutez `supabase/seed.sql` : il ajoute les données d'exemple
   (membres fictives, rendez-vous, paiements…). **Ne le faites pas sur la base qui servira pour de vrai.**
4. Ouvrez **Project Settings > API** et recopiez dans `.env.local` :
   - `NEXT_PUBLIC_SUPABASE_URL` : la « Project URL » ;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` : la clé « anon public » ;
   - `SUPABASE_SERVICE_ROLE_KEY` : la clé « service_role » (secrète, à ne jamais montrer).
5. Ouvrez **Authentication > URL Configuration** :
   - « Site URL » : `http://localhost:3000` (puis l'adresse du site une fois en ligne) ;
   - « Redirect URLs » : ajoutez `http://localhost:3000/auth/callback` (et plus tard `https://votre-site/auth/callback`).
6. Relancez `npm run dev`. Le bandeau de démo disparaît : on se connecte avec son e-mail sur `/connexion`
   (un lien de connexion arrive par e-mail, sans mot de passe).
7. **Donner le rôle d'administratrice** à Julia et Nora : elles se connectent une première fois, puis dans SQL Editor :

   ```sql
   insert into public.user_roles (profile_id, role)
   select id, 'admin' from public.profiles where email in ('email-de-julia@exemple.com', 'email-de-nora@exemple.com')
   on conflict do nothing;
   ```

   Ensuite, les autres rôles (membre, modératrice, partenaire, pro) se donnent depuis l'appli : Fondatrices > Rôles et accès.

Sans Stripe, une réservation payante ou une adhésion se règle par **virement déclaré** : elle apparaît chez les fondatrices
dans « Virements à valider ». Indiquez le titulaire et l'IBAN dans `NEXT_PUBLIC_TRANSFER_HOLDER` et `NEXT_PUBLIC_TRANSFER_IBAN`.

### 3.2 Stripe (paiement par carte, en mode test d'abord)

Tous les paiements passent par une interface unique (`src/lib/modules/paiements/`, voir `docs/ARCHITECTURE.md`, section
« Paiements ») : adhésion annuelle en 1, 3 ou 12 fois, abonnement mensuel des pros, boutique, billets. Le prestataire se
choisit par `PAYMENT_PROVIDER` (`stripe`, `transfer` ; `simulated` est réservé à la démo et refusé en mode réel).

> **Préalable** : Stripe n'ouvre pas de compte à une entreprise immatriculée au Maroc. Il faut une entité dans un pays
> pris en charge (France / UE…), avec son compte bancaire. Sinon : virement déclaré (déjà en place), puis un prestataire
> marocain (CMI…) à brancher derrière la même interface (voir plus bas).

1. Créez le compte Stripe de l'entité qui encaisse. Restez en **mode test** (interrupteur « Test mode »).
2. **Paramètres > Informations sur l'entreprise / Marque** : nom public « Nomad Club », logo, couleur, adresse de support ;
   **Paramètres > E-mails clients** : activez les reçus de paiement et les e-mails de factures si vous le souhaitez.
3. **Développeurs > Clés API** : clé secrète de test (`sk_test_…`) dans `STRIPE_SECRET_KEY`.
4. **Produits** (facultatif) : l'appli crée les prix à la volée (montants de `NEXT_PUBLIC_PRICE_*` et des formules pro).
   Pour des prix gérés dans Stripe, créez un produit « Carnet d'adresses » avec trois prix mensuels récurrents
   (Essentiel, Visibilité, Vitrine) et copiez leurs identifiants dans `STRIPE_PRICE_PRO_ESSENTIEL`, `STRIPE_PRICE_PRO_VISIBILITE`,
   `STRIPE_PRICE_PRO_VITRINE`.
5. **Développeurs > Webhooks > Ajouter un endpoint** :
   - adresse : `https://votre-site/api/stripe/webhook` (ou `https://votre-site/api/paiements/webhook`, même traitement) ;
   - événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`,
     `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded` ;
   - copiez le « Secret de signature » (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET`.

   En local : [Stripe CLI](https://stripe.com/docs/stripe-cli), `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
   Chaque événement est stocké (table `payment_events`) et traité une seule fois ; un événement en échec se rejoue depuis
   Fondatrices > Paiements et échéances.
6. **Paramètres > Billing > Portail client** : activez le portail ; autorisez « mettre à jour le moyen de paiement »,
   « voir l'historique des factures » et « annuler l'abonnement (à la fin de la période) ». C'est le bouton « Gérer ma carte ».
7. **Paramètres > Billing > Abonnements et e-mails > Gérer les paiements échoués** : activez les nouvelles tentatives
   intelligentes (par exemple 4 tentatives sur 2 semaines) ; après la dernière tentative, choisissez « marquer l'abonnement
   comme impayé » (la fiche pro passe alors « suspendue »). Côté adhésion, l'accès est maintenu `MEMBERSHIP_GRACE_DAYS` jours
   (15 par défaut) puis suspendu, et rétabli dès que l'échéance est réglée.
8. Tâche quotidienne `/api/cron/paiements` (déjà dans `vercel.json`) : relances des échéances en retard, suspensions,
   rappels de renouvellement J-30 / J-7 / J-1. Elle demande `CRON_SECRET` et `SUPABASE_SERVICE_ROLE_KEY`.
9. Tests : carte `4242 4242 4242 4242` (réussite), `4000 0000 0000 0341` (s'enregistre puis échoue aux prélèvements suivants),
   date future, n'importe quel code. Pour avancer le temps sur un abonnement : Stripe > Billing > Horloges de test.
10. **Passage en live** : activez le compte (justificatifs de l'entité, compte bancaire), refaites l'étape 5 en mode live
    (nouveau `whsec_…`), remplacez `STRIPE_SECRET_KEY` par la clé `sk_live_…` (ou une clé restreinte `rk_live_…`), refaites
    les étapes 4, 6 et 7 en live (les réglages test et live sont séparés). Aucun changement de code ; le bandeau « mode test »
    disparaît des pages.

Une place payée par carte est retenue 30 minutes pendant le paiement ; si le paiement n'aboutit pas, elle est libérée.
L'accès (adhésion, ressource de la boutique, fiche pro, billet) n'est accordé qu'à la confirmation par le webhook.

**Brancher un prestataire marocain (CMI…)** : écrire `src/lib/modules/paiements/providers/cmi.ts` qui implémente
`PaymentProvider` (création de la page de paiement hébergée, vérification du retour serveur à serveur → `verifyWebhook`,
traduction en événements normalisés), l'ajouter à `providers/index.ts` et à `PAYMENT_PROVIDER`. Les écrans, les échéanciers,
le grand livre et les relances restent identiques. Le CMI ne gérant pas d'abonnements, les échéances suivantes seront
prélevées par la tâche quotidienne (carte enregistrée chez le CMI) ou réglées par lien de paiement.

### 3.3 Mettre en ligne sur Vercel

1. Mettez le projet sur GitHub (dépôt privé conseillé).
2. Sur [vercel.com](https://vercel.com), « Add New > Project », choisissez le dépôt. Les réglages par défaut conviennent (Next.js).
3. Avant de déployer, ouvrez **Settings > Environment Variables** et ajoutez les mêmes variables que dans `.env.local`,
   avec `NEXT_PUBLIC_SITE_URL` = l'adresse du site (par exemple `https://nomadclub.vercel.app` ou votre domaine).
4. Déployez. Puis mettez à jour l'adresse du site dans Supabase (Authentication > URL Configuration) et l'adresse du webhook dans Stripe.
5. Pour un nom de domaine à vous : Vercel > Settings > Domains.

À savoir : en ligne **sans** variables Supabase, le site reste en mode démo et ses données repartent de zéro régulièrement.

---

## Pour la personne qui développe

- `npm run dev` : développement · `npm run build` : version de production · `npm run lint` : vérification du code.
- `npm run seed:sql` : régénère `supabase/seed.sql` à partir de `src/lib/seed.ts`.
- `npm run test:sql` : exécute toutes les migrations et le seed dans un Postgres embarqué (PGlite) et vérifie rôles et sécurité (RLS).
- `npm run test:paiements` : échéancier, montants, webhooks Stripe signés localement, traitement idempotent (sans réseau).
- Architecture : `docs/ARCHITECTURE.md`. Toutes les données passent par l'interface `src/lib/data/repo.ts`
  (implémentations `demo-repo.ts` et `supabase-repo.ts`, choix automatique dans `src/lib/data/index.ts`).
- Pages : `src/app/(visite)` (compte gratuit), `src/app/espace` (membre), `src/app/partenaire`, `src/app/pro`, `src/app/fondatrices` (admin).
  Actions serveur : `src/app/actions`. Logique métier pure : `src/lib/domain`.
- Rôles et permissions : `src/lib/permissions.ts` (rôles cumulables → capacités). Garde d'accès : `src/middleware.ts`
  + vérification dans les layouts et les actions (`requireCapability`, `checkCapability` dans `src/lib/auth.ts`).

### Plus tard

Envoi réel du billet et des relances sur WhatsApp, connexion par code WhatsApp, assistant branché sur une IA,
mode hors ligne, export comptable.
