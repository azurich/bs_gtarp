# Pré-prod BlackState — Debian + cloudflared + GHCR

**Date :** 2026-07-02
**Statut :** design validé en brainstorming

## Objectif

Mettre BlackState en **pré-production** sur une machine **Debian** (cloudflared
déjà installé), via des **images de conteneur** construites par GitHub Actions et
publiées sur **GitHub Packages (ghcr.io)**. Le trafic public arrive par un
**tunnel Cloudflare** (sortant), sans port ouvert ni reverse proxy ni certificat
local.

**Hors périmètre :** logique de jeu, refonte visuelle, modèle cagnotte, migration
de données depuis la base de dev (la pré-prod démarre sur une **base vierge**).

## Corrections au modèle mental initial

1. **Pas de conteneur "db".** La stack utilise `bun:sqlite` → la base est un
   simple **fichier** (`casino.db`) persisté sur un volume. Aucun conteneur
   PostgreSQL/MySQL.
2. **cloudflared remplace le reverse proxy ET le HTTPS.** Le tunnel sort en
   connexion sortante vers l'edge Cloudflare, qui termine le TLS. Donc : pas de
   Caddy/nginx, pas de Let's Encrypt, pas d'enregistrement DNS A, aucun port
   80/443 ouvert.

## Topologie cible

```
GitHub (azurich/bs_gtarp)
   └─ push main ─► GitHub Actions ─► build image ─► ghcr.io/azurich/bs_gtarp:latest  (PUBLIC)
                                                              │
Debian ◄──────────────────── docker compose pull ────────────┘
   ├─ conteneur "casino"  (bun+sqlite, écoute 127.0.0.1:3000 UNIQUEMENT)
   │     └─ volume ./data ► /app/data/casino.db  (persistance + backups)
   └─ cloudflared (service hôte)  http://localhost:3000 ─► edge Cloudflare ─► https://blackstate.club
```

## Décisions retenues

- **Ingress :** tunnel → app direct (pas de reverse proxy).
- **CI/CD :** GitHub Actions build → GHCR, **pull manuel** sur la Debian.
- **cloudflared :** sur l'**hôte** (service systemd déjà installé), pas dans compose.
- **Visibilité image GHCR :** **publique** → aucun `docker login` requis pour puller.
- **Hostname du tunnel :** `blackstate.club`.
- **Service du tunnel (dashboard Cloudflare) :** Type **HTTP**, URL **`localhost:3000`**.
- **Bind du conteneur :** `127.0.0.1:3000:3000` (loopback → seul le tunnel hôte y accède).

## Architecture & fichiers

### CI — `.github/workflows/docker-publish.yml`
- Déclencheurs : push sur `main`, et tags `v*`.
- Permissions du job : `contents: read`, `packages: write`.
- Étapes : `checkout` → `docker/login-action` vers `ghcr.io` avec
  `${{ github.actor }}` / `${{ secrets.GITHUB_TOKEN }}` (aucun secret à créer) →
  `docker/metadata-action` (tags : `latest` sur main, `sha-<court>`, `vX.Y.Z` sur
  tag git) → `docker/build-push-action` (contexte racine, `push: true`,
  plateforme **linux/amd64**).
- Image : `ghcr.io/azurich/bs_gtarp`.

### Runtime — `docker-compose.prod.yml` (racine du repo)
- `image: ghcr.io/azurich/bs_gtarp:latest` (pas de `build:`).
- `ports: ["127.0.0.1:3000:3000"]` (loopback strict).
- `env_file: [.env]` ; `environment: DB_FILE=/app/data/casino.db` (force la base
  dans le volume, surcharge tout `.env`).
- `volumes: ["./data:/app/data"]`.
- `restart: unless-stopped` ; healthcheck identique à l'actuel (`wget` sur `/`).

### `.env` (sur la Debian, jamais commité)
```ini
PORT=3000
ADMIN_USER=<admin>
ADMIN_PASS=<mot de passe fort et unique>
DB_FILE=/app/data/casino.db
```
Le compte admin est créé au **premier démarrage** (base vierge en pré-prod).

### cloudflared (hôte) — `deploy/cloudflared-config.yml.example`
Fichier exemple versionné (doc), à adapter sur la machine :
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: blackstate.club
    service: http://localhost:3000
  - service: http_status:404
```
> Si le tunnel est piloté par le **dashboard** (Public Hostname : Type HTTP, URL
> `localhost:3000`), ce fichier n'est qu'un pense-bête ; la config vit côté
> Cloudflare. Les deux voies sont documentées dans le runbook.

### Mise à jour — `deploy/update.sh`
```sh
#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
```

### Runbook — `deploy/PREPROD.md`
Procédure Debian de bout en bout : install Docker + plugin compose ; récupérer
`docker-compose.prod.yml` + `deploy/` ; créer `.env` ; `docker compose -f
docker-compose.prod.yml up -d` ; vérifier `curl 127.0.0.1:3000` = 200 ; configurer
le tunnel (dashboard **ou** `config.yml`) vers `http://localhost:3000` +
`blackstate.club` ; activer le service cloudflared ; cron de backup ; boucle de
mise à jour (`git push` → `update.sh`). L'actuel `DEPLOY.md` (VPS + Caddy) est
**conservé** comme alternative, non supprimé.

### Amélioration Dockerfile
Copier `bun.lock` avant `bun install` (avec `package.json`) pour des builds
reproductibles/lockés. Le reste du Dockerfile est inchangé (déjà non-root, EXPOSE
3000, healthcheck).

### Migration Git / repo
1. Merger `feat/reactiver-bj-demineur` → `main` (fast-forward ; finalise
   Blackjack/Démineur).
2. Repointer `origin` vers `https://github.com/azurich/bs_gtarp.git` (l'ancien
   `Lorr0/Casino_Online_GTARP` est abandonné).
3. `git push -u origin main` (+ push d'un tag `v2.0.0` optionnel pour déclencher un
   build versionné).

## Sécurité
- Aucun port public ouvert ; l'app n'écoute que sur `127.0.0.1`. Seul le tunnel
  sortant expose le service.
- `.env` hors image (déjà dans `.dockerignore` + `.gitignore`) ; conteneur en
  utilisateur non-root (`casino`).
- Image publique : **ne jamais** committer de secret dans le repo/Docker (déjà le
  cas). Mot de passe admin fort et unique.

## Sauvegardes
- `deploy/backup.sh` existant (sauvegarde à chaud du SQLite) via cron quotidien +
  copie hors-machine recommandée.

## Tests / vérification
1. **CI :** le workflow passe ; l'image apparaît dans l'onglet **Packages** du repo
   et est **publique**.
2. **Debian :** `docker compose -f docker-compose.prod.yml up -d` → conteneur
   `healthy` ; `curl -s -o /dev/null -w "%{http_code}" 127.0.0.1:3000` = `200`.
3. **Tunnel :** `https://blackstate.club` répond (page casino) en HTTPS valide.
4. **Persistance :** créer un compte, `docker compose down && up -d`, le compte
   existe toujours (volume `./data`).
5. **Résilience :** reboot machine → conteneur + tunnel remontent seuls.
6. **Boucle de déploiement :** un `git push` sur `main` publie une image ;
   `deploy/update.sh` la met en service sans downtime notable.

## Inchangé
- Logique de jeu, front, modèle cagnotte, `DEPLOY.md` (VPS/Caddy conservé comme
  alternative), `backup.sh`, structure de l'app.
