#!/usr/bin/env bash
# Nomad Club — sauvegarde chiffrée de la base Supabase (Lot 6).
#
# À lancer chaque nuit sur une machine de confiance (VPS Hostinger, Mac) par cron, par exemple :
#   15 3 * * * cd /opt/nomad-club && ./scripts/backup.sh >> backups/backup.log 2>&1
# Prérequis : pg_dump (même version majeure que Postgres sur Supabase, 15 ou plus) et openssl.
# Variables : SUPABASE_DB_URL (obligatoire), BACKUP_PASSPHRASE (obligatoire),
#             BACKUP_DIR (défaut ./backups), BACKUP_KEEP_DAYS (défaut 30).
# Restauration : voir docs/securite/sauvegardes.md (scripts/backup.sh --restore FICHIER).
set -euo pipefail

if [[ -f .env.local ]]; then
  # n'importe que les variables utiles, sans exécuter le fichier
  while IFS='=' read -r k v; do
    case "$k" in SUPABASE_DB_URL|BACKUP_PASSPHRASE|BACKUP_DIR|BACKUP_KEEP_DAYS) [[ -z "${!k:-}" ]] && export "$k=$v" ;; esac
  done < <(grep -E '^(SUPABASE_DB_URL|BACKUP_PASSPHRASE|BACKUP_DIR|BACKUP_KEEP_DAYS)=' .env.local || true)
fi

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquante (Supabase > Database > Connection string)}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquante}"
DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP_DAYS:-30}"
command -v pg_dump >/dev/null || { echo "pg_dump introuvable (installer postgresql-client)"; exit 1; }
command -v openssl >/dev/null || { echo "openssl introuvable"; exit 1; }
mkdir -p "$DIR"
chmod 700 "$DIR"

if [[ "${1:-}" == "--restore" ]]; then
  FILE="${2:?Indiquer le fichier .dump.enc à restaurer}"
  TARGET="${RESTORE_DB_URL:?RESTORE_DB_URL manquante : base cible (de préférence un projet Supabase de test)}"
  echo "Restauration de $FILE vers la base cible (les objets existants sont remplacés)."
  read -r -p "Taper RESTAURER pour confirmer : " ok
  [[ "$ok" == "RESTAURER" ]] || { echo "Annulé."; exit 1; }
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" \
    | pg_restore --clean --if-exists --no-owner --no-privileges --schema=public -d "$TARGET"
  echo "Restauration terminée."
  exit 0
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DIR/nomad-club-$STAMP.dump.enc"
# Schéma public (données métier) et auth (comptes de connexion, facteurs 2FA) ; format custom compressé.
pg_dump "$SUPABASE_DB_URL" --format=custom --compress=9 --no-owner --no-privileges --schema=public --schema=auth \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -out "$OUT"
chmod 600 "$OUT"
SIZE="$(wc -c < "$OUT" | tr -d ' ')"
[[ "$SIZE" -gt 1000 ]] || { echo "Sauvegarde anormalement petite ($SIZE octets) : vérifier la connexion."; exit 1; }
shasum -a 256 "$OUT" > "$OUT.sha256"
echo "$(date -u +%FT%TZ) sauvegarde OK : $OUT ($SIZE octets)"

# Rotation : on garde KEEP jours.
find "$DIR" -name 'nomad-club-*.dump.enc*' -type f -mtime +"$KEEP" -print -delete
