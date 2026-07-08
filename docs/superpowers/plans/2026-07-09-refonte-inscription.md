# Refonte de l'inscription — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre obligatoires les champs d'identité RP essentiels, appliquer une politique de force du mot de passe « pro », et donner un retour de validation live par champ à l'inscription.

**Architecture:** Les règles de mot de passe vivent dans un module pur partagé `public/core/password.js` (UMD, comme `core/tiers.js`) : le front l'utilise pour la checklist live, le serveur l'importe pour appliquer — source de vérité unique. Le serveur reste la barrière réelle (refus 400 même si le client est contourné). Le front ajoute la validation live et le verrouillage du bouton.

**Tech Stack:** Bun + ElysiaJS + bun:sqlite (backend TS `src/`), JS vanilla multi-pages (`public/`), tests `bun test`.

## Global Constraints

- **Longueur mot de passe : min 12, max 128** (plafond 128 = garde anti-DoS bcrypt, à conserver).
- **Règles MDP** (toutes requises pour accepter) : ≥ 1 majuscule, ≥ 1 minuscule, ≥ 1 chiffre, ≥ 1 caractère spécial, **ne contient pas le pseudo**.
- **Champs obligatoires** : Pseudo, Mot de passe, NOM, Prénom, id Discord. **Téléphone RP reste optionnel.**
- **Serveur = source de vérité** : les règles côté serveur doivent rejeter même sans passer par le front.
- **Une seule source des règles** : `public/core/password.js`, importé par le serveur ET chargé par le front. Ne PAS dupliquer la logique.
- **Hors périmètre, ne pas toucher** : `/api/login`, 2FA, mécanique d'invitation (réservation atomique), captcha Turnstile, schéma DB, pages admin/profil/casino/fight.
- **Trailers de commit obligatoires** sur chaque commit :
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ
  ```
- Ne PAS pousser sur `main` (le push déclenche un déploiement — réservé à une demande explicite de l'utilisateur).

---

## File Structure

- `public/core/password.js` *(nouveau)* — module pur UMD : `checkPassword`, `errorMessage`, constantes `MIN_LEN`/`MAX_LEN`.
- `tests/password.test.ts` *(nouveau)* — tests unitaires du module.
- `src/server.ts` *(modif)* — route `/api/register` : import du module, application des règles MDP, champs RP requis avant réservation d'invitation.
- `public/club.html` *(modif)* — markup section `#registerSection` (marqueurs requis, checklist MDP, jauge, messages par champ) + `<script>` password.js.
- `public/club.js` *(modif)* — validation live, jauge, verrouillage bouton, garde-fou `submitRegister`.
- `public/club.css` *(modif)* — styles valid/invalid, checklist, jauge, bouton désactivé.

---

## Task 1 : Module partagé `password.js` + tests

**Files:**
- Create: `public/core/password.js`
- Test: `tests/password.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces (utilisés par Task 2 serveur et Task 4 front) :
  - `checkPassword(pw: string, pseudo?: string) -> { rules: { length, upper, lower, digit, special, notName }, ok: boolean, score: number /*0..6*/, label: 'Faible'|'Moyen'|'Fort' }`
  - `errorMessage(res) -> string | null` (message FR de la 1re règle en échec, `null` si `ok`)
  - `MIN_LEN = 12`, `MAX_LEN = 128`
  - Global navigateur : `window.Password` (mêmes membres).

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `tests/password.test.ts` :

```ts
import { test, expect } from 'bun:test'
import { checkPassword, errorMessage, MIN_LEN } from '../public/core/password.js'

