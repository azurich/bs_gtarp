# Refonte des machines du casino — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la couche présentation des 6 machines du casino (DA feutre & néon, effets gradués, toasts cohérents, icônes unifiées, responsive fluide) sans toucher au modèle économique ni au serveur.

**Architecture:** Framework centralisé (approche A). Une base partagée — shell CSS `.machine` + un moteur JS unique `gameResult()` adossé à une logique de palier pure et testée (`pickTier`) — que les 6 jeux réutilisent. La logique aujourd'hui éparpillée (`checkBigWin`, `flashBal`, `.msg` par jeu) est remplacée par ce point d'entrée unique.

**Tech Stack:** Vanilla HTML/CSS/JS (scripts globaux, pas de bundler), Bun (test runner `bun test`), game-icons.net (SVG CC BY 3.0). Fichiers servis en statique avec `Cache-Control: no-cache` → **F5 suffit** (pas de redémarrage serveur, on ne touche pas à `server.ts`).

## Global Constraints

- **Charte casino = violet** : toute couleur passe par `--accent`, `--accent-2`, `--accent-soft`, `--accent-glow`, `--accent-dim` (`--accent` = `#7c3aed`). **Aucun doré** (`--gold`, `#c9a84c`, `rgba(201,168,76,…)`) ni violet codé en dur (`rgba(91,33,182,…)`, `#5b21b6`) dans le casino.
- **Aucun audio** — effets purement visuels.
- **Serveur / économie inchangés** : aucune modif de `server.ts`, `games.ts`, `db.ts`, des routes, des paytables ou du bridage cagnotte.
- **Pas d'emoji** dans l'UI de jeu (symboles en SVG).
- **Icônes** game-icons.net, teintées `currentColor`, viewBox `0 0 512 512`.
- **Toast uniquement sur gain net** (`gain > bet`). Perte / récup. partielle / mise rendue = indicateur machine seul.
- **Commits** : chaque commit utilise les trailers standard du repo :
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ
  ```
- **Vérification visuelle** : serveur déjà lancé sur `http://localhost:3000` ; recharger (F5) après chaque changement front. Compte de test `loc` disponible.

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `public/core/tiers.js` | Logique pure de palier (`pickTier`) — UMD (global + `module.exports`) | **Créer** |
| `tests/tiers.test.ts` | Tests `bun test` de `pickTier` | **Créer** |
| `public/casino.js` | Moteur `gameResult()` + refactor des 6 résolutions ; suppression `checkBigWin`/`flashBal` ad hoc | Modifier |
| `public/casino.css` | Shell `.machine`, feutre/néon, classes `fx-*`, overlay redessiné, boards par jeu, `@container` | Modifier |
| `public/casino.html` | Markup `.machine` pour les 6 vues + overlay | Modifier |
| `public/core/game-icons.js` | Set d'icônes régénéré (Plinko/Roue unifiés) + sélecteurs `applyGameIcons` | Régénérer/Modifier |
| `scripts/gen-game-icons.ts` | Sources Plinko/Roue → vraies icônes game-icons.net | Modifier |
| `scripts/gi-src/*.svg` | SVG sources téléchargés | Ajouter plinko.svg, wheel.svg |
| `public/responsive.css` | Réécriture fluide + purge des couleurs codées en dur | Modifier |
| `public/core/tokens.css` | Toasts (réutilisés tels quels) | Inchangé (réf.) |

Chargement scripts dans `casino.html` : ajouter `core/tiers.js` **avant** `casino.js`.

---

### Task 1 : Logique de palier pure `pickTier` (TDD)

Unité pure, testable, isolée du DOM. Décide le palier à partir du résultat net.

**Files:**
- Create: `public/core/tiers.js`
- Test: `tests/tiers.test.ts`

**Interfaces:**
- Produces: `pickTier(gain: number, bet: number): string` → une des clés
  `'lose' | 'partial' | 'push' | 'win-s' | 'win-m' | 'win-big' | 'win-mega'`.
  Exposée en global `window.Tiers.pickTier` (navigateur) et `module.exports`
  (test). Règles : `bet<=0`→`lose` ; `gain<=0`→`lose` ; `gain<bet`→`partial` ;
  `gain==bet`→`push` ; `gain<=2*bet`→`win-s` ; `gain<=5*bet`→`win-m` ;
  `gain<=20*bet`→`win-big` ; sinon `win-mega`. Seuils inclusifs en borne haute.

- [ ] **Step 1 : Écrire le test qui échoue**

Create `tests/tiers.test.ts` :

