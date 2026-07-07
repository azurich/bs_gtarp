# Jackpot admin v2 (multiplicateur réel forcé) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger le jackpot admin : au lieu de créditer un montant plat, forcer le prochain jeu à multiplicateur (slots/roue/plinko/dé) à **jouer normalement et tomber sur un vrai multiplicateur** tel que `mise × mult` approche une cible (30-60 % de la cagnotte) sans la dépasser, toujours payable ; sinon (mise trop grosse) pas de jackpot, il reste armé.

**Architecture:** Fonctions pures dans `games.ts` (choix + forçage du multiplicateur par jeu). Un helper serveur `jackpotResolve()` calcule la cible, choisit le multiplicateur réel, force le résultat et fait la compta ; branché dans les 4 routes à multiplicateur. Le front v1 (overlay `showJackpot` + gardes `d.jackpot`) est **retiré** : le résultat forcé est une réponse de jeu **normale** → animation et célébration de gain existantes.

**Tech Stack:** Bun + ElysiaJS + bun:sqlite, bun:test, front vanilla.

## Global Constraints

- **4 jeux uniquement** : slots, roue, plinko, dé. Le hook est **retiré** de `/api/bj/deal` et `/api/mines/start`.
- **Cible** : `pct = 0.30 + Math.random()*0.30` ; `target = G.jackpotAmount(pendingJackpot.base, pool, CASINO_RESERVE, pct)` (déjà en place ; `pool = max(0, wagered-paid)`, `CASINO_RESERVE = 0.30`).
- **Choix** : `desiredMult = bet>0 ? target/bet : 0` ; `chosenMult = G.pickJackpotMult(multsDuJeu, desiredMult)` = plus grand mult réel `≤ desiredMult`, sinon `null`.
- **`null` → pas de jackpot** : le jeu se déroule normalement, `pendingJackpot` reste armé. **Non-`null`** → `charge` (400 si insuffisant), résultat forcé, `payout(gain)`, `bookCasino(bet, gain)`, `awardXP`, `recordHistory(gameKey, bet, gain, 'jackpot')`, `logEvent(armedBy, 'admin', …)`, `pendingJackpot = null`, réponse = **réponse normale du jeu** (reels/index/bin/roll + gain).
- **Multiplicateurs par jeu** : slots `[20,8,3,2,1.75,1.25]` (brelans 7️⃣/💎/🔔/🍒/⭐/🍋) ; roue = valeurs distinctes de `WHEEL[risk]` ; plinko = valeurs distinctes de `PK_MULT[risk]` ; dé = seul mult `(100/chance)×RTP` (victoire forcée si payable).
- **Solvabilité** : `gain = bet×chosenMult ≤ target ≤ pool` → toujours payable.
- **Conservé** : `pendingJackpot`, endpoints admin `GET/POST/DELETE /api/admin/jackpot`, bloc admin, `jackpotAmount`. **Retiré** : `awardJackpot` (v1), le front v1.
- Commits avec trailers `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ`. Backend → image prod à reconstruire (CI). Front servi sans cache (F5).

---

## File Structure
- `src/games.ts` — Task 1 : `pickJackpotMult`, `slotsJackpotMults`/`slotsJackpot`, `wheelMults`/`wheelJackpot`, `plinkoMults`/`plinkoJackpot`, `diceMult`.
- `tests/jackpot.test.ts` — Task 1 (étend le fichier existant).
- `src/server.ts` — Task 2 : retirer `awardJackpot` + les 6 hooks v1 ; ajouter `jackpotResolve` + hook v2 dans les 4 routes.
- `public/casino.js` + `public/casino.css` — Task 3 : retirer `showJackpot`, les 6 gardes `d.jackpot`, l'overlay `.jackpot-*`.

---

### Task 1 : games.ts — helpers de forçage + tests

**Files:**
- Modify: `src/games.ts` (ajouts ; ne rien retirer)
- Modify: `tests/jackpot.test.ts` (ajouts)