test('trop court → length faux, ok faux', () => {
  const r = checkPassword('Ab1!', 'joueur')
  expect(r.rules.length).toBe(false)
  expect(r.ok).toBe(false)
})
test('manque majuscule', () => {
  const r = checkPassword('str0ng!passw', 'joueur')
  expect(r.rules.upper).toBe(false); expect(r.ok).toBe(false)
})
test('manque minuscule', () => {
  const r = checkPassword('STR0NG!PASSW', 'joueur')
  expect(r.rules.lower).toBe(false); expect(r.ok).toBe(false)
})
test('manque chiffre', () => {
  const r = checkPassword('Strong!Passwd', 'joueur')
  expect(r.rules.digit).toBe(false); expect(r.ok).toBe(false)
})
test('manque caractère spécial', () => {
  const r = checkPassword('Str0ngPasswd1', 'joueur')
  expect(r.rules.special).toBe(false); expect(r.ok).toBe(false)
})
test('contient le pseudo → notName faux, ok faux', () => {
  const r = checkPassword('Motdepasse1!', 'motdepasse')
  expect(r.rules.notName).toBe(false); expect(r.ok).toBe(false)
})
test('pseudo court (<3) → notName vrai (pas de fausse alarme)', () => {
  const r = checkPassword('Str0ng!Passw', 'ab')
  expect(r.rules.notName).toBe(true)
})
test('valide minimal (12 car, 4 classes) → ok, label Moyen, score 5', () => {
  const r = checkPassword('Str0ng!Passw', 'joueur')
  expect(r.ok).toBe(true); expect(r.label).toBe('Moyen'); expect(r.score).toBe(5)
})
test('long (≥16 car, 4 classes) → label Fort, score 6', () => {
  const r = checkPassword('Str0ng!Password!', 'joueur')
  expect(r.label).toBe('Fort'); expect(r.score).toBe(6)
})
test('errorMessage : 1re règle manquante, null si ok', () => {
  expect(errorMessage(checkPassword('Ab1!', 'joueur'))).toContain('caractères')
  expect(errorMessage(checkPassword('Str0ng!Passw', 'joueur'))).toBe(null)
})
test('MIN_LEN = 12', () => { expect(MIN_LEN).toBe(12) })
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `cd /c/Users/info/Documents/DEV/Casino_Online_GTARP && bun test tests/password.test.ts`
Expected: FAIL (module `../public/core/password.js` introuvable / exports absents).

- [ ] **Step 3 : Écrire le module**

Create `public/core/password.js` :

```js
/* BlackState — politique de mot de passe (logique pure, sans DOM).
   Source de vérité unique partagée par le front (checklist live) et le serveur
   (application). Même patron UMD que core/tiers.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Password = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var MIN_LEN = 12, MAX_LEN = 128;

  function checkPassword(pw, pseudo) {
    pw = String(pw == null ? '' : pw);
    pseudo = String(pseudo == null ? '' : pseudo);
    var rules = {
      length : pw.length >= MIN_LEN && pw.length <= MAX_LEN,
      upper  : /[A-Z]/.test(pw),
      lower  : /[a-z]/.test(pw),
      digit  : /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
      notName: pseudo.length < 3 || pw.toLowerCase().indexOf(pseudo.toLowerCase()) === -1,
    };
    var ok = rules.length && rules.upper && rules.lower && rules.digit && rules.special && rules.notName;
    var classes = (rules.upper ? 1 : 0) + (rules.lower ? 1 : 0) + (rules.digit ? 1 : 0) + (rules.special ? 1 : 0);
    var lenScore = pw.length >= 16 ? 2 : pw.length >= 12 ? 1 : 0;
    var score = classes + lenScore;                       // 0..6
    var label = score >= 6 ? 'Fort' : score >= 4 ? 'Moyen' : 'Faible';
    return { rules: rules, ok: ok, score: score, label: label };
  }

  function errorMessage(res) {
    if (res.ok) return null;
    var r = res.rules;
    if (!r.length)  return 'Mot de passe : entre 12 et 128 caractères.';
    if (!r.lower)   return 'Mot de passe : ajoute une minuscule.';
    if (!r.upper)   return 'Mot de passe : ajoute une majuscule.';
    if (!r.digit)   return 'Mot de passe : ajoute un chiffre.';
    if (!r.special) return 'Mot de passe : ajoute un caractère spécial.';
    if (!r.notName) return 'Le mot de passe ne doit pas contenir ton pseudo.';
    return 'Mot de passe invalide.';
  }

  return {
    checkPassword: checkPassword, errorMessage: errorMessage,
    MIN_LEN: MIN_LEN, MAX_LEN: MAX_LEN,
  };
});
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `bun test tests/password.test.ts`
Expected: PASS (11 tests). Lancer aussi `bun test` complet pour vérifier l'absence de régression.

- [ ] **Step 5 : Commit**

```bash
git add public/core/password.js tests/password.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): module partagé password.js (règles force MDP) + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ
EOF
)"
```

---

## Task 2 : Application serveur dans `/api/register`

**Files:**
- Modify: `src/server.ts` (import en tête ; route `/api/register`, actuellement lignes ~401-428)

**Interfaces:**
- Consumes: `Pw.checkPassword`, `Pw.errorMessage` (Task 1) ; helpers existants `validUser`, `clip`, `Q.userByName`, `Q.insertUser`.
- Produces: comportement HTTP (400 sur MDP faible ou champ RP requis vide ; l'invitation n'est PAS réservée sur ces refus). Aucune nouvelle signature exportée.

- [ ] **Step 1 : Ajouter l'import du module partagé**

Repérer l'import du module de jeux en tête de `src/server.ts` (`import * as G from './games.ts'`) et ajouter juste après :

```ts
import * as Pw from '../public/core/password.js'
```

- [ ] **Step 2 : Remplacer la validation MDP + ajouter les champs requis**

Dans la route `.post('/api/register', ...)`, remplacer ce bloc existant :

```ts
      if (!validUser(u))  { set.status = 400; return { error: 'Pseudo invalide (3-20 cars, lettres/chiffres/_ ou -).' } }
      if (p.length < 8)   { set.status = 400; return { error: 'Mot de passe trop court (8 min).' } }
      // SECURITY: limite max pour éviter le DoS bcrypt (hash d'une chaîne 1 Mo bloquerait le thread)
      if (p.length > 128) { set.status = 400; return { error: 'Mot de passe trop long (128 max).' } }
      if (Q.userByName.get(u)) { set.status = 400; return { error: 'Ce pseudo existe déjà.' } }
      if (!inviteCode)   { set.status = 403; return { error: "Un lien d'invitation est requis pour créer un compte." } }
