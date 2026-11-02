# Vague 2 : finir l'appli pour la sortie

Base : `main` après fusion des lots 0, 1, 3, 4, 5 et 6 (264 tests SQL verts). Mêmes règles que `docs/LOTS-PARALLELES.md` (module par chantier, blocs commentés dans les fichiers partagés, `seed.sql` régénéré seulement à la fusion, rien de poussé ni déployé).

| Chantier | Branche | Migration | Module |
|---|---|---|---|
| 2a Paiements | `v2-paiements` | `0009_paiements.sql` | `src/lib/modules/paiements/` |
| 2b Contrats | `v2-contrats` | `0010_contrats.sql` | `src/lib/modules/contrats/` |
| E-mails | `v2-emails` | `0011_emails.sql` (si besoin) | `src/lib/modules/emails/` |
| Inscription et lancement | `v2-lancement` | `0012_lancement.sql` | `src/lib/modules/lancement/` (voir `docs/lancement/`) |

Chaque migration ne dépend que de 0001 à 0008.

## Choix par défaut (en attendant les décisions de la cliente)

- **Paiement** : Stripe derrière une interface `PaymentProvider` (Stripe, virement déclaré, simulé en démo) pour pouvoir brancher plus tard un prestataire marocain (CMI, etc.) sans toucher aux écrans. Mode test tant qu'il n'y a pas de clés live.
- **Devise** : configurable par variable d'environnement `NEXT_PUBLIC_CURRENCY` (par défaut `USD`, comme aujourd'hui), affichage via une seule fonction de formatage.
- **Contrats** : acceptation électronique simple (case à cocher, horodatage, IP, version, empreinte SHA-256 du PDF) ; signature qualifiée (Yousign…) possible plus tard derrière une interface. Les textes sont des BROUILLONS à faire valider par un juriste.
- **E-mails** : Resend derrière une interface `Mailer` (repli : journal en console en démo / sans clé). Expéditeur et domaine configurables (`EMAIL_FROM`).

## Points d'intégration entre chantiers (prévoir des branchements, pas de dépendance au code des autres)

- Les **contrats** se génèrent après une souscription réussie : exposer `onSubscriptionActivated(...)` côté contrats ; le chantier paiements appelle un point d'extension (`src/lib/modules/paiements/hooks.ts`) qui ne fait rien si rien n'est branché.
- Les **e-mails** sont envoyés via `src/lib/notify.ts` (canal e-mail) et via `sendEmail(template, data)` : les autres chantiers appellent `sendEmail` s'il existe, sinon rien (point d'extension `src/lib/mail-hook.ts` que le chantier e-mails remplit).
- Les montants passent par `formatMoney()` (chantier paiements) ; en attendant, les autres chantiers utilisent la fonction existante.