**Interfaces:**
- Consumes : `WHEEL`, `PK_MULT`, `RTP`, `rnd` (déjà dans games.ts).
- Produces (Task 2) :
  - `pickJackpotMult(mults: number[], desiredMult: number): number | null`
  - `slotsJackpotMults(): number[]` ; `slotsJackpot(bet: number, mult: number): { reels: string[]; mult: number; gain: number }`
  - `wheelMults(risk: string): number[]` ; `wheelJackpot(bet: number, risk: string, mult: number): { index: number; mult: number; gain: number }`
  - `plinkoMults(risk: string): number[]` ; `plinkoJackpot(bet: number, risk: string, mult: number): { bin: number; mult: number; gain: number }`
  - `diceMult(chance: number): number`

- [ ] **Step 1 : Écrire les tests (ajouter à `tests/jackpot.test.ts`)**

Ajouter en tête l'import des symboles nécessaires et les tests :
```ts
import { pickJackpotMult, slotsJackpot, slotsJackpotMults, wheelMults, wheelJackpot, plinkoMults, plinkoJackpot, diceMult, WHEEL, PK_MULT } from '../src/games.ts'

test('pickJackpotMult : plus grand <= desired, sinon null', () => {
  const m = [20, 8, 3, 2, 1.75, 1.25]
  expect(pickJackpotMult(m, 45)).toBe(20)     // desired > top -> top
  expect(pickJackpotMult(m, 5)).toBe(3)       // 3 <= 5 < 8
  expect(pickJackpotMult(m, 2.5)).toBe(2)
  expect(pickJackpotMult(m, 1)).toBe(null)    // rien <= 1
})

test('slotsJackpot : brelan du bon symbole + gain', () => {
  expect(slotsJackpotMults()).toEqual([20, 8, 3, 2, 1.75, 1.25])
  const r = slotsJackpot(500, 20)
  expect(r.reels).toEqual(['7️⃣', '7️⃣', '7️⃣'])
  expect(r.mult).toBe(20)
  expect(r.gain).toBe(10000)
})

test('wheelJackpot : index porte le mult demandé', () => {
  const top = wheelMults('high')[0]                 // 50
  const w = wheelJackpot(100, 'high', top)
  expect(WHEEL.high[w.index]).toBe(top)
  expect(w.gain).toBe(Math.round(100 * top))
})

test('plinkoJackpot : bin porte le mult demandé', () => {
  const top = plinkoMults('high')[0]
  const p = plinkoJackpot(100, 'high', top)
  expect(PK_MULT.high[p.bin]).toBe(top)
  expect(p.gain).toBe(Math.round(100 * top))
})

test('diceMult = (100/chance)*RTP avec clamp', () => {
  expect(diceMult(50)).toBe(+((100 / 50) * 0.70).toFixed(2))  // 1.4
  expect(diceMult(1)).toBe(diceMult(2))                        // clamp bas (2)
  expect(diceMult(99)).toBe(diceMult(95))                      // clamp haut (95)
})
```

- [ ] **Step 2 : Lancer → échec**

Run : `bun test tests/jackpot.test.ts`
Expected : FAIL — fonctions absentes.

- [ ] **Step 3 : Ajouter les helpers dans `src/games.ts`**

