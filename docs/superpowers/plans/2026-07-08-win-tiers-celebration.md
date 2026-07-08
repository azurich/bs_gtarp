# Paliers de gain & écran de célébration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre le feedback de gain en `Win → Big Win → Mega Win → Jackpot` avec un écran de célébration persistant dont le montant compte de 0 au gain final.

**Architecture:** Le serveur ajoute un booléen `top` (gain maximal atteint) aux réponses des jeux à multiplicateur. Une fonction pure front `Tiers.pickTier(gain, bet, isTop)` décide le palier. `gameResult()` déclenche un overlay count-up persistant pour Big/Mega/Jackpot.

**Tech Stack:** Bun + ElysiaJS + bun:sqlite (backend `src/`), JS vanilla + Canvas (front `public/`), tests `bun test`.

## Global Constraints

- **RTP inchangé (0.70)**, modèle cagnotte inchangé, mécanique du jackpot admin inchangée (on n'améliore que sa *présentation*).
- **Jackpot indiscernable** : le palier `jackpot` est déclenché par le `top` du jeu (n'importe quel joueur peut l'atteindre), jamais par une info admin.
- Seuils : `BIG_MULT = 5`, `MEGA_MULT = 10`, `JACKPOT_MIN_MULT = 10` (`mult = gain / mise`).
- Ordre : `lose` (gain≤0) → `partial` (gain<mise) → `push` (gain=mise) → `jackpot` (isTop ET mult≥10) → `mega-win` (mult>10) → `big-win` (mult>5) → `win`.
- Blackjack : pas de champ `top` → toujours `win` au maximum. Paliers de perte (`lose`/`partial`/`push`) inchangés.
- Le champ `top` est **additif** (défaut `false`/absent), ne casse aucune réponse existante.
- Tests via `bun test` (aucun script `test` dans package.json).

---

### Task 1: `games.ts` — helpers `top` (purs) + tests

**Files:**
- Modify: `src/games.ts` (ajout après `diceMult`, ~ligne 320)
- Test: `tests/top-mult.test.ts` (créer)

**Interfaces:**
- Consumes : constantes existantes `WHEEL`, `PK_MULT`, `slotsJackpotMults()`, `minesMaxGems()` (déjà dans games.ts).
- Produces : `slotsIsTop(mult)`, `wheelIsTop(risk, mult)`, `plinkoIsTop(risk, mult)`, `diceIsTop(chance, won)`, `minesIsTop(bombs, gems)` — tous `=> boolean`, purs.

- [ ] **Step 1: Écrire le test (échoue : fonctions absentes)**

Créer `tests/top-mult.test.ts` :
```ts
import { test, expect } from 'bun:test'
import { slotsIsTop, wheelIsTop, plinkoIsTop, diceIsTop, minesIsTop, PK_MULT } from '../src/games.ts'

test('slots : trois 7️⃣ (×20) = top', () => {
  expect(slotsIsTop(20)).toBe(true)
  expect(slotsIsTop(8)).toBe(false)
})
test('roue high : top segment ×50 = top', () => {
  expect(wheelIsTop('high', 50)).toBe(true)
  expect(wheelIsTop('high', 5)).toBe(false)
  expect(wheelIsTop('high', 0)).toBe(false)
})
test('plinko high : top bin = top, centre = non', () => {
  const top = Math.max(...PK_MULT.high)
  expect(plinkoIsTop('high', top)).toBe(true)
  expect(plinkoIsTop('high', PK_MULT.high[6])).toBe(false) // centre (0)
})
test('dé : gain à chance ≤ 3 = top', () => {
  expect(diceIsTop(2, true)).toBe(true)
  expect(diceIsTop(3, true)).toBe(true)
  expect(diceIsTop(50, true)).toBe(false)
  expect(diceIsTop(2, false)).toBe(false)
})
test('démineur : full-clear = top', () => {
  expect(minesIsTop(3, 22)).toBe(true)   // minesMaxGems(3)=22
  expect(minesIsTop(3, 10)).toBe(false)
  expect(minesIsTop(12, 13)).toBe(true)  // minesMaxGems(12)=13
})
```

- [ ] **Step 2: Lancer le test → échec**

Run: `bun test tests/top-mult.test.ts`
Expected: FAIL (`slotsIsTop is not a function` / import manquant).

- [ ] **Step 3: Implémenter les helpers dans `src/games.ts`**

Ajouter juste après la fonction `diceMult` (~ligne 320) :
```ts
/* ── Palier "top" : le résultat a-t-il atteint le gain MAXIMAL du jeu ? ──
   Sert au palier JACKPOT (présentation). Purs & testables. */
export function slotsIsTop(mult: number): boolean {
  return mult === Math.max(...slotsJackpotMults())      // 20 (trois 7️⃣)
}
export function wheelIsTop(risk: string, mult: number): boolean {
  const seg = WHEEL[risk as keyof typeof WHEEL] ?? WHEEL.med
  return mult > 0 && mult === Math.max(...seg)
}
export function plinkoIsTop(risk: string, mult: number): boolean {
  const arr = PK_MULT[risk] ?? PK_MULT.med
  return mult > 0 && mult === Math.max(...arr)
}
export function diceIsTop(chance: number, won: boolean): boolean {
  return won && chance <= 3
}
export function minesIsTop(bombs: number, gems: number): boolean {
  return gems >= minesMaxGems(bombs)
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `bun test tests/top-mult.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Non-régression complète**

Run: `bun test`
Expected: tous les tests passent (les 39 existants + 5 nouveaux).

- [ ] **Step 6: Commit**

```bash
git add src/games.ts tests/top-mult.test.ts
git commit -m "feat(games): helpers top-multiplicateur par jeu (slots/roue/plinko/dé/démineur)"
```

---

### Task 2: `server.ts` — champ `top` dans les réponses des jeux + `jackpotResolve`

**Files:**
- Modify: `src/server.ts` (routes slots/plinko/wheel/dice/mines + `jackpotResolve` ~ligne 173)

**Interfaces:**
- Consumes : helpers de Task 1 (`G.slotsIsTop`, `G.wheelIsTop`, `G.plinkoIsTop`, `G.diceIsTop`, `G.minesIsTop`).
- Produces : chaque réponse de jeu à multiplicateur contient `top: boolean`. Signature `jackpotResolve(u, bet, gameKey, mults, forcer, isTop, set)`.

- [ ] **Step 1: `jackpotResolve` — ajouter le paramètre `isTop` et le champ `top`**

Dans `src/server.ts`, la signature (~ligne 173) devient :
```ts
function jackpotResolve(
  u: User, bet: number, gameKey: string, mults: number[],
  forcer: (m: number) => Record<string, unknown> & { gain: number },
  isTop: (m: number) => boolean,
  set: { status?: number },
): object | null {
```
Et la ligne de retour finale de la fonction :
```ts
  return { ...r, top: isTop(m), ...userSnapshot(u.id) }
```
(le reste de la fonction inchangé.)

- [ ] **Step 2: Mettre à jour les 4 appels à `jackpotResolve` + les 4 retours de route**

Slots (~ligne 536 et 543) :
```ts
        const jr = jackpotResolve(u, bet, 'slots', G.slotsJackpotMults(), m => G.slotsJackpot(bet, m), m => G.slotsIsTop(m), set)
```
```ts
      return { reels: r.reels, gain: r.gain, top: G.slotsIsTop(r.mult), ...userSnapshot(u.id) }
```

Plinko (~ligne 553 et 560) :
```ts
        const jr = jackpotResolve(u, bet, 'plinko', G.plinkoMults(risk), m => G.plinkoJackpot(bet, risk, m), m => G.plinkoIsTop(risk, m), set)
```
```ts
      return { bin: r.bin, mult: r.mult, gain: r.gain, top: G.plinkoIsTop(risk, r.mult), ...userSnapshot(u.id) }
```

Wheel (~ligne 570 et 577) :
```ts
        const jr = jackpotResolve(u, bet, 'wheel', G.wheelMults(risk), m => G.wheelJackpot(bet, risk, m), m => G.wheelIsTop(risk, m), set)
```
```ts
      return { index: r.index, mult: r.mult, gain: r.gain, top: G.wheelIsTop(risk, r.mult), ...userSnapshot(u.id) }
```

Dice (~ligne 588 et 595) :
```ts
        const jr = jackpotResolve(u, bet, 'dice', dm > 1 ? [dm] : [], m => ({ roll: +(Math.random() * chance).toFixed(2), win: true, mult: m, gain: Math.round(bet * m) }), () => G.diceIsTop(chance, true), set)
```
```ts
      return { roll: r.roll, win: r.win, mult: r.mult, gain: r.gain, top: G.diceIsTop(chance, r.win), ...userSnapshot(u.id) }
```

- [ ] **Step 3: Démineur — `top` sur sweep (pick) et cashout**

Retour sweep dans `/api/mines/pick` (~ligne 688) :
```ts
        return { result: 'gem', i, pot, cashedOut: true, gain: pot, top: true, bombs: G.minesDisplayBombs(st.revealed, st.bombs, -1), ...userSnapshot(u.id) }
```
Retour de `/api/mines/cashout` (~ligne 702) :
```ts
      return { gain, top: G.minesIsTop(st.bombs, st.gems), bombs: G.minesDisplayBombs(st.revealed, st.bombs, -1), ...userSnapshot(u.id) }
```
(La réponse `bomb` — perte — n'a pas de `top`, c'est voulu.)

- [ ] **Step 4: Vérifier la compilation + non-régression**

Run: `bun build src/server.ts --target bun --outdir /tmp/bsbuild && bun test`
Expected: build OK, tous les tests passent (aucun test ne dépend encore de `top` côté serveur — la vérif est la compilation + non-régression).

- [ ] **Step 5: Vérifier que les 6 retours portent bien `top`**

Run: `grep -n "top:" src/server.ts`
Expected: au moins 6 occurrences — slots, plinko, wheel, dice (retours normaux), mines sweep (`top: true`), mines cashout (`top: G.minesIsTop(...)`), plus la ligne `top: isTop(m)` de `jackpotResolve`.

- [ ] **Step 6: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): champ top dans les réponses jeux + jackpotResolve"
```

---

### Task 3: `core/tiers.js` — `pickTier(gain, bet, isTop)` + réécriture des tests

**Files:**
- Modify: `public/core/tiers.js` (réécriture de la fonction pure)
- Test: `tests/tiers.test.ts` (réécriture complète)

**Interfaces:**
- Produces : `Tiers.pickTier(gain, bet, isTop) => 'lose'|'partial'|'push'|'win'|'big-win'|'mega-win'|'jackpot'` ; constantes exportées `BIG_MULT`, `MEGA_MULT`, `JACKPOT_MIN_MULT`.

- [ ] **Step 1: Réécrire le test (échoue : anciens paliers)**

Remplacer tout `tests/tiers.test.ts` par :
```ts
import { test, expect } from 'bun:test'
import { pickTier } from '../public/core/tiers.js'

