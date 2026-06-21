#!/usr/bin/env bash
# Sauvegarde à chaud de la base SQLite (cohérente même pendant l'écriture).
# Nécessite sqlite3 : sudo apt install -y sqlite3
# À planifier en cron (voir DEPLOY.md).
set -euo pipefail

DB=/opt/blackstate/casino.db
DEST=/opt/blackstate/backups
RETENTION_DAYS=14

mkdir -p "$DEST"
TS=$(date +%Y%m%d-%H%M%S)

# .backup = snapshot cohérent (gère le WAL), contrairement à un simple cp
sqlite3 "$DB" ".backup '$DEST/casino-$TS.db'"

# Purge des sauvegardes trop anciennes
find "$DEST" -name 'casino-*.db' -mtime +"$RETENTION_DAYS" -delete

echo "[$(date)] Sauvegarde OK : $DEST/casino-$TS.db"
