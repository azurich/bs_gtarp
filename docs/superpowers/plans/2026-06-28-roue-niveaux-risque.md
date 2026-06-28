# Roue — Niveaux de risque · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 3 niveaux de risque (Faible/Moyen/Élevé) à la Roue, sur le modèle du Plinko — même RTP (0,70) par niveau, seule la variance change, et la roue se redessine selon le niveau choisi.

**Architecture:** `games.ts` expose `WHEEL`/`WHEEL_W` en `Record<risk, number[]>` calibrés à EV=0,70 via un helper `normWheel`. La route `/api/play/wheel` lit `risk` comme le Plinko. Le front ajoute un sélecteur, redessine la roue SVG par niveau et envoie le `risk`. Aucune autre mécanique (cagnotte, effets, charte) n'est touchée.

**Tech Stack:** Bun (test runner `bun test`), TypeScript (games.ts/server.ts), vanilla JS/HTML/CSS (front, scripts globaux, pas de bundler). Fichiers front servis en `no-cache` → F5. **`games.ts`/`server.ts` sont du backend → redémarrer le serveur après modif.**

## Global Constraints

- **3 niveaux** `low`/`med`/`high`, chacun **EV = RTP = 0,70 exactement** (vérifié par test unitaire, ±0,001).
- **Faible (`low`)** : aucun segment 0× ; récupération partielle (0,5×–0,9×) + petits gains. **Moyen (`med`)** : identique à la roue actuelle (0× / 1,5× / 2× / 5× / 15×). **Élevé (`high`)** : majorité de 0× + jackpot **50×** rare.
- **Bridage cagnotte conservé** : poids à 0 pour les segments dont `valeur·mise > budget` (les 0× passent toujours).
- **16 segments** par niveau (la roue SVG est construite pour `WHEEL[risk].length`).
- Défaut côté serveur ET front = `med`.
- **Charte violet uniquement** : aucune couleur or/hors-charte, pas de `rgba(91,33,182,…)` codé en dur nouveau. Pas d'emoji dans l'UI.
- **Économie/effets inchangés** : `gameResult`, modèle cagnotte, RTP global, autres jeux — rien d'autre n'est modifié.
- **Commits** : trailers standard du repo :
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ
  ```
- **Vérif** : `bun test` ; serveur sur `http://localhost:3000` (redémarrer après Task 1). Compte de test `loc`.

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `games.ts` | `WHEEL`/`WHEEL_W` par niveau + `normWheel` + `playWheel(bet, risk, budget)` | Modifier (≈ L.113-127) |
| `server.ts` | Route `/api/play/wheel` lit `risk` ; `/api/config` expose déjà `wheel: G.WHEEL` (devient un record, aucune modif) | Modifier (≈ L.491-499) |
| `tests/wheel.test.ts` | Test EV=0,70 + invariants par niveau | **Créer** |
| `public/casino.html` | Sélecteur `<select id="wheelRisk">` dans les contrôles de la Roue | Modifier (≈ L.364-376) |
| `public/casino.js` | `WHEEL` record, `renderWheel()` par niveau, `wheelColor` (<1×), `wheelSpin(risk)`, listener boot | Modifier |

---

### Task 1 : Backend — Roue par niveau (games.ts + route) + test (TDD)

**Files:**
- Create: `tests/wheel.test.ts`
- Modify: `games.ts` (≈ L.113-127)
- Modify: `server.ts` (≈ L.491-499)

**Interfaces:**
- Produces (depuis `games.ts`) :
  - `WHEEL: Record<'low'|'med'|'high', number[]>` — 16 valeurs visibles par niveau.
  - `WHEEL_W: Record<'low'|'med'|'high', number[]>` — 16 poids (somme 1) par niveau, EV=0,70.
  - `playWheel(bet: number, risk: string, budget: number): { index: number, mult: number, gain: number }`.
- Consumes : `RTP` (déjà exporté = 0.70), `pickWeighted` (interne games.ts).

- [ ] **Step 1 : Écrire le test qui échoue**

Create `tests/wheel.test.ts` :

