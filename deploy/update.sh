#!/usr/bin/env sh
# Met à jour la pré-prod : tire la dernière image GHCR et redémarre.
set -eu

# se placer à la racine du repo (le script est dans deploy/)
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> Pull de la dernière image…"
$COMPOSE pull

echo "==> Redémarrage du service…"
$COMPOSE up -d

echo "==> Nettoyage des images orphelines…"
docker image prune -f

echo "==> OK. État :"
$COMPOSE ps
