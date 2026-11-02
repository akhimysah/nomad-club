# Sauvegardes et reprise (Lot 6)

## Ce qui est sauvegardé

| Élément | Comment | Fréquence |
|---|---|---|
| Base Supabase (schémas `public` et `auth`) | Sauvegardes automatiques Supabase (plan Pro : quotidiennes, 7 jours ; option PITR) | Quotidienne |
| Base Supabase, copie indépendante | `scripts/backup.sh` : `pg_dump` chiffré (AES-256, PBKDF2), conservé 30 jours, hors de Supabase | Quotidienne (cron) |
| Code | Dépôt git (GitHub) | À chaque commit |
| Variables d'environnement | Vercel + copie dans le gestionnaire de mots de passe des fondatrices | À chaque changement |
| Photos (si Supabase Storage est utilisé par un lot) | `supabase storage` / rclone vers un second stockage | Hebdomadaire |

Le plan gratuit de Supabase **n'a pas** de sauvegarde automatique téléchargeable : la copie par `scripts/backup.sh` est alors la seule.

## Mise en place de `scripts/backup.sh`

1. Sur la machine qui sauvegarde (le VPS Hostinger convient) : installer `postgresql-client` (même version majeure que Supabase) et `openssl`.
2. Renseigner `SUPABASE_DB_URL` (Supabase › Project Settings › Database › chaîne « Session pooler ») et `BACKUP_PASSPHRASE` (longue phrase aléatoire, conservée aussi hors de la machine).
3. Planifier : `15 3 * * * cd /opt/nomad-club && ./scripts/backup.sh >> backups/backup.log 2>&1`.
4. Copier régulièrement le dossier `backups/` ailleurs (autre serveur, stockage objet) : une sauvegarde sur la même machine ne protège pas d'une perte de la machine.

Les fichiers `backups/nomad-club-AAAAMMJJTHHMMSSZ.dump.enc` sont accompagnés d'une empreinte `.sha256`. Le dossier est ignoré par git.

## Restaurer

**Toujours tester d'abord sur un projet Supabase de test**, jamais directement en production.

```bash
export BACKUP_PASSPHRASE='…'
export RESTORE_DB_URL='postgresql://…projet-de-test…'
./scripts/backup.sh --restore backups/nomad-club-20261102T031500Z.dump.enc
```

La restauration remplace les objets du schéma `public`. Pour le schéma `auth` (comptes), passer par le support Supabase ou une restauration complète du projet.

## Exercice de reprise (à faire une fois par trimestre)

1. Créer un projet Supabase de test, appliquer les migrations (`supabase db push`).
2. Restaurer la dernière sauvegarde comme ci-dessus.
3. Pointer une copie locale de l'appli vers ce projet (`.env.local`) et vérifier : connexion, agenda, réservations, encaissements, journal.
4. Noter la date et la durée de l'exercice dans le journal des fondatrices.

Objectifs proposés : perte de données maximale 24 h (RPO), remise en service en moins de 4 h (RTO).
