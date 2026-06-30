# Réactivation Blackjack & Démineur — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre Blackjack et Démineur jouables, intégrés à la cagnotte selon « empêcher l'impayable » (BJ mise plafonnée à budget/2,2 ; Mines montée bloquée quand la case suivante dépasserait le budget), UI déverrouillée, résultats branchés sur `gameResult`.

**Architecture:** Backend : retrait des 503, helpers purs testés (`bjMaxBet`, `minesStepFactor`), bridage budget par jeu, `bookCasino` à la résolution. Frontend : déverrouillage (nav/accueil/voile/`switchTab`) + bascule des résultats BJ/Mines sur `gameResult`.

**Tech Stack:** Bun (`bun test`), TypeScript (`games.ts`/`server.ts`), vanilla JS/HTML (front). **Backend modifié → redémarrer le serveur.** Front statique → F5.

## Global Constraints

- **Empêcher l'impayable** (pas de gain rogné) : **BJ** mise max = `floor(budget / BJ_BJ_MULT)` (BJ_BJ_MULT=2,2), refus serveur au-delà. **Mines** : la case dont le multiplicateur suivant donnerait `bet × nextMult > budget` est bloquée — **serveur (refus du pick) + UI**.
- `budget = casinoBudget()` = `0.30 × max(0, W − P)`, **recalculé à chaque pas**.
- **`bookCasino(bet, gain)` à la résolution** : BJ → `(bet, gain)` (win), `(bet, bet)` (push), `(bet, 0)` (lose) ; Mines → `(bet, gain)` à l'encaisse/sweep, `(bet, 0)` à la bombe.
- **RTP inchangé** : `BJ_BIAS`=36, `MINES_RAKE`=0,11 conservés. Modèle cagnotte inchangé.
- **`gameResult`** : router les résultats finaux BJ/Mines via `gameResult({ machine, bet, gain, balance, xp, level, push })` (push pour l'égalité BJ). Retirer `#bjMsg`/`#minesMsg`/`checkBigWin`/`flashBal` de ces flux ; remplacer par un indicateur `.machine-result`.
- **Charte VIOLET** : pas de doré/`rgba(91,33,182,…)` codé en dur nouveau ; pas d'emoji rendu. Habillage `.machine` déjà fait (ne pas refondre).
- **Commits** : trailers standard du repo :
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ
  ```

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `games.ts` | Helpers purs `bjMaxBet`, `minesStepFactor` | Modifier (+ exports) |
| `tests/cagnotte-stateful.test.ts` | Tests des helpers | **Créer** |
| `server.ts` | Routes BJ/Mines (retrait 503, bridage budget, `bookCasino`), `userSnapshot` budget, `GET /api/budget` | Modifier (≈ L.122-202, 518-609) |
| `public/casino.html` | Déverrouiller nav/accueil/vues + `.machine-result` BJ/Mines | Modifier |
| `public/casino.js` | Retrait garde `switchTab`, BJ→`gameResult`+mise max, Mines→`gameResult`+maxReached | Modifier |

---

### Task 1 : Backend — bridage cagnotte BJ/Mines + helpers testés (TDD)

**Files:**
- Create: `tests/cagnotte-stateful.test.ts`
- Modify: `games.ts`
- Modify: `server.ts` (≈ L.122-124, 183-202, 518-609)

**Interfaces:**
- Produces (`games.ts`) :
  - `bjMaxBet(budget: number): number` = `Math.floor(budget / BJ_BJ_MULT)`.
  - `minesStepFactor(picks: number, bombs: number): number` = `((25 − picks) / ((25 − bombs) − picks)) × (1 − MINES_RAKE)`.
- Le serveur renvoie désormais `budget` dans `userSnapshot`, expose `GET /api/budget`, refuse les mises BJ trop hautes et les picks Mines en état `maxReached`.

- [ ] **Step 1 : Écrire le test qui échoue**

Create `tests/cagnotte-stateful.test.ts` :

```ts
import { test, expect } from 'bun:test'
import { bjMaxBet, minesStepFactor, BJ_BJ_MULT, MINES_RAKE } from '../games.ts'

test('bjMaxBet = floor(budget / 2.2)', () => {
  expect(BJ_BJ_MULT).toBe(2.2)
  expect(bjMaxBet(2200)).toBe(1000)
  expect(bjMaxBet(0)).toBe(0)
  expect(bjMaxBet(100)).toBe(45)      // 100/2.2 = 45.45 -> 45
})

test('minesStepFactor — 1re case (3 bombes) = (25/22)*(1-rake)', () => {
  expect(MINES_RAKE).toBe(0.11)
  const f = minesStepFactor(0, 3)     // (25/22) * 0.89
  expect(f).toBeCloseTo((25 / 22) * 0.89, 6)
  expect(f).toBeGreaterThan(1)        // 1er pas paie (>1)
})

test('minesStepFactor croît avec les picks (cases sûres plus rares)', () => {
  expect(minesStepFactor(5, 3)).toBeGreaterThan(minesStepFactor(0, 3))
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `bun test tests/cagnotte-stateful.test.ts`
Expected: FAIL — `bjMaxBet`/`minesStepFactor` non exportés par `games.ts`.

- [ ] **Step 3 : Ajouter les helpers dans games.ts**

Modify `games.ts` — ajouter (près des constantes BJ/Mines, après `export const MINES_RAKE = 0.11`) :

```ts
// Plafond de mise Blackjack imposé par la cagnotte (gain max d'une main = mise × BJ_BJ_MULT)
export function bjMaxBet(budget: number): number {
  return Math.floor(budget / BJ_BJ_MULT)
}
// Facteur de multiplicateur d'une case sûre du Démineur (picks déjà révélés, bombs placées)
export function minesStepFactor(picks: number, bombs: number): number {
  const safe = 25 - bombs
  return ((25 - picks) / (safe - picks)) * (1 - MINES_RAKE)
}
```

(`BJ_BJ_MULT` et `MINES_RAKE` sont déjà exportés.)

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `bun test tests/cagnotte-stateful.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5 : Brancher le budget dans `userSnapshot` + endpoint**

Modify `server.ts` — `userSnapshot` (≈ L.122-124) :

```ts
function userSnapshot(id: number) {
  const u = Q.userById.get(id) as User
  return { balance: Math.floor(u.credit), xp: u.xp ?? 0, level: u.level ?? 1, budget: Math.floor(casinoBudget()) }
}
```

Ajouter une route de lecture du budget (dans le bloc authentifié `withAuth`, à côté de `/api/config`) :

```ts
    .get('/api/budget', () => ({ budget: Math.floor(casinoBudget()) }))
```

- [ ] **Step 6 : Blackjack — retrait 503, mise plafonnée, `bookCasino`**

Modify `server.ts` — `/api/bj/deal` (≈ L.518-536) : **supprimer** la ligne `set.status = 503; return {...}`, et après `if (!bet) {...}` ajouter le plafond :

```ts
      const max = G.bjMaxBet(casinoBudget())
      if (bet > max) { set.status = 400; return { error: 'Mise max actuelle : ' + max + ' (cagnotte)' } }
```

Modify `server.ts` — `bjResolve` (≈ L.193-201) : après le bloc `if/else` qui calcule `gain` et paie, **avant** `recordHistory`, ajouter la comptabilité cagnotte :

```ts
  // cagnotte : win -> (bet, gain) ; push -> (bet, bet) [mise rendue] ; lose -> (bet, 0)
  bookCasino(st.bet, outcome === 'push' ? st.bet : gain)
```

- [ ] **Step 7 : Démineur — retrait 503, montée bridée, `bookCasino`**

Modify `server.ts` — `/api/mines/start` (≈ L.555-556) : **supprimer** la ligne `set.status = 503; return {...}`.

Modify `server.ts` — `/api/mines/pick` (≈ L.573-598) :
1. Tout en haut du handler, après la garde `if (!st || !st.live) {...}`, refuser si déjà au max :
   ```ts
   if (st.maxReached) { set.status = 400; return { error: 'Max atteint — encaisse' } }
   ```
2. Le pas de multiplicateur passe par le helper. Remplacer
   `st.mult *= ((25 - k) / (safe - k)) * (1 - G.MINES_RAKE)` par
   `st.mult *= G.minesStepFactor(k, st.bombs)`.
3. À la bombe (branche `if (st.bombSet.has(i))`), avant le `return`, ajouter
   `bookCasino(st.bet, 0)`.
4. Au sweep (branche `if (st.gems === safe)`), avant le `return`, ajouter
   `bookCasino(st.bet, pot)`.
5. Sur une case sûre **non-sweep**, calculer `maxReached` et le stocker/retourner :
   ```ts
   st.maxReached = st.picks < safe && st.bet * st.mult * G.minesStepFactor(st.picks, st.bombs) > casinoBudget()
   // ... dans le return de la branche 'gem' non-sweep, ajouter:  maxReached: st.maxReached
   ```
   (Le `return` final `gem` devient `return { result: 'gem', i, mult: +st.mult.toFixed(2), pot, maxReached: st.maxReached, ...userSnapshot(u.id) }`.)

Modify `server.ts` — `/api/mines/cashout` (≈ L.600-609) : avant `recordHistory`, ajouter `bookCasino(st.bet, gain)`.

Modify `server.ts` — ajouter le champ `maxReached?: boolean` à l'interface de l'état Mines (`MinesState` / le type de `activeMines`), initialisé implicitement à `undefined` (falsy) au `start`.

- [ ] **Step 8 : Redémarrer le serveur + vérifier (helpers + intégration session forgée)**

```bash
cd "C:/Users/info/Documents/DEV/Casino_Online_GTARP"
bun test tests/cagnotte-stateful.test.ts 2>&1 | tail -3      # PASS
# redemarrage (backend modifie)
powershell -Command "Get-Process -Name bun -ErrorAction SilentlyContinue | ForEach-Object { \$_.Kill() }"
(bun run server.ts &) ; sleep 2
curl -s -o /dev/null -w "casino %{http_code}\n" http://localhost:3000/casino   # 200
# Integration : forger une session pour le user de test 'loc' et appeler les routes
bun -e '
  import db from "./db.ts";
  const u = db.query("SELECT id FROM users WHERE username = ?").get("loc");
  if(!u){ console.log("pas de user loc"); process.exit(0); }
  const tok = "test_"+Date.now();
  db.query("INSERT INTO sessions (token,user_id,created) VALUES (?,?,?)").run(tok,u.id,Date.now());
  console.log("TOKEN="+tok);
' > /tmp/tok.txt; TOK=$(grep TOKEN /tmp/tok.txt | cut -d= -f2)
echo "deal:";  curl -s -XPOST localhost:3000/api/bj/deal   -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"bet":100}' | head -c 200; echo
echo "mines:"; curl -s -XPOST localhost:3000/api/mines/start -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"bet":100,"bombs":3}' | head -c 200; echo
echo "budget:"; curl -s localhost:3000/api/budget -H "Authorization: Bearer $TOK"; echo
```
Expected : `casino 200` ; `deal` ne renvoie PAS « indisponible » (renvoie une main BJ ou un résultat) ; `mines` renvoie `{bombs,mult,pot,...}` ; `/api/budget` renvoie `{budget:...}`. (Nettoyer la session de test après.)

Note : adapter l'`INSERT INTO sessions` aux **noms de colonnes réels** de la table `sessions` (vérifier le schéma : `bun -e "import db from './db.ts'; console.log(db.query('PRAGMA table_info(sessions)').all())"`). Si le test à session forgée est trop fragile dans l'environnement, le **minimum acceptable** reste : test unitaire des helpers PASS + grep confirmant que les `set.status = 503` sont retirés des deux routes + `bookCasino` ajouté + serveur redémarré + `/casino` 200 ; l'intégration réelle (jouer une main) est alors validée par l'utilisateur.

- [ ] **Step 9 : Commit**

```bash
git add games.ts server.ts tests/cagnotte-stateful.test.ts
git commit -m "feat(casino): reactive BJ/Mines cote serveur + bridage cagnotte (mise max BJ, montee Mines bridee, bookCasino)"
```

---

### Task 2 : Front — déverrouillage UI + Blackjack sur `gameResult`

**Files:**
- Modify: `public/casino.html` (nav L.59-63, cartes L.135-139, vues BJ L.223-258 & Mines L.267-296)
- Modify: `public/casino.js` (`switchTab` L.154, `bjFinish`/`bjDeal` L.411-427)

**Interfaces:**
- Consumes : `gameResult(...)`, `/api/bj/deal` (accepte `bet`, renvoie `budget` + `outcome/gain` à la résolution), `/api/budget`.

- [ ] **Step 1 : Déverrouiller la nav et les cartes d'accueil (HTML)**

Modify `public/casino.html` :
- Nav (L.59-63) : pour Blackjack et Démineur, retirer la classe `locked` et le `<span class="nav-soon">Bientôt</span>`. Résultat :
  ```html
            <button class="nav-item" data-v="blackjack" onclick="switchTab('blackjack')">
              <span class="ni"><i data-lucide="layers-2"></i></span><span>Blackjack</span>
            </button>
            <button class="nav-item" data-v="mines" onclick="switchTab('mines')">
              <span class="ni"><i data-lucide="bomb"></i></span><span>Démineur</span>
            </button>
  ```
- Cartes d'accueil (L.135-139) : retirer `locked` et remplacer `<div class="hg-tag hg-soon">Bientôt</div>` par une vraie accroche :
  ```html
                <div class="home-game-card anim-up" onclick="switchTab('blackjack')" data-game="blackjack" data-delay="1">
                  <div class="hg-icon"><i data-lucide="layers-2"></i></div><div class="hg-name">Blackjack</div><div class="hg-tag">Bats le croupier</div>
                </div>
                <div class="home-game-card anim-up" onclick="switchTab('mines')" data-game="mines" data-delay="2">
                  <div class="hg-icon"><i data-lucide="bomb"></i></div><div class="hg-name">Démineur</div><div class="hg-tag">Évite les bombes</div>
                </div>
  ```

- [ ] **Step 2 : Déverrouiller les vues BJ & Mines + indicateur BJ (HTML)**

Modify `public/casino.html` :
- Vue Blackjack (L.223) : `<div class="machine locked" data-game="blackjack">` → `<div class="machine" data-game="blackjack">`, et **supprimer** la ligne `<div class="machine-veil"><span class="nav-soon">Bientôt</span></div>`.
- Vue Démineur (L.267) : `<div class="machine locked" data-game="mines">` → `<div class="machine" data-game="mines">`, et **supprimer** son `<div class="machine-veil">…</div>`.
- Dans la vue Blackjack, remplacer `<div id="bjMsg" class="msg"></div>` par :
  ```html
                  <div class="machine-result" id="bjResultMsg" data-state="idle"></div>
  ```
  Et **ajouter** une ligne d'info « mise max » au-dessus de `#bjBetRow` :
  ```html
                  <div class="dice-result-cap" id="bjMaxBet" style="text-align:center"></div>
  ```
  (On laisse la vue Démineur et son `#minesMsg` tels quels — branchés en Task 3.)

- [ ] **Step 3 : Retirer le garde `switchTab` + brancher Blackjack sur `gameResult` (JS)**

Modify `public/casino.js` :
- `switchTab` (L.154) : **supprimer** la ligne
  `if (v === 'blackjack' || v === 'mines') { toast('Bientôt disponible', 2600, 'info'); return; }`.
- Réécrire `bjFinish` (L.411-418) pour router via `gameResult` :
  ```js
  function bjFinish(d) {
    $('bjActions').classList.add('hidden'); $('bjBetRow').classList.remove('hidden');
    const machine = $('view-blackjack').querySelector('.machine');
    gameResult({ machine, bet: bjCurrentBet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level, push: d.outcome === 'push' });
    bjUpdateMaxBet(d.budget);
  }
  ```
- Dans `bjDeal` (L.424), retirer `$('bjMsg').textContent = '';` (l'élément n'existe plus) et après `setBalance(...)` ajouter `bjUpdateMaxBet(d.budget);`. Ajouter aussi, en cas d'erreur de deal, l'affichage du message d'erreur via le toast existant (déjà le cas).
- Ajouter le helper d'affichage de la mise max + son rafraîchissement à l'entrée de l'onglet :
  ```js
  function bjUpdateMaxBet(budget) {
    const el = $('bjMaxBet'); if (!el) return;
    const max = Math.floor((budget || 0) / 2.2);
    el.textContent = 'Mise max (cagnotte) : ' + fmt(max);
  }
  async function bjRefreshBudget() {
    try { const r = await api('/budget'); bjUpdateMaxBet(r.budget); } catch (e) {}
  }
  ```
  Et dans `switchTab`/`_doTab`, quand on entre sur `blackjack`, appeler `bjRefreshBudget()`. (Repérer la fonction qui exécute le changement d'onglet — `_doTab(v)` — et ajouter `if (v === 'blackjack') bjRefreshBudget();`.)

- [ ] **Step 4 : Vérifier**

```bash
cd "C:/Users/info/Documents/DEV/Casino_Online_GTARP"
bun test 2>&1 | tail -3                                  # non-regression : PASS
curl -s -o /dev/null -w "casino %{http_code}\n" http://localhost:3000/casino   # 200
grep -c 'nav-soon">Bientôt' public/casino.html           # 0
grep -c 'machine-veil' public/casino.html                # 0
grep -c "v === 'blackjack' || v === 'mines'" public/casino.js   # 0
grep -c 'id="bjResultMsg"' public/casino.html            # 1
grep -c 'function bjUpdateMaxBet' public/casino.js        # 1
grep -c 'bjMsg' public/casino.html public/casino.js      # 0 (ancien message BJ retire)
```
Plus **visuel (utilisateur)** : Blackjack jouable (nav + carte sans « Bientôt »), résultat via toast/indicateur, mise max affichée et respectée (refus si trop haut). Démineur est déverrouillé mais garde son affichage actuel (branché en Task 3).

- [ ] **Step 5 : Commit**

```bash
git add public/casino.html public/casino.js
git commit -m "feat(casino/bj): deverrouillage UI BJ+Mines + Blackjack branche sur gameResult + mise max cagnotte"
```

---

### Task 3 : Front — Démineur sur `gameResult` + montée bridée (maxReached)

**Files:**
- Modify: `public/casino.html` (vue Mines : `#minesMsg` → `.machine-result`)
- Modify: `public/casino.js` (`minesPick`, `minesCashout`, `minesStartGame`, `buildMinesGrid`)

**Interfaces:**
- Consumes : `gameResult(...)`, `/api/mines/pick` (renvoie `maxReached` sur case sûre), `/api/mines/cashout`.

- [ ] **Step 1 : Indicateur Mines (HTML)**

Modify `public/casino.html` — dans la vue Démineur, remplacer `<div id="minesMsg" class="msg"></div>` par :
```html
                  <div class="machine-result" id="minesResultMsg" data-state="idle"></div>
```

- [ ] **Step 2 : Brancher Mines sur `gameResult` + gérer `maxReached` (JS)**

Modify `public/casino.js` :
- `minesStartGame` (L.439-447) : remplacer `$('minesMsg').textContent = '';` par la réinitialisation de l'indicateur :
  ```js
    { const r = $('minesResultMsg'); if (r) { r.dataset.state = 'idle'; r.textContent = ''; } }
  ```
  et `minesActive = true; minesMaxReached = false;` (ajouter le flag). Réactiver la grille (au cas où désactivée) : `$('minesGrid').classList.remove('maxed');`.
- Déclarer le flag en tête de section : `let minesActive = false, minesCurrentBet = 0, minesMaxReached = false;`.
- `minesPick` (L.448-471) — réécrire les fins de branche via `gameResult` et gérer `maxReached` :
  ```js
  async function minesPick(i) {
    if (!minesActive || minesMaxReached) return;
    const cell = minesCell(i); if (cell.classList.contains('done')) return;
    let d; try { d = await api('/mines/pick', 'POST', { i }); } catch (e) { return toast(e.message, 4000, 'error'); }
    cell.classList.add('done');
    const machine = $('view-mines').querySelector('.machine');
    if (d.result === 'bomb') {
      cell.classList.add('bomb'); cell.innerHTML = MINE_BOMB; revealBombs(d.bombs); shakeEl($('minesGrid')); minesActive = false;
      $('minesCash').classList.add('hidden'); $('minesStart').classList.remove('hidden');
      gameResult({ machine, bet: minesCurrentBet, gain: 0, balance: d.balance, xp: d.xp, level: d.level });
      return;
    }
    cell.classList.add('gem'); cell.innerHTML = MINE_GEM;
    $('minesMult').textContent = d.mult.toFixed(2) + '×'; $('minesPot').textContent = fmt(d.pot);
    $('minesGems').textContent = (+$('minesGems').textContent) + 1;
    if (d.cashedOut) {
      revealBombs(d.bombs); minesActive = false;
      $('minesCash').classList.add('hidden'); $('minesStart').classList.remove('hidden');
      gameResult({ machine, bet: minesCurrentBet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
      return;
    }
    setBalance(d.balance, undefined, d.xp, d.level);
    if (d.maxReached) {
      minesMaxReached = true;
      $('minesGrid').classList.add('maxed');
      const r = $('minesResultMsg'); if (r) { r.dataset.state = 'neutral'; r.textContent = 'Max atteint (cagnotte) — encaisse'; }
    }
  }
  ```
- `minesCashout` (L.472-480) — router via `gameResult` :
  ```js
  async function minesCashout() {
    if (!minesActive) return;
    let d; try { d = await api('/mines/cashout', 'POST'); } catch (e) { return toast(e.message, 4000, 'error'); }
    revealBombs(d.bombs); minesActive = false; minesMaxReached = false;
    $('minesCash').classList.add('hidden'); $('minesStart').classList.remove('hidden');
    const machine = $('view-mines').querySelector('.machine');
    gameResult({ machine, bet: minesCurrentBet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
  }
  ```

- [ ] **Step 3 : Style « grille verrouillée au max » (CSS)**

Modify `public/casino.css` — ajouter (près des règles `.cell`/`.mines-grid`) :
```css
.mines-grid.maxed .cell:not(.done){pointer-events:none;opacity:.5}
```

- [ ] **Step 4 : Vérifier**

```bash
cd "C:/Users/info/Documents/DEV/Casino_Online_GTARP"
bun test 2>&1 | tail -3                                  # PASS
curl -s -o /dev/null -w "casino %{http_code}\n" http://localhost:3000/casino   # 200
grep -c 'id="minesResultMsg"' public/casino.html         # 1
grep -c 'id="minesMsg"' public/casino.html public/casino.js   # 0
grep -c 'minesMaxReached' public/casino.js               # >=3
grep -c "gameResult(" public/casino.js                   # >= 6 (slots/wheel/dice/plinko/bj/mines)
```
Plus **visuel (utilisateur)** : Démineur jouable ; bombe/encaisse/sweep passent par le toast/indicateur ; quand le max cagnotte est atteint, les cases restantes se désactivent (grisées) et « Max atteint — encaisse » s'affiche ; impossible de piocher au-delà (le serveur refuse aussi).

- [ ] **Step 5 : Commit**

```bash
git add public/casino.html public/casino.js public/casino.css
git commit -m "feat(casino/mines): Demineur branche sur gameResult + montee bridee cagnotte (maxReached)"
```

---

## Notes d'exécution

- **Task 1 = backend** → redémarrer le serveur avant les tests d'intégration. **Tasks 2-3 = front** → F5.
- Les **tests unitaires** ne couvrent que les helpers purs (`bjMaxBet`, `minesStepFactor`) ; le reste (routes stateful, UI) est vérifié par intégration (session forgée) + acceptation visuelle utilisateur.
- Ordre : Task 1 (serveur) → Task 2 (déverrouillage + BJ) → Task 3 (Mines). Entre Task 2 et 3, le Démineur est déverrouillé mais garde son affichage `#minesMsg` (fonctionnel) jusqu'à sa bascule `gameResult`.
