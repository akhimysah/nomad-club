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
2. Dans le projet, ouvrez **SQL Editor**, collez tout le contenu de `supabase/migrations/0001_init.sql` et cliquez sur **Run**.
   Cela crée les tables, les règles de sécurité et les fonctions.
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
7. **Donner le rôle de fondatrice** à Julia et Nora : elles se connectent une première fois, puis dans SQL Editor :

   ```sql
   update public.profiles set role = 'founder' where email in ('email-de-julia@exemple.com', 'email-de-nora@exemple.com');
   ```

Sans Stripe, une réservation payante ou une adhésion se règle par **virement déclaré** : elle apparaît chez les fondatrices
dans « Virements à valider ». Indiquez le titulaire et l'IBAN dans `NEXT_PUBLIC_TRANSFER_HOLDER` et `NEXT_PUBLIC_TRANSFER_IBAN`.

### 3.2 Stripe (paiement par carte, en mode test d'abord)

1. Créez un compte sur [stripe.com](https://stripe.com). Restez en **mode test** (interrupteur « Test mode »).
2. **Développeurs > Clés API** : copiez la clé secrète de test (`sk_test_…`) dans `STRIPE_SECRET_KEY`.
3. **Développeurs > Webhooks > Ajouter un endpoint** :
   - adresse : `https://votre-site/api/stripe/webhook` ;
   - événements : `checkout.session.completed` et `checkout.session.expired` ;
   - copiez le « Secret de signature » (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET`.

   En local, on peut utiliser l'outil [Stripe CLI](https://stripe.com/docs/stripe-cli) :
   `stripe listen --forward-to localhost:3000/api/stripe/webhook` (il affiche le `whsec_…` à utiliser).
4. Pour payer en test, utilisez la carte `4242 4242 4242 4242`, une date future et n'importe quel code.
5. Quand tout est prêt, passez Stripe en mode réel et remplacez les clés de test par les clés réelles.

Une place payée par carte est retenue 30 minutes pendant le paiement ; si le paiement n'aboutit pas, elle est libérée.

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
- Architecture : `docs/ARCHITECTURE.md`. Toutes les données passent par l'interface `src/lib/data/repo.ts`
  (implémentations `demo-repo.ts` et `supabase-repo.ts`, choix automatique dans `src/lib/data/index.ts`).
- Pages : `src/app/(visite)` (compte gratuit), `src/app/espace` (membre), `src/app/fondatrices`.
  Actions serveur : `src/app/actions`. Logique métier pure : `src/lib/domain`.
- Garde d'accès : `src/middleware.ts` + vérification dans les layouts (`requireMember`, `requireFounder`).

### Plus tard

Envoi réel du billet et des relances sur WhatsApp, connexion par code WhatsApp, assistant branché sur une IA,
mode hors ligne, export comptable.
