# Règles pour les lots développés en parallèle

Les lots 1, 3, 4, 5 et 6 sont développés en même temps, chacun sur sa branche git (copie de travail séparée), à partir du socle du Lot 0 (commit `4438650`). Ils seront fusionnés dans `main` ensuite. Le Lot 2 (paiements en plusieurs fois, abonnements, contrats) est reporté : tout ce qui doit être payé (boutique, carnet pro) passe par un **paiement simulé** derrière une fonction unique, à remplacer plus tard.

## Numéros de migration (un fichier par lot, jamais deux fois le même numéro)

| Lot | Branche | Migration | Dossier du module |
|---|---|---|---|
| 1 Communauté | `lot-1-communaute` | `supabase/migrations/0004_communaute.sql` | `src/lib/modules/communaute/` |
| 3 Partenaires, carnet pro, carte | `lot-3-partenaires` | `supabase/migrations/0005_partenaires.sql` | `src/lib/modules/partenaires/` |
| 4 Engagement | `lot-4-engagement` | `supabase/migrations/0006_engagement.sql` | `src/lib/modules/engagement/` |
| 5 CRM | `lot-5-crm` | `supabase/migrations/0007_crm.sql` | `src/lib/modules/crm/` |
| 6 Sécurité et conformité | `lot-6-securite` | `supabase/migrations/0008_securite.sql` | `src/lib/modules/securite/` |

Chaque migration ne doit dépendre que de 0001 à 0003 (pas des autres lots), pour pouvoir être appliquée dans n'importe quel ordre après 0003.

## Limiter les conflits

- **Types** : dans `src/lib/modules/<module>/types.ts`, pas dans `src/lib/types.ts` (sauf ajout d'une ligne d'export si nécessaire).
- **Accès aux données** : une interface par module (`CommunauteRepo`, `PartenairesRepo`…) dans `src/lib/modules/<module>/repo.ts`, avec ses implémentations démo et Supabase dans le même dossier. Dans `src/lib/data/repo.ts`, ajouter seulement `extends <Module>Repo` à l'interface `Repo` (une ligne), et brancher les implémentations dans `demo-repo.ts` / `supabase-repo.ts` en déléguant (quelques lignes, regroupées en bloc commenté `// --- Lot N ---`).
- **Données d'exemple** : dans `src/lib/modules/<module>/seed.ts`, importées par `src/lib/seed.ts` (une ligne). `supabase/seed.sql` sera régénéré à la fusion (`npm run seed:sql`) : ne pas le modifier à la main.
- **Permissions** : ajouter les nouvelles capacités dans `src/lib/permissions.ts` dans un bloc commenté `// --- Lot N ---`.
- **Navigation** : ajouter les entrées de menu en un seul endroit par espace, en bloc commenté.
- **Tests SQL** : ajouter un fichier `scripts/test-sql/<module>.mjs` appelé par `scripts/test-sql.mjs` (une ligne), ou des vérifications dans un bloc commenté.
- **Styles** : `src/app/<espace>/<page>/*.module.css` ou un fichier `src/styles/<module>.css` importé ; ne pas réécrire `globals.css` (ajouts en fin de fichier dans un bloc commenté seulement). Respecter le design noir et blanc validé.
- Ne pas toucher à `carnet-server/`, `carnet-site/`, `carnet-site.zip`, `archives/`.

## Fin de lot

`npm run build`, `npm run lint` et `npm run test:sql` passent. Commits fréquents en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Rien n'est poussé ni déployé. Cocher le lot dans `docs/ROADMAP.md`.
