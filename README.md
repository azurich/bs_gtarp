# BlackState Club — casino GTA RP (crédits virtuels)

Casino web pour serveur **GTA RP**, en crédits virtuels. Architecture client-serveur :
le **navigateur affiche et anime**, mais **le serveur décide tout** (argent, RNG, taux de
gain). Aucun joueur ne peut tricher en modifiant le code de sa page.

Jeux : Slots, Blackjack, Démineur, Plinko, Roue de la fortune, Dice.
Espace joueur (compte, solde, stats, classement) + espace admin (création /
approvisionnement de comptes, économie RTP fixe en lecture seule, journal d'activité).

**Stack :** Bun + ElysiaJS + `bun:sqlite` (base = un simple fichier). Front vanilla
multi-pages. 2FA (TOTP) et CAPTCHA (Cloudflare Turnstile) sur l'auth.

---

## Développement local

Prérequis : **[Bun](https://bun.sh) ≥ 1.3**.

```bash
bun install
cp env.example .env      # édite ADMIN_USER / ADMIN_PASS
bun run dev              # ou : bun run start
```

Puis ouvre **http://localhost:3000**. Au premier démarrage, un compte admin est créé
à partir de `ADMIN_USER` / `ADMIN_PASS` du `.env` (⚠️ mets un vrai mot de passe).

En local, laisse `TURNSTILE_*` vide dans `.env` → le CAPTCHA est désactivé et les
formulaires marchent normalement.

## Tests

```bash
bun test
```

## Données

Tout est stocké dans un seul fichier SQLite (`blackstate.db` par défaut, ou le chemin
`DB_FILE`). Pour sauvegarder : copie ce fichier (voir `deploy/backup.sh`).

---

## Déploiement (production)

Le déploiement de référence est **conteneur Docker + tunnel Cloudflare** sur une
machine Debian, avec l'image publiée sur GitHub Container Registry par GitHub Actions.

👉 Procédure complète : **[`deploy/PREPROD.md`](deploy/PREPROD.md)**.

En bref : `docker compose -f docker-compose.prod.yml up -d` tire l'image
`ghcr.io/azurich/bs_gtarp`, l'app écoute en loopback, et un tunnel `cloudflared`
l'expose en HTTPS. Mises à jour via `deploy/update.sh`.

---

## Sécurité — en place

- Mots de passe **hachés** (bcrypt), jamais en clair ; 2FA TOTP optionnelle.
- **Toute** la logique d'argent, le RNG et les taux de gain sont **côté serveur**.
- Sessions par token, routes admin protégées (403 si non-admin).
- Rate-limiting sur l'auth, en-têtes de sécurité + CSP stricte, CAPTCHA Turnstile
  sur login + inscription (activé si les clés `TURNSTILE_*` sont définies).
- Inscription **sur invitation** uniquement.

> Les parties de Blackjack / Démineur en cours sont gardées **en mémoire** : un
> redémarrage du serveur annule une partie en cours (le solde reste correct). Pour du
> multi-instance, il faudrait déporter cet état (Redis/DB).

---

## Marque & légal

Crédits **virtuels** uniquement — pas d'argent réel sans licence ANJ. Univers de
fiction (GTA RP) : **non affilié à Rockstar Games / Take-Two** ; n'utilise pas les
logos, polices ou personnages officiels de GTA.
