# BlackState — Plateforme multi-univers — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le casino mono-page en plateforme multi-pages (Club / Casino / Fight / Profil / Admin) sous un seul domaine, avec noyau commun, thème par univers, et profil RP enrichi.

**Architecture:** Pages HTML statiques distinctes servies par routes Elysia, partageant `core/tokens.css` (design system + accents), `core/auth.js` (session/API) et `core/shell.js` (barre de nav globale). Le casino existant déménage sous `/casino` quasi inchangé. Backend additif : 4 colonnes RP + `POST /api/profile`.

**Tech Stack:** Bun, ElysiaJS, bun:sqlite, HTML/CSS/JS vanilla, Lucide (auto-hébergé).

## Global Constraints

- **Ne JAMAIS modifier** l'économie/RTP (`games.ts`) ni la logique des jeux (routes `/api/play/*`, `/api/bj/*`, `/api/mines/*`).
- Clé de session localStorage : **`ns_token`** (inchangée — ne pas invalider les sessions existantes).
- CSP : conserver `script-src 'self'` **et** `script-src-attr 'unsafe-inline'` (requis pour les `onclick=`).
- Couleurs d'accent : Club = or `#c9a84c`, Casino = violet `#7c3aed`, Fight = rouge `#e23b3b`.
- Champs RP (4 nouveaux) : `rp_nom`, `rp_prenom`, `rp_phone`, `discord`. "Pseudo" = `username` (login, non modifiable).
- Pas de framework de test → vérif par `curl`, `bun build`, `bun -e`, `grep`, contrôle visuel.
- Redémarrer le serveur après chaque tâche touchant `server.ts`/`db.ts` (`pkill -f "bun run server.ts"` puis relancer) et vérifier HTTP 200.
- Commits : `git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit`.
- L'app doit rester fonctionnelle à chaque étape : `index.html`/`style.css`/`app.js` restent servis à `/` jusqu'à la tâche de bascule du routing (Tâche 11), supprimés en Tâche 12.

---

## Structure des fichiers (cible)

```
public/
  core/
    tokens.css   — :root design system + blocs body[data-universe=…] (accents) + composants partagés
    auth.js      — TOKEN/USER, api(), getMe(), doLogin(), logout(), requireAuth(), requireAdmin(),
                   helpers $/fmt/esc/toast/openModal/closeModal/confirmModal
    shell.js     — barre de nav globale (logo + Club/Casino/Fight + menu user), injectée au chargement
  club.html / club.css / club.js   — "/"        (data-universe="club")
  casino.html / casino.css / casino.js — "/casino" (data-universe="casino")
  profil.html / profil.js          — "/profil"  (data-universe="club")
  fight.html                       — "/fight"   (data-universe="fight")
  admin.html / admin.js            — "/admin"   (caché)
  lucide.min.js
  responsive.css                   — partagé
```

---

### Task 1: DB — colonnes RP

**Files:**
- Modify: `db.ts` (bloc migrations ~L61-66 ; interface `User` ~L71-84)

**Interfaces:**
- Produces: colonnes `rp_nom`, `rp_prenom`, `rp_phone`, `discord` (TEXT NOT NULL DEFAULT '') sur `users` ; champs correspondants dans l'interface `User`.

- [ ] **Step 1: Ajouter les migrations**

Dans `db.ts`, après les deux `addCol('users', 'xp'…)` / `('users','level'…)` existants, ajouter :

```ts
addCol('users', 'rp_nom',    "TEXT NOT NULL DEFAULT ''")
addCol('users', 'rp_prenom', "TEXT NOT NULL DEFAULT ''")
addCol('users', 'rp_phone',  "TEXT NOT NULL DEFAULT ''")
addCol('users', 'discord',   "TEXT NOT NULL DEFAULT ''")
```

- [ ] **Step 2: Étendre l'interface `User`**

Dans l'interface `User`, après `level : number`, ajouter :

```ts
  rp_nom    : string
  rp_prenom : string
  rp_phone  : string
  discord   : string
```

- [ ] **Step 3: Vérifier les colonnes**

Run: `bun -e "import {db} from './db.ts'; console.log(db.prepare('PRAGMA table_info(users)').all().map(c=>c.name).join(','))"`
Expected: la sortie contient `rp_nom,rp_prenom,rp_phone,discord`.

- [ ] **Step 4: Commit**

```bash
git add db.ts
git commit -m "feat(db): colonnes RP (rp_nom, rp_prenom, rp_phone, discord)"
```

---

### Task 2: API — champs RP à l'inscription + publicUser

**Files:**
- Modify: `server.ts` (`Q.insertUser` ~L43 ; `publicUser` ~L91-100 ; route `/api/register` ~L285-309)

**Interfaces:**
- Consumes: colonnes RP (Task 1).
- Produces: `publicUser()` renvoie `rp` `{nom, prenom, phone, discord}` ; `/api/register` accepte `nom,prenom,phone,discord` dans le body.

- [ ] **Step 1: insertUser avec colonnes RP**

Remplacer la préparée `insertUser` :