```ts
import { test, expect } from 'bun:test'
import { pickTier } from '../public/core/tiers.js'

test('perte totale → lose', () => {
  expect(pickTier(0, 100)).toBe('lose')
})
test('mise nulle ou invalide → lose', () => {
  expect(pickTier(50, 0)).toBe('lose')
})
test('récupération partielle (gain < mise) → partial', () => {
  expect(pickTier(50, 100)).toBe('partial')   // ex. Plinko x0.5
})
test('mise rendue (gain == mise) → push', () => {
  expect(pickTier(100, 100)).toBe('push')
})
test('petit gain net jusqu’à x2 inclus → win-s', () => {
  expect(pickTier(150, 100)).toBe('win-s')
  expect(pickTier(200, 100)).toBe('win-s')    // borne x2 inclusive
})
test('gain moyen >x2 jusqu’à x5 inclus → win-m', () => {
  expect(pickTier(201, 100)).toBe('win-m')
  expect(pickTier(500, 100)).toBe('win-m')    // borne x5 inclusive
})
test('gros gain >x5 jusqu’à x20 inclus → win-big', () => {
  expect(pickTier(501, 100)).toBe('win-big')
  expect(pickTier(2000, 100)).toBe('win-big') // borne x20 inclusive
})
test('jackpot >x20 → win-mega', () => {
  expect(pickTier(2001, 100)).toBe('win-mega')
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `bun test tests/tiers.test.ts`
Expected: FAIL — `Cannot find module '../public/core/tiers.js'` (le fichier n'existe pas).

- [ ] **Step 3 : Implémenter le module pur (UMD)**

Create `public/core/tiers.js` :

```js
/* BlackState — paliers de résultat (logique pure, sans DOM).
   Décide le palier à partir du résultat NET (gain vs mise). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tiers = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function pickTier(gain, bet) {
    if (!(bet > 0)) return 'lose';
    if (gain <= 0)   return 'lose';
    if (gain < bet)  return 'partial';
    if (gain === bet) return 'push';
    if (gain <= 2 * bet)  return 'win-s';
    if (gain <= 5 * bet)  return 'win-m';
    if (gain <= 20 * bet) return 'win-big';
    return 'win-mega';
  }
  return { pickTier: pickTier };
});
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `bun test tests/tiers.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5 : Commit**

```bash
git add public/core/tiers.js tests/tiers.test.ts
git commit -m "feat(casino): logique de palier pure pickTier + tests"
```

---

### Task 2 : Moteur `gameResult()` + shell `.machine` + overlay, prouvés sur Slots

Keystone : on construit le framework partagé (CSS shell + JS engine + overlay redessiné) et on l'applique au premier jeu (Slots) comme implémentation de référence.

**Files:**
- Modify: `public/casino.html` (charger `core/tiers.js` ; vue Slots → `.machine`)
- Modify: `public/casino.css` (shell `.machine`, `fx-*`, overlay, slots board)
- Modify: `public/casino.js` (`gameResult()`, refactor `spin()`, confetti violet)

**Interfaces:**
- Consumes: `window.Tiers.pickTier(gain, bet)` (Task 1).
- Produces: `gameResult({ machine, bet, gain, balance, xp, level, push }): void`
  — point d'entrée unique appelé par tous les jeux. `machine` = élément `.machine`
  (ou `null`, toléré). Pose une classe `fx-<key>` sur `.machine`, écrit
  l'indicateur `.machine-result`, appelle `setBalance(balance, win, xp, level)`,
  déclenche l'overlay sur `win-big`/`win-mega`, et `toast('+'+fmt(gain), 1800,
  'success')` **uniquement** si la clé commence par `win`.

- [ ] **Step 1 : Charger `core/tiers.js` avant `casino.js`**

Modify `public/casino.html` `<head>` — insérer avant la ligne `<script defer src="/casino.js"></script>` :

```html
  <script defer src="/core/tiers.js"></script>
```

- [ ] **Step 2 : Convertir la vue Slots au markup `.machine`**

Modify `public/casino.html` — remplacer le bloc `<!-- SLOTS -->` (`<div id="view-slots" …>` … `</div>` de la vue) par :

```html
          <!-- SLOTS -->
          <div id="view-slots" class="view game-view">
            <div class="view-inner">
              <div class="machine" data-game="slots">
                <div class="machine-head">
                  <span class="ic-game"></span>
                  <div class="machine-head-txt"><h2>Slots</h2><span class="sub">3 rouleaux — alignez les symboles</span></div>
                </div>
                <div class="machine-board">
                  <div class="reels">
                    <div class="reel" id="r0"></div>
                    <div class="reel" id="r1"></div>
                    <div class="reel" id="r2"></div>
                  </div>
                </div>
                <div class="machine-result" id="slotResult" data-state="idle"></div>
                <div class="machine-controls">
                  <div class="bet-row">
                    <div class="field">
                      <label>Mise</label>
                      <input id="slotBet" type="number" min="1" value="100">
                      <div class="qbet">
                        <button onclick="qbet('slotBet','half')">½</button>
                        <button onclick="qbet('slotBet','double')">×2</button>
                        <button onclick="qbet('slotBet','max')">MAX</button>
                      </div>
                    </div>
                    <button id="slotBtn" class="btn" onclick="spin()">TOURNER</button>
                  </div>
                  <div class="paytable" id="slotPaytable"></div>
                </div>
              </div>
            </div>
          </div>
```

(La paytable sera remplie en SVG en Task 7 ; la laisser vide ici.)

- [ ] **Step 3 : Styles du shell `.machine`, classes `fx-*`, indicateur, overlay**

Modify `public/casino.css` — ajouter une section délimitée `/* ===== MACHINE SHELL (refonte feutre & néon) ===== */` :

```css
/* ===== MACHINE SHELL (refonte feutre & néon) ===== */
.machine{
  container-type:inline-size;
  position:relative;display:flex;flex-direction:column;gap:clamp(14px,3cqw,22px);
  padding:clamp(16px,3.5cqw,28px);
  border-radius:var(--r3);
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(124,58,237,.10), transparent 60%),
    radial-gradient(100% 100% at 50% 100%, rgba(8,6,18,.9), rgba(10,8,22,.96)),
    repeating-linear-gradient(135deg, rgba(255,255,255,.012) 0 2px, transparent 2px 4px);
  border:1px solid var(--accent-dim);
  box-shadow:0 0 0 1px rgba(124,58,237,.10),
             0 24px 60px rgba(0,0,0,.55),
             inset 0 1px 0 rgba(255,255,255,.04),
             inset 0 -30px 60px rgba(0,0,0,.35);
}
.machine::before{ /* liseré néon lumineux */
  content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  box-shadow:inset 0 0 0 1px rgba(124,58,237,.35), 0 0 28px -6px var(--accent-glow);
  transition:box-shadow .3s var(--ease-out);
}
.machine-head{display:flex;align-items:center;gap:14px}
.machine-head .ic-game{display:inline-flex;width:clamp(30px,6cqw,40px);color:var(--accent-2)}
.machine-head .ic-game .gi{width:100%;height:auto;filter:drop-shadow(0 0 10px var(--accent-glow))}
.machine-head h2{margin:0;font-family:var(--display);font-size:clamp(1.5rem,5cqw,2.2rem);line-height:1}
.machine-head .sub{display:block;color:var(--muted);font-size:clamp(.7rem,2cqw,.82rem)}
.machine-board{display:flex;align-items:center;justify-content:center;min-height:0}
.machine-controls{display:flex;flex-direction:column;gap:14px}

