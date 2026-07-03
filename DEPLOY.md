# Déploiement BlackState sur un VPS (Hetzner / Hostinger)

L'app tourne telle quelle : **Bun + SQLite**, aucun service externe.
Cible : Ubuntu 22.04/24.04. Toutes les commandes en SSH (`root` ou `sudo`).

---

## 1. Créer le VPS
- **Hetzner Cloud** : projet → Add Server → Ubuntu 24.04 → type **CX22** (~4,5 €/mois).
- **Hostinger** : VPS → KVM → image Ubuntu 24.04.
- Ajoute ta clé SSH à la création, note l'**IP publique**.

## 2. DNS — sous-domaine `blackstate.azurich.fr`
Chez le gestionnaire DNS d'`azurich.fr`, ajoute :

| Type | Nom | Valeur |
|------|-----|--------|
| `A`  | `blackstate` | `IP_DU_VPS` |

Propagation : quelques minutes à ~1h. Le Caddyfile fourni est déjà réglé sur ce domaine.

## 3. Connexion + mises à jour
```bash
ssh root@IP_DU_VPS
apt update && apt upgrade -y
apt install -y git sqlite3 ufw
```

## 4. Pare-feu
```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable          # le port 3000 N'EST PAS ouvert → accessible seulement via le proxy local
```

## 5. Utilisateur dédié + Bun + code
```bash
adduser --disabled-password --gecos "" blackstate
sudo -u blackstate bash -lc 'curl -fsSL https://bun.sh/install | bash'

# Récupère le code dans /opt/blackstate
git clone <URL_DE_TON_REPO> /opt/blackstate     # ou scp/rsync depuis ton PC
chown -R blackstate:blackstate /opt/blackstate

# Dépendances
sudo -u blackstate bash -lc 'cd /opt/blackstate && ~/.bun/bin/bun install --production'
```

## 6. Configuration (.env)
```bash
nano /opt/blackstate/.env
```
```ini
PORT=3000
ADMIN_USER=ton_admin
ADMIN_PASS=un_mot_de_passe_TRES_long_et_unique
DB_FILE=/opt/blackstate/blackstate.db
```
> ⚠️ Mets un **vrai** mot de passe admin. Il est haché au premier démarrage.

## 7. Lancer en service (redémarre seul au reboot/crash)
```bash
# Vérifie le chemin de bun et ajuste blackstate.service si besoin
sudo -u blackstate which bun        # ex: /home/blackstate/.bun/bin/bun

cp /opt/blackstate/deploy/blackstate.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now blackstate
systemctl status blackstate          # doit être "active (running)"
```
Test local : `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/` → `200`.

## 8. HTTPS automatique (Caddy)
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Le Caddyfile est déjà réglé sur blackstate.azurich.fr
cp /opt/blackstate/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```
Caddy obtient le certificat Let's Encrypt automatiquement (dès que le DNS pointe vers le VPS).
Ton site est en ligne sur **https://blackstate.azurich.fr** 🎉

## 9. Sauvegardes quotidiennes (important !)
```bash
chmod +x /opt/blackstate/deploy/backup.sh
crontab -e
```
Ajoute (sauvegarde tous les jours à 4h) :
```
0 4 * * * /opt/blackstate/deploy/backup.sh >> /opt/blackstate/backups/backup.log 2>&1
```
> Pense aussi à copier ces sauvegardes **hors du VPS** (ex: `rsync` vers ton PC, ou un stockage objet) — un disque peut lâcher.

---

## Mettre à jour le site (après un `git push`)
```bash
cd /opt/blackstate
sudo -u blackstate git pull
sudo -u blackstate ~/.bun/bin/bun install --production
systemctl restart blackstate
```

## Voir les logs
```bash
journalctl -u blackstate -f        # logs de l'app
journalctl -u caddy -f             # logs du proxy/HTTPS
```

## Récapitulatif des fichiers fournis (`deploy/`)
| Fichier | Rôle |
|---|---|
| `blackstate.service` | Service systemd (lance bun, redémarre seul) |
| `Caddyfile` | Reverse-proxy + HTTPS automatique |
| `backup.sh` | Sauvegarde à chaud de la base SQLite |