```

par :

```ts
      if (!validUser(u))  { set.status = 400; return { error: 'Pseudo invalide (3-20 cars, lettres/chiffres/_ ou -).' } }
      // Politique MDP « pro » (règles partagées avec le front, source unique).
      // checkPassword applique aussi le plafond 128 (garde anti-DoS bcrypt).
      const pwCheck = Pw.checkPassword(p, u)
      if (!pwCheck.ok) { set.status = 400; return { error: Pw.errorMessage(pwCheck) } }
      if (Q.userByName.get(u)) { set.status = 400; return { error: 'Ce pseudo existe déjà.' } }
      // Champs RP obligatoires — vérifiés AVANT toute réservation d'invitation
      // (pour ne pas consommer un lien sur une saisie incomplète).
      const rpNom = clip(b.nom), rpPrenom = clip(b.prenom), rpDiscord = clip(b.discord)
      if (!rpNom || !rpPrenom || !rpDiscord) {
        set.status = 400; return { error: 'NOM, prénom et id Discord sont obligatoires.' }
      }
      const rpPhone = clip(b.phone, 20)   // reste optionnel
      if (!inviteCode)   { set.status = 403; return { error: "Un lien d'invitation est requis pour créer un compte." } }
```

- [ ] **Step 3 : Retirer l'ancienne déclaration dupliquée des champs RP**

Plus bas dans la même route, supprimer la ligne existante (les valeurs sont désormais déclarées plus haut) :

```ts
      const rpNom = clip(b.nom), rpPrenom = clip(b.prenom), rpPhone = clip(b.phone, 20), rpDiscord = clip(b.discord)
```

Vérifier que l'appel `Q.insertUser.run(u, hash, 0, invite.credits, Date.now(), rpNom, rpPrenom, rpPhone, rpDiscord)` référence toujours ces mêmes variables (inchangé).

- [ ] **Step 4 : Redémarrer le serveur dev et vérifier par curl**

```bash
# tuer les bun existants puis relancer (règle projet : redémarrer après modif backend)
powershell -Command "Get-Process bun -ErrorAction SilentlyContinue | Stop-Process -Force"
cd /c/Users/info/Documents/DEV/Casino_Online_GTARP && (bun run dev &) ; sleep 3
# a) MDP faible -> 400 (message longueur), avant même l'invitation
curl -s -X POST localhost:3000/api/register -H 'Content-Type: application/json' \
  -d '{"user":"testreg1","pass":"weak","nom":"X","prenom":"Y","discord":"z"}'
# b) MDP fort mais NOM manquant -> 400 "obligatoires"
curl -s -X POST localhost:3000/api/register -H 'Content-Type: application/json' \
  -d '{"user":"testreg2","pass":"Str0ng!Passw","prenom":"Y","discord":"z"}'
# c) tout valide SAUF invitation -> 403 "invitation requise" (prouve : règles passées,
#    aucun compte créé, invitation jamais atteinte avant les checks)
curl -s -X POST localhost:3000/api/register -H 'Content-Type: application/json' \
  -d '{"user":"testreg3","pass":"Str0ng!Passw","nom":"X","prenom":"Y","discord":"z"}'