/* Indicateur de résultat (persistant, couvre tous les cas) */
.machine-result{
  min-height:1.6em;text-align:center;font-family:var(--num);font-weight:600;
  font-size:clamp(.9rem,2.6cqw,1.05rem);letter-spacing:.02em;
  opacity:0;transition:opacity .25s,color .25s;
}
.machine-result[data-state="idle"]{opacity:0}
.machine-result[data-state="win"]{opacity:1;color:#46d588}
.machine-result[data-state="lose"]{opacity:1;color:var(--muted)}
.machine-result[data-state="neutral"]{opacity:1;color:var(--accent-2)}

/* Effets gradués posés sur .machine */
@keyframes fxShake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-7px)}40%,60%{transform:translateX(7px)}}
@keyframes fxGlow{0%{box-shadow:inset 0 0 0 1px var(--accent),0 0 50px -4px var(--accent-glow)}100%{box-shadow:inset 0 0 0 1px rgba(124,58,237,.35),0 0 28px -6px var(--accent-glow)}}
@keyframes fxPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.012)}}
.machine.fx-lose{animation:fxShake .5s var(--ease-out)}
.machine.fx-lose .machine-board{filter:brightness(.7) saturate(.6);transition:filter .4s}
.machine.fx-partial .machine-board{filter:brightness(.82) saturate(.8);transition:filter .4s}
.machine.fx-win-s::before{animation:fxGlow .7s var(--ease-out)}
.machine.fx-win-m{animation:fxPulse .5s var(--ease-out) 2}
.machine.fx-win-m::before{animation:fxGlow .7s var(--ease-out)}
.machine.fx-win-big::before,.machine.fx-win-mega::before{animation:fxGlow .7s var(--ease-out) 3}

