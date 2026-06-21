# BlackState — Plateforme multi-univers (Club + Casino + Fight)
**Date :** 2026-06-21
**Portée :** Restructurer le casino mono-page en plateforme à plusieurs univers sous un seul domaine `blackstate.azurich.fr`. **Hors périmètre :** la logique du jeu Fight (univers en "Coming Soon" seulement).

---

## 1. Vision

Transformer BlackState en **plateforme** :
- **`/`** — **BlackState Club** : site vitrine (présentation + comment nous rejoindre), thème **noir & doré**.
- **`/casino`** — le casino existant (jeux inchangés), thème **violet**.
- **`/fight`** — univers de combats, thème **rouge**, page **Coming Soon** (aucun backend pour l'instant).
- **`/profil`** — gestion du profil enrichi.
- **`/admin`** — panel admin, **caché** (aucun lien, accès admin uniquement).

Direction artistique commune, **accent de couleur par univers**. Session partagée. Inscription **sur invitation** déplacée vers le Club avec un formulaire enrichi.

---

## 2. Architecture & fichiers

Découpage **noyau commun / spécifique par univers** :

```
public/
  core/
    tokens.css   — design system commun (couleurs base, polices, espacements,
                   rayons, composants : boutons, cartes, modale, formulaires, toast, spinner)
    auth.js      — session/token, api(), login/logout, getUser(), requireAuth(), requireAdmin()
    shell.js     — barre de navigation globale (logo + Club/Casino/Fight + menu user),
                   injectée sur chaque page ; surligne l'univers actif
  club.html / club.css / club.js     — "/"        (noir & doré)
  casino.html / casino.css / casino.js — "/casino" (violet, l'actuel déménagé)
  profil.html / profil.js            — "/profil"  (thème club)
  fight.html                         — "/fight"   (rouge, coming soon)
  admin.html / admin.js              — "/admin"   (caché)
  lucide.min.js
  responsive.css                     — règles responsive partagées
```

**Migration depuis l'existant :** `style.css` actuel → scindé en `core/tokens.css` (commun) + `casino.css` (sidebar jeux, jeux, spécifique violet). `app.js` actuel → scindé en `core/auth.js` (session, login/register/logout, helpers) + `casino.js` (jeux) + `admin.js` (panel admin). L'`index.html` actuel → `casino.html` moins la vue auth (→ Club) et moins `#adminPanel` (→ `/admin`).

**Routing serveur (ElysiaJS) :**

| URL | Sert | Protection |
|---|---|---|
| `/` | `club.html` | public (gère `?invite=TOKEN`) |
| `/casino` | `casino.html` | client : redirige `/` si non connecté |
| `/fight` | `fight.html` | public |
| `/profil` | `profil.html` | client : redirige `/` si non connecté |
| `/admin` | `admin.html` | client + serveur : `checkAdmin` sur l'API |
| `/api/*` | API commune | inchangé |
| ressources / reste | handler statique générique existant | — |

Les redirections "page protégée" sont côté client (le HTML se charge, `requireAuth()` redirige si pas de session) ; la **sécurité réelle** reste sur l'API (`checkAdmin`, `withAuth`).

**Barre de navigation globale (`shell.js`) :** présente sur Club / Casino / Fight / Profil. Contient : logo BlackState (→ `/`), liens **Club / Casino / Fight**, et à droite le **menu utilisateur** (solde + pseudo + Profil + Déconnexion) si connecté, sinon un bouton **Se connecter** (ouvre la modale de login). L'univers actif est surligné dans sa couleur d'accent.

---

## 3. Thème par univers

`core/tokens.css` définit le design system avec des variables d'**accent** neutres :
`--accent`, `--accent-2`, `--accent-soft`, `--accent-glow`, `--accent-dim`.

Chaque page surcharge ces variables (via sa CSS ou une classe sur `<body>`) :

| Univers | `--accent` (principal) | Fond |
|---|---|---|
| **Club** | or `#c9a84c` (+ `#e0bd5a`) | noir profond `#05050c` |
| **Casino** | violet `#7c3aed` (+ `#5b21b6` / `#a78bfa`) | `#05050c` (inchangé) |
| **Fight** | rouge `#e23b3b` (+ teintes) | `#05050c` |

Les composants partagés (boutons, cartes, modale, champs, toast) utilisent `--accent*` → ils prennent automatiquement la couleur de l'univers courant. La barre de nav globale est sombre/neutre, le lien actif prend `--accent`.

---

## 4. Page Club (`/`)

Structure verticale, sobre :
1. **Barre de nav globale** (logo + univers + Se connecter / menu user).
2. **Présentation du club** — bloc éditorial : qui est BlackState en RP, l'ambiance, ce qu'on y trouve (casino, bientôt Fight). Texte placeholder rédigé, modifiable dans le HTML.
3. **Comment nous rejoindre** — encart éditorial expliquant la démarche pour obtenir une invitation (texte libre, pas de coordonnées fixes).

**Connexion :** bouton "Se connecter" dans la nav → **modale** (pseudo + mot de passe). Après succès, la page se recharge en état connecté.

**Inscription :** si l'URL contient `?invite=TOKEN` valide → affichage du **formulaire d'inscription enrichi** (en page ou modale dédiée) au lieu/au-dessus de la présentation, avec le bandeau "Invitation · X crédits offerts".

---

## 5. Inscription (invitation) + Profil

### Champs RP (nouveaux)
Le profil collecte, en plus du **Pseudo** (= `username`, le login déjà présent) + mot de passe :
- **NOM** du personnage RP (`rp_nom`)
- **Prénom** du personnage RP (`rp_prenom`)
- **Numéro** de téléphone RP in-game (`rp_phone`)
- **id Discord** (`discord`)

> Le "Pseudo" reste le login du compte (non modifiable). Les 4 champs ci-dessus sont nouveaux.

### Base de données
Ajout de 4 colonnes à `users` via le mécanisme `addCol` existant (non destructif) :
```sql
rp_nom    TEXT NOT NULL DEFAULT ''
rp_prenom TEXT NOT NULL DEFAULT ''
rp_phone  TEXT NOT NULL DEFAULT ''
discord   TEXT NOT NULL DEFAULT ''
```
Interface `User` étendue en conséquence.

### API
- **`POST /api/register`** (existant, sur invitation) — accepte et valide les 4 champs RP (longueurs bornées, ex. ≤ 40 chars chacun), les stocke. Validation pseudo/mot de passe inchangée.
- **`POST /api/profile`** (nouveau, protégé `withAuth`) — met à jour **uniquement** `rp_nom`, `rp_prenom`, `rp_phone`, `discord` du joueur connecté. Ne touche jamais à `username`, `credit`, `is_admin`, stats. Bornes de longueur appliquées.
- **`publicUser()`** — renvoie désormais les 4 champs RP (pour pré-remplir le profil).

### Page Profil (`/profil`, thème club)
- En-tête : pseudo (login, lecture seule) + carte XP/niveau (réutilise les composants existants).
- **Stats du compte** (lecture seule) : solde, misé, gagné, net, parties, meilleur gain.
- **Infos RP éditables** : formulaire (NOM, Prénom, Numéro, id Discord) + bouton "Enregistrer" → `POST /api/profile`.
- Pas d'avatar ni de bio (hors périmètre).

---

## 6. Casino (`/casino`) + Admin (`/admin`)

### Casino
- `casino.html` = l'`index.html` actuel **moins** : la vue `#authView` (login/inscription → Club) et `#adminPanel` (→ `/admin`).
- Page **protégée** : `requireAuth()` au chargement → redirige vers `/` si pas de session.
- La **sidebar casino** ne garde que la navigation **jeux** (Accueil + 6 jeux + Historique + Profil). Le bloc `sidebar-user` (solde/XP/pseudo/déconnexion) est **retiré** → ces infos vivent dans la barre de nav globale. (Le lien "Profil" du casino pointe vers `/profil`.)
- `casino.js` = `app.js` actuel **moins** la logique auth (login/register/logout → `core/auth.js`) et admin (→ `admin.js`). Jeux + chat (déjà retiré) + historique inchangés.
- `casino.css` = `style.css` actuel **moins** les tokens communs (→ `core/tokens.css`).

### Admin (caché)
- `admin.html` = le `#adminPanel` actuel en page autonome (`/admin`), thème admin existant (zinc/violet).
- **Caché** : aucun lien dans la nav globale ni ailleurs. Un admin qui se connecte est **redirigé automatiquement** vers `/admin` (le shell détecte `user.admin`). Un non-admin qui ouvre `/admin` est redirigé vers `/`. L'API admin reste protégée par `checkAdmin` (403).
- La **table joueurs** affiche désormais les infos RP (NOM Prénom, Discord) en plus des stats.
- `admin.js` = la logique admin extraite d'`app.js` (renderAdminUsers, crédits/débit/suppression, invitations, logs, gameinfo).

---

## 7. Univers Fight (`/fight`) — Coming Soon

`fight.html` : barre de nav globale + une section centrale **Coming Soon** au thème rouge (logo, titre "FIGHT", sous-titre "Combats — Bientôt disponible", court teaser). **Aucun backend, aucune table, aucune route API.** Sert juste à matérialiser l'univers dans la nav et la vitrine.

---

## 8. Session & sécurité (inchangé sur le fond)

- Token Bearer en `localStorage` (clé `ns_token`), partagé par toutes les pages (même origine).
- `core/auth.js` centralise : `api(path, method, body)`, `login()`, `register()`, `logout()`, `getUser()` (cache `/api/me`), `requireAuth()` (redirige `/`), `requireAdmin()` (redirige `/`).
- Sécurité serveur inchangée : `withAuth` sur les routes joueur, `checkAdmin` sur les routes admin, rate-limit login, CSP (`script-src-attr 'unsafe-inline'` conservé pour les `onclick`).
- À la connexion : `user.admin` → redirection `/admin` ; sinon retour à la page courante (ou `/`).

---

## 9. Fichiers touchés (récap)

| Fichier | Action |
|---|---|
| `public/core/tokens.css` | **créer** (extrait de `style.css`) |
| `public/core/auth.js` | **créer** (extrait de `app.js` : session/login/register/logout) |
| `public/core/shell.js` | **créer** (barre de nav globale) |
| `public/club.html` / `club.css` / `club.js` | **créer** |
| `public/profil.html` / `profil.js` | **créer** |
| `public/fight.html` | **créer** |
| `public/admin.html` / `admin.js` | **créer** (extrait de `index.html`/`app.js`) |
| `public/casino.html` | renommer/adapter depuis `index.html` |
| `public/casino.css` | renommer/adapter depuis `style.css` |
| `public/casino.js` | renommer/adapter depuis `app.js` |
| `public/index.html` / `style.css` / `app.js` | **supprimer** une fois migrés |
| `server.ts` | routes `/`, `/casino`, `/fight`, `/profil`, `/admin` ; `POST /api/profile` ; champs RP dans register/publicUser |
| `db.ts` | 4 colonnes RP + interface `User` |

**Contrainte :** préserver les IDs/classes utilisés par le JS des jeux. Ne pas modifier l'économie (RTP) ni la logique des jeux.
