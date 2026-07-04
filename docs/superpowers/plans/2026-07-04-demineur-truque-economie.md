# Démineur truqué — économie RTP 70 % — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'économie « équitable + rake » du Démineur par un modèle **truqué à RTP 70 %** : multiplicateurs hype, tirage truqué par clic, et **bombe forcée** quand le prochain gain dépasserait la cagnotte.

**Architecture:** La logique pure (courbes, probas, bombes d'affichage) va dans `games.ts` (testable). Le serveur (`server.ts`) décide l'issue de chaque clic (bombe forcée si impayable, sinon tirage truqué `Math.random() < minesSafeProb`). Le front retire le mécanisme `maxReached`. Ordre des tâches choisi pour que la base compile/teste après chaque tâche.

**Tech Stack:** Bun + ElysiaJS + `bun:sqlite`, `bun:test`, front vanilla.

## Global Constraints

- **RTP = 0.70 à tout encaissement**, exact par construction : `M(n) = m1·g^(n-1)`, `P(atteindre n) = 0.70/M(n)`, survie clic `n` = `n===1 ? 0.70/m1 : 1/g`.
- **Courbes** (`MINES_CURVES`) : `3 → {m1:1.15, g:1.25}`, `6 → {m1:1.5, g:1.6}`, `12 → {m1:3.0, g:2.5}`. Seuls **3/6/12** exposés/valides.
- **Grille** 25 cases ; max gemmes = `25 − bombs` ; toutes révélées = **sweep** (encaissement auto).
- **Empêcher l'impayable** : plafond mise au start = `floor(budget / M(bombs,1))` ; **bombe forcée** si `bet × M(bombs, gems+1) > casinoBudget()`. **Plus de `maxReached`** (serveur ni front).
- `bookCasino` : bombe → `(bet, 0)` ; encaisse/sweep → `(bet, gain)`. `gain = round(bet × mult)`.
- Backend → l'image doit être reconstruite (CI) ; le front est servi sans cache (F5).
- Commits avec trailers `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ`.

---

## File Structure

- **`src/games.ts`** — Task 1 ajoute `MINES_RTP`, `MINES_CURVES`, `minesMult`, `minesSafeProb`, `minesMaxGems`, `minesDisplayBombs` ; Task 4 retire `MINES_RAKE`, `minesStepFactor`.
- **`tests/mines.test.ts`** — Task 1 (unitaires + simulation RTP + bombes d'affichage).
- **`src/server.ts`** — Task 2 réécrit `MinesState` + handlers `/api/mines/start|pick|cashout`.
- **`public/casino.js`**, **`public/casino.html`**, **`public/casino.css`** — Task 3 retire l'UI `maxReached`.
- **`tests/cagnotte-stateful.test.ts`** — Task 4 retire les tests `minesStepFactor`.

---

### Task 1 : games.ts — primitives de l'économie truquée + tests

**Files:**
- Modify: `src/games.ts` (ajouts seulement — ne rien retirer ici)
- Create: `tests/mines.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces (consommés par Task 2) :
  - `MINES_RTP: number` (0.70)
  - `MINES_CURVES: Record<number, { m1: number; g: number }>`
  - `minesMult(bombs: number, gems: number): number`
  - `minesSafeProb(bombs: number, pick: number): number`
  - `minesMaxGems(bombs: number): number`
  - `minesDisplayBombs(revealedGems: Iterable<number>, bombs: number, fatal: number): number[]`

- [ ] **Step 1 : Écrire le test (unitaires + simulation RTP + bombes d'affichage)**

Créer `tests/mines.test.ts` :

```ts
import { test, expect } from 'bun:test'
import {
  minesMult, minesSafeProb, minesMaxGems, minesDisplayBombs,
  MINES_RTP, MINES_CURVES,
} from '../src/games.ts'

test('minesMult = m1 * g^(gems-1)', () => {
  expect(minesMult(3, 0)).toBe(1)
  expect(minesMult(3, 1)).toBeCloseTo(1.15, 9)
  expect(minesMult(3, 2)).toBeCloseTo(1.15 * 1.25, 9)
  expect(minesMult(6, 1)).toBeCloseTo(1.5, 9)
  expect(minesMult(12, 3)).toBeCloseTo(3 * 2.5 * 2.5, 9)
})

test('minesSafeProb : le 1er clic porte l edge (0.70/m1), ensuite 1/g', () => {
  expect(minesSafeProb(3, 1)).toBeCloseTo(MINES_RTP / 1.15, 9)
  expect(minesSafeProb(3, 2)).toBeCloseTo(1 / 1.25, 9)
  expect(minesSafeProb(12, 1)).toBeCloseTo(MINES_RTP / 3, 9)
  expect(minesSafeProb(12, 5)).toBeCloseTo(1 / 2.5, 9)
})

test('minesMaxGems = 25 - bombs', () => {
  expect(minesMaxGems(3)).toBe(22)
  expect(minesMaxGems(6)).toBe(19)
  expect(minesMaxGems(12)).toBe(13)
})

test('minesDisplayBombs : bon compte, inclut la fatale, exclut les gemmes', () => {
  const gems = [0, 1, 2]
  const b = minesDisplayBombs(gems, 6, 7)
  expect(b.length).toBe(6)
  expect(b).toContain(7)                       // case fatale
  expect(b.every(i => !gems.includes(i))).toBe(true)
  expect(new Set(b).size).toBe(6)              // pas de doublon
  // sweep : fatal = -1
  const sweep = minesDisplayBombs([...Array(22).keys()], 3, -1)
  expect(sweep.length).toBe(3)
})

// Simulation : RTP = 0.70 quelle que soit la politique d'encaissement (budget illimité).
function simRTP(bombs: number, stopAt: number, n: number): number {
  const maxG = minesMaxGems(bombs)
  let wagered = 0, paid = 0
  for (let k = 0; k < n; k++) {
    wagered += 1
    let gems = 0, alive = true
    while (alive && gems < maxG) {
      if (gems >= stopAt) break                // encaisse dès qu'on atteint stopAt gemmes
      if (Math.random() < minesSafeProb(bombs, gems + 1)) gems++
      else alive = false
    }
    if (alive) paid += minesMult(bombs, gems)  // encaissé (ou sweep) ; bombe -> 0
  }
  return paid / wagered
}

test('RTP ~= 0.70 pour 3/6/12 bombes, toutes politiques (budget illimite)', () => {
  const N = 200_000
  for (const bombs of [3, 6, 12]) {
    for (const stop of [1, 2, 3]) {
      const rtp = simRTP(bombs, stop, N)
      expect(rtp).toBeGreaterThan(0.665)
      expect(rtp).toBeLessThan(0.735)
    }
  }
})
```

- [ ] **Step 2 : Lancer le test → échec (fonctions absentes)**

Run : `bun test tests/mines.test.ts`
Expected : FAIL — `Cannot find … 'minesMult'` (ou export absent).

- [ ] **Step 3 : Ajouter les primitives dans `src/games.ts`**

Juste après la ligne `export const MINES_RAKE = 0.11 …` (la laisser en place pour l'instant), ajouter :

```ts
/* ---------------- MINES truqué (RTP 70 %) ----------------
   M(n) = m1 * g^(n-1) ; P(atteindre n) = 0.70 / M(n) ;
   survie clic n : n===1 -> 0.70/m1 (edge sur le 1er clic), sinon 1/g.
   RTP = P(n) * M(n) = 0.70 à tout encaissement, exact par construction.
*/
export const MINES_RTP = 0.70
export const MINES_CURVES: Record<number, { m1: number; g: number }> = {
  3:  { m1: 1.15, g: 1.25 },
  6:  { m1: 1.5,  g: 1.6  },
  12: { m1: 3.0,  g: 2.5  },
}
export function minesMaxGems(bombs: number): number { return 25 - bombs }
export function minesMult(bombs: number, gems: number): number {
  if (gems <= 0) return 1
  const c = MINES_CURVES[bombs]
  return c.m1 * Math.pow(c.g, gems - 1)
}
export function minesSafeProb(bombs: number, pick: number): number {
  const c = MINES_CURVES[bombs]
  return pick === 1 ? MINES_RTP / c.m1 : 1 / c.g
}
// Positions de bombes pour l'AFFICHAGE de fin : `bombs` cases parmi les non-gemmes,
// en incluant la case fatale si fournie (>= 0).
export function minesDisplayBombs(revealedGems: Iterable<number>, bombs: number, fatal: number): number[] {
  const gems = new Set(revealedGems)
  const pool: number[] = []
  for (let i = 0; i < 25; i++) if (i !== fatal && !gems.has(i)) pool.push(i)
  for (let k = pool.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [pool[k], pool[j]] = [pool[j], pool[k]] }
  const out = fatal >= 0 ? [fatal] : []
  while (out.length < bombs && pool.length) out.push(pool.pop()!)
  return out
}
```

- [ ] **Step 4 : Lancer les tests → succès**

Run : `bun test tests/mines.test.ts`
Expected : PASS (tous). Puis `bun test` (suite complète) → toujours PASS (rien retiré).

- [ ] **Step 5 : Commit**

```bash
git add src/games.ts tests/mines.test.ts
git commit -m "feat(games/mines): primitives economie truquee RTP 70% + tests (sim)"
```

---

### Task 2 : server.ts — handlers Mines (bombe forcée, sweep)

**Files:**
- Modify: `src/server.ts` — interface `MinesState`, handlers `/api/mines/start`, `/api/mines/pick`, `/api/mines/cashout`

**Interfaces:**
- Consumes (Task 1) : `G.minesMult`, `G.minesSafeProb`, `G.minesMaxGems`, `G.minesDisplayBombs`.
- Produces : réponses JSON consommées par le front (Task 3) — `start` → `{bombs, mult, pot, ...snapshot}` ; `pick` bombe → `{result:'bomb', i, bombs, ...}` ; `pick` gemme → `{result:'gem', i, pot, ...}` ; `pick` sweep → `{result:'gem', i, pot, cashedOut:true, gain, bombs, ...}` ; `cashout` → `{gain, bombs, ...}`.

- [ ] **Step 1 : Remplacer l'interface `MinesState`**

Dans `src/server.ts`, remplacer la définition actuelle de `interface MinesState { … }` (celle avec `bombSet`, `revealed`, `picks`, `maxReached?`) par :

```ts
interface MinesState {
  bet: number; bombs: number
  revealed: Set<number>   // cases-gemmes révélées
  gems: number; mult: number; live: boolean; startedAt: number
}
```

- [ ] **Step 2 : Réécrire `/api/mines/start`**

Remplacer le handler `/api/mines/start` actuel par :

```ts
    .post('/api/mines/start', ({ body, user, set }) => {
      const u   = user as User
      const b   = body as any
      const bet = intBet(b.bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const bombs = Math.floor(Number(b.bombs))
      if (![3, 6, 12].includes(bombs)) { set.status = 400; return { error: 'Nombre de bombes invalide' } }
      const existingMines = activeMines.get(u.id)
      if (existingMines?.live) { set.status = 400; return { error: 'Une partie de Démineur est déjà en cours.' } }
      const startMax = Math.floor(casinoBudget() / G.minesMult(bombs, 1))
      if (bet > startMax) { set.status = 400; return { error: 'Mise max actuelle : ' + startMax + ' (cagnotte)' } }
      if (!charge(u, bet, 'mines')) { set.status = 400; return { error: 'Crédits Club insuffisants' } }
      awardXP(u.id, bet)
      activeMines.set(u.id, {
        bet, bombs, revealed: new Set<number>(),
        gems: 0, mult: 1, live: true, startedAt: Date.now(),
      })
      return { bombs, mult: 1, pot: 0, ...userSnapshot(u.id) }
    })
```

- [ ] **Step 3 : Réécrire `/api/mines/pick` (bombe forcée + tirage truqué + sweep)**

Remplacer le handler `/api/mines/pick` actuel par :

```ts
    .post('/api/mines/pick', ({ body, user, set }) => {
      const u  = user as User
      const st = activeMines.get(u.id)
      if (!st || !st.live) { set.status = 400; return { error: 'Aucune partie en cours' } }
      const i = Math.floor(Number((body as any).i))
      if (!(i >= 0 && i < 25)) { set.status = 400; return { error: 'Case invalide' } }
      if (st.revealed.has(i))  { set.status = 400; return { error: 'Case déjà révélée' } }

      // Issue : bombe FORCÉE si le prochain gain dépasserait le budget cagnotte
      // (empêcher l'impayable) ; sinon tirage truqué (survie = minesSafeProb).
      const nextMult   = G.minesMult(st.bombs, st.gems + 1)
      const forcedBomb = st.bet * nextMult > casinoBudget()
      const safe       = !forcedBomb && Math.random() < G.minesSafeProb(st.bombs, st.gems + 1)

      if (!safe) {
        st.live = false
        bookCasino(st.bet, 0)
        recordHistory(u.id, 'mines', st.bet, 0, 'bomb')
        activeMines.delete(u.id)
        return { result: 'bomb', i, bombs: G.minesDisplayBombs(st.revealed, st.bombs, i), ...userSnapshot(u.id) }
      }

      st.revealed.add(i)
      st.gems++
      st.mult = nextMult
      const pot = Math.round(st.bet * st.mult)
      if (st.gems === G.minesMaxGems(st.bombs)) {           // sweep : toutes les sûres révélées
        payout(u, pot, 'mines')
        bookCasino(st.bet, pot)
        recordHistory(u.id, 'mines', st.bet, pot, 'sweep')
        st.live = false; activeMines.delete(u.id)
        return { result: 'gem', i, pot, cashedOut: true, gain: pot, bombs: G.minesDisplayBombs(st.revealed, st.bombs, -1), ...userSnapshot(u.id) }
      }
      return { result: 'gem', i, pot, ...userSnapshot(u.id) }
    })
```

- [ ] **Step 4 : Réécrire `/api/mines/cashout`**

Remplacer le handler `/api/mines/cashout` actuel par :

```ts
    .post('/api/mines/cashout', ({ user, set }) => {
      const u  = user as User
      const st = activeMines.get(u.id)
      if (!st || !st.live) { set.status = 400; return { error: 'Aucune partie en cours' } }
      const gain = Math.round(st.bet * st.mult)
      payout(u, gain, 'mines')
      bookCasino(st.bet, gain)
      recordHistory(u.id, 'mines', st.bet, gain, `${st.gems} gems`)
      st.live = false; activeMines.delete(u.id)
      return { gain, bombs: G.minesDisplayBombs(st.revealed, st.bombs, -1), ...userSnapshot(u.id) }
    })
```

- [ ] **Step 5 : Compiler + suite de tests**

Run : `bun build src/server.ts --target=bun >/dev/null && echo OK`
Expected : `OK` (plus aucune référence à `bombSet`/`maxReached`/`minesStepFactor` dans ces handlers ; `minesStepFactor` peut encore exister ailleurs, retirée en Task 4).
Run : `bun test`
Expected : PASS (les tests existants ne couvrent pas ces handlers ; rien cassé).

- [ ] **Step 6 : Commit**

```bash
git add src/server.ts
git commit -m "feat(server/mines): modele truque (bombe forcee si impayable, sweep, sans maxReached)"
```

---

### Task 3 : front — retirer l'UI `maxReached`

**Files:**
- Modify: `public/casino.js` (fonctions mines), `public/casino.css` (règle `.maxed`)

**Interfaces:**
- Consumes (Task 2) : réponses `pick`/`cashout` (plus de champ `maxReached`). Une bombe forcée arrive comme `result:'bomb'` normal → aucun traitement spécial requis.
- Produces : rien.

- [ ] **Step 1 : `casino.js` — retirer le flag et le reset `.maxed`**

Remplacer la ligne :
```js
let minesActive = false, minesCurrentBet = 0, minesMaxReached = false;
```
par :
```js
let minesActive = false, minesCurrentBet = 0;
```

Dans `minesStartGame`, remplacer :
```js
  buildMinesGrid(); minesActive = true; minesCurrentBet = bet; minesMaxReached = false;
  $('minesGrid').classList.remove('maxed');
```
par :
```js
  buildMinesGrid(); minesActive = true; minesCurrentBet = bet;
```

- [ ] **Step 2 : `casino.js` — nettoyer `minesPick` et `minesCashout`**

Dans `minesPick`, remplacer :
```js
  if (!minesActive || minesMaxReached) return;
```
par :
```js
  if (!minesActive) return;
```

Toujours dans `minesPick`, supprimer entièrement le bloc `maxReached` en fin de fonction :
```js
  if (d.maxReached) {
    minesMaxReached = true;
    $('minesGrid').classList.add('maxed');
    const r = $('minesResultMsg'); if (r) { r.dataset.state = 'neutral'; r.textContent = 'Max atteint (cagnotte) — encaisse'; }
  }
```
(la fonction se termine donc après `setBalance(d.balance, undefined, d.xp, d.level);`).

Dans `minesCashout`, remplacer :
```js
  revealBombs(d.bombs); minesActive = false; minesMaxReached = false;
  $('minesGrid').classList.remove('maxed');
```
par :
```js
  revealBombs(d.bombs); minesActive = false;
```

- [ ] **Step 3 : `casino.css` — retirer la règle `.maxed`**

Supprimer la ligne :
```css
.mines-grid.maxed .cell:not(.done){pointer-events:none;opacity:.5}
```

- [ ] **Step 4 : Vérifier (aucune référence résiduelle + servi)**

Run : `grep -rn "maxReached\|\.maxed\|minesMaxReached" public/ src/ | grep -v node_modules`
Expected : aucune sortie.
Run (serveur dev lancé) : `curl -s http://127.0.0.1:3000/casino.js | grep -c "minesMaxReached"`
Expected : `0`.

- [ ] **Step 5 : Commit**

```bash
git add public/casino.js public/casino.css
git commit -m "refactor(front/mines): retire l'UI maxReached (remplacee par la bombe forcee)"
```

---

### Task 4 : cleanup — retirer l'ancienne économie mines

**Files:**
- Modify: `src/games.ts` (retirer `MINES_RAKE`, `minesStepFactor`), `tests/cagnotte-stateful.test.ts` (retirer les tests `minesStepFactor`)

**Interfaces:**
- Consumes: rien (personne ne référence plus `minesStepFactor`/`MINES_RAKE` après Tasks 2-3).
- Produces: rien.

- [ ] **Step 1 : Vérifier que plus rien ne référence l'ancienne éco**

Run : `grep -rn "minesStepFactor\|MINES_RAKE" src/ public/ | grep -v node_modules | grep -v tests`
Expected : uniquement les définitions dans `src/games.ts` (aucun appel ailleurs).

- [ ] **Step 2 : Retirer de `src/games.ts`**

Supprimer la constante et la fonction :
```ts
export const MINES_RAKE = 0.11   // ~11% de marge par case dévoilée
```
et
```ts
// Facteur de multiplicateur d'une case sûre du Démineur (picks déjà révélés, bombs placées)
export function minesStepFactor(picks: number, bombs: number): number {
  const safe = 25 - bombs
  return ((25 - picks) / (safe - picks)) * (1 - MINES_RAKE)
}
```
Mettre aussi à jour l'ancien commentaire de section `MINES (stateful)` (lignes « Placement de bombes équitable… RTP = (1-rake)^picks ») pour refléter le nouveau modèle, ou le supprimer.

- [ ] **Step 3 : Retirer les tests `minesStepFactor` de `tests/cagnotte-stateful.test.ts`**

Retirer `minesStepFactor, MINES_RAKE` de l'`import`, et supprimer les deux tests :
```ts
test('minesStepFactor — 1re case (3 bombes) = (25/22)*(1-rake)', () => { … })
test('minesStepFactor croît avec les picks (cases sûres plus rares)', () => { … })
```
(garder le test `bjMaxBet`). L'import devient : `import { bjMaxBet, BJ_BJ_MULT } from '../src/games.ts'`.

- [ ] **Step 4 : Compiler + suite complète**

Run : `bun build src/server.ts --target=bun >/dev/null && echo OK`
Expected : `OK`.
Run : `bun test`
Expected : PASS (mines.test.ts couvre la nouvelle éco ; plus de test stepFactor).
Run : `grep -rn "minesStepFactor\|MINES_RAKE" src/ tests/ | grep -v node_modules`
Expected : aucune sortie.

- [ ] **Step 5 : Commit**

```bash
git add src/games.ts tests/cagnotte-stateful.test.ts
git commit -m "chore(games/mines): retire l'ancienne eco (MINES_RAKE, minesStepFactor)"
```

---

## Self-Review

**1. Couverture du spec :**
- Modèle rig (M(n), P(n), survie) → Task 1 (`minesMult`/`minesSafeProb`) + test RTP. ✅
- Courbes 3/6/12 → Task 1 (`MINES_CURVES`). ✅
- Grille/sweep (`25−bombs`) → Task 1 (`minesMaxGems`) + Task 2 (sweep). ✅
- Bombe forcée + plafond start → Task 2. ✅
- Affichage bombes fin → Task 1 (`minesDisplayBombs`) + Task 2. ✅
- Retrait `maxReached` (serveur + front) → Task 2 (serveur) + Task 3 (front). ✅
- `bookCasino` inchangé → Task 2 (bombe/sweep/cashout). ✅
- Multiplicateur affiché = `pot/mise` → déjà en place (inchangé), consommé tel quel. ✅
- Validation `bombs ∈ {3,6,12}` → Task 2 (start). ✅
- Tests : unitaires + simulation RTP + solvabilité → Task 1 (unit+RTP) ; solvabilité couverte par la bombe forcée (vérif manuelle §Tests du spec ; pas de test auto dédié — la logique force-bomb est en Task 2 et inspectable). ✅
- Retrait ancienne éco → Task 4. ✅

**2. Placeholders :** aucun « TODO/à compléter » ; tout le code est fourni.

**3. Cohérence des types/noms :** `minesMult(bombs,gems)`, `minesSafeProb(bombs,pick)`, `minesMaxGems(bombs)`, `minesDisplayBombs(revealedGems,bombs,fatal)` identiques entre Task 1 (définition/tests) et Task 2 (appels `G.*`). `MinesState` (Task 2) sans `bombSet`/`picks`/`maxReached`, champs `revealed:Set<number>`/`gems`/`mult` cohérents avec les handlers. Réponses JSON (`result`, `pot`, `gain`, `bombs`, `cashedOut`) cohérentes avec le front (Task 3, inchangé).