```

Expected :
- a) `{"error":"Mot de passe : entre 12 et 128 caractères."}` (HTTP 400)
- b) `{"error":"NOM, prénom et id Discord sont obligatoires."}` (HTTP 400)
- c) `{"error":"Un lien d'invitation est requis pour créer un compte."}` (HTTP 403)

(Note structurelle : les refus a/b surviennent AVANT la réservation atomique de l'invitation → un lien ne peut pas être consommé sur une saisie invalide. Garantie par l'ordre du code.)

- [ ] **Step 5 : Commit**

```bash
git add src/server.ts
git commit -m "$(cat <<'EOF'
feat(register): applique la force MDP + champs RP obligatoires côté serveur

Source de vérité serveur : checkPassword (module partagé) + NOM/prénom/
discord requis, vérifiés avant toute réservation d'invitation.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ
EOF
)"
```

---

## Task 3 : Markup + styles du formulaire (`club.html` + `club.css`)

**Files:**
- Modify: `public/club.html` (bloc `<script>` du `<head>` ~ligne 18-19 ; `#registerSection > .reg-grid` ~lignes 79-89 ; bouton ~ligne 89)
- Modify: `public/club.css` (ajout de règles en fin de fichier)

**Interfaces:**
- Consumes: `window.Password` chargé par le script (Task 1).
- Produces (ids/classes consommés par Task 4) : champs `regUser/regPass/regNom/regPrenom/regPhone/regDiscord` (déjà présents) ; nouveaux : `regUserMsg`, `regNomMsg`, `regPrenomMsg`, `regDiscordMsg`, `regPassMsg`, `regPassBar`, `regPassLabel`, `regPassChecklist` (avec `li[data-rule]`), bouton `regSubmit` (attribut `disabled` initial).

- [ ] **Step 1 : Charger le module partagé avant `club.js`**

Dans `public/club.html`, ajouter la ligne juste avant `<script defer src="/club.js"></script>` :

```html
  <script defer src="/core/password.js"></script>
```