test('perte totale → lose', () => { expect(pickTier(0, 100)).toBe('lose') })
test('mise nulle/invalide → lose', () => { expect(pickTier(50, 0)).toBe('lose') })
test('gain < mise → partial', () => { expect(pickTier(50, 100)).toBe('partial') })
test('gain = mise → push', () => { expect(pickTier(100, 100)).toBe('push') })
test('×1..×5 inclus → win', () => {
  expect(pickTier(150, 100)).toBe('win')
  expect(pickTier(500, 100)).toBe('win')   // ×5 exact
})
test('×5 < mult ≤ ×10 → big-win', () => {
  expect(pickTier(501, 100)).toBe('big-win')
  expect(pickTier(1000, 100)).toBe('big-win')  // ×10 exact
})
test('mult > ×10 sans top → mega-win', () => {
  expect(pickTier(1500, 100)).toBe('mega-win')
  expect(pickTier(2000, 100)).toBe('mega-win')
})
test('top + mult ≥ ×10 → jackpot', () => {
  expect(pickTier(2000, 100, true)).toBe('jackpot')  // ×20 top
})
test('jackpot prime sur mega', () => {
  expect(pickTier(5000, 100, true)).toBe('jackpot')  // ×50 top
})
test('top mais mult < gate → pas jackpot (win)', () => {
  expect(pickTier(250, 100, true)).toBe('win')   // ×2.5 top (blackjack)
})
test('isTop absent (défaut) → jamais jackpot', () => {
  expect(pickTier(2000, 100)).toBe('mega-win')
})
```

- [ ] **Step 2: Lancer le test → échec**

Run: `bun test tests/tiers.test.ts`
Expected: FAIL (retourne encore `win-s`/`win-mega`).

- [ ] **Step 3: Réécrire `public/core/tiers.js`**

Remplacer tout le fichier par :
```js
/* BlackState — paliers de résultat (logique pure, sans DOM).
   Décide le palier à partir du résultat NET (gain vs mise) et du flag `top`
   (le gain a-t-il atteint le multiplicateur maximal du jeu ?). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tiers = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var BIG_MULT = 5, MEGA_MULT = 10, JACKPOT_MIN_MULT = 10;
  function pickTier(gain, bet, isTop) {
    if (!(bet > 0)) return 'lose';
    if (gain <= 0)    return 'lose';
    if (gain < bet)   return 'partial';
    if (gain === bet) return 'push';
    var mult = gain / bet;
    if (isTop && mult >= JACKPOT_MIN_MULT) return 'jackpot';
    if (mult > MEGA_MULT) return 'mega-win';
    if (mult > BIG_MULT)  return 'big-win';
    return 'win';
  }
  return {
    pickTier: pickTier,
    BIG_MULT: BIG_MULT, MEGA_MULT: MEGA_MULT, JACKPOT_MIN_MULT: JACKPOT_MIN_MULT,
  };
});
```

- [ ] **Step 4: Lancer le test → succès**

Run: `bun test tests/tiers.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add public/core/tiers.js tests/tiers.test.ts
git commit -m "feat(tiers): pickTier Win/Big/Mega/Jackpot avec flag top"
```

---

### Task 4: `casino.html` + `casino.css` — markup overlay + styles paliers + renommage FX

**Files:**
- Modify: `public/casino.html` (bloc `#winOverlay`, ~lignes 458-462)
- Modify: `public/casino.css` (FX machine ~818-826, styles overlay)

**Interfaces:**
- Produces : DOM `#winOverlay[data-tier]`, `#winLabel`, `#winAmount`, `#winMult`, bouton Continuer ; classes machine `fx-win/fx-big-win/fx-mega-win/fx-jackpot` ; styles `[data-tier="mega-win"|"jackpot"]`. Consommé par Task 5.

- [ ] **Step 1: Remanier le bloc `#winOverlay` dans `casino.html`**

Remplacer (lignes ~458-462) :
```html
  <!-- WIN OVERLAY -->
  <div id="winOverlay" class="win-overlay hidden" onclick="this.classList.add('hidden')">
    <canvas id="confettiCanvas" class="confetti-cvs"></canvas>
    <div id="winLabel" class="win-label"></div>
  </div>
```
par :
```html
  <!-- WIN OVERLAY (célébration persistante) -->
  <div id="winOverlay" class="win-overlay hidden" data-tier="" onclick="hideWinOverlay()">
    <canvas id="confettiCanvas" class="confetti-cvs"></canvas>
    <div class="win-card">
      <div id="winLabel" class="win-label"></div>
      <div class="win-amount"><span class="win-plus">+</span><span id="winAmount">0</span></div>
      <div id="winMult" class="win-mult"></div>
      <button type="button" class="btn win-continue">Continuer</button>
    </div>
  </div>
```
(Clic n'importe où sur l'overlay ou sur Continuer → `hideWinOverlay()` par bubbling.)

- [ ] **Step 2: Renommer les classes FX machine dans `casino.css`**

Remplacer les lignes ~818-821 :
```css
.machine.fx-win-s::before{animation:fxGlow .7s var(--ease-out)}
.machine.fx-win-m{animation:fxPulse .5s var(--ease-out) 2}
.machine.fx-win-m::before{animation:fxGlow .7s var(--ease-out)}
.machine.fx-win-big::before,.machine.fx-win-mega::before{animation:fxGlow .7s var(--ease-out) 3}
```
par :
```css
.machine.fx-win::before{animation:fxGlow .7s var(--ease-out)}
.machine.fx-big-win::before,.machine.fx-mega-win::before,.machine.fx-jackpot::before{animation:fxGlow .7s var(--ease-out) 3}
```

- [ ] **Step 3: Remplacer le bloc overlay BIG/MEGA (~824-826) par les styles de célébration**

Remplacer :
```css
/* Overlay BIG/MEGA redessiné (violet sobre) */
.win-label{color:#fff;text-shadow:0 0 24px var(--accent-glow),0 2px 0 rgba(0,0,0,.4)}
.win-overlay.mega .win-label{font-size:clamp(2.6rem,10vw,6.5rem);
  background:linear-gradient(180deg,#fff, var(--accent-2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
```
par :
```css
/* Célébration : carte centrale + montant count-up, escalade par palier */
.win-label{color:#fff;text-shadow:0 0 24px var(--accent-glow),0 2px 0 rgba(0,0,0,.4)}
.win-card{
  position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:14px;
  text-align:center;padding:0 20px;animation:winpop .5s var(--ease-back);
}
.win-amount{
  font-family:var(--num);font-variant-numeric:tabular-nums;font-weight:800;line-height:1;
  font-size:clamp(3rem,14vw,8rem);color:#fff;
  text-shadow:0 0 34px var(--accent-glow),0 4px 0 rgba(0,0,0,.35);
}
.win-plus{opacity:.85;margin-right:.05em}
.win-mult{font-family:var(--num);font-weight:700;letter-spacing:.04em;
  font-size:clamp(1rem,4vw,1.8rem);color:var(--accent-2)}
.win-continue{pointer-events:auto;min-width:180px}
/* Mega : label plus imposant */
.win-overlay[data-tier="mega-win"] .win-label{font-size:clamp(2.6rem,10vw,6.5rem)}
/* Jackpot : or + pulse écran */
.win-overlay[data-tier="jackpot"]{animation:overlayIn .3s var(--ease-out), jackpotPulse 1.1s ease-in-out infinite}
.win-overlay[data-tier="jackpot"] .win-label,
.win-overlay[data-tier="jackpot"] .win-amount{
  background:linear-gradient(180deg,#fff8dc,#f4c430 55%,#b8860b);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
  filter:drop-shadow(0 0 26px rgba(244,196,48,.6));
}
.win-overlay[data-tier="jackpot"] .win-mult{color:#f4c430}
@keyframes jackpotPulse{0%,100%{background:rgba(5,5,12,.6)}50%{background:rgba(30,20,0,.72)}}
```

- [ ] **Step 4: Vérifier qu'aucune ancienne classe FX ne subsiste**

Run: `grep -rn "fx-win-s\|fx-win-m\|fx-win-big\|fx-win-mega\|win-overlay.mega\|\.mega " public/casino.css public/casino.js`
Expected: aucun résultat dans `casino.css` (les usages `casino.js` sont traités en Task 5).

- [ ] **Step 5: Commit**

```bash
git add public/casino.html public/casino.css
git commit -m "feat(casino): markup overlay célébration + styles paliers + renommage FX"
```

---

### Task 5: `casino.js` — `gameResult` + overlay count-up + propagation `top`

**Files:**
- Modify: `public/casino.js` (`FX`/`gameResult` ~124-144, `launchConfetti` ~86-121, 7 appels `gameResult`)

**Interfaces:**
- Consumes : `Tiers.pickTier` (Task 3), DOM `#winOverlay`/`#winLabel`/`#winAmount`/`#winMult` (Task 4), champ `d.top` (Task 2), helper existant `countUp`.
- Produces : `showWinOverlay(tier, gain, mult)`, `hideWinOverlay()`, `launchConfetti(palette, count)` (signature changée), `gameResult({..., top})`.

- [ ] **Step 1: Réécrire le bloc confettis/overlay (`casino.js` ~86-121)**

Remplacer toute la section `/* ── Confettis ── */` (de `let _confAF = null;` jusqu'à la fin de `launchConfetti`, lignes ~87-121) par :
```js
/* ── Écran de célébration (persistant) + confettis ────────── */
const WIN_LABELS = { 'big-win': 'BIG WIN', 'mega-win': 'MEGA WIN', 'jackpot': 'JACKPOT' };
const CONF_COLORS = {
  gold:   ['#fff8dc', '#f4c430', '#ffd700', '#b8860b', '#ffffff'],
  violet: ['#7c3aed', '#a855f7', '#c9a3ff', '#e9d5ff', '#c4b5fd', '#ffffff'],
};
let _confAF = null;
function showWinOverlay(tier, gain, mult) {
  const ov = $('winOverlay'); if (!ov) return;
  ov.dataset.tier = tier;
  $('winLabel').textContent = WIN_LABELS[tier] || 'WIN';
  $('winMult').textContent = '×' + mult.toFixed(2);
  const amt = $('winAmount'); if (amt) amt.textContent = '0';
  ov.classList.remove('hidden');
  if (amt) countUp(amt, Math.round(gain), 1200);
  launchConfetti(tier === 'jackpot' ? 'gold' : 'violet', tier === 'jackpot' ? 220 : 160);
}
function hideWinOverlay() {
  const ov = $('winOverlay'); if (!ov) return;
  ov.classList.add('hidden'); ov.dataset.tier = '';
  if (_confAF) { cancelAnimationFrame(_confAF); _confAF = null; }
}
function launchConfetti(palette, count) {
  const cvs = $('confettiCanvas'); if (!cvs) return;
  const ctx = cvs.getContext('2d');
  cvs.width = innerWidth; cvs.height = innerHeight;
  const COLORS = CONF_COLORS[palette] || CONF_COLORS.violet;
  const pts = Array.from({ length: count }, () => ({
    x: Math.random() * cvs.width, y: -20 - Math.random() * cvs.height * 0.6,
    w: 6 + Math.random() * 10, h: 3 + Math.random() * 5,
    vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 5,
    rot: Math.random() * 360, rv: (Math.random() - 0.5) * 8,
    color: COLORS[Math.random() * COLORS.length | 0], alpha: 1,
  }));
  let frames = 0;
  function frame() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    let alive = false;
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy + frames * 0.02; p.rot += p.rv; p.vy += 0.04;
      p.alpha = Math.max(0, 1 - (p.y / (cvs.height * 1.1)));
      if (p.y < cvs.height + 20) alive = true;
      ctx.save(); ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frames++;
    if (alive && frames < 240) _confAF = requestAnimationFrame(frame);
    else { _confAF = null; ctx.clearRect(0, 0, cvs.width, cvs.height); }  // confettis finis, overlay RESTE
  }
  if (_confAF) cancelAnimationFrame(_confAF);
  _confAF = requestAnimationFrame(frame);
}
```

- [ ] **Step 2: Réécrire `FX` + `gameResult` (`casino.js` ~124-144)**

Remplacer :
```js
const FX = ['fx-lose','fx-partial','fx-win-s','fx-win-m','fx-win-big','fx-win-mega'];
function gameResult({ machine, bet, gain, balance, xp, level, push }) {
  const key = push ? 'push' : (window.Tiers ? Tiers.pickTier(gain, bet) : 'lose');
```
… (tout le corps jusqu'à la fin de `gameResult`) par :
```js
const FX = ['fx-lose','fx-partial','fx-win','fx-big-win','fx-mega-win','fx-jackpot'];
function gameResult({ machine, bet, gain, balance, xp, level, push, top }) {
  const key = push ? 'push' : (window.Tiers ? Tiers.pickTier(gain, bet, !!top) : 'lose');
  const isWin = key === 'win' || key === 'big-win' || key === 'mega-win' || key === 'jackpot';
  setBalance(balance, key === 'push' ? undefined : isWin, xp, level);
  if (machine) {
    const res = machine.querySelector('.machine-result');
    if (res) {
      if (isWin)                  { res.dataset.state = 'win';     res.textContent = '+' + fmt(gain) + ' · ×' + (gain / bet).toFixed(2); }
      else if (key === 'partial') { res.dataset.state = 'lose';    res.textContent = '−' + fmt(bet - gain); }
      else if (key === 'push')    { res.dataset.state = 'neutral'; res.textContent = 'Mise rendue'; }
      else                        { res.dataset.state = 'lose';    res.textContent = 'Perdu'; }
    }
    machine.classList.remove(...FX);
    void machine.offsetWidth;
    if (key !== 'push') machine.classList.add('fx-' + key);
  }
  if (key === 'big-win' || key === 'mega-win' || key === 'jackpot') {
    showWinOverlay(key, gain, gain / bet);
  } else if (key === 'win') {
    toast('+' + fmt(gain), 1800, 'success');
  }
}
```

- [ ] **Step 3: Propager `top: d.top` aux 6 appels gagnants de `gameResult`**

Ajouter `, top: d.top` avant la `}` de fermeture des objets passés à `gameResult` dans :
- Slots (~ligne 384) : `gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level, top: d.top });`
- Démineur sweep via pick (~ligne 469) : `gameResult({ machine, bet: minesCurrentBet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level, top: d.top });`
- Démineur cashout (~ligne 480) : `gameResult({ machine, bet: minesCurrentBet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level, top: d.top });`
- Plinko (~ligne 586) : `gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level, top: d.top });`
- Roue (~ligne 638) : `gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level, top: d.top });`
- Dé (~ligne 664) : `gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level, top: d.top });`

Ne PAS toucher :
- Démineur bombe (~ligne 458, `gain: 0` — perte, pas de `top`).
- Blackjack (~ligne 408, pas de champ `top` — reste au palier `win` au max).

- [ ] **Step 4: Vérifier qu'aucune ancienne référence FX/label ne subsiste**

Run: `grep -n "fx-win-s\|fx-win-m\|fx-win-big\|fx-win-mega\|winLabel\|\.mega\|launchConfetti(" public/casino.js`
Expected: seules les occurrences attendues restent — `launchConfetti(` dans `showWinOverlay` (nouvelle signature) ; aucune ancienne classe FX ; `$('winLabel')` uniquement dans `showWinOverlay`. Aucun appel `launchConfetti('BIG WIN…')` ni `ov.classList.add('mega')`.

- [ ] **Step 5: Sanity syntaxe (le fichier parse)**

Run: `bun build public/casino.js --outdir /tmp/bscasino`
Expected: build OK (pas d'erreur de syntaxe). *(Le fichier référence des globals DOM ; on ne valide que le parsing.)*

- [ ] **Step 6: Non-régression tests**

Run: `bun test`
Expected: tous les tests passent.

- [ ] **Step 7: Commit**

```bash
git add public/casino.js
git commit -m "feat(casino): overlay count-up persistant + paliers Win/Big/Mega/Jackpot"
```

---

## Vérification manuelle finale (après les 5 tasks)

Redémarrer `bun run dev`, se connecter avec un compte **non-admin**, aller au Casino :
1. **Slots** : jouer jusqu'à trois 7️⃣ (×20) → écran **JACKPOT** doré, montant qui monte de 0, reste jusqu'à Continuer. Trois 💎 (×8) → **BIG WIN**. Petit gain (×2/×3) → pas d'overlay, juste toast + glow.
2. **Démineur** : full-clear → **JACKPOT** ; cashout modeste → Win/Big selon mult.
3. **Roue high** / **Plinko high** : top segment/bin → Jackpot ; mults intermédiaires → Mega/Big.
4. **Dé** à chance ≤ 3 gagnant → Jackpot.
5. **Blackjack** : main gagnante / blackjack → **WIN** léger, pas d'écran bloquant.
6. **Admin** : armer un jackpot (petite mise ensuite) → l'écran Jackpot s'affiche côté joueur **sans aucun indice admin**.

## Self-Review (couverture spec)

- Paliers Win/Big/Mega/Jackpot + seuils 5/10/10 → Task 3. ✅
- Jackpot = top mult du jeu, flag serveur → Tasks 1-2. ✅
- Overlay count-up persistant, clic/Continuer → Tasks 4-5. ✅
- Escalade visuelle (violet → intense → or) → Task 4. ✅
- Win léger sans overlay ; lose/partial/push inchangés → Task 5. ✅
- Jackpot admin indiscernable (même chemin de réponse) → Task 2 (`jackpotResolve` renvoie `top`). ✅
- Blackjack plafonné → pas de `top` → Task 2/5. ✅
- Types cohérents : `pickTier(gain, bet, isTop)` et clés `big-win/mega-win/jackpot` identiques entre tiers.js, gameResult, CSS `[data-tier]`, `WIN_LABELS`. ✅