À la fin de `src/games.ts` (après `jackpotAmount`), ajouter :
```ts
/* ---------------- JACKPOT ADMIN v2 — forçage du multiplicateur ----------------
   Choisit un vrai multiplicateur du jeu <= desiredMult (cible/mise) et force le
   résultat gagnant correspondant. rnd() est utilisé pour varier l'index/bin. */
export function pickJackpotMult(mults: number[], desiredMult: number): number | null {
  let best: number | null = null
  for (const m of mults) if (m <= desiredMult && (best === null || m > best)) best = m
  return best
}

const SLOTS_JACKPOT: [number, string][] = [[20, '7️⃣'], [8, '💎'], [3, '🔔'], [2, '🍒'], [1.75, '⭐'], [1.25, '🍋']]
export function slotsJackpotMults(): number[] { return SLOTS_JACKPOT.map(([m]) => m) }
export function slotsJackpot(bet: number, mult: number): { reels: string[]; mult: number; gain: number } {
  const sym = (SLOTS_JACKPOT.find(([m]) => m === mult) ?? SLOTS_JACKPOT[0])[1]
  return { reels: [sym, sym, sym], mult, gain: Math.round(bet * mult) }
}

export function wheelMults(risk: string): number[] {
  const seg = WHEEL[risk as keyof typeof WHEEL] ?? WHEEL.med
  return [...new Set(seg)].sort((a, b) => b - a)
}
export function wheelJackpot(bet: number, risk: string, mult: number): { index: number; mult: number; gain: number } {
  const seg = WHEEL[risk as keyof typeof WHEEL] ?? WHEEL.med
  const idxs = seg.map((v, i) => (v === mult ? i : -1)).filter(i => i >= 0)
  const index = idxs.length ? idxs[(rnd() * idxs.length) | 0] : 0
  return { index, mult, gain: Math.round(bet * mult) }
}

export function plinkoMults(risk: string): number[] {
  const arr = PK_MULT[risk] ?? PK_MULT.med
  return [...new Set(arr)].sort((a, b) => b - a)
}
export function plinkoJackpot(bet: number, risk: string, mult: number): { bin: number; mult: number; gain: number } {
  const arr = PK_MULT[risk] ?? PK_MULT.med
  const bins = arr.map((v, i) => (v === mult ? i : -1)).filter(i => i >= 0)
  const bin = bins.length ? bins[(rnd() * bins.length) | 0] : 0
  return { bin, mult, gain: Math.round(bet * mult) }
}

export function diceMult(chance: number): number {
  const c = Math.max(2, Math.min(95, chance))
  return +((100 / c) * RTP).toFixed(2)
}
```

- [ ] **Step 4 : Lancer → succès**

Run : `bun test tests/jackpot.test.ts` puis `bun test`
Expected : PASS (nouveaux tests + suite complète).

- [ ] **Step 5 : Commit**
```bash
git add src/games.ts tests/jackpot.test.ts
git commit -m "feat(games): jackpot v2 — helpers forcage multiplicateur (slots/roue/plinko/de) + tests"
```

---

### Task 2 : server.ts — remplacer le hook v1 par la logique v2

**Files:**
- Modify: `src/server.ts`

**Interfaces:**
- Consumes (Task 1) : `G.pickJackpotMult`, `G.slotsJackpotMults`, `G.slotsJackpot`, `G.wheelMults`, `G.wheelJackpot`, `G.plinkoMults`, `G.plinkoJackpot`, `G.diceMult`, `G.jackpotAmount`.
- Produces (Task 3) : les réponses de jeu forcées ont la **forme normale** (pas de champ `jackpot`).

- [ ] **Step 1 : Retirer le helper v1 `awardJackpot`**

Supprimer entièrement la fonction `awardJackpot` (bloc `function awardJackpot(u: User, bet: number, gameKey: string, set: { status?: number }): object { … }`, ~lignes 172-185).

- [ ] **Step 2 : Retirer les 6 hooks v1**

Supprimer ces 6 lignes (dans slots/plinko/wheel/dice/bj-deal/mines-start) :
```ts
      if (pendingJackpot) return awardJackpot(u, bet, 'slots', set)
      if (pendingJackpot) return awardJackpot(u, bet, 'plinko', set)
      if (pendingJackpot) return awardJackpot(u, bet, 'wheel', set)
      if (pendingJackpot) return awardJackpot(u, bet, 'dice', set)
      if (pendingJackpot) return awardJackpot(u, bet, 'blackjack', set)
      if (pendingJackpot) return awardJackpot(u, bet, 'mines', set)
```
(Les deux dernières — blackjack et mines — ne sont PAS remplacées : BJ/Démineur sont hors périmètre.)