(les `defer` préservent l'ordre → `window.Password` est prêt avant `club.js`.)

- [ ] **Step 2 : Remplacer le `.reg-grid` et le bouton**

Remplacer le bloc existant (`<div class="reg-grid"> … </div>` puis les `#regCaptcha`, `#regErr`, bouton) par :

```html
        <div class="reg-grid">
          <label>Pseudo (login) <span class="req">*</span>
            <input id="regUser" autocomplete="username">
            <span class="field-msg" id="regUserMsg"></span>
          </label>
          <label>Mot de passe <span class="req">*</span>
            <div class="pw-field">
              <input id="regPass" type="password" autocomplete="new-password">
              <button type="button" class="pw-eye" onclick="togglePw('regPass', this)" aria-label="Afficher / masquer"><i data-lucide="eye"></i></button>
            </div>
            <div class="pw-meter"><span id="regPassBar" class="pw-meter-bar"></span></div>
            <span id="regPassLabel" class="pw-meter-label"></span>
            <ul class="pw-checklist" id="regPassChecklist">
              <li data-rule="length">12 caractères minimum</li>
              <li data-rule="upper">Une majuscule</li>
              <li data-rule="lower">Une minuscule</li>
              <li data-rule="digit">Un chiffre</li>
              <li data-rule="special">Un caractère spécial</li>
            </ul>
            <span class="field-msg" id="regPassMsg"></span>
          </label>
          <label>NOM <span class="req">*</span>
            <input id="regNom">
            <span class="field-msg" id="regNomMsg"></span>
          </label>
          <label>Prénom <span class="req">*</span>
            <input id="regPrenom">
            <span class="field-msg" id="regPrenomMsg"></span>
          </label>
          <label>Numéro (tél RP) <span class="opt">(optionnel)</span>
            <input id="regPhone">
          </label>
          <label>id Discord <span class="req">*</span>
            <input id="regDiscord">
            <span class="field-msg" id="regDiscordMsg"></span>
          </label>
        </div>
        <div id="regCaptcha" class="cf-slot"></div>
        <div id="regErr" class="form-err"></div>
        <button class="btn" id="regSubmit" onclick="submitRegister()" disabled>Créer mon compte</button>
```

- [ ] **Step 3 : Ajouter les styles**

Ajouter en fin de `public/club.css` :

```css
/* ── Inscription : validation live ── */
.reg-grid .req { color: var(--accent, #7c5cff); font-weight: 600; }
.reg-grid .opt { color: #9aa0b5; font-weight: 400; font-size: .82em; }
.field-msg { display: block; min-height: 1em; margin-top: 4px; font-size: .8rem; color: #ff5c72; }
.field-msg.ok { color: #43d17a; }
.reg-grid input.valid   { border-color: #43d17a; }
.reg-grid input.invalid { border-color: #ff5c72; }
.pw-meter { height: 6px; border-radius: 4px; background: rgba(255,255,255,.08); overflow: hidden; margin-top: 8px; }
.pw-meter-bar { display: block; height: 100%; width: 0; border-radius: 4px; transition: width .2s ease, background .2s ease; background: #ff5c72; }
.pw-meter-bar[data-level="Moyen"] { background: #f2b13c; }
.pw-meter-bar[data-level="Fort"]  { background: #43d17a; }
.pw-meter-label { font-size: .78rem; color: #9aa0b5; }
.pw-checklist { list-style: none; padding: 0; margin: 8px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; }
.pw-checklist li { font-size: .8rem; color: #9aa0b5; padding-left: 18px; position: relative; }
.pw-checklist li::before { content: '○'; position: absolute; left: 0; }
.pw-checklist li.ok { color: #43d17a; }
.pw-checklist li.ok::before { content: '✓'; }
#regSubmit:disabled { opacity: .5; cursor: not-allowed; }
```

- [ ] **Step 4 : Vérification visuelle**

Redémarrer le serveur si besoin, ouvrir `http://localhost:3000/`. La section inscription n'apparaît qu'avec un lien d'invitation valide ; pour vérifier le markup **sans invitation**, ouvrir la console du navigateur et exécuter :

```js
document.getElementById('portalLogin').classList.add('hidden');
document.getElementById('registerSection').classList.remove('hidden');
```

Vérifier : astérisques rouges sur les 5 champs requis, « (optionnel) » sur le téléphone, la checklist à 5 items (puces ○), la barre de jauge vide, le bouton « Créer mon compte » grisé. Aucune erreur console. (Le câblage dynamique arrive en Task 4.)

- [ ] **Step 5 : Commit**

```bash
git add public/club.html public/club.css
git commit -m "$(cat <<'EOF'
feat(register): markup + styles formulaire (requis, checklist MDP, jauge)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ
EOF
)"
```

---

## Task 4 : Validation live (`club.js`)

**Files:**
- Modify: `public/club.js` (nouvelles fonctions + wiring dans la branche `else if (INVITE_TOKEN)` ~ligne 56-62 ; garde-fou dans `submitRegister` ~ligne 165)

**Interfaces:**
- Consumes: `window.Password.checkPassword` (Task 1) ; ids/classes du markup (Task 3) ; helper existant `$`.
- Produces: bouton `regSubmit` activé uniquement si tous les requis valides + `checkPassword().ok` ; checklist/jauge live ; `submitRegister` revalide avant POST.

- [ ] **Step 1 : Ajouter les fonctions de validation live**

Dans `public/club.js`, ajouter ce bloc (par ex. juste avant `async function submitRegister()`) :

```js
/* ── Inscription : validation live ── */
function validUserClient(u) { return /^[A-Za-z0-9_-]{3,20}$/.test(u); }

function regFieldOk(id, valid, msg) {
  const inp = $(id); if (!inp) return valid;
  const filled = inp.value.trim() !== '';
  inp.classList.toggle('valid', valid);
  inp.classList.toggle('invalid', !valid && filled);
  const m = $(id + 'Msg');
  if (m) m.textContent = (!valid && filled) ? msg : '';
  return valid;
}

function renderPwMeter(res, pass) {
  const bar = $('regPassBar');
  if (bar) {
    bar.style.width = (pass ? (res.score / 6 * 100) : 0) + '%';
    bar.dataset.level = pass ? res.label : '';
  }
  const lbl = $('regPassLabel');
  if (lbl) lbl.textContent = pass ? ('Force : ' + res.label) : '';
  const list = $('regPassChecklist');
  if (list) list.querySelectorAll('li').forEach(li => {
    li.classList.toggle('ok', !!res.rules[li.dataset.rule]);
  });
  // notName n'est pas dans la checklist (règle croisée) → message dédié
  const msg = $('regPassMsg');
  if (msg) msg.textContent = (pass && !res.rules.notName) ? 'Le mot de passe ne doit pas contenir ton pseudo.' : '';
}

function refreshRegisterState() {
  const user = $('regUser').value.trim();
  const pass = $('regPass').value;
  const okUser    = regFieldOk('regUser', validUserClient(user), 'Pseudo : 3–20 caractères (lettres, chiffres, _ ou -).');
  const okNom     = regFieldOk('regNom', $('regNom').value.trim() !== '', 'Champ requis.');
  const okPrenom  = regFieldOk('regPrenom', $('regPrenom').value.trim() !== '', 'Champ requis.');
  const okDiscord = regFieldOk('regDiscord', $('regDiscord').value.trim() !== '', 'Champ requis.');
  const res = Password.checkPassword(pass, user);
  renderPwMeter(res, pass);
  const okAll = okUser && okNom && okPrenom && okDiscord && res.ok;
  const btn = $('regSubmit'); if (btn) btn.disabled = !okAll;
  return okAll;
}

function initRegisterValidation() {
  ['regUser', 'regPass', 'regNom', 'regPrenom', 'regDiscord'].forEach(id => {
    const el = $(id); if (el) el.addEventListener('input', refreshRegisterState);
  });
  refreshRegisterState();
}
```

- [ ] **Step 2 : Câbler l'init quand la section s'affiche**

Dans la branche `else if (INVITE_TOKEN)`, après `$('registerSection').classList.remove('hidden');` (et la ligne `cfRender('regCaptcha')…`), ajouter :

```js
      initRegisterValidation();
```

- [ ] **Step 3 : Garde-fou dans `submitRegister`**

Au début de `submitRegister()`, après `$('regErr').textContent = '';`, ajouter :

```js
  if (!refreshRegisterState()) { $('regErr').textContent = 'Complète les champs en rouge.'; return; }
```

(le reste de `submitRegister` — POST `/register`, `TOKEN`/`localStorage`, étape 2FA — reste inchangé.)

- [ ] **Step 4 : Vérification manuelle (comportement)**

Créer un lien d'invitation pour tester le flux réel : se connecter en admin (`/`), aller dans l'espace admin, **créer une invitation**, récupérer le token, puis ouvrir `http://localhost:3000/?invite=<token>`.

Vérifier :
- Champs vides → bouton grisé.
- Taper un MDP faible (`abc`) → checklist rouge, jauge « Faible », bouton grisé.
- Compléter jusqu'à `Str0ng!Passw` + NOM + Prénom + Discord → checklist tout vert, jauge « Moyen », bordures vertes, **bouton actif**.
- Mettre le pseudo `Str0ng` et un MDP contenant `Str0ng` → message « ne doit pas contenir ton pseudo », bouton grisé.
- Vider NOM → bouton se re-grise, message « Champ requis ».
- Avec tout valide → clic « Créer mon compte » → compte créé → étape 2FA optionnelle.

- [ ] **Step 5 : Commit**

```bash
git add public/club.js
git commit -m "$(cat <<'EOF'
feat(register): validation live par champ + verrouillage du bouton

Checklist/jauge MDP en direct via le module partagé, bouton actif seulement
si tous les requis + règles MDP sont bons, garde-fou dans submitRegister.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ
EOF
)"
```

---

## Self-review (fait à l'écriture du plan)

- **Couverture spec** : champs requis (Task 2 serveur + Task 3/4 front) ✓ ; force MDP min 12 + 4 classes + notName (Task 1 module, Task 2 serveur, Task 4 front) ✓ ; source unique `password.js` (Task 1, consommé par 2 et 4) ✓ ; validation live par champ + checklist + jauge + bouton verrouillé (Task 3/4) ✓ ; serveur = barrière (Task 2, curl) ✓ ; invitation non consommée sur refus (Task 2, ordre du code) ✓ ; téléphone optionnel (Task 2 `clip` sans check, Task 3 label « optionnel ») ✓.
- **Placeholders** : aucun — chaque step porte le code réel.
- **Cohérence des types** : `checkPassword`/`errorMessage`/`score 0..6`/`label` identiques entre Task 1 (définition), Task 2 (`Pw.*`) et Task 4 (`Password.*`) ; ids du markup (Task 3) == ids consommés (Task 4) ; `li[data-rule]` ∈ {length,upper,lower,digit,special} == clés `res.rules`.
- **Hors périmètre** respecté : aucun changement login/2FA/invitation/DB/admin.
