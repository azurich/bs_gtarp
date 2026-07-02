# Pré-prod Debian + cloudflared + GHCR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre BlackState en pré-prod sur une machine Debian via des images de conteneur construites par GitHub Actions, publiées (publiques) sur ghcr.io, et exposées par un tunnel cloudflared hôte sur `blackstate.club`.

**Architecture:** GitHub Actions construit l'image à chaque push `main` et la pousse sur `ghcr.io/azurich/bs_gtarp:latest`. La Debian tire cette image via un `docker-compose.prod.yml` (bind loopback `127.0.0.1:3000`, volume `./data` pour le SQLite). cloudflared, service hôte déjà installé, route `blackstate.club → http://localhost:3000`. Aucun port public, pas de reverse proxy, pas de conteneur DB (SQLite = fichier sur volume).

**Tech Stack:** Bun + ElysiaJS + bun:sqlite (existant), Docker + Docker Compose, GitHub Actions, GitHub Container Registry (ghcr.io), cloudflared.

## Global Constraints

- Image : `ghcr.io/azurich/bs_gtarp`, **publique** (aucun `docker login` pour puller).
- Le conteneur n'écoute QUE sur loopback : `127.0.0.1:3000:3000`.
- La base SQLite vit dans le volume : `DB_FILE=/app/data/casino.db`, volume `./data:/app/data`.
- `.env` n'est JAMAIS commité (déjà dans `.gitignore` et `.dockerignore`). Aucun secret dans le repo ni dans l'image (image publique).
- Tunnel : hostname `blackstate.club`, Service Type **HTTP**, URL `localhost:3000`.
- Repo cible : `https://github.com/azurich/bs_gtarp.git`. Commits signés avec les trailers habituels (`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ`).
- Plateforme d'image : `linux/amd64`.
- Ces tâches modifient uniquement infra/CI/docs — aucune logique de jeu, aucun front.

---

## File Structure