- [ ] **Step 3 : Ajouter le helper `jackpotResolve`**

À l'emplacement où était `awardJackpot` (après la fonction `bookCasino`), ajouter :
```ts
// Jackpot v2 : force un vrai multiplicateur du jeu <= cible/mise. Renvoie la réponse
// de jeu forcée, un objet erreur (crédits insuffisants), ou null (pas de jackpot -> reste armé).
function jackpotResolve(
  u: User, bet: number, gameKey: string, mults: number[],
  forcer: (m: number) => Record<string, unknown> & { gain: number },
  set: { status?: number },
): object | null {
  const c = Q.getCasino.get() as { wagered: number; paid: number }
  const pool = Math.max(0, c.wagered - c.paid)
  const pct  = 0.30 + Math.random() * 0.30
  const target = G.jackpotAmount(pendingJackpot!.base, pool, CASINO_RESERVE, pct)
  const m = G.pickJackpotMult(mults, bet > 0 ? target / bet : 0)
  if (m === null) return null                       // mise trop grosse -> pas de jackpot, reste armé
  if (!charge(u, bet, gameKey)) { set.status = 400; return { error: 'Crédits Club insuffisants' } }
  const r = forcer(m)
  payout(u, r.gain, gameKey); awardXP(u.id, bet); bookCasino(bet, r.gain)
  recordHistory(u.id, gameKey, bet, r.gain, 'jackpot')
  logEvent(pendingJackpot!.armedBy, 'admin',
    'JACKPOT ' + gameKey + ' par ' + u.username + ' : ' + r.gain + ' (x' + m + ', cible ' + Math.round(target) + ')', r.gain)
  pendingJackpot = null
  return { ...r, ...userSnapshot(u.id) }
}
```

- [ ] **Step 4 : Brancher le hook v2 dans les 4 routes**

**Slots** — remplacer la ligne supprimée (juste après `if (!bet) {...}`) par :
```ts
      if (pendingJackpot) {
        const jr = jackpotResolve(u, bet, 'slots', G.slotsJackpotMults(), m => G.slotsJackpot(bet, m), set)
        if (jr) return jr
      }
```
**Plinko** — insérer **après** `const risk = (['low', 'med', 'high'] as const).find(x => x === b.risk) ?? 'med'` (avant `charge`) :
```ts
      if (pendingJackpot) {
        const jr = jackpotResolve(u, bet, 'plinko', G.plinkoMults(risk), m => G.plinkoJackpot(bet, risk, m), set)
        if (jr) return jr
      }
```
**Wheel** — insérer **après** `const risk = (['low', 'med', 'high'] as const).find(x => x === b.risk) ?? 'med'` (avant `charge`) :
```ts
      if (pendingJackpot) {
        const jr = jackpotResolve(u, bet, 'wheel', G.wheelMults(risk), m => G.wheelJackpot(bet, risk, m), set)
        if (jr) return jr
      }
```
**Dice** — insérer **après** `const chance = Math.max(2, Math.min(95, Math.floor(Number(b.chance) || 50)))` (avant `charge`) :
```ts
      if (pendingJackpot) {
        const dm = G.diceMult(chance)
        const jr = jackpotResolve(u, bet, 'dice', [dm], m => ({ roll: +(Math.random() * chance).toFixed(2), win: true, mult: m, gain: Math.round(bet * m) }), set)
        if (jr) return jr
      }
```

- [ ] **Step 5 : Compiler + smoke + suite**

Run : `bun build src/server.ts --target=bun >/dev/null && echo OK`
Expected : `OK` (plus aucune référence à `awardJackpot`).
Run : `grep -c "awardJackpot" src/server.ts`
Expected : `0`.
Run : `bun test`
Expected : PASS.