```ts
  insertUser  : db.prepare('INSERT INTO users (username, pass_hash, is_admin, credit, created, rp_nom, rp_prenom, rp_phone, discord) VALUES (?,?,?,?,?,?,?,?,?)'),
```

- [ ] **Step 2: publicUser renvoie les champs RP**

Dans `publicUser`, ajouter avant la fermeture de l'objet retourné :

```ts
    rp       : { nom: u.rp_nom ?? '', prenom: u.rp_prenom ?? '', phone: u.rp_phone ?? '', discord: u.discord ?? '' },
```

- [ ] **Step 3: register lit, valide et stocke les champs RP**

Ajouter un helper près des autres helpers (après `validUser`) :

```ts
const clip = (v: unknown, max = 40) => String(v ?? '').trim().slice(0, max)
```

Dans `/api/register`, juste avant `const hash = await Bun.password.hash(p, …)`, ajouter :

```ts
      const rpNom = clip(b.nom), rpPrenom = clip(b.prenom), rpPhone = clip(b.phone, 20), rpDiscord = clip(b.discord)
```

Puis remplacer l'appel `Q.insertUser.run(u, hash, 0, invite.credits, Date.now())` par :

```ts
      const info  = Q.insertUser.run(u, hash, 0, invite.credits, Date.now(), rpNom, rpPrenom, rpPhone, rpDiscord)
```

(Note : la ligne `const info =` existe déjà — fusionner, ne pas dupliquer.)

- [ ] **Step 4: Redémarrer + vérifier**

```bash
pkill -f "bun run server.ts"; sleep 1; bun run server.ts > /tmp/bun-server.log 2>&1 &
sleep 3; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```
Expected: `200`. Puis créer une invitation via l'admin (ou `bun -e` sur la table `invites`) et `POST /api/register` avec un body incluant `nom/prenom/phone/discord` ; vérifier que `bun -e "import {db} from './db.ts'; console.log(db.prepare('SELECT username,rp_nom,discord FROM users ORDER BY id DESC LIMIT 1').get())"` montre les valeurs.

- [ ] **Step 5: Commit**

```bash
git add server.ts
git commit -m "feat(api): champs RP a l'inscription + publicUser.rp"
```

---

### Task 3: API — POST /api/profile (édition RP)

**Files:**
- Modify: `server.ts` (préparées `Q` ; bloc routes protégées, après `/api/me` ~L338)

**Interfaces:**
- Consumes: `withAuth` (fournit `user`), helper `clip` (Task 2).
- Produces: `POST /api/profile` → `{ user: publicUser }`. Met à jour uniquement les 4 champs RP.

- [ ] **Step 1: Préparée d'update RP**

Dans l'objet `Q`, ajouter :

```ts
  setProfile  : db.prepare('UPDATE users SET rp_nom = ?, rp_prenom = ?, rp_phone = ?, discord = ? WHERE id = ?'),
```

- [ ] **Step 2: Route protégée**

Dans le bloc `.use(new Elysia().use(withAuth) …)`, juste après la ligne `.get('/api/me', …)`, ajouter :

```ts
    .post('/api/profile', ({ body, user }) => {
      const b = body as Record<string, unknown>
      const u = user as User
      Q.setProfile.run(clip(b.nom), clip(b.prenom), clip(b.phone, 20), clip(b.discord), u.id)
      return { user: publicUser(Q.userById.get(u.id) as User) }
    })
```

- [ ] **Step 3: Redémarrer + vérifier**

```bash
pkill -f "bun run server.ts"; sleep 1; bun run server.ts > /tmp/bun-server.log 2>&1 &
sleep 3; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```
Expected: `200`. Avec un token valide : `curl -s -X POST http://localhost:3000/api/profile -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"nom":"Vercetti","prenom":"Tommy","phone":"555-0100","discord":"tommy#1"}'` → renvoie `user.rp.nom == "Vercetti"`.

- [ ] **Step 4: Commit**

```bash
git add server.ts
git commit -m "feat(api): POST /api/profile (edition infos RP)"
```

---

### Task 4: core/tokens.css — design system partagé + accents

**Files:**
- Create: `public/core/tokens.css`
- Reference: `public/style.css` (source à extraire)

**Interfaces:**
- Produces: variables `--accent`, `--accent-2`, `--accent-soft`, `--accent-glow`, `--accent-dim` ; règles de base + composants partagés (boutons `.btn`, `.card`, champs `.field input/select`, modale `#modalOverlay`, toast `#toast`, spinner, animations, polices).

- [ ] **Step 1: Créer tokens.css par extraction**

Copier dans `public/core/tokens.css`, depuis `public/style.css`, **uniquement les blocs communs** (non spécifiques au casino) : l'`@import`/`@font-face` des polices, le bloc `:root{…}` (tokens couleurs/espacements/rayons/durées), `*`/`html`/`body` de base, `.btn` et variantes, `.card`, `.field`/`input`/`select`/`label`, `.modal*`/`#modalOverlay`, `#toast`, `.spinner`, les `@keyframes` partagés. **Ne pas** copier : `.sidebar*`, `.reels`/`.reel`/jeux, `.wheel*`, `.plinko*`, `.dice*`, `.mines*`, `.bj*`, `.adm*`/admin, `.game-*`, `.auth*`.