- **Create** `.github/workflows/docker-publish.yml` — CI build & push vers GHCR.
- **Create** `docker-compose.prod.yml` — stack runtime (image GHCR, loopback, volume).
- **Create** `deploy/update.sh` — pull + up -d + prune.
- **Create** `deploy/cloudflared-config.yml.example` — exemple de config tunnel hôte.
- **Create** `deploy/PREPROD.md` — runbook Debian de bout en bout.
- **Modify** `Dockerfile` — copier `bun.lock` avant `bun install`.
- **Git** — merge `feat/reactiver-bj-demineur` → `main`, repoint `origin`, push. (Tâche finale, exécutée par l'orchestrateur, pas par un sous-agent.)

Note : la plupart des tâches sont de l'infra/config. Il n'y a pas de tests unitaires à écrire ; chaque tâche se termine par une **vérification concrète** (lint YAML, build local, `docker compose config`, etc.) tenant lieu de test.

---

### Task 1: Dockerfile — lock reproductible

**Files:**
- Modify: `Dockerfile:8-9`

**Interfaces:**
- Consumes: rien.
- Produces: image buildable avec dépendances lockées (consommée par Task 2 CI et Task 3 compose).

- [ ] **Step 1: Modifier le Dockerfile pour copier `bun.lock`**

Remplacer le bloc dépendances actuel :

```dockerfile
# dépendances d'abord (layer mis en cache)
COPY package.json .
RUN bun install --production
```

par :

```dockerfile
# dépendances d'abord (layer mis en cache) — lock inclus pour builds reproductibles
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
```

- [ ] **Step 2: Vérifier que l'image build encore en local**

Run : `docker build -t bs_gtarp:localtest .`
Expected : build OK jusqu'à `CMD` (le layer `bun install --frozen-lockfile` réussit ; si `bun.lock` est désynchronisé, il échoue — dans ce cas lancer `bun install` localement pour régénérer le lock, committer, et relancer).

- [ ] **Step 3: Nettoyer l'image de test**

Run : `docker image rm bs_gtarp:localtest`
Expected : image supprimée (ou ignorer l'erreur si déjà absente).

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "build(docker): copie bun.lock + --frozen-lockfile (builds reproductibles)"
```

---

### Task 2: Workflow CI — build & push GHCR

**Files:**
- Create: `.github/workflows/docker-publish.yml`

**Interfaces:**
- Consumes: `Dockerfile` (Task 1).
- Produces: image `ghcr.io/azurich/bs_gtarp:latest` (+ tags `sha-…`, `vX.Y.Z`) sur push `main`/tag. Consommée par Task 3 (compose) et Task 4 (update.sh).

- [ ] **Step 1: Créer le workflow**

Créer `.github/workflows/docker-publish.yml` :

```yaml
name: Build & publish container image

on:
  push:
    branches: [main]
    tags: ["v*"]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=sha-
            type=semver,pattern={{version}}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

> Note : `IMAGE_NAME = github.repository` vaut `azurich/bs_gtarp` une fois le repo poussé → image `ghcr.io/azurich/bs_gtarp`. Aucun secret à créer : `GITHUB_TOKEN` est fourni automatiquement et a `packages: write`.

- [ ] **Step 2: Valider la syntaxe YAML**

Run (Windows/Bash, si `python` dispo) : `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/docker-publish.yml')); print('YAML OK')"`
Expected : `YAML OK` (pas d'exception). Si `python`/`yaml` indisponible, relire le fichier pour vérifier l'indentation (2 espaces, pas de tabs).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/docker-publish.yml
git commit -m "ci(docker): build & push image vers GHCR sur push main/tag"
```

> La publication réelle et le passage de l'image en **public** se vérifient après le push GitHub (Task 6) : onglet **Packages** du repo → `bs_gtarp` → Package settings → Change visibility → Public.

---

### Task 3: docker-compose.prod.yml — runtime GHCR

**Files:**
- Create: `docker-compose.prod.yml`

**Interfaces:**
- Consumes: image `ghcr.io/azurich/bs_gtarp:latest` (Task 2) ; `.env` (fourni sur la machine).
- Produces: stack lançable par `docker compose -f docker-compose.prod.yml up -d`. Consommée par Task 4 (update.sh) et Task 5 (runbook).

- [ ] **Step 1: Créer le compose de prod**

Créer `docker-compose.prod.yml` :

```yaml
services:
  casino:
    image: ghcr.io/azurich/bs_gtarp:latest
    restart: unless-stopped
    ports:
      # loopback STRICT : seul le tunnel cloudflared hôte y accède
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      # FORCE la base dans le volume persisté (surcharge un éventuel DB_FILE du .env)
      - DB_FILE=/app/data/casino.db
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      start_period: 15s
      retries: 3
```

- [ ] **Step 2: Valider la config compose (résolution des variables + schéma)**

Préparer un `.env` minimal local pour la validation (non commité) puis valider :

```bash
printf 'PORT=3000\nADMIN_USER=admin\nADMIN_PASS=validation-only\nDB_FILE=/app/data/casino.db\n' > .env.validate
docker compose -f docker-compose.prod.yml --env-file .env.validate config
```

Expected : la config est imprimée sans erreur ; on y voit `127.0.0.1:3000:3000` (published `3000`, host_ip `127.0.0.1`), le volume `./data:/app/data`, et `DB_FILE=/app/data/casino.db`.

- [ ] **Step 3: Nettoyer le fichier de validation**

Run : `rm -f .env.validate`
Expected : fichier supprimé (il ne doit pas être commité ; `.env*` réels sont ignorés, mais `.env.validate` ne l'est pas forcément — le supprimer explicitement).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "feat(deploy): docker-compose.prod (image GHCR, loopback 3000, volume data)"
```

---

### Task 4: deploy/update.sh — boucle de mise à jour

**Files:**
- Create: `deploy/update.sh`

**Interfaces:**
- Consumes: `docker-compose.prod.yml` (Task 3).
- Produces: script de déploiement idempotent, référencé par le runbook (Task 5).

- [ ] **Step 1: Créer le script**

Créer `deploy/update.sh` :

```sh
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
```

- [ ] **Step 2: Rendre le script exécutable**

Run : `chmod +x deploy/update.sh`
Expected : le bit exécutable est posé (visible via `ls -l deploy/update.sh` → `-rwxr-xr-x`). Sur Windows, poser aussi le flag git à l'étape suivante.

- [ ] **Step 3: Vérifier la syntaxe shell**

Run : `sh -n deploy/update.sh && echo "SH OK"`
Expected : `SH OK` (aucune erreur de syntaxe).

- [ ] **Step 4: Commit (avec bit exécutable dans git)**

```bash
git update-index --chmod=+x deploy/update.sh 2>/dev/null || true
git add deploy/update.sh
git commit -m "feat(deploy): update.sh (pull + up -d + prune)"
```

---

### Task 5: cloudflared example + runbook PREPROD

**Files:**
- Create: `deploy/cloudflared-config.yml.example`
- Create: `deploy/PREPROD.md`

**Interfaces:**
- Consumes: `docker-compose.prod.yml` (Task 3), `deploy/update.sh` (Task 4), `deploy/backup.sh` (existant).
- Produces: documentation opérationnelle complète (aucun code aval ne dépend d'elle).

- [ ] **Step 1: Créer l'exemple de config cloudflared**

Créer `deploy/cloudflared-config.yml.example` :

```yaml
# Exemple de configuration d'un tunnel cloudflared géré par FICHIER (voie CLI).
# À adapter puis placer dans /etc/cloudflared/config.yml sur la Debian.
# ── Alternative : gérer le tunnel via le dashboard Cloudflare Zero Trust
#    (Public Hostname : Type=HTTP, URL=localhost:3000) — dans ce cas ce fichier
#    n'est qu'un pense-bête, la config vit côté Cloudflare.

tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: blackstate.club
    service: http://localhost:3000
  - service: http_status:404
```

- [ ] **Step 2: Créer le runbook `deploy/PREPROD.md`**

Créer `deploy/PREPROD.md` :

````markdown
# Pré-prod BlackState — Debian + Docker + cloudflared (GHCR)

Déploiement par **image de conteneur publique** (`ghcr.io/azurich/bs_gtarp`),
tirée sur une machine **Debian**, exposée par un **tunnel cloudflared** sur
`https://blackstate.club`. Pas de port public, pas de reverse proxy, pas de
conteneur DB (SQLite = fichier sur volume).

Pour l'alternative VPS public (Caddy + Let's Encrypt), voir `../DEPLOY.md`.

## 0. Pré-requis
- Machine Debian avec `cloudflared` déjà installé.
- Un tunnel Cloudflare pour le domaine `blackstate.club`.

## 1. Installer Docker + plugin compose
```bash
sudo apt update
sudo apt install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # puis re-login pour appliquer le groupe
docker --version && docker compose version
```

## 2. Récupérer les fichiers de déploiement
```bash
sudo mkdir -p /opt/blackstate && sudo chown "$USER" /opt/blackstate
git clone https://github.com/azurich/bs_gtarp.git /opt/blackstate
cd /opt/blackstate
```
> Seuls `docker-compose.prod.yml` et `deploy/` sont nécessaires au runtime ;
> cloner tout le repo est le plus simple.

## 3. Configurer `.env` (jamais commité)
```bash
cat > .env <<'EOF'
PORT=3000
ADMIN_USER=ton_admin
ADMIN_PASS=un_mot_de_passe_TRES_long_et_unique
DB_FILE=/app/data/casino.db
EOF
chmod 600 .env
```
> ⚠️ Mets un vrai mot de passe admin. Le compte est créé au premier démarrage
> (base vierge en pré-prod).

## 4. Lancer l'app
L'image étant **publique**, aucun `docker login` n'est nécessaire.
```bash
mkdir -p data
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps        # doit être "healthy"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/   # -> 200
```

## 5. Tunnel cloudflared → blackstate.club
Deux voies au choix.

**A. Dashboard (recommandé, ce qui est déjà en place)**
Cloudflare Zero Trust → Networks → Tunnels → ton tunnel → Public Hostname :
- Subdomain/Domain : `blackstate.club`
- Service : **Type `HTTP`**, URL `localhost:3000`

**B. Fichier**
```bash
sudo cp deploy/cloudflared-config.yml.example /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml     # remplir <TUNNEL_ID>
sudo cloudflared service install          # si pas déjà en service
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared         # "active (running)"
```

Test public : ouvrir `https://blackstate.club` → la page casino s'affiche en HTTPS.

## 6. Sauvegardes quotidiennes
```bash
chmod +x deploy/backup.sh
crontab -e
```
Ajouter (backup tous les jours à 4h) :
```
0 4 * * * /opt/blackstate/deploy/backup.sh >> /opt/blackstate/backups/backup.log 2>&1
```
> `backup.sh` utilise `DB_FILE` ; il sauvegarde `/opt/blackstate/data/casino.db`.
> Copie aussi ces sauvegardes hors-machine.

## 7. Mettre à jour (après un `git push` sur `main`)
GitHub Actions reconstruit et pousse l'image automatiquement. Sur la machine :
```bash
cd /opt/blackstate
git pull                 # pour récupérer d'éventuels changements de compose/scripts
./deploy/update.sh       # pull image + up -d + prune
```

## 8. Logs & diagnostic
```bash
docker compose -f docker-compose.prod.yml logs -f     # logs app
sudo journalctl -u cloudflared -f                     # logs tunnel
docker compose -f docker-compose.prod.yml ps          # état/health
```
````

- [ ] **Step 3: Vérifier le YAML de l'exemple cloudflared**

Run (si `python` dispo) : `python -c "import yaml; yaml.safe_load(open('deploy/cloudflared-config.yml.example')); print('YAML OK')"`
Expected : `YAML OK`. Sinon relire pour vérifier l'indentation.

- [ ] **Step 4: Commit**

```bash
git add deploy/cloudflared-config.yml.example deploy/PREPROD.md
git commit -m "docs(deploy): runbook PREPROD + exemple config cloudflared"
```

---

### Task 6: Migration Git & push vers azurich/bs_gtarp

> **Exécutée par l'orchestrateur** (pas un sous-agent) : opérations git sur remotes réels. À faire APRÈS validation des tâches 1-5.

**Files:** aucun fichier — opérations git.

**Interfaces:**
- Consumes: toutes les tâches précédentes (commits sur `feat/reactiver-bj-demineur`).
- Produces: `main` à jour poussé sur `https://github.com/azurich/bs_gtarp.git` → déclenche le workflow CI (Task 2).

- [ ] **Step 1: Merger la branche de feature dans main (fast-forward)**

```bash
git checkout main
git merge --ff-only feat/reactiver-bj-demineur
git log --oneline -3
```
Expected : `main` avance jusqu'au dernier commit de la branche (dont le spec, le plan et les 5 tâches infra). Si le fast-forward échoue (main a divergé), faire `git merge --no-ff feat/reactiver-bj-demineur` à la place.

- [ ] **Step 2: Repointer origin vers le nouveau repo**

```bash
git remote set-url origin https://github.com/azurich/bs_gtarp.git
git remote -v
```
Expected : `origin` pointe vers `https://github.com/azurich/bs_gtarp.git` (fetch + push).

- [ ] **Step 3: Pousser main**

```bash
git push -u origin main
```
Expected : push réussi ; la branche `main` existe sur `azurich/bs_gtarp`. (Si le repo distant a un commit initial — README auto — et que le push est rejeté, faire `git pull --rebase origin main` puis re-push.)

- [ ] **Step 4: Vérifier le déclenchement de la CI et publier l'image en public**

- Onglet **Actions** du repo → le workflow "Build & publish container image" tourne et passe au vert.
- Onglet **Packages** (page du repo ou profil) → `bs_gtarp` apparaît après succès.
- Package `bs_gtarp` → **Package settings** → **Change visibility** → **Public** → confirmer.

Expected : `ghcr.io/azurich/bs_gtarp:latest` est **public** et pullable sans authentification (`docker pull ghcr.io/azurich/bs_gtarp:latest` depuis n'importe où).

- [ ] **Step 5: (Optionnel) Tag de version pour un build versionné**

```bash
git tag v2.0.0
git push origin v2.0.0
```
Expected : le workflow reconstruit et publie aussi `ghcr.io/azurich/bs_gtarp:2.0.0`.

---

## Self-Review

**1. Spec coverage :**
- CI GHCR (spec §CI) → Task 2. ✅
- docker-compose.prod (spec §Runtime) → Task 3. ✅
- `.env`/base vierge (spec §.env) → documenté Task 5 (runbook §3). ✅
- cloudflared hôte + exemple (spec §cloudflared) → Task 5. ✅
- update.sh (spec §Mise à jour) → Task 4. ✅
- runbook PREPROD, DEPLOY.md conservé (spec §Runbook) → Task 5. ✅
- Dockerfile bun.lock (spec §Amélioration) → Task 1. ✅
- Migration git (spec §Migration) → Task 6. ✅
- Sécurité loopback / image sans secret (spec §Sécurité) → Task 3 (bind 127.0.0.1) + Global Constraints. ✅
- Backups (spec §Sauvegardes) → Task 5 (runbook §6, réutilise `backup.sh`). ✅
- Vérifications (spec §Tests) → réparties : build local (T1), config compose (T3), YAML (T2/T5), runbook curl 200 + tunnel + reboot (T5), boucle déploiement (T4/T6).

**2. Placeholder scan :** `<TUNNEL_ID>`, `ton_admin`, `un_mot_de_passe…` sont des valeurs à remplir par l'opérateur sur la machine (intentionnel, hors dépôt), pas des placeholders de plan. Aucun "TODO/TBD/à compléter" dans les livrables.

**3. Type/nom consistency :** image `ghcr.io/azurich/bs_gtarp` identique partout (CI, compose, update.sh implicite, runbook) ; fichier `docker-compose.prod.yml` référencé de façon identique dans T3/T4/T5 ; port `3000` et bind `127.0.0.1:3000:3000` cohérents ; `DB_FILE=/app/data/casino.db` + volume `./data:/app/data` cohérents spec↔plan.