- [ ] **Step 6 : Commit**
```bash
git add src/server.ts
git commit -m "feat(server/jackpot): v2 — force un vrai multiplicateur payable (4 jeux), retire awardJackpot v1"
```

---

### Task 3 : casino — retirer le front jackpot v1

**Files:**
- Modify: `public/casino.js` (retirer `showJackpot` + les 6 gardes `d.jackpot`)
- Modify: `public/casino.css` (retirer l'overlay `.jackpot-*`)

**Interfaces:**
- Consumes : rien (les réponses forcées v2 sont des réponses de jeu normales — traitées par les handlers existants).

- [ ] **Step 1 : Retirer les 6 gardes `d.jackpot`**

Dans `public/casino.js`, supprimer les 6 lignes qui commencent par `if (d.jackpot) {` (dans les handlers slots, bjDeal, minesStartGame, plinko, wheel, dice). Repère : `grep -n "d.jackpot" public/casino.js`.

- [ ] **Step 2 : Retirer la fonction `showJackpot`**

Supprimer entièrement la fonction `function showJackpot(gain) { … }` (et son commentaire) dans `public/casino.js`.

- [ ] **Step 3 : Retirer l'overlay CSS**

Dans `public/casino.css`, supprimer le bloc de règles `.jackpot-overlay`, `.jackpot-overlay.show`, `.jackpot-box`, `.jackpot-overlay.show .jackpot-box`, `.jackpot-title`, `.jackpot-amount`, `.jackpot-sub` (et le commentaire `/* ── Overlay Jackpot … ── */`).

- [ ] **Step 4 : Vérifier (aucune trace + parse)**

Run : `grep -rn "showJackpot\|d.jackpot\|jackpot-overlay\|jackpot-box" public/casino.js public/casino.css`
Expected : aucune sortie.
Run : `bun build public/casino.js --target=browser >/dev/null 2>&1 && echo "PARSE OK"`
Expected : `PARSE OK`.
(Rendu réel : vérif manuelle — armer, jouer, voir un gros gain normal.)

- [ ] **Step 5 : Commit**
```bash
git add public/casino.js public/casino.css
git commit -m "refactor(casino): retire le front jackpot v1 (le gain force s'anime comme un gros gain normal)"
```

---

## Self-Review

**1. Couverture du spec v2 :**
- Cible 30-60 % (GROS/PETIT) via `jackpotAmount` → Task 2 (jackpotResolve). ✅
- `desiredMult = target/bet`, `pickJackpotMult` → Task 1 + Task 2. ✅
- Forçage par jeu (slots/roue/plinko/dé) → Task 1 helpers + Task 2 hooks. ✅
- `null` → pas de jackpot, reste armé → Task 2 (`if (m===null) return null` + `if (jr) return jr` sinon fall-through). ✅
- Solvabilité (gain ≤ target ≤ pool) → Task 1 (pickJackpotMult ≤ desired) + spec. ✅
- 4 jeux only, retrait bj/mines → Task 2 (Step 2). ✅
- Réponse de jeu normale + retrait front v1 → Task 2 (forme) + Task 3. ✅
- Conservé : pendingJackpot, endpoints admin, bloc admin, jackpotAmount → non touchés. ✅

**2. Placeholders :** aucun ; tout le code est fourni.

**3. Cohérence des types/noms :** `pickJackpotMult`, `slotsJackpotMults`/`slotsJackpot`, `wheelMults`/`wheelJackpot`, `plinkoMults`/`plinkoJackpot`, `diceMult` identiques Task 1↔Task 2. `jackpotResolve(u,bet,gameKey,mults,forcer,set)` cohérent. Les `forcer` renvoient `{...gameFields, mult, gain}` ; jackpotResolve spread + snapshot. Réponses forcées = forme normale des jeux (reels/index/bin/roll + gain), consommées par les handlers existants (Task 3 retire les gardes v1 mortes).