- [ ] **Step 2: Ajouter les blocs d'accent par univers**

À la fin de `tokens.css`, ajouter :

```css
/* Accent par univers (défaut = club/or) */
:root{ --accent:#c9a84c; --accent-2:#e0bd5a; --accent-soft:rgba(201,168,76,.14);
       --accent-glow:rgba(201,168,76,.45); --accent-dim:rgba(201,168,76,.30); }
body[data-universe="casino"]{ --accent:#7c3aed; --accent-2:#a78bfa; --accent-soft:rgba(124,58,237,.16);
       --accent-glow:rgba(124,58,237,.5); --accent-dim:rgba(124,58,237,.3); }
body[data-universe="fight"]{ --accent:#e23b3b; --accent-2:#ff6a6a; --accent-soft:rgba(226,59,59,.16);
       --accent-glow:rgba(226,59,59,.5); --accent-dim:rgba(226,59,59,.3); }
```

- [ ] **Step 3: Rendre les boutons partagés sensibles à l'accent**

Dans `tokens.css`, sur `.btn` (variante principale), s'assurer que le fond/gradient et l'ombre utilisent `var(--accent)`/`var(--accent-2)`/`var(--accent-glow)` au lieu de valeurs violettes en dur. (Adapter les couleurs trouvées à l'extraction.)

- [ ] **Step 4: Vérifier**

Run: `bun build public/core/tokens.css 2>&1 | head` n'est pas pertinent (CSS) ; à la place : `grep -c "data-universe" public/core/tokens.css`
Expected: `3`. Le fichier ne doit contenir aucun sélecteur `.reel`/`.wheel-wrap`/`.sidebar` : `grep -cE "\.reel|\.wheel-wrap|\.sidebar" public/core/tokens.css` → `0`.

- [ ] **Step 5: Commit**

```bash
git add public/core/tokens.css
git commit -m "feat(core): tokens.css (design system partage + accents par univers)"
```

---

### Task 5: core/auth.js — session & API partagés

**Files:**
- Create: `public/core/auth.js`

**Interfaces:**
- Produces (globals): `TOKEN`, `USER`, `$`, `api(path,method,body)`, `getMe()`, `doLogin(user,pass)`, `logout()`, `requireAuth()`, `requireAdmin()`, `fmt(n)`, `esc(s)`, `toast(t,ms)`, `openModal(title,html,cb)`, `closeModal()`, `confirmModal()`. Sur 401, `api()` purge le token et redirige vers `/`.

- [ ] **Step 1: Créer auth.js (contenu complet)**

```js
/* BlackState — noyau session/API partagé */
let TOKEN = localStorage.getItem('ns_token') || null;
let USER  = null;
const $ = id => document.getElementById(id);

async function api(path, method = 'GET', body) {
  const opt = { method, headers: {} };
  if (TOKEN) opt.headers['Authorization'] = 'Bearer ' + TOKEN;
  if (body)  { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch('/api' + path, opt);
  let data = {}; try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && path !== '/login') {
    TOKEN = null; USER = null; localStorage.removeItem('ns_token');
    if (location.pathname !== '/') { location.href = '/'; }
    throw new Error(data.error || 'Session expirée');
  }
  if (!res.ok) throw new Error(data.error || ('Erreur ' + res.status));
  return data;
}

function fmt(n) { return Math.floor(n).toLocaleString('fr-FR'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function toast(t, ms = 2800) { const el = $('toast'); if (!el) { console.log(t); return; } el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms); }

let _modalCb = null;
function openModal(title, bodyHtml, onConfirm) {
  $('modalTitle').textContent = title; $('modalBody').innerHTML = bodyHtml;
  _modalCb = onConfirm; $('modalOverlay').classList.remove('hidden');
}
function closeModal() { const o = $('modalOverlay'); if (o) o.classList.add('hidden'); _modalCb = null; }
function confirmModal() { const cb = _modalCb; closeModal(); if (cb) cb(); }

async function getMe() {
  if (!TOKEN) { USER = null; return null; }
  try { const d = await api('/me'); USER = d.user; return USER; }
  catch (e) { USER = null; return null; }
}
async function doLogin(user, pass) {
  const d = await api('/login', 'POST', { user, pass });
  TOKEN = d.token; localStorage.setItem('ns_token', TOKEN); USER = d.user;
  return USER;
}
async function logout() {
  try { await api('/logout', 'POST'); } catch (e) {}
  TOKEN = null; USER = null; localStorage.removeItem('ns_token');
  location.href = '/';
}
async function requireAuth() {
  const u = await getMe();
  if (!u) { location.href = '/'; return null; }
  return u;
}
async function requireAdmin() {
  const u = await getMe();
  if (!u || !u.admin) { location.href = '/'; return null; }
  return u;
}
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `bun build public/core/auth.js --target browser > /dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add public/core/auth.js
git commit -m "feat(core): auth.js (session/API/helpers partages)"
```

---

### Task 6: core/shell.js — barre de navigation globale

**Files:**
- Create: `public/core/shell.js`

**Interfaces:**
- Consumes: `USER` (après `getMe()`), `fmt`, `logout`.
- Produces: `renderShell()` qui injecte la barre dans `#bs-shell` ; surligne l'univers via `document.body.dataset.universe`. Expose `openLoginModal()` (utilisé par le bouton "Se connecter").

- [ ] **Step 1: Créer shell.js (contenu complet)**

```js
/* BlackState — barre de navigation globale (injectée sur chaque page) */
function renderShell() {
  const mount = $('bs-shell'); if (!mount) return;
  const uni = document.body.dataset.universe || 'club';
  const link = (href, key, label) =>
    `<a class="bs-nav-link${uni===key?' active':''}" data-u="${key}" href="${href}">${label}</a>`;
  const right = USER
    ? `<div class="bs-user">
         <span class="bs-bal"><span class="bs-coin"></span>${fmt(USER.credit)}</span>
         <a class="bs-nav-link" href="/profil">${esc(USER.username)}</a>
         <button class="btn ghost sm" onclick="logout()">Déconnexion</button>
       </div>`
    : `<button class="btn sm" onclick="openLoginModal()">Se connecter</button>`;
  mount.innerHTML =
    `<header class="bs-nav">
       <a class="bs-logo" href="/">Black<span>State</span></a>
       <nav class="bs-nav-links">
         ${link('/','club','Club')}
         ${link('/casino','casino','Casino')}
         ${link('/fight','fight','Fight')}
       </nav>
       <div class="bs-nav-right">${right}</div>
     </header>`;
}

function openLoginModal() {
  const s = 'width:100%;padding:11px 13px;margin-top:6px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.4);color:#e8e6f3;font-size:16px;outline:none';
  openModal('Se connecter',
    `<label>Pseudo</label><input id="mLoginUser" style="${s}" autocomplete="username">
     <label style="display:block;margin-top:12px">Mot de passe</label>
     <input id="mLoginPass" type="password" style="${s}" autocomplete="current-password">
     <div id="mLoginErr" style="color:#f87171;font-size:.85rem;margin-top:10px;min-height:1em"></div>`,
    null);
  // remplace le bouton "Confirmer" par une connexion réelle
  const overlay = $('modalOverlay');
  const confirmBtn = overlay.querySelector('[data-modal-confirm]');
  if (confirmBtn) confirmBtn.onclick = submitLogin;
  setTimeout(() => { const i = $('mLoginPass'); if (i) i.addEventListener('keydown', e => { if (e.key === 'Enter') submitLogin(); }); }, 0);
}
async function submitLogin() {
  const err = $('mLoginErr'); if (err) err.textContent = '';
  try {
    const u = await doLogin($('mLoginUser').value.trim(), $('mLoginPass').value);
    closeModal();
    location.href = u.admin ? '/admin' : (location.pathname === '/' ? '/casino' : location.pathname);
  } catch (e) { if (err) err.textContent = e.message; }
}
```

> Le bouton de confirmation de la modale doit porter l'attribut `data-modal-confirm` (voir Task 7, structure modale partagée).

- [ ] **Step 2: Vérifier la syntaxe**

Run: `bun build public/core/shell.js --target browser > /dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add public/core/shell.js
git commit -m "feat(core): shell.js (barre de nav globale + modale login)"
```

---

### Task 7: Fragments partagés (modale + toast) + styles shell

**Files:**
- Create: `public/core/shell.css` (styles de la barre + `.bs-*`)
- Reference: structure modale/toast à réutiliser dans chaque page

**Interfaces:**
- Produces: HTML canonique du shell/modale/toast à inclure dans chaque page ; classes `.bs-nav`, `.bs-logo`, `.bs-nav-link`, `.bs-user`, `.bs-bal`.

- [ ] **Step 1: Définir le HTML partagé (à coller dans chaque page)**

Bloc à inclure en haut du `<body>` de chaque page (club/casino/profil/fight/admin) :

```html
<div id="bs-shell"></div>
<div id="toast"></div>
<div id="modalOverlay" class="hidden">
  <div class="modal">
    <h3 id="modalTitle"></h3>
    <div id="modalBody"></div>
    <div class="modal-actions">
      <button class="btn ghost sm" onclick="closeModal()">Annuler</button>
      <button class="btn sm" data-modal-confirm onclick="confirmModal()">Confirmer</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Créer shell.css**

```css
.bs-nav{display:flex;align-items:center;gap:22px;height:60px;padding:0 22px;
  background:linear-gradient(180deg,#0a0818,#06050f);border-bottom:1px solid rgba(255,255,255,.06);
  position:sticky;top:0;z-index:40}
.bs-logo{font-family:var(--display,'Cormorant Garamond',serif);font-size:1.5rem;font-weight:700;
  letter-spacing:.04em;color:#f5f0ff;text-decoration:none}
.bs-logo span{color:var(--accent)}
.bs-nav-links{display:flex;gap:6px;margin-left:8px}
.bs-nav-link{padding:7px 14px;border-radius:8px;color:rgba(230,225,245,.7);text-decoration:none;
  font-weight:600;font-size:.9rem;transition:color .15s,background-color .15s}
.bs-nav-link:hover{color:#fff;background:rgba(255,255,255,.05)}
.bs-nav-link.active{color:var(--accent-2);background:var(--accent-soft)}
.bs-nav-right{margin-left:auto;display:flex;align-items:center;gap:12px}
.bs-user{display:flex;align-items:center;gap:12px}
.bs-bal{display:inline-flex;align-items:center;gap:7px;font-weight:700;color:#f5f0ff}
.bs-coin{width:15px;height:15px;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--accent-2),var(--accent));
  box-shadow:0 0 8px var(--accent-glow)}
@media(max-width:640px){ .bs-nav{gap:10px;padding:0 12px;height:54px} .bs-nav-link{padding:6px 9px;font-size:.82rem} .bs-bal{font-size:.85rem} }
```

- [ ] **Step 3: Vérifier**

Run: `grep -c "bs-nav-link" public/core/shell.css`
Expected: ≥ `3`.

- [ ] **Step 4: Commit**

```bash
git add public/core/shell.css
git commit -m "feat(core): shell.css + structure modale/toast partagee"
```

---

### Task 8: Casino — déménagement sous /casino

**Files:**
- Create: `public/casino.html` (depuis `index.html`), `public/casino.css` (depuis `style.css`), `public/casino.js` (depuis `app.js`)
- Reference: `index.html`, `style.css`, `app.js`

**Interfaces:**
- Consumes: `core/tokens.css`, `core/auth.js`, `core/shell.js`, `core/shell.css`.
- Produces: page casino fonctionnelle à `/casino` (après Task 11), `data-universe="casino"`, sans vue auth ni panel admin, sidebar sans bloc user.

- [ ] **Step 1: casino.html**

Copier `index.html` → `casino.html`. Puis :
1. `<body>` → `<body data-universe="casino">`.
2. **Supprimer** entièrement le bloc `#authView` (login/inscription) et le bloc `#adminPanel`.
3. En haut du `<body>`, coller le bloc partagé shell/modale/toast (Task 7 Step 1). Retirer l'ancien `#toast`/`#modalOverlay` dupliqués s'ils existaient.
4. Dans la sidebar casino, **supprimer** le bloc `.sidebar-user` (solde/XP/pseudo/déconnexion) ; faire pointer le lien "Profil" vers `/profil` (lien `<a href="/profil">` au lieu de `onclick="switchTab('profil')"` si présent — sinon conserver l'onglet profil interne mais le lien latéral mène à `/profil`).
5. `<head>` : remplacer les `<link>`/`<script>` par, dans l'ordre :

```html
<link rel="stylesheet" href="/core/tokens.css">
<link rel="stylesheet" href="/casino.css">
<link rel="stylesheet" href="/core/shell.css">
<link rel="stylesheet" href="/responsive.css">
<script defer src="/lucide.min.js"></script>
<script defer src="/core/auth.js"></script>
<script defer src="/core/shell.js"></script>
<script defer src="/casino.js"></script>
```

- [ ] **Step 2: casino.css**

Copier `style.css` → `casino.css`, puis **retirer** les blocs déplacés dans `tokens.css` (Task 4 Step 1 : `:root`, polices, `.btn`, `.card`, `.field`, modale, toast, spinner, keyframes partagés). Conserver tout le spécifique casino (sidebar jeux, jeux, `.game-*`, admin si encore référencé — sinon retiré en Task 9). Ajouter en tête un mapping pour les composants partagés : le casino conserve ses `--v-*` ; pas besoin de redéfinir `--accent` (fourni par `body[data-universe="casino"]` dans tokens.css).

- [ ] **Step 3: casino.js — retirer auth/admin, ajouter bootstrap**

Copier `app.js` → `casino.js`. Puis :
1. **Supprimer** les définitions désormais dans `auth.js` : `let TOKEN`, `const $`, `function api`, `fmt`, `esc`, `toast`, `openModal`, `closeModal`, `confirmModal`, `doLogin`, `doRegister`, `showLogin`, `showRegister`, `logout`. (Garder tout le reste : jeux, rendu, etc.)
2. **Supprimer** les fonctions admin (`switchAdminTab`, `renderAdminUsers`, `adminCredit`, `renderInvites`, `renderLogs`, `adminGenInvite`, etc.) → elles iront dans `admin.js` (Task 9).
3. Remplacer la fonction `enter()` et l'IIFE de boot final par un nouveau bootstrap :

```js
(async () => {
  const u = await requireAuth();        // redirige vers / si non connecté
  if (!u) return;
  if (u.admin) { location.href = '/admin'; return; }
  renderShell();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  $('whoName') && ($('whoName').textContent = u.username);
  refreshBal(); updateXP(u.xp || 0, u.level || 1);
  buildMinesGrid(); initSlots();
  try { const cfg = await api('/config'); GAME_RTP = cfg.rtp ?? 0.70;
        if (cfg.plinko) PK_MULT = cfg.plinko; if (cfg.wheel) WHEEL = cfg.wheel; } catch (e) {}
  switchTab('home');
})();
```

4. Le lien latéral "Profil" : si `switchTab('profil')` est conservé en interne, OK ; sinon retirer la vue profil du casino (elle vit sur `/profil`). Choix : **retirer** la vue profil interne du casino et pointer vers `/profil`.

- [ ] **Step 4: Vérifier la syntaxe JS**

Run: `bun build public/casino.js --target browser > /dev/null && echo OK`
Expected: `OK` (sinon corriger les références à des fonctions supprimées).

- [ ] **Step 5: Commit**

```bash
git add public/casino.html public/casino.css public/casino.js
git commit -m "feat(casino): page /casino (sans auth ni admin, noyau partage)"
```

---

### Task 9: Admin — page /admin

**Files:**
- Create: `public/admin.html` (depuis `#adminPanel` d'`index.html`), `public/admin.js` (depuis fonctions admin d'`app.js`), `public/admin.css` (styles `.adm*` depuis `style.css`)
- Reference: `index.html`, `app.js`, `style.css`

**Interfaces:**
- Consumes: `core/auth.js` (`requireAdmin`, `api`), `core/tokens.css`.
- Produces: page admin à `/admin`, accessible aux seuls admins (redirige `/` sinon).

- [ ] **Step 1: admin.html**

Nouvelle page : `<body data-universe="club">` (ou thème admin existant). Inclure le bloc shell/modale/toast partagé, `core/tokens.css`, `admin.css`, `core/auth.js`, `admin.js`. Coller la structure interne de `#adminPanel` (onglets joueurs/invitations/logs/économie) dans `<main>`. Ajouter une **colonne RP** (NOM Prénom, Discord) dans l'en-tête de la table joueurs.

- [ ] **Step 2: admin.js**

Déplacer depuis `app.js` toutes les fonctions admin : `switchAdminTab`, `renderAdminUsers`, `adminCredit`, `adminDelete`, `renderInvites`, `adminGenInvite`, `copyInvite*`, `renderLogs`, `renderGameInfo`, etc. Dans `renderAdminUsers`, afficher `u.rp?.nom`, `u.rp?.prenom`, `u.rp?.discord` (la route `/api/admin/users` doit les exposer — voir Step 3). Bootstrap :

```js
(async () => {
  const u = await requireAdmin(); if (!u) return;
  renderShell();
  $('admWhoName') && ($('admWhoName').textContent = u.username);
  switchAdminTab('players'); renderInvites(); renderLogs();
  if (typeof lucide !== 'undefined') lucide.createIcons();
})();
```

- [ ] **Step 3: Exposer les champs RP côté /api/admin/users**

Dans `server.ts`, la préparée `allUsers` (~L50) : ajouter `rp_nom, rp_prenom, discord` au `SELECT`. La route `/api/admin/users` renvoie ces colonnes telles quelles (le front lit `rp_nom`/`rp_prenom`/`discord`).

- [ ] **Step 4: admin.css**

Extraire les règles `.adm*` / panel admin de `style.css` vers `admin.css`.

- [ ] **Step 5: Vérifier**

Run: `bun build public/admin.js --target browser > /dev/null && echo OK`
Expected: `OK`. Après redémarrage serveur : `curl -s http://localhost:3000/api/admin/users -H "Authorization: Bearer <ADMIN_TOKEN>" | grep -c rp_nom` → ≥ `1`.

- [ ] **Step 6: Commit**

```bash
git add public/admin.html public/admin.js public/admin.css server.ts
git commit -m "feat(admin): page /admin cachee + infos RP dans la table joueurs"
```

---

### Task 10: Page Club (`/`) + inscription enrichie + Profil + Fight

**Files:**
- Create: `public/club.html`, `public/club.css`, `public/club.js`, `public/profil.html`, `public/profil.js`, `public/fight.html`

**Interfaces:**
- Consumes: `core/auth.js`, `core/shell.js`, `core/shell.css`, `core/tokens.css`.
- Produces: pages Club, Profil, Fight servies (après Task 11).

- [ ] **Step 1: club.html**

`<body data-universe="club">`. Inclure shell/modale/toast partagés + `core/tokens.css` + `club.css` + `core/shell.css` + `core/auth.js` + `core/shell.js` + `club.js`. Contenu :

```html
<div id="bs-shell"></div>
<main class="club">
  <section class="club-hero">
    <h1 class="club-title">Black<span>State</span></h1>
    <p class="club-tagline">Le club privé. Casino, et bientôt l'arène Fight.</p>
  </section>
  <section id="registerSection" class="club-section hidden">
    <h2>Créer mon compte</h2>
    <p id="inviteBanner" class="invite-banner"></p>
    <div class="reg-grid">
      <label>Pseudo (login)<input id="regUser" autocomplete="username"></label>
      <label>Mot de passe<input id="regPass" type="password" autocomplete="new-password"></label>
      <label>NOM<input id="regNom"></label>
      <label>Prénom<input id="regPrenom"></label>
      <label>Numéro (tél RP)<input id="regPhone"></label>
      <label>id Discord<input id="regDiscord"></label>
    </div>
    <div id="regErr" class="form-err"></div>
    <button class="btn" onclick="submitRegister()">Créer mon compte</button>
  </section>
  <section class="club-section">
    <h2>Le Club</h2>
    <p class="club-text">BlackState est un cercle de jeu clandestin de Los Santos…
      (texte de présentation à personnaliser).</p>
  </section>
  <section class="club-section">
    <h2>Nous rejoindre</h2>
    <p class="club-text">L'accès se fait uniquement sur invitation…
      (démarche à personnaliser).</p>
  </section>
</main>
```

- [ ] **Step 2: club.js**

```js
const INVITE_TOKEN = new URLSearchParams(location.search).get('invite') || '';
(async () => {
  const u = await getMe();
  renderShell();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (u) {                                   // déjà connecté
    if (u.admin) { location.href = '/admin'; return; }
    return;                                   // reste sur la vitrine
  }
  if (INVITE_TOKEN) {
    try {
      const inv = await api('/invite/' + INVITE_TOKEN);
      $('registerSection').classList.remove('hidden');
      $('inviteBanner').textContent = `Invitation valide · ${fmt(inv.credits)} crédits offerts`;
    } catch (e) { toast(e.message, 4000); }
  }
})();

async function submitRegister() {
  $('regErr').textContent = '';
  try {
    const d = await api('/register', 'POST', {
      user: $('regUser').value.trim(), pass: $('regPass').value, invite: INVITE_TOKEN,
      nom: $('regNom').value, prenom: $('regPrenom').value,
      phone: $('regPhone').value, discord: $('regDiscord').value,
    });
    TOKEN = d.token; localStorage.setItem('ns_token', TOKEN); USER = d.user;
    location.href = '/casino';
  } catch (e) { $('regErr').textContent = e.message; }
}
```

- [ ] **Step 3: club.css** — styles vitrine (hero, sections, `.reg-grid`, `.invite-banner`, `.form-err`). Fond noir, accents or via `var(--accent)`.

- [ ] **Step 4: profil.html + profil.js**

`profil.html` : `<body data-universe="club">`, shell/modale/toast + cores + `profil.js`. Contenu : en-tête pseudo + carte XP, bloc stats (lecture seule), formulaire RP :

```html
<main class="club">
  <div id="bs-shell"></div>
  <section class="club-section">
    <h2>Mon profil — <span id="pName"></span></h2>
    <div id="pStats" class="profil-stats"></div>
  </section>
  <section class="club-section">
    <h2>Infos RP</h2>
    <div class="reg-grid">
      <label>NOM<input id="pNom"></label>
      <label>Prénom<input id="pPrenom"></label>
      <label>Numéro<input id="pPhone"></label>
      <label>id Discord<input id="pDiscord"></label>
    </div>
    <div id="pErr" class="form-err"></div>
    <button class="btn" onclick="saveProfile()">Enregistrer</button>
  </section>
</main>
```

`profil.js` :

```js
(async () => {
  const u = await requireAuth(); if (!u) return;
  renderShell();
  $('pName').textContent = u.username;
  $('pStats').innerHTML =
    [['Solde',u.credit],['Misé',u.stats.wagered],['Gagné',u.stats.won],
     ['Parties',u.stats.played],['Meilleur gain',u.stats.biggest],['Niveau',u.level]]
    .map(([k,v]) => `<div class="stat"><div class="lbl">${k}</div><div class="val">${fmt(v)}</div></div>`).join('');
  $('pNom').value = u.rp?.nom || ''; $('pPrenom').value = u.rp?.prenom || '';
  $('pPhone').value = u.rp?.phone || ''; $('pDiscord').value = u.rp?.discord || '';
})();
async function saveProfile() {
  $('pErr').textContent = '';
  try {
    await api('/profile', 'POST', { nom:$('pNom').value, prenom:$('pPrenom').value,
      phone:$('pPhone').value, discord:$('pDiscord').value });
    toast('Profil enregistré');
  } catch (e) { $('pErr').textContent = e.message; }
}
```

- [ ] **Step 5: fight.html**

`<body data-universe="fight">`, shell + tokens + shell.css + auth.js + shell.js + un script inline minimal `getMe().then(renderShell)`. Contenu central :

```html
<div id="bs-shell"></div>
<main class="fight-soon">
  <h1 class="fight-title">FIGHT</h1>
  <p class="fight-sub">Combats clandestins — <b>Bientôt disponible</b></p>
  <p class="fight-teaser">L'arène ouvrira ses portes prochainement. Restez connectés.</p>
</main>
<script defer src="/core/auth.js"></script>
<script defer src="/core/shell.js"></script>
<script>window.addEventListener('DOMContentLoaded',()=>getMe().then(renderShell));</script>
```

Styles `.fight-soon`/`.fight-title` : ajouter dans `club.css` ou un court bloc inline `<style>` utilisant `var(--accent)` (rouge via data-universe).

- [ ] **Step 6: Vérifier**

Run: `for f in club profil; do bun build public/$f.js --target browser > /dev/null && echo "$f OK"; done`
Expected: `club OK` puis `profil OK`.

- [ ] **Step 7: Commit**

```bash
git add public/club.* public/profil.* public/fight.html
git commit -m "feat(pages): Club (+ inscription enrichie), Profil, Fight coming soon"
```

---

### Task 11: Routing serveur multi-pages

**Files:**
- Modify: `server.ts` (handler statique `/*` ~L584-596)

**Interfaces:**
- Consumes: toutes les pages créées (Tasks 8-10).
- Produces: routes `/`→club, `/casino`→casino, `/fight`→fight, `/profil`→profil, `/admin`→admin ; assets statiques inchangés ; fallback → club.

- [ ] **Step 1: Table de mapping + handler**

Remplacer le handler `.get('/*', …)` par :

```ts
  .get('/*', async ({ request, set }) => {
    const pub  = (f: string) => Bun.file(join(import.meta.dir, 'public', f))
    const PAGES: Record<string, string> = {
      '/': 'club.html', '/casino': 'casino.html', '/fight': 'fight.html',
      '/profil': 'profil.html', '/admin': 'admin.html',
    }
    let pathname: string
    try { pathname = decodeURIComponent(new URL(request.url).pathname) }
    catch { return pub('club.html') }
    if (pathname.includes('..') || pathname.includes('\0')) return pub('club.html')
    const clean = pathname.replace(/\/+$/, '') || '/'
    if (PAGES[clean]) { set.headers['Content-Type'] = 'text/html'; return pub(PAGES[clean]) }
    const ext = pathname.slice(pathname.lastIndexOf('.') + 1).toLowerCase()
    if (MIME[ext]) {
      const file = pub(pathname)
      if (await file.exists()) { set.headers['Content-Type'] = MIME[ext]; return file }
    }
    set.headers['Content-Type'] = 'text/html'; return pub('club.html')   // fallback
  })
```

- [ ] **Step 2: Redémarrer + vérifier chaque route**

```bash
pkill -f "bun run server.ts"; sleep 1; bun run server.ts > /tmp/bun-server.log 2>&1 &
sleep 3
for p in / /casino /fight /profil /admin; do
  echo -n "$p -> "; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$p"
done
```
Expected: chaque ligne `200`. Vérifier le contenu : `curl -s http://localhost:3000/ | grep -c "club-hero"` → ≥ `1` ; `curl -s http://localhost:3000/fight | grep -c "FIGHT"` → ≥ `1`.

- [ ] **Step 3: Vérifier les assets**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/core/auth.js`
Expected: `200`.

- [ ] **Step 4: Commit**

```bash
git add server.ts
git commit -m "feat(server): routing multi-pages (Club/Casino/Fight/Profil/Admin)"
```

---

### Task 12: Nettoyage des anciens fichiers

**Files:**
- Delete: `public/index.html`, `public/style.css`, `public/app.js`

**Interfaces:**
- Consumes: rien (tout a été migré).

- [ ] **Step 1: Vérifier qu'aucune page ne les référence**

Run: `grep -rEl "app\.js|style\.css|index\.html" public/*.html`
Expected: aucune sortie (ou seulement des références légitimes inexistantes). Corriger toute référence résiduelle avant suppression.

- [ ] **Step 2: Supprimer**

```bash
git rm public/index.html public/style.css public/app.js
```

- [ ] **Step 3: Redémarrer + parcours complet**

```bash
pkill -f "bun run server.ts"; sleep 1; bun run server.ts > /tmp/bun-server.log 2>&1 &
sleep 3
for p in / /casino /fight /profil /admin /core/auth.js /core/shell.js /core/tokens.css; do
  echo -n "$p -> "; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$p"
done
```
Expected: tout `200`.

- [ ] **Step 4: Contrôle visuel manuel**

Ouvrir `http://localhost:3000/` : vitrine or, nav. Tester login → redirection casino (violet). Tester `/profil` (édition RP + enregistrement). Tester `/fight` (rouge, coming soon). Se connecter en admin → redirection `/admin`. Jouer une partie sur chaque jeu pour confirmer que rien n'est cassé.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: suppression index.html/style.css/app.js (migres vers le multi-pages)"
```

---

## Self-Review (rempli)

- **Couverture spec :** §2 architecture → Tasks 4-12 ; §3 thèmes → Task 4 ; §4 Club → Task 10 ; §5 RP/profil → Tasks 1-3,10 ; §6 casino/admin → Tasks 8-9 ; §7 Fight → Task 10 ; §8 session → Tasks 5-6. ✓
- **Cohérence des noms :** `TOKEN`/`USER`/`api`/`renderShell`/`requireAuth`/`requireAdmin`/`publicUser.rp` employés de façon identique dans auth.js, shell.js, casino.js, admin.js, club.js, profil.js. ✓
- **Champs RP :** `rp_nom`/`rp_prenom`/`rp_phone`/`discord` cohérents entre db.ts, register, /api/profile, /api/admin/users, club.js, profil.js, admin.js. ✓
- **Ordre sûr :** l'ancien `/` (index.html) reste servi jusqu'à Task 11 ; suppression en Task 12. ✓
- **Point d'attention (à valider à l'exécution) :** la modale de login (shell.js) réutilise le bouton `[data-modal-confirm]` ; vérifier que `confirmModal()` n'est pas rappelé en double (on remplace `onclick`).