/* Overlay BIG/MEGA redessiné (violet & or sobre) */
.win-label{color:#fff;text-shadow:0 0 24px var(--accent-glow),0 2px 0 rgba(0,0,0,.4)}
.win-overlay.mega .win-label{font-size:clamp(2.6rem,10vw,6.5rem);
  background:linear-gradient(180deg,#fff, var(--accent-2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
```

(Note : remplacer plus bas dans `casino.css` la couleur dorée de `.reel.hit` —
`var(--gold)` / `rgba(201,168,76,…)` — par `var(--accent)` / `var(--accent-glow)`,
voir Step 5.)

- [ ] **Step 4 : Ajouter le moteur `gameResult()` dans `casino.js`**

Modify `public/casino.js` — ajouter après `checkBigWin` (≈ ligne 127) :

```js
/* ── Moteur d'effets gradués (point d'entrée unique) ───────── */
const FX = ['fx-lose','fx-partial','fx-win-s','fx-win-m','fx-win-big','fx-win-mega'];
function gameResult({ machine, bet, gain, balance, xp, level, push }) {
  const key = push ? 'push' : (window.Tiers ? Tiers.pickTier(gain, bet) : 'lose');
  const isWin = key.indexOf('win') === 0;
  setBalance(balance, key === 'push' ? undefined : isWin, xp, level);
  if (machine) {
    const res = machine.querySelector('.machine-result');
    if (res) {
      if (isWin)            { res.dataset.state = 'win';     res.textContent = '+' + fmt(gain) + ' · ×' + (gain / bet).toFixed(2); }
      else if (key === 'partial') { res.dataset.state = 'lose'; res.textContent = '−' + fmt(bet - gain); }
      else if (key === 'push')    { res.dataset.state = 'neutral'; res.textContent = 'Mise rendue'; }
      else                  { res.dataset.state = 'lose';    res.textContent = 'Perdu'; }
    }
    machine.classList.remove(...FX);
    void machine.offsetWidth;
    if (key !== 'push') machine.classList.add('fx-' + key);
  }
  if (key === 'win-big')  launchConfetti('BIG WIN\n+' + fmt(gain) + ' 🪙');
  if (key === 'win-mega') { const ov = $('winOverlay'); if (ov) ov.classList.add('mega'); launchConfetti('MEGA WIN\n+' + fmt(gain) + ' 🪙'); }
  if (isWin) toast('+' + fmt(gain) + ' 🪙', 1800, 'success');
}
```

Et au début de `launchConfetti`, retirer la classe `mega` quand l'overlay se ferme : dans le `setTimeout` final et la branche `else ov.classList.add('hidden')`, ajouter `ov.classList.remove('mega')`. Remplacer aussi la palette `COLORS` par du violet/or :

```js
  const COLORS = ['#7c3aed','#a855f7','#c9a3ff','#e9d5ff','#f5d061','#ffffff'];
```

- [ ] **Step 5 : Refactor `spin()` pour utiliser `gameResult` + corriger le doré slots**

Modify `public/casino.js` — dans `spin()`, remplacer le bloc final (`setBalance(...)` → fin du `if/else` message) par :

```js
  setTimeout(() => {
    clearInterval(tick);
    const machine = $('view-slots').querySelector('.machine');
    if (d.gain > 0) reels.forEach(r => r.classList.add('hit'));
    gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
    slotSpinning = false; $('slotBtn').disabled = false;
  }, 1180);
```

Et remplacer `$('slotMsg').textContent = '';` (début de `spin`) par
`{ const res = $('slotResult'); if (res) { res.dataset.state = 'idle'; res.textContent = ''; } }`.

Modify `public/casino.css` — `.reel.hit` : remplacer `border-color:var(--gold)` par `border-color:var(--accent)` et `rgba(201,168,76,.55)`/`rgba(201,168,76,.18)` par `var(--accent-glow)`/`rgba(124,58,237,.18)`.

- [ ] **Step 6 : Vérifier dans le navigateur**

1. `bun test tests/tiers.test.ts` → PASS (non-régression logique).
2. F5 sur `http://localhost:3000/casino`, onglet Slots : le jeu s'affiche en tapis feutré + liseré violet, l'en-tête a l'icône.
3. Jouer (cagnotte=0 → perte) : tapis qui s'assombrit + shake, indicateur « Perdu », **pas de toast**.
4. Forcer un gain pour tester le vert : amorcer la cagnotte —
   `curl -s -XPOST localhost:3000/api/admin/casino/reset` n'est pas requis ; jouer ~20 mises pour remplir, puis observer un gain → indicateur vert « +X · ×Y » + glow + **toast vert**.
   (Alternative : seed direct en base si besoin, hors périmètre.)

- [ ] **Step 7 : Commit**

```bash
git add public/casino.html public/casino.css public/casino.js
git commit -m "feat(casino): framework machine (shell feutre/neon + moteur gameResult + overlay) sur Slots"
```

---

### Task 3 : Roue (wheel) → `.machine` + `gameResult`

**Files:**
- Modify: `public/casino.html` (vue wheel → `.machine`)
- Modify: `public/casino.css` (board roue en néon, retrait `jackpot-flash`)
- Modify: `public/casino.js` (`wheelSpin` → `gameResult`)

**Interfaces:**
- Consumes: `gameResult(...)` (Task 2).

- [ ] **Step 1 : Markup**

Modify `public/casino.html` — vue `<!-- WHEEL -->` : envelopper dans `<div class="machine" data-game="wheel">`, remplacer `.game-head` par `.machine-head` (icône `<span class="ic-game"></span>` + `.machine-head-txt` avec `<h2>Roue</h2><span class="sub">Tentez le jackpot 15×</span>`), `.game-board` par `.machine-board`, ajouter `<div class="machine-result" id="wResult" data-state="idle"></div>` avant les contrôles, et envelopper `bet-row` dans `.machine-controls`. Supprimer le `<div id="wMsg" class="msg"></div>`.

- [ ] **Step 2 : CSS board roue**

Modify `public/casino.css` — remplacer toute couleur dorée/violette codée en dur des règles `.wheel-*` par les tokens `--accent*` ; supprimer la règle `.wheel-wrap.jackpot-flash .wheel-svg{…}` (effet désormais géré par `gameResult`). Vérifier que `.wheel-hub` et le pointeur utilisent `--accent`.

- [ ] **Step 3 : Refactor `wheelSpin`**

Modify `public/casino.js` — dans `wheelSpin`, après l'animation de rotation, remplacer la logique `wMsg`/`flashBal`/`checkBigWin` par :

```js
  const machine = $('view-wheel').querySelector('.machine');
  gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
```

(et réinitialiser `#wResult` à `data-state="idle"` au lancement, comme Slots).

- [ ] **Step 4 : Vérifier**

F5 → onglet Roue : tapis feutré, roue en violet, rotation OK, indicateur + effet selon résultat, toast seulement sur gain net.

- [ ] **Step 5 : Commit**

```bash
git add public/casino.html public/casino.css public/casino.js
git commit -m "feat(casino): Roue sur le framework machine + gameResult"
```

---

### Task 4 : Dice → `.machine` + `gameResult`

**Files:**
- Modify: `public/casino.html` (vue dice → `.machine`)
- Modify: `public/casino.css` (piste/curseur/stats en néon)
- Modify: `public/casino.js` (`diceRoll` → `gameResult`)

**Interfaces:**
- Consumes: `gameResult(...)` (Task 2).

- [ ] **Step 1 : Markup**

Modify `public/casino.html` — vue `<!-- DICE -->` : envelopper dans `<div class="machine" data-game="dice">`, `.game-head`→`.machine-head` (titre « Dice », sub « Choisissez votre chance de gagner »), `.game-board game-board-stack` conservé à l'intérieur de `.machine-board`, ajouter `<div class="machine-result" id="diceResultMsg" data-state="idle"></div>` avant la `slider-row`, envelopper `slider-row` + `dice-stats` + `bet-row` dans `.machine-controls`. Supprimer `<div id="diceMsg" class="msg"></div>`. (Ne pas renommer `#diceResult` qui est le gros chiffre du lancer.)

- [ ] **Step 2 : CSS**

Modify `public/casino.css` — règles `.dice-*` : remplacer couleurs codées en dur par `--accent*` (zones win/lose, marqueur, piste). Conserver vert/rouge sémantiques pour `dice-zone-win`/`dice-zone-lose` mais via tokens cohérents.

- [ ] **Step 3 : Refactor `diceRoll`**

Modify `public/casino.js` — dans `diceRoll`, après l'animation du dé, remplacer la logique `diceMsg` par :

```js
  const machine = $('view-dice').querySelector('.machine');
  gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
```

(réinitialiser `#diceResultMsg` à l'`idle` au lancement).

- [ ] **Step 4 : Vérifier**

F5 → Dice : tapis feutré, piste violette, lancer OK, indicateur + effet + toast (gain net) corrects.

- [ ] **Step 5 : Commit**

```bash
git add public/casino.html public/casino.css public/casino.js
git commit -m "feat(casino): Dice sur le framework machine + gameResult"
```

---

### Task 5 : Plinko → `.machine` + `gameResult` (récup. partielle)

**Files:**
- Modify: `public/casino.html` (vue plinko → `.machine`)
- Modify: `public/casino.css` (canvas sur tapis, palette néon)
- Modify: `public/casino.js` (`plinkoDrop` → `gameResult`)

**Interfaces:**
- Consumes: `gameResult(...)` (Task 2). Le cas `partial` (gain < mise, ex. ×0.5)
  produit indicateur `−{mise−gain}` (état `lose`) **sans toast** — déjà géré par
  `gameResult`/`pickTier`.

- [ ] **Step 1 : Markup**

Modify `public/casino.html` — vue `<!-- PLINKO -->` : envelopper dans `<div class="machine" data-game="plinko">`, `.game-head`→`.machine-head` (titre « Plinko », sub « Laissez tomber la balle »), canvas dans `.machine-board`, ajouter `<div class="machine-result" id="plinkoResult" data-state="idle"></div>`, contrôles dans `.machine-controls`. Supprimer `<div id="plinkoMsg" class="msg"></div>`.

- [ ] **Step 2 : CSS**

Modify `public/casino.css` — `.plinko-screen`/canvas : fond transparent sur le tapis ; si des couleurs de rendu canvas sont définies en JS, les passer en violet (voir Step 3). Purger toute couleur codée en dur des règles `.plinko-*`.

- [ ] **Step 3 : Refactor `plinkoDrop` (+ couleurs canvas)**

Modify `public/casino.js` — dans `plinkoDrop`, après la chute de la balle, remplacer la logique `plinkoMsg` par :

```js
  const machine = $('view-plinko').querySelector('.machine');
  gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
```

Si le rendu canvas Plinko code des couleurs en dur (plots/bins/balle), les remplacer par du violet (`#7c3aed`, `#a855f7`) pour la charte. Réinitialiser `#plinkoResult` à l'`idle` au lâcher.

- [ ] **Step 4 : Vérifier (dont récup. partielle)**

F5 → Plinko : tapis feutré, canvas violet. Tester les 3 risques. Vérifier un résultat ×0.5/×0.7 (risque faible) → indicateur atténué « −X », **pas de toast vert**. Un vrai gain net → vert + toast.

- [ ] **Step 5 : Commit**

```bash
git add public/casino.html public/casino.css public/casino.js
git commit -m "feat(casino): Plinko sur le framework machine + gameResult (recup partielle sans toast)"
```

---

### Task 6 : Blackjack & Démineur (désactivés) — habillage `.machine`

Habillage visuel seulement ; les jeux restent verrouillés côté nav et 503 côté serveur. Pas de `gameResult` (non jouables).

**Files:**
- Modify: `public/casino.html` (vues blackjack & mines → `.machine`)
- Modify: `public/casino.css` (table BJ, grille mines en néon)

- [ ] **Step 1 : Markup BJ & Mines**

Modify `public/casino.html` — vues `<!-- BLACKJACK -->` et `<!-- MINES -->` : envelopper chaque dans `<div class="machine" data-game="blackjack">` / `data-game="mines"`, `.game-head`→`.machine-head` (icônes + titres conservés), `.game-board`→`.machine-board`, contrôles dans `.machine-controls`. Conserver les `id`/handlers existants (les routes répondent 503, c'est attendu). Garder/styler un voile « Bientôt » cohérent.

- [ ] **Step 2 : CSS**

Modify `public/casino.css` — règles `.bj-*`, `.pcard`, `.mines-*`, `.cell` : purger doré/violet codé en dur → `--accent*`. Gemmes/bombes en accent violet. Ajouter un état visuel « verrouillé » (overlay « Bientôt ») sur ces deux `.machine` (réutiliser `.hg-soon`/style locked existant).

- [ ] **Step 3 : Vérifier**

F5 → Blackjack & Démineur : habillage feutre/néon homogène, mention « Bientôt » visible, aucune interaction cassée (clic → comportement verrouillé/503 inchangé).

- [ ] **Step 4 : Commit**

```bash
git add public/casino.html public/casino.css
git commit -m "feat(casino): habillage machine Blackjack/Demineur (desactives, prets a reactiver)"
```

---

### Task 7 : Icônes unifiées (game-icons.net) + symboles Slots SVG

**Files:**
- Add: `scripts/gi-src/plinko.svg`, `scripts/gi-src/wheel.svg`
- Modify: `scripts/gen-game-icons.ts` (Plinko/Roue depuis sources + en-tête)
- Modify: `public/core/game-icons.js` (régénéré + sélecteur `.machine-head`)
- Modify: `public/casino.js` (symboles Slots + paytable en SVG, sans emoji)

**Interfaces:**
- Consumes: `applyGameIcons()` (existant) — doit cibler `.machine-head .ic-game`
  désormais (les vues ont gardé la classe `game-view`).

- [ ] **Step 1 : Récupérer 2 icônes game-icons.net pour Plinko & Roue**

Télécharger 2 SVG cohérents avec le style gravé existant depuis le dépôt officiel game-icons (raw GitHub `https://raw.githubusercontent.com/game-icons/icons/master/<auteur>/<nom>.svg`). Candidats à essayer et garder le plus lisible en petit :
- Roue : `lorc/spinning-wheel`, `delapouite/wheelbarrow` (non), `lorc/round-star` → privilégier une roue/cible ; à défaut `lorc/target-dummy` ou cible `delapouite/round-shield`.
- Plinko : `delapouite/falling` / `lorc/falling` (bille qui tombe), ou triangle de plots `delapouite/diamonds` ; à défaut conserver le custom mais l'épaissir au style gravé.

Enregistrer les retenus dans `scripts/gi-src/plinko.svg` et `scripts/gi-src/wheel.svg`. **Critère** : trait plein `fill`, lisible à 24px, même poids visuel que slots/dice. Si aucun candidat n'est satisfaisant, garder les formes maison actuelles mais documenter le choix dans l'en-tête généré (la charte prime sur le dogme « 100% game-icons.net »).

- [ ] **Step 2 : Brancher les sources dans le générateur**

Modify `scripts/gen-game-icons.ts` — remplacer les définitions inline `plinko:` et `wheel:` par `plinko: innerIcon('scripts/gi-src/plinko.svg')` et `wheel: innerIcon('scripts/gi-src/wheel.svg')` (si Step 1 a retenu des SVG). Mettre à jour l'en-tête de provenance en conséquence.

- [ ] **Step 3 : Régénérer le fichier d'icônes**

Run: `bun run scripts/gen-game-icons.ts`
Expected: `public/core/game-icons.js généré (6 icônes)` + tailles listées.

- [ ] **Step 4 : Mettre à jour le sélecteur `applyGameIcons`**

Modify `scripts/gen-game-icons.ts` (corps `applyGameIcons`) **puis régénérer** — la 3e boucle doit cibler le nouvel en-tête : remplacer `v.querySelector('.game-head .ic-game')` par `v.querySelector('.machine-head .ic-game')`. Régénérer (`bun run scripts/gen-game-icons.ts`).

- [ ] **Step 5 : Symboles Slots en SVG (sans emoji)**

Modify `public/casino.js` — vérifier `SLOT_SVG`/`slotSymbolHTML` (déjà SVG) et **remplir la paytable `#slotPaytable` en SVG** au lieu des `<span>7️⃣7️⃣7️⃣ = 20×</span>` emoji. Ajouter à l'init des slots (`initSlots`) un rendu paytable :

```js
function renderPaytable() {
  const p = $('slotPaytable'); if (!p) return;
  // ⚠ Utiliser les clés EMOJI réelles de SYM/SLOT_SVG (vérifier en haut de casino.js).
  // Exemple si les clés sont '7️⃣','💎','🔔','🍒' :
  const rows = [['7️⃣','20×'],['💎','8×'],['🔔','3×'],['🍒','2×']];
  p.innerHTML = rows.map(r =>
    '<span class="pt">' + slotSymbolHTML(r[0]) + slotSymbolHTML(r[0]) + slotSymbolHTML(r[0]) + ' = ' + r[1] + '</span>'
  ).join('');
}
```

Appeler `renderPaytable()` dans `initSlots()`. **Les emoji ici sont des clés de map** vers le SVG (jamais affichées telles quelles) ; elles **doivent matcher exactement** les clés de `SYM`/`SLOT_SVG` définies en haut de `casino.js` — les lire avant d'écrire ce code. Ajouter un style `.paytable .pt{display:inline-flex;align-items:center;gap:2px}` et `.paytable .slot-sym{width:18px;height:18px}` dans `casino.css`.

- [ ] **Step 6 : Vérifier**

F5 → nav, accueil (cartes jeux), en-têtes des 6 machines : icônes homogènes (Plinko/Roue dans le même style). Paytable Slots en SVG, plus aucun emoji visible dans l'UI de jeu.

- [ ] **Step 7 : Commit**

```bash
git add scripts/gen-game-icons.ts scripts/gi-src public/core/game-icons.js public/casino.js public/casino.css
git commit -m "feat(casino): set d'icones unifie (Plinko/Roue) + symboles Slots SVG sans emoji"
```

---

### Task 8 : Responsive fluide (container queries) + purge des couleurs codées en dur

**Files:**
- Modify: `public/responsive.css` (réécriture des sections jeux vers fluide + purge)
- Modify: `public/casino.css` (règles `@container` internes aux machines si besoin)

- [ ] **Step 1 : Purger les couleurs codées en dur de `responsive.css`**

Modify `public/responsive.css` — remplacer toutes les occurrences `rgba(91,33,182,…)` et autres violets/dorés en dur par `var(--accent)` / `var(--accent-dim)` / `var(--accent-glow)`. Vérifier après coup : `grep -nE "rgba\\(91,33,182|#5b21b6|#c9a84c|201,168,76" public/responsive.css public/casino.css` → **aucun résultat**.

- [ ] **Step 2 : Rendre les boards fluides via `@container`**

Modify `public/casino.css` — comme `.machine` est `container-type:inline-size`, ajouter les ajustements internes en `@container` plutôt qu'en `@media`. Exemple pour Slots :

```css
@container (max-width: 420px){
  .reels{gap:8px}
  .machine-head h2{font-size:1.4rem}
}
@container (max-width: 320px){
  .machine{padding:14px}
}
```

Décliner les ajustements internes nécessaires par jeu (roue : `.wheel-wrap{width:min(320px,90cqw)}` ; dice : tailles en `cqw` ; mines : `.mines-grid{gap:clamp(4px,1.5cqw,8px)}`). Retirer de `responsive.css` les `@media` jeux désormais couverts par `@container` (slots/wheel/dice/mines/plinko) pour éviter les doublons.

- [ ] **Step 3 : Conserver le responsive de structure**

Garder dans `responsive.css` ce qui dépend du **viewport** (layout global, repli sidebar mobile, home grid, podium, modal, tables) ; seul l'intérieur des machines passe en `@container`. Réaligner les couleurs de la sidebar mobile sur `--accent*`.

- [ ] **Step 4 : Vérifier la fluidité**

Avec les DevTools (mode responsive), balayer **chaque machine** de ~320px à grand écran : aucun débordement, boutons tactiles ≥ 44px, l'intérieur des machines se réorganise selon la **largeur de la machine** (tester aussi en réduisant la fenêtre desktop, pas seulement le viewport mobile). Vérifier accueil + nav + historique.

- [ ] **Step 5 : Commit**

```bash
git add public/responsive.css public/casino.css
git commit -m "refactor(casino): responsive fluide (container queries) + purge des couleurs hors charte"
```

---

### Task 9 : Nettoyage final + vérification d'ensemble

**Files:**
- Modify: `public/casino.js` (suppression du code mort)
- Modify: `public/casino.html` (résidus `.msg`/`game-head` éventuels)

- [ ] **Step 1 : Supprimer le code mort**

Modify `public/casino.js` — supprimer `checkBigWin` (remplacé par `gameResult`) si plus appelé, et tout `flashBal`/`shakeEl` ad hoc devenu inutile (BJ/Mines désactivés peuvent conserver `shakeEl` sur la grille). Vérifier qu'aucune fonction de jeu n'écrit encore dans un `#…Msg`.

- [ ] **Step 2 : Grep de propreté**

Run et vérifier **aucun** résidu inattendu :

```bash
grep -nE "checkBigWin|class=\"msg\"|id=\"[a-z]+Msg\"" public/casino.js public/casino.html
grep -nE "rgba\(91,33,182|#5b21b6|var\(--gold\)|201,168,76|🍒|🔔|7️⃣|💎" public/casino.html public/casino.css
```

Expected : plus de `.msg`/`#…Msg` actifs ; plus d'emoji dans le HTML/CSS de jeu ; plus de couleurs hors charte. (Les emoji peuvent rester comme **clés** dans `casino.js` `slotSymbolHTML` — ce n'est pas de l'affichage.)

- [ ] **Step 3 : Vérification fonctionnelle complète**

```bash
curl -s -o /dev/null -w "casino %{http_code}\n" localhost:3000/casino
for g in slots plinko wheel dice; do curl -s -o /dev/null -w "$g %{http_code}\n" -XPOST localhost:3000/api/play/$g; done
```

Et manuellement (compte `loc`, F5) : jouer les 4 jeux actifs, vérifier paliers (perte sobre sans toast, gain net → vert + toast + effet, gros gain → overlay), BJ/Démineur verrouillés.

- [ ] **Step 4 : Lancer les tests**

Run: `bun test`
Expected: PASS (tiers).

- [ ] **Step 5 : Commit final**

```bash
git add -A
git commit -m "chore(casino): nettoyage code mort + verification refonte machines"
```

---

## Notes d'exécution

- **Pas de redémarrage serveur** : aucune modif backend. `Cache-Control: no-cache` → F5.
- **Cagnotte à 0** : au début, presque tout perd (par design). Pour tester les paliers gagnants, amorcer la cagnotte en jouant une série, puis observer les gains se débloquer (suivi dans Admin → Cagnotte).
- **Ordre** : Tasks 1→2 sont le socle (logique + framework sur Slots) ; 3→6 répliquent par jeu ; 7 unifie les icônes (après stabilisation du markup) ; 8 fluidifie ; 9 nettoie.
