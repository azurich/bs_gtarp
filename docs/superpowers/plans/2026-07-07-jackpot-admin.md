# Jackpot admin (caché) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'admin un pouvoir caché : armer un jackpot depuis la section Cagnotte ; le prochain joueur (n'importe quel jeu) remporte `aléa(30-60 %) × base` avec une célébration générique, sans qu'aucun joueur sache que l'admin peut déclencher ça.

**Architecture:** Un état `pendingJackpot` en mémoire dans `server.ts`. Le calcul du montant est une fonction pure `jackpotAmount()` dans `games.ts` (testable). Un helper `awardJackpot()` court-circuite le prochain jeu (hook au point de mise des 6 routes). 3 endpoints admin arment/annulent/lisent l'état ; l'UI admin vit dans la section Cagnotte. Le joueur gagnant voit un overlay « JACKPOT ! » générique.

**Tech Stack:** Bun + ElysiaJS + bun:sqlite, bun:test, front vanilla.

## Global Constraints

- **Montant** : `pct = 0.30 + Math.random()*0.30` (30-60 %) ; `base` = `'pool'` (= `wagered − paid`) ou `'budget'` (= `CASINO_RESERVE × pool`, `CASINO_RESERVE = 0.30`) ; `gain = jackpotAmount(base, pool, CASINO_RESERVE, pct)`.
- **Déclenchement** : hook au point de mise des 6 jeux (`/api/play/{slots,plinko,wheel,dice}`, `/api/bj/deal`, `/api/mines/start`) ; si `pendingJackpot`, court-circuit → `awardJackpot(...)` renvoie `{ jackpot: true, gain, …snapshot }` et remet `pendingJackpot = null`.
- **awardJackpot** : `charge(bet)` (400 si insuffisant), `payout(gain)`, `bookCasino(bet, gain)`, `awardXP(bet)`, `recordHistory(..., 'jackpot')`, `logEvent(armedBy, 'admin', …)`, puis `pendingJackpot = null`.
- **Endpoints admin** protégés par `checkAdmin` (403 sinon) ; `base` validée ∈ `{'pool','budget'}`.
- **Caché joueur** : célébration générique, aucune mention admin, aucun bandeau/annonce, aucun endpoint d'état joueur.
- **État en mémoire** (`pendingJackpot`), perdu au redémarrage.
- Commits avec trailers `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ`.
- Backend modifié → l'image prod devra être reconstruite (CI). Front servi sans cache (F5).

---

## File Structure
- `src/games.ts` — Task 1 : fonction pure `jackpotAmount()`.
- `tests/jackpot.test.ts` — Task 1.
- `src/server.ts` — Task 2 : état `pendingJackpot`, helper `awardJackpot`, hooks (6 routes), endpoints admin.
- `public/admin.js` (+ `public/admin.css`) — Task 3 : bloc Jackpot dans `renderGameInfo` + `armJackpot`/`cancelJackpot`.
- `public/casino.js` (+ `public/casino.css`) — Task 4 : détection `d.jackpot` (6 handlers) + `showJackpot()` + overlay.

---

### Task 1 : games.ts — `jackpotAmount()` (pur) + test

