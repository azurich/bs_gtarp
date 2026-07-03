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
sudo apt install -y ca-certificates curl sqlite3
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
cd /opt/blackstate
cat > .env <<'EOF'
PORT=3000
ADMIN_USER=ton_admin
ADMIN_PASS=un_mot_de_passe_TRES_long_et_unique
DB_FILE=/app/data/blackstate.db
# CAPTCHA Turnstile (optionnel) — les DEUX pour l'activer sur login+inscription.
# Clé de site = publique, clé secrète = SERVEUR UNIQUEMENT. Cloudflare → Turnstile.
TURNSTILE_SITE_KEY=<ta_cle_de_site>
TURNSTILE_SECRET_KEY=<ta_cle_secrete>
EOF
chmod 600 .env
```
> ⚠️ Mets un vrai mot de passe admin. Le compte est créé au premier démarrage
> (base vierge en pré-prod).

## 4. Lancer l'app
L'image étant **publique**, aucun `docker login` n'est nécessaire.
```bash
mkdir -p data
# L'app tourne en utilisateur non-root "blackstate" (uid 10001) DANS le conteneur.
# Le volume ./data (bind-mount) doit lui appartenir, sinon SQLite ne peut pas
# créer/écrire blackstate.db et le conteneur crashe en boucle (SQLITE_CANTOPEN).
sudo chown -R 10001:10001 data
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
> `backup.sh` sauvegarde `/opt/blackstate/data/blackstate.db` par défaut (surchargeable via `BACKUP_DB=…`).
> Si la base est absente, le script échoue bruyamment au lieu de produire un backup vide.
> Vérifier un premier lancement manuel : `./deploy/backup.sh && ls -la /opt/blackstate/backups` (vérifier que le fichier .db n'est pas vide).
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
