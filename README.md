# NEON SANTOS — Social Casino (crédits virtuels)

Casino web pour serveur **GTA RP**, en crédits virtuels. Architecture client-serveur :
le **navigateur affiche et anime**, mais **le serveur décide tout** (argent, RNG, taux de gain).
Aucun joueur ne peut tricher en modifiant le code de sa page.

Jeux : Slots, Blackjack, Démineur, Plinko, Roue de la fortune, Dice.
Espace joueur (compte, solde, stats, classement) + espace admin
(création/approvisionnement de comptes, économie RTP fixe en lecture seule, journal d'activité).

---

## 1. Prérequis

- **Node.js ≥ 22.5** (la base SQLite est intégrée à Node, rien à compiler).
  Vérifie avec `node --version`.

## 2. Installation & lancement (local / chez toi)

```bash
npm install
npm start
```

Puis ouvre **http://localhost:3000**.

Au premier démarrage, un compte admin est créé : **admin / admin**.
**Change-le immédiatement** via le fichier `.env` (voir `.env.example`) :

```bash
cp .env.example .env
# édite .env : ADMIN_USER, ADMIN_PASS, PORT, DB_FILE
```

(Si tu changes `ADMIN_USER`/`ADMIN_PASS` après le 1er démarrage, supprime `casino.db*`
pour régénérer le compte, ou change le mot de passe en base.)

## 3. Données

Tout est stocké dans un seul fichier **`casino.db`** (SQLite). Pour sauvegarder : copie ce fichier.
Tables : `users`, `sessions`, `settings` (les taux), `logs`.

---

## 4. Héberger

### a) Chez toi
`npm start` sur un PC allumé en permanence, puis ouvre/redirige le port (ex. 3000) sur ta box.
Mets un reverse-proxy (Nginx/Caddy) devant pour le HTTPS et un nom de domaine. Pense au risque DDoS.

### b) Hébergeur gratuit / pas cher
- **Render** (offre gratuite permanente, sans carte) : crée un *Web Service*, build `npm install`,
  start `npm start`. ⚠️ le service se met en veille après ~15 min d'inactivité (réveil ~30-50 s),
  et le disque est éphémère → pour garder `casino.db`, ajoute un *Persistent Disk* (payant) ou
  passe sur une vraie base (voir §5).
- **Railway / Fly.io** : pratiques mais plus de palier 100 % gratuit (crédit d'essai puis ~5 $/mois),
  carte requise. Volume persistant simple pour le fichier SQLite.
- **VPS** (~5-7 €/mois) : le plus stable. `git pull`, `npm install`, lance avec `pm2` ou un service systemd.

> Important : sur un hébergeur au disque éphémère, le fichier SQLite est **effacé à chaque redéploiement**.
> Utilise un disque persistant, ou migre vers une base managée (§5).

---

## 5. Brancher la vraie monnaie RP (MySQL du serveur FiveM) — plus tard

Aujourd'hui le casino a sa **propre économie** (crédits internes, alimentés par l'admin).
Pour utiliser l'argent que les joueurs ont **déjà en jeu**, il faut taper dans la base **MySQL/MariaDB**
de ton serveur FiveM (celle d'ESX/QBCore/QBox).

Marche à suivre :
1. `npm install mysql2`.
2. Réécris **`db.js`** pour te connecter à la MySQL du serveur (mêmes noms de requêtes, l'API est proche).
3. Dans `server.js`, remplace la lecture/écriture de `users.credit` par la table d'argent du framework
   (ex. ESX : colonne `money`/`bank` de `users` ; QBCore : champ JSON `money` de `players`),
   en identifiant le joueur par son **identifiant RP** (license / citizenid) plutôt que par pseudo.
4. Idéalement, fais-les se connecter via **Discord OAuth** lié à leur identité RP.

Tant que les gains **ne se reconvertissent pas en argent réel**, tu restes dans le cadre d'un
minijeu in-game (pas un casino au sens de la loi). Ne mets jamais de vrai argent en jeu sans licence.

---

## 6. Sécurité — déjà en place / à renforcer

En place :
- Mots de passe **hachés** (bcrypt), jamais en clair.
- **Toute** la logique d'argent, le RNG et les taux de gain sont **côté serveur**.
- Sessions par token, routes admin protégées (403 si non-admin).
- Validations : mises entières positives, solde vérifié, cases du démineur non rejouables.

À renforcer avant une grosse mise en prod :
- HTTPS obligatoire (reverse-proxy).
- Limiteur de requêtes (rate limiting) pour éviter le spam de mises.
- Les parties de blackjack/démineur en cours sont gardées **en mémoire** : un redémarrage du
  serveur annule une partie en cours (le solde reste correct). Pour du multi-instance, déporte cet
  état (Redis/DB).

---

## 7. Marque & légal

Ambiance néon *inspirée* de la Californie. **Non affilié à Rockstar Games / Take-Two** :
n'utilise pas les logos GTA, la police « Pricedown » ni les personnages officiels si tu publies.
Garde le nom « Neon Santos » comme exemple ou mets le tien.

Crédits **virtuels** uniquement. Pas d'argent réel sans licence ANJ.