**Files:**
- Modify: `src/games.ts` (ajout d'un export)
- Create: `tests/jackpot.test.ts`

**Interfaces:**
- Produces (Task 2) : `jackpotAmount(base: 'pool' | 'budget', pool: number, reserve: number, pct: number): number`.

- [ ] **Step 1 : Écrire le test**

Créer `tests/jackpot.test.ts` :
```ts
import { test, expect } from 'bun:test'
import { jackpotAmount } from '../src/games.ts'

test('jackpotAmount : base pool vs budget, arrondi, clamp', () => {
  expect(jackpotAmount('pool',   100000, 0.30, 0.50)).toBe(50000)  // 50% du pool
  expect(jackpotAmount('budget', 100000, 0.30, 0.50)).toBe(15000)  // 50% du budget (30k)
  expect(jackpotAmount('pool',   100000, 0.30, 0.30)).toBe(30000)  // borne basse
  expect(jackpotAmount('pool',   100000, 0.30, 0.60)).toBe(60000)  // borne haute
  expect(jackpotAmount('pool',   -5,     0.30, 0.50)).toBe(0)      // pool négatif -> 0
  expect(jackpotAmount('budget', 101,    0.30, 0.50)).toBe(15)     // round(0.30*101*0.50 = 15.15) = 15
})
```

- [ ] **Step 2 : Lancer → échec (fonction absente)**

Run : `bun test tests/jackpot.test.ts`
Expected : FAIL — `jackpotAmount` non exporté.

- [ ] **Step 3 : Ajouter la fonction dans `src/games.ts`**

À la fin de `src/games.ts`, ajouter :
```ts
/* ---------------- JACKPOT ADMIN ----------------
   Montant d'un jackpot : pct du pool (GROS) ou du budget = reserve*pool (PETIT). */
export function jackpotAmount(base: 'pool' | 'budget', pool: number, reserve: number, pct: number): number {
  const p = Math.max(0, pool)
  const baseAmount = base === 'pool' ? p : reserve * p
  return Math.round(baseAmount * pct)
}
```

- [ ] **Step 4 : Lancer → succès**

Run : `bun test tests/jackpot.test.ts` puis `bun test`
Expected : PASS (nouveau test + suite complète).

- [ ] **Step 5 : Commit**
```bash
git add src/games.ts tests/jackpot.test.ts
git commit -m "feat(games): jackpotAmount() pur (montant jackpot admin) + test"
```

---

### Task 2 : server.ts — état + helper + hooks + endpoints admin

**Files:**
- Modify: `src/server.ts`

**Interfaces:**
- Consumes (Task 1) : `G.jackpotAmount(base, pool, reserve, pct)`.
- Produces (Task 3) : endpoints `GET/POST/DELETE /api/admin/jackpot`. (Task 4) : réponses de jeu `{ jackpot: true, gain, …snapshot }`.

- [ ] **Step 1 : Déclarer l'état `pendingJackpot`**

Dans `src/server.ts`, juste après la ligne `const activeMines = new Map<number, MinesState>()` (~L83), ajouter :
```ts
// Jackpot admin armé (caché) : consommé par le prochain jeu. En mémoire (perdu au restart).
let pendingJackpot: { base: 'pool' | 'budget'; armedBy: string } | null = null
```

- [ ] **Step 2 : Ajouter le helper `awardJackpot`**

Juste après la fonction `bookCasino` (~L168, avant `recordHistory`), ajouter :
```ts
// Court-circuite le prochain jeu en jackpot. Renvoie le corps de réponse.
function awardJackpot(u: User, bet: number, gameKey: string, set: { status?: number }): object {
  if (!charge(u, bet, gameKey)) { set.status = 400; return { error: 'Crédits Club insuffisants' } }
  const c = Q.getCasino.get() as { wagered: number; paid: number }
  const pool = Math.max(0, c.wagered - c.paid)
  const pct  = 0.30 + Math.random() * 0.30
  const gain = G.jackpotAmount(pendingJackpot!.base, pool, CASINO_RESERVE, pct)
  payout(u, gain, gameKey)
  bookCasino(bet, gain)
  awardXP(u.id, bet)
  recordHistory(u.id, gameKey, bet, gain, 'jackpot')
  logEvent(pendingJackpot!.armedBy, 'admin',
    'JACKPOT gagné par ' + u.username + ' : ' + gain + ' (' + gameKey + ', ' + Math.round(pct * 100) + '% du ' + pendingJackpot!.base + ')', gain)
  pendingJackpot = null
  return { jackpot: true, gain, ...userSnapshot(u.id) }
}
```
> Note : `awardXP` et `recordHistory` sont définis plus bas dans le fichier mais sont des déclarations de fonctions (hoistées) — l'appel depuis `awardJackpot` fonctionne.

- [ ] **Step 3 : Brancher le hook dans les 6 routes**

Dans chaque route, **juste après** la validation `if (!bet) { … }` (et avant tout `charge`/logique), ajouter la ligne indiquée :

`/api/play/slots` — après `if (!bet) {...}` :
```ts
      if (pendingJackpot) return awardJackpot(u, bet, 'slots', set)
```
`/api/play/plinko` — après `if (!bet) {...}` (avant le parsing `risk`) :
```ts
      if (pendingJackpot) return awardJackpot(u, bet, 'plinko', set)
```
`/api/play/wheel` — après `if (!bet) {...}` :
```ts
      if (pendingJackpot) return awardJackpot(u, bet, 'wheel', set)
```
`/api/play/dice` — après `if (!bet) {...}` :
```ts
      if (pendingJackpot) return awardJackpot(u, bet, 'dice', set)
```
`/api/bj/deal` — après `if (!bet) {...}` (avant le contrôle `bjMaxBet`) :
```ts
      if (pendingJackpot) return awardJackpot(u, bet, 'blackjack', set)
```
`/api/mines/start` — après `if (!bet) {...}` (avant la validation des bombes) :
```ts
      if (pendingJackpot) return awardJackpot(u, bet, 'mines', set)
```

- [ ] **Step 4 : Ajouter les 3 endpoints admin**

Juste après le handler `/api/admin/casino/reset` (~L758), ajouter :
```ts
    .get('/api/admin/jackpot', ({ headers, set }) => {
      if (!checkAdmin(headers as any)) { set.status = 403; return { error: 'Réservé admin' } }
      return { armed: !!pendingJackpot, base: pendingJackpot?.base ?? null }
    })
    .post('/api/admin/jackpot', ({ headers, body, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      const base = (body as any).base
      if (base !== 'pool' && base !== 'budget') { set.status = 400; return { error: 'Base invalide' } }
      pendingJackpot = { base, armedBy: adm.username }
      logEvent(adm.username, 'admin', 'Jackpot armé (' + base + ')')
      return { ok: true, base }
    })
    .delete('/api/admin/jackpot', ({ headers, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      pendingJackpot = null
      logEvent(adm.username, 'admin', 'Jackpot annulé')
      return { ok: true }
    })
```

- [ ] **Step 5 : Compiler + smoke (auth requise = 403)**

Run : `bun build src/server.ts --target=bun >/dev/null && echo OK`
Expected : `OK`.
Run (serveur dev sur :3000) : `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3000/api/admin/jackpot -H 'content-type: application/json' -d '{"base":"pool"}'`
Expected : `403` (protégé, non-admin).
Run : `bun test`
Expected : PASS (suite inchangée ; `jackpotAmount` couvert en Task 1).

- [ ] **Step 6 : Commit**
```bash
git add src/server.ts
git commit -m "feat(server): jackpot admin — etat, awardJackpot, hooks 6 jeux, endpoints admin"
```

---

### Task 3 : admin — bloc Jackpot dans la Cagnotte

**Files:**
- Modify: `public/admin.js` (fonction `renderGameInfo`, + `armJackpot`/`cancelJackpot`)
- Modify: `public/admin.css` (styles du bloc)

**Interfaces:**
- Consumes (Task 2) : `GET/POST/DELETE /api/admin/jackpot`, `GET /api/admin/casino` (`pool`, `budget`).

- [ ] **Step 1 : Récupérer l'état jackpot dans `renderGameInfo`**

Dans `public/admin.js`, dans `renderGameInfo`, juste après la ligne
`let d; try { d = await api('/admin/casino'); } catch (e) { … return; }`, ajouter :
```js
  let jp; try { jp = await api('/admin/jackpot'); } catch (e) { jp = { armed: false, base: null }; }
```

- [ ] **Step 2 : Ajouter le bloc Jackpot au HTML rendu**

Toujours dans `renderGameInfo`, remplacer la dernière ligne du `box.innerHTML = … + '<button class="btn ghost sm" onclick="resetCasino()" style="margin-top:18px">Réinitialiser la cagnotte</button>';`
par (on insère le bloc jackpot AVANT le bouton reset) :
```js
    + '<div class="cg-jackpot">'
    +   '<div class="cg-jp-head">Jackpot' + (jp.armed ? '<span class="cg-jp-armed">ARMÉ · ' + (jp.base === 'pool' ? 'GROS' : 'PETIT') + '</span>' : '') + '</div>'
    +   '<p class="hint">Arme le prochain jeu : le prochain joueur remporte 30-60 %. '
    +     'GROS = de la cagnotte (' + f(d.pool) + ' → ' + f(0.30 * d.pool) + '–' + f(0.60 * d.pool) + '). '
    +     'PETIT = du budget (' + f(d.budget) + ' → ' + f(0.30 * d.budget) + '–' + f(0.60 * d.budget) + ').</p>'
    +   '<div class="cg-jp-actions">'
    +     '<button class="btn sm" onclick="armJackpot(\'pool\')">Armer GROS</button>'
    +     '<button class="btn sm ghost" onclick="armJackpot(\'budget\')">Armer PETIT</button>'
    +     (jp.armed ? '<button class="btn sm ghost" onclick="cancelJackpot()">Annuler</button>' : '')
    +   '</div>'
    + '</div>'
    + '<button class="btn ghost sm" onclick="resetCasino()" style="margin-top:18px">Réinitialiser la cagnotte</button>';
```

- [ ] **Step 3 : Ajouter `armJackpot` / `cancelJackpot`**

Dans `public/admin.js`, juste après la fonction `resetCasino` (la `}` de fin), ajouter :
```js
async function armJackpot(base) {
  try { await api('/admin/jackpot', 'POST', { base }); toast('Jackpot armé (' + (base === 'pool' ? 'GROS' : 'PETIT') + ')'); renderGameInfo(); }
  catch (e) { toast(e.message, 4000, 'error'); }
}
function cancelJackpot() {
  api('/admin/jackpot', 'DELETE').then(() => { toast('Jackpot annulé'); renderGameInfo(); }).catch(e => toast(e.message, 4000, 'error'));
}
```

- [ ] **Step 4 : Styles du bloc**

À la fin de `public/admin.css`, ajouter :
```css
/* ── Bloc Jackpot (Cagnotte admin) ── */
.cg-jackpot { margin-top: 20px; padding: 16px; border: 1px solid var(--accent-dim, rgba(201,168,76,.3)); border-radius: 12px; background: rgba(201,168,76,.05); }
.cg-jp-head { display: flex; align-items: center; gap: 10px; font-family: var(--display, serif); font-size: 1.2rem; font-weight: 600; color: var(--tx, #f5f0ff); margin-bottom: 6px; }
.cg-jp-armed { font-family: var(--body); font-size: .66rem; font-weight: 700; letter-spacing: .08em; color: #46d588; background: rgba(52,209,126,.14); border: 1px solid rgba(52,209,126,.4); border-radius: 999px; padding: 3px 10px; }
.cg-jp-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.cg-jp-actions .btn { width: auto; }
```

- [ ] **Step 5 : Vérifier (servi + parse)**

Run (serveur dev) : `curl -s http://127.0.0.1:3000/admin.js | grep -c "function armJackpot\|cg-jackpot"`
Expected : `≥ 2`.
Run : `bun build public/admin.js --target=browser >/dev/null 2>&1 && echo "PARSE OK"`
Expected : `PARSE OK`.
(Rendu réel : vérif manuelle dans l'admin.)

- [ ] **Step 6 : Commit**
```bash
git add public/admin.js public/admin.css
git commit -m "feat(admin): bloc Jackpot (armer GROS/PETIT, annuler) dans la Cagnotte"
```

---

### Task 4 : casino — détection `d.jackpot` (6 handlers) + célébration

**Files:**
- Modify: `public/casino.js` (6 handlers + `showJackpot`)
- Modify: `public/casino.css` (overlay)

**Interfaces:**
- Consumes (Task 2) : réponses de jeu `{ jackpot: true, gain, balance, xp, level }`.

- [ ] **Step 1 : Ajouter `showJackpot()`**

Dans `public/casino.js`, ajouter cette fonction (par ex. juste avant `function gameResult(`) :
```js
/* Célébration générique de jackpot (aucune mention de l'origine admin) */
function showJackpot(gain) {
  const ov = document.createElement('div');
  ov.className = 'jackpot-overlay';
  ov.innerHTML = '<div class="jackpot-box"><div class="jackpot-title">JACKPOT !</div>'
    + '<div class="jackpot-amount"><span class="bs-coin"></span>' + fmt(gain) + '</div>'
    + '<div class="jackpot-sub">Crédits Club remportés</div></div>';
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 320); };
  ov.addEventListener('click', close);
  setTimeout(close, 6000);
}
```

- [ ] **Step 2 : Brancher la détection dans les 6 handlers**

Dans chaque handler, **immédiatement après** la ligne `let d; try { d = await api('/…', …); } catch …` (avant tout traitement du résultat), ajouter le garde. Détails par jeu :

`slotSpin` — après le `try { d = await api('/play/slots', …); } catch … return toast(...) }` (l'anim de rouleaux tourne déjà) :
```js
  if (d.jackpot) { clearInterval(tick); reels.forEach(r => r.classList.remove('spin')); slotSpinning = false; $('slotBtn').disabled = false; setBalance(d.balance, undefined, d.xp, d.level); showJackpot(d.gain); return; }
```
`bjDeal` — après `let d; try { d = await api('/bj/deal', …); } catch … }` :
```js
  if (d.jackpot) { $('bjDealBtn').disabled = false; setBalance(d.balance, undefined, d.xp, d.level); showJackpot(d.gain); return; }
```
`minesStartGame` — après `let d; try { d = await api('/mines/start', …); } catch … }` :
```js
  if (d.jackpot) { setBalance(d.balance, undefined, d.xp, d.level); showJackpot(d.gain); return; }
```
`plinkoDrop` — après `let d; try { d = await api('/play/plinko', …); } catch … }` :
```js
  if (d.jackpot) { setBalance(d.balance, undefined, d.xp, d.level); showJackpot(d.gain); return; }
```
`wheelSpin` — après `try { d = await api('/play/wheel', …); } catch … }` (l'état spinning est déjà posé) :
```js
  if (d.jackpot) { wheelSpinning = false; $('wBtn').disabled = false; if (rs) rs.disabled = false; setBalance(d.balance, undefined, d.xp, d.level); showJackpot(d.gain); return; }
```
`diceRoll` — après `let d; try { d = await api('/play/dice', …); } catch … }` :
```js
  if (d.jackpot) { setBalance(d.balance, undefined, d.xp, d.level); showJackpot(d.gain); return; }
```

- [ ] **Step 3 : Styles de l'overlay**

À la fin de `public/casino.css`, ajouter :
```css
/* ── Overlay Jackpot (générique) ── */
.jackpot-overlay { position: fixed; inset: 0; z-index: 400; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 40%, rgba(201,168,76,.18), rgba(5,5,12,.9) 70%); opacity: 0; transition: opacity .3s ease; cursor: pointer; }
.jackpot-overlay.show { opacity: 1; }
.jackpot-box { text-align: center; transform: scale(.85); transition: transform .35s var(--ease-back, cubic-bezier(.34,1.56,.64,1)); }
.jackpot-overlay.show .jackpot-box { transform: scale(1); }
.jackpot-title { font-family: var(--display, serif); font-weight: 700; font-size: clamp(3rem, 12vw, 7rem); letter-spacing: .04em; color: #fff; text-shadow: 0 0 40px rgba(201,168,76,.8), 0 0 12px rgba(201,168,76,.9); }
.jackpot-amount { display: inline-flex; align-items: center; gap: 14px; margin-top: 10px; font-family: var(--num); font-variant-numeric: tabular-nums; font-weight: 700; font-size: clamp(2rem, 8vw, 4.5rem); color: var(--gold, #c9a84c); }
.jackpot-sub { margin-top: 8px; font-family: var(--body); font-size: .9rem; letter-spacing: .1em; text-transform: uppercase; color: rgba(245,240,255,.6); }
```

- [ ] **Step 4 : Vérifier (servi + parse)**

Run (serveur dev) : `curl -s http://127.0.0.1:3000/casino.js | grep -c "function showJackpot\|d.jackpot"`
Expected : `≥ 7` (la fonction + 6 gardes).
Run : `bun build public/casino.js --target=browser >/dev/null 2>&1 && echo "PARSE OK"`
Expected : `PARSE OK`.
(Rendu réel : vérif manuelle — armer depuis l'admin, jouer, voir l'overlay.)

- [ ] **Step 5 : Commit**
```bash
git add public/casino.js public/casino.css
git commit -m "feat(casino): celebration jackpot generique sur reponse jackpot:true (6 jeux)"
```

---

## Self-Review

**1. Couverture du spec :**
- `pendingJackpot` en mémoire → Task 2 (Step 1). ✅
- Montant `pct×base`, base pool/budget → Task 1 (`jackpotAmount`) + Task 2 (awardJackpot). ✅
- Hook 6 jeux, court-circuit, consommation → Task 2 (Step 3). ✅
- `awardJackpot` (charge/payout/bookCasino/awardXP/recordHistory 'jackpot'/logEvent) → Task 2 (Step 2). ✅
- Endpoints admin GET/POST/DELETE protégés + base validée → Task 2 (Step 4). ✅
- Bloc admin (armer GROS/PETIT, annuler, fourchettes, état) → Task 3. ✅
- Célébration joueur générique + détection 6 handlers → Task 4. ✅
- Caché (aucune mention admin, pas de bandeau/annonce/poll) → Task 4 (célébration générique) ; rien de player-facing ajouté hors overlay. ✅
- Cagnotte/solvabilité (bookCasino, pool≈0→0) → Task 2 (awardJackpot) + `jackpotAmount` clamp. ✅
- Cas limites (crédits insuffisants→400, un seul armé, restart perd l'état) → Task 2. ✅

**2. Placeholders :** aucun ; tout le code est fourni.

**3. Cohérence des types/noms :** `jackpotAmount(base,pool,reserve,pct)` identique Task 1↔Task 2. `pendingJackpot: { base:'pool'|'budget'; armedBy:string }` cohérent (état, awardJackpot, endpoints). Réponse `{ jackpot:true, gain, …snapshot }` produite en Task 2, consommée en Task 4 (`d.jackpot`, `d.gain`, `d.balance/xp/level`). `showJackpot(gain)` défini et appelé en Task 4. Endpoints `/api/admin/jackpot` produits Task 2, consommés Task 3.