```ts
import { test, expect } from 'bun:test'
import { WHEEL, WHEEL_W } from '../games.ts'

const RISKS = ['low', 'med', 'high'] as const

for (const risk of RISKS) {
  test(`roue ${risk} : 16 segments + 16 poids`, () => {
    expect(WHEEL[risk].length).toBe(16)
    expect(WHEEL_W[risk].length).toBe(16)
  })
  test(`roue ${risk} : poids >= 0 et somme = 1`, () => {
    WHEEL_W[risk].forEach(w => expect(w).toBeGreaterThanOrEqual(0))
    const sum = WHEEL_W[risk].reduce((s, w) => s + w, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9)
  })
  test(`roue ${risk} : EV = RTP (0.70)`, () => {
    const ev = WHEEL[risk].reduce((s, v, i) => s + v * WHEEL_W[risk][i], 0)
    expect(Math.abs(ev - 0.70)).toBeLessThan(0.001)
  })
}

test('roue low : aucun segment 0x (recup partielle)', () => {
  expect(WHEEL.low.every(v => v > 0)).toBe(true)
})
test('roue high : jackpot 50x present', () => {
  expect(WHEEL.high.includes(50)).toBe(true)
})
test('roue med : inchangee (0x / 1.5x / 2x / 5x / 15x)', () => {
  expect(WHEEL.med).toEqual([0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0, 15])
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `bun test tests/wheel.test.ts`
Expected: FAIL — `WHEEL.low`/`WHEEL_W.low` sont `undefined` (WHEEL est encore un tableau, WHEEL_W n'est pas exporté).

- [ ] **Step 3 : Implémenter games.ts**

Modify `games.ts` — remplacer le bloc WHEEL actuel (l'en-tête `/* ---------------- WHEEL ----------------`, `export const WHEEL = [...]`, `const WHEEL_W = [...]`, et `export function playWheel(bet, budget) { ... }`) par :

```ts
/* ---------------- WHEEL ----------------
   3 niveaux de risque (comme le Plinko), 16 segments visibles + poids cachés.
   Chaque niveau est calibré à EV = RTP (0.70) via normWheel ; seule la variance
   change : faible = récup. partielle (0.5–0.9×, jamais de 0×), moyen ≈ l'ancienne
   roue, élevé = beaucoup de 0× + jackpot 50× rare.
*/
const WHEEL_SEG: Record<'low' | 'med' | 'high', number[]> = {
  low:  [0.5, 1.5, 0.7, 2, 0.5, 1.5, 0.9, 3, 0.5, 1.5, 0.7, 2, 0.5, 1.5, 0.9, 3],
  med:  [0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0, 15],
  high: [0, 0, 2, 0, 0, 5, 0, 0, 0, 0, 5, 0, 0, 2, 0, 50],
}
// Formes de poids brutes (donnent la variance voulue). normWheel cale l'EV sur RTP
// en mettant à l'échelle les poids des segments de valeur "balValue" (le balancier).
const WHEEL_WRAW: Record<'low' | 'high', number[]> = {
  low:  [5, 2, 4, 1, 5, 2, 3, 0.5, 5, 2, 4, 1, 5, 2, 3, 0.5],
  high: [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 0.05],
}
// Met à l'échelle les poids des segments de valeur balValue pour que
// Σ(w·seg)/Σw = RTP, puis normalise (Σ = 1). Garantit EV = RTP par construction.
function normWheel(seg: number[], wRaw: number[], balValue: number): number[] {
  let A = 0, B = 0, Wb = 0
  seg.forEach((v, i) => { if (v === balValue) Wb += wRaw[i]; else { A += wRaw[i] * v; B += wRaw[i] } })
  const f = (RTP * B - A) / (Wb * (balValue - RTP))
  const w = wRaw.map((wi, i) => (seg[i] === balValue ? wi * f : wi))
  const sum = w.reduce((s, wi) => s + wi, 0)
  return w.map(wi => wi / sum)
}
export const WHEEL: Record<'low' | 'med' | 'high', number[]> = WHEEL_SEG
export const WHEEL_W: Record<'low' | 'med' | 'high', number[]> = {
  low:  normWheel(WHEEL_SEG.low, WHEEL_WRAW.low, 0.5),
  // moyen : poids historiques (déjà EV=0.70), conservés à l'identique
  med:  [0.080625, 0.0675, 0.080625, 0.03, 0.080625, 0.0675, 0.080625, 0.02,
         0.080625, 0.0675, 0.080625, 0.03, 0.080625, 0.0675, 0.080625, 0.005],
  high: normWheel(WHEEL_SEG.high, WHEEL_WRAW.high, 0),
}
export function playWheel(bet: number, risk: string, budget: number) {
  const seg = WHEEL[risk as keyof typeof WHEEL]   ?? WHEEL.med
  const wt  = WHEEL_W[risk as keyof typeof WHEEL_W] ?? WHEEL_W.med
  // bridage : poids à 0 pour les segments non payables (les 0× passent toujours)
  const w   = wt.map((x, i) => (seg[i] * bet <= budget ? x : 0))
  const idx = pickWeighted(w)
  const m   = seg[idx]
  return { index: idx, mult: m, gain: Math.round(bet * m) }
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `bun test tests/wheel.test.ts`
Expected: PASS (les 3 EV à 0.70, low sans 0×, high avec 50×, med inchangé).

- [ ] **Step 5 : Brancher le `risk` dans la route serveur**

Modify `server.ts` — remplacer la route `/api/play/wheel` (≈ L.491-499) par (ajout de `const b`, extraction `risk` comme le Plinko, passage à `playWheel`) :

```ts
    .post('/api/play/wheel', ({ body, user, set }) => {
      const u   = user as User
      const b   = body as any
      const bet = intBet(b.bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const risk = (['low', 'med', 'high'] as const).find(x => x === b.risk) ?? 'med'
      if (!charge(u, bet, 'wheel')) { set.status = 400; return { error: 'Crédits Club insuffisants' } }
      const r = G.playWheel(bet, risk, casinoBudget())
      payout(u, r.gain, 'wheel'); awardXP(u.id, bet); bookCasino(bet, r.gain)
      recordHistory(u.id, 'wheel', bet, r.gain, `x${r.mult}`)
      return { index: r.index, mult: r.mult, gain: r.gain, ...userSnapshot(u.id) }
    })
```

(`/api/config` renvoie déjà `wheel: G.WHEEL` — qui devient le record `{low,med,high}` automatiquement. **Ne pas y toucher.**)

- [ ] **Step 6 : Redémarrer le serveur + vérifier**

Le serveur a `games.ts`/`server.ts` en mémoire → redémarrage obligatoire.

```bash
# tuer le(s) bun en cours (PowerShell), puis relancer
powershell -Command "Get-Process -Name bun -ErrorAction SilentlyContinue | ForEach-Object { \$_.Kill() }"
cd "C:/Users/info/Documents/DEV/Casino_Online_GTARP" && (bun run server.ts &)
sleep 2
curl -s -o /dev/null -w "casino %{http_code}\n" http://localhost:3000/casino   # -> 200
curl -s http://localhost:3000/api/config | grep -o '"wheel":{"low"' && echo "config expose la roue par niveau -> OK"
curl -s -o /dev/null -w "play/wheel %{http_code}\n" -XPOST http://localhost:3000/api/play/wheel   # -> 401 (route existe, auth requise)
```
Expected: `casino 200`, config contient `"wheel":{"low"...`, `play/wheel 401`.

- [ ] **Step 7 : Commit**

```bash
git add games.ts server.ts tests/wheel.test.ts
git commit -m "feat(casino/roue): niveaux de risque backend (WHEEL par niveau, EV=0.70, route risk)"
```

---

### Task 2 : Front — sélecteur de niveau + roue redessinée par niveau

**Files:**
- Modify: `public/casino.html` (≈ L.364-376, contrôles de la Roue ; et la carte/sous-titre Roue)
- Modify: `public/casino.js` (bloc WHEEL ≈ L.591-623 + boot ≈ L.660-665)

**Interfaces:**
- Consumes : `/api/config` renvoie `wheel: { low, med, high }` (Task 1) ; route `/api/play/wheel` accepte `{ bet, risk }` et renvoie `{ index, mult, gain, ... }`.

- [ ] **Step 1 : Ajouter le sélecteur de risque (HTML)**

Modify `public/casino.html` — dans la vue Roue, à l'intérieur de `.machine-controls > .bet-row`, AJOUTER le champ risque **avant** le champ Mise (mêmes options que le Plinko). Remplacer :

```html
                  <div class="bet-row">
                    <div class="field">
                      <label>Mise</label>
                      <input id="wBet" type="number" min="1" value="100">
```
par :
```html
                  <div class="bet-row">
                    <div class="field plinko-risk">
                      <label>Risque</label>
                      <select id="wheelRisk">
                        <option value="low">Faible</option>
                        <option value="med" selected>Moyen</option>
                        <option value="high">Élevé</option>
                      </select>
                    </div>
                    <div class="field">
                      <label>Mise</label>
                      <input id="wBet" type="number" min="1" value="100">
```

(On réutilise la classe `.plinko-risk` pour le même style que le sélecteur Plinko.)

- [ ] **Step 2 : Mettre à jour les libellés Roue (HTML)**

Modify `public/casino.html` — la Roue n'a plus un jackpot fixe de 15× :
- Sous-titre (≈ L.352) : `<span class="sub">Tentez le jackpot 15×</span>` → `<span class="sub">Risque réglable · jackpot jusqu'à 50×</span>`.
- Carte d'accueil (≈ L.145) : `<div class="hg-tag">Jackpot 15×</div>` → `<div class="hg-tag">Risque réglable</div>`.

- [ ] **Step 3 : Roue par niveau (JS) — WHEEL record, couleur, rendu, spin**

Modify `public/casino.js` — remplacer le bloc Roue (de `let WHEEL = [...]` jusqu'à la fin de `wheelSpin`, ≈ L.593-623) par :

```js
/* défaut écrasé par /api/config (source de vérité = games.ts) */
let WHEEL = {
  low:  [0.5, 1.5, 0.7, 2, 0.5, 1.5, 0.9, 3, 0.5, 1.5, 0.7, 2, 0.5, 1.5, 0.9, 3],
  med:  [0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0, 15],
  high: [0, 0, 2, 0, 0, 5, 0, 0, 0, 0, 5, 0, 0, 2, 0, 50],
};
let wheelSpinning = false, wheelRot = 0, wheelRiskBuilt = '';
function wheelRisk() { const s = $('wheelRisk'); return (s && WHEEL[s.value]) ? s.value : 'med'; }
function wheelColor(m) {
  return m === 0 ? '#1c1430' : m < 1 ? '#3a3550'
    : m >= 50 ? '#a855f7' : m >= 10 ? '#ff2e88' : m >= 5 ? '#d6209e'
    : m >= 3 ? '#7b2ff7' : m >= 2 ? '#23e0d6' : '#2a8fa0';
}
function renderWheel() {
  const risk = wheelRisk();
  const segs = WHEEL[risk];
  const g = $('wheelG'); if (!g) return;
  const cx = 160, cy = 160, r = 150, n = segs.length, seg = 360 / n; let html = '';
  for (let i = 0; i < n; i++) {
    const a0 = i * seg * Math.PI / 180, a1 = (i + 1) * seg * Math.PI / 180;
    const x0 = cx + r * Math.sin(a0), y0 = cy - r * Math.cos(a0), x1 = cx + r * Math.sin(a1), y1 = cy - r * Math.cos(a1);
    html += '<path d="M' + cx + ' ' + cy + ' L' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z" fill="' + wheelColor(segs[i]) + '" stroke="rgba(0,0,0,.4)" stroke-width="1"/>';
    const am = i * seg + seg / 2, rad = am * Math.PI / 180, lx = cx + 106 * Math.sin(rad), ly = cy - 106 * Math.cos(rad);
    html += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="#fff" font-family="Inter, system-ui, sans-serif" font-size="15" text-anchor="middle" dominant-baseline="middle" transform="rotate(' + am.toFixed(1) + ' ' + lx.toFixed(1) + ' ' + ly.toFixed(1) + ')">' + (segs[i] === 0 ? '✕' : segs[i] + '×') + '</text>';
  }
  html += '<circle cx="160" cy="160" r="150" fill="none" stroke="rgba(168,85,247,.55)" stroke-width="3"/>';
  g.innerHTML = html; g.style.transform = 'rotate(' + wheelRot + 'deg)'; wheelRiskBuilt = risk;
}
async function wheelSpin() {
  if (wheelSpinning) return;
  const bet = int('wBet'); if (!bet) return toast('Mise invalide', 2800, 'error');
  const risk = wheelRisk();
  if (wheelRiskBuilt !== risk) renderWheel();
  let d; try { d = await api('/play/wheel', 'POST', { bet, risk }); } catch (e) { return toast(e.message, 4000, 'error'); }
  wheelSpinning = true; $('wBtn').disabled = true;
  const rs = $('wheelRisk'); if (rs) rs.disabled = true;
  { const res = $('wResult'); if (res) { res.dataset.state = 'idle'; res.textContent = ''; } }
  const n = WHEEL[risk].length, seg = 360 / n, mid = d.index * seg + seg / 2, jitter = (Math.random() - .5) * (seg * .6);
  const base = Math.ceil(wheelRot / 360) * 360; wheelRot = base + 360 * 6 - mid + jitter;
  $('wheelG').style.transform = 'rotate(' + wheelRot + 'deg)';
  setTimeout(() => {
    wheelSpinning = false; $('wBtn').disabled = false; if (rs) rs.disabled = false;
    const machine = $('view-wheel').querySelector('.machine');
    gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
  }, 4700);
}
```

Notes :
- L'ancien `buildWheel()` (avec le verrou `wheelBuilt`) et `let WHEEL = [array]` disparaissent au profit de `renderWheel()` (re-dessine selon le niveau) et du record `WHEEL`.
- `font-size` du label passé de 17 à 15 (les valeurs comme « 0.5× » / « 50× » sont plus longues).

- [ ] **Step 4 : Câbler le rendu au boot + au changement de niveau**

Modify `public/casino.js` — dans le boot (≈ L.660-665) :
- La ligne `if (cfg.wheel) WHEEL = cfg.wheel;` reste valable (cfg.wheel est désormais le record). La garder telle quelle.
- Après l'init, AJOUTER le rendu de la roue et le listener du sélecteur, à côté de celui du Plinko. Remplacer :

```js
  const riskSel = $('plinkoRisk'); if (riskSel) riskSel.addEventListener('change', () => drawPlinko());
```
par :
```js
  const riskSel = $('plinkoRisk'); if (riskSel) riskSel.addEventListener('change', () => drawPlinko());
  renderWheel();
  const wRiskSel = $('wheelRisk'); if (wRiskSel) wRiskSel.addEventListener('change', () => renderWheel());
```

- **Important** : `switchTab` appelle aussi `buildWheel()` (≈ L.174 : `if (v === 'wheel') buildWheel();`). Le remplacer par `renderWheel()` :
  ```js
  if (v === 'wheel')   renderWheel();
  ```
  Après ces changements, `buildWheel` et `wheelBuilt` n'existent plus nulle part (vérifié par le grep de Step 5).

- [ ] **Step 5 : Vérifier**

Le front est statique (no-cache) → pas de redémarrage, F5. Vérifs structurelles :

```bash
cd "C:/Users/info/Documents/DEV/Casino_Online_GTARP"
bun test tests/wheel.test.ts 2>&1 | tail -2          # non-régression backend : PASS
curl -s -o /dev/null -w "casino %{http_code}\n" http://localhost:3000/casino   # 200
grep -c 'id="wheelRisk"' public/casino.html          # 1
grep -c 'function renderWheel' public/casino.js       # 1
grep -c 'buildWheel' public/casino.js                 # 0 (supprimé)
```
Plus **vérification visuelle (utilisateur)** : la roue se redessine en changeant de niveau (Faible montre des 0,5×/petits sans ✕, Élevé montre le 50× + beaucoup de ✕) ; la rotation tombe sur le bon segment ; toast seulement sur gain net ; couleurs dans la charte violette.

- [ ] **Step 6 : Commit**

```bash
git add public/casino.html public/casino.js
git commit -m "feat(casino/roue): selecteur de niveau + roue redessinee par risque (front)"
```

---

## Notes d'exécution

- **Task 1 touche le backend** (`games.ts`/`server.ts`) → **redémarrer le serveur** (kill bun PowerShell + relance) avant de tester les routes. **Task 2 est front pur** → F5 suffit.
- La **vérification visuelle finale** (rendu de la roue par niveau, rotation, lisibilité des labels longs comme « 0.5× »/« 50× ») est faite par l'utilisateur — les sous-agents valident le structurel (test EV, routes, présence du markup).
- Le **bridage cagnotte** s'applique par niveau sans code spécifique : à cagnotte faible, les gros segments (50×, 15×) sont non payables → la roue tombe sur du payable. RTP global 0,70 inchangé quel que soit le niveau.
