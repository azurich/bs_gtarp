#!/usr/bin/env bash
# Sauvegarde à chaud de la base SQLite (cohérente même pendant l'écriture).
# Nécessite sqlite3 : sudo apt install -y sqlite3
# À planifier en cron (voir PREPROD.md / DEPLOY.md).
set -euo pipefail

# Chemin de la base à sauvegarder sur l'HÔTE.
#   Déploiement Docker (PREPROD.md) : /opt/blackstate/data/blackstate.db (volume ./data)
#   VPS bare-metal (DEPLOY.md)       : export BACKUP_DB=/opt/blackstate/blackstate.db
DB="${BACKUP_DB:-/opt/blackstate/data/blackstate.db}"
DEST=/opt/blackstate/backups
RETENTION_DAYS=14

# Garde-fou : ne jamais produire un backup vide si la base est absente
if [ ! -f "$DB" ]; then
  echo "[$(date)] ERREUR : base introuvable ($DB) — sauvegarde annulée (définir BACKUP_DB ?)" >&2
  exit 1
fi

mkdir -p "$DEST"
TS=$(date +%Y%m%d-%H%M%S)

# .backup = snapshot cohérent (gère le WAL), contrairement à un simple cp
sqlite3 "$DB" ".backup '$DEST/blackstate-$TS.db'"

# Purge des sauvegardes trop anciennes
find "$DEST" -name 'blackstate-*.db' -mtime +"$RETENTION_DAYS" -delete

echo "[$(date)] Sauvegarde OK : $DEST/blackstate-$TS.db"
