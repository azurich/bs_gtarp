/* ============================================================
   BlackState Casino — logique de jeu (côté serveur)
   Le client n'envoie que sa mise ; le serveur décide l'issue.

   MODÈLE ÉCONOMIQUE — Cagnotte / redistribution
   ────────────────────────────────────────────────
   1) Marge de base : les paytables ont une EV = mise × RTP (RTP=0.70).
   2) Cagnotte : un `budget` (= 30% de la cagnotte globale) est passé à chaque
      jeu. Le tirage est BRIDÉ EN AMONT : seuls les multiplicateurs dont le gain
      ≤ budget sont tirables. À cagnotte vide (budget 0) → que des x0.
   Les gros multiplicateurs restent affichés mais injouables tant que la
   cagnotte ne peut pas les payer. La comptabilité globale est dans server.ts.
============================================================ */

export const RTP = 0.70                 // 70% reversé, 30% de marge maison

export const GAME_KEYS = ['slots', 'blackjack', 'mines', 'plinko', 'wheel', 'dice'] as const
export type GameKey = typeof GAME_KEYS[number]

export interface Card {
  r: string
  s: string
  c: 'b' | 'red'
}

const rnd      = () => Math.random()
const randItem = <T>(a: T[]): T => a[(rnd() * a.length) | 0]
const shuffle  = <T>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
export const favored = (bias: number) => rnd() * 100 < bias

/* tirage pondéré : renvoie l'index choisi selon les poids fournis */
function pickWeighted(weights: number[]): number {
  const tot = weights.reduce((a, b) => a + b, 0)
  let r = rnd() * tot
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i }
  return weights.length - 1
}

/* ---------------- SLOTS ----------------
   Probabilités calibrées pour EV ≈ 0.70 × mise.
   37,1% des tours rapportent quelque chose (surtout des paires).
   Paytable affichée : 7️⃣=20× 💎=8× 🔔=3× 🍒=2× ⭐=1.75× 🍋=1.25× paire=1.5×
   EV = .003·20 + .008·8 + .015·3 + .02·2 + .0125·1.75 + .0125·1.25 + .30·1.5 = 0.6965
*/
const SYM = ['🍒', '🔔', '💎', '7️⃣', '🍋', '⭐']
function fill3(s: string): string[] { return [s, s, s] }
function twoOfKind(): string[] {
  const s = randItem(SYM); let o = randItem(SYM)
  while (o === s) o = randItem(SYM)
  return shuffle([s, s, o])
}
function loseCombo(): string[] {
  let a: string, b: string, c: string
  do { a = randItem(SYM); b = randItem(SYM); c = randItem(SYM) } while (a === b || b === c || a === c)
  return [a, b, c]
}
export function playSlots(bet: number, budget: number) {
  const r = rnd()
  let reels: string[], mult: number
  if      (r < 0.003) { reels = fill3('7️⃣');                 mult = 20  }
  else if (r < 0.011) { reels = fill3('💎');                 mult = 8   }
  else if (r < 0.026) { reels = fill3('🔔');                 mult = 3   }
  else if (r < 0.046) { reels = fill3('🍒');                 mult = 2   }
  else if (r < 0.0585){ reels = fill3('⭐');                  mult = 1.75 }
  else if (r < 0.071) { reels = fill3('🍋');                  mult = 1.25 }
  else if (r < 0.371) { reels = twoOfKind();                 mult = 1.5 }
  else                { reels = loseCombo();                 mult = 0   }
  // bridage cagnotte : un gain non payable devient une perte (rouleaux perdants)
  if (mult > 0 && bet * mult > budget) { reels = loseCombo(); mult = 0 }
  return { reels, mult, gain: Math.round(bet * mult) }
}

/* ---------------- PLINKO ----------------
   Distribution binomiale réelle (12 rangées, pièce équilibrée).
   Les multiplicateurs de chaque profil de risque sont normalisés
   pour que l'espérance pondérée = RTP, identique sur les 3 risques.
*/
const PK_BINOM = [1, 12, 66, 220, 495, 792, 924, 792, 495, 220, 66, 12, 1].map(c => c / 4096)
function normMults(shape: number[]): number[] {
  const ev = shape.reduce((s, m, i) => s + m * PK_BINOM[i], 0)
  const k  = RTP / ev
  return shape.map(m => +(m * k).toFixed(2))
}
// Profils refondus avec des x0 : faible = régulier (jamais de perte totale),
// moyen = équilibré (perte au centre), élevé = haute variance (perte le plus
// souvent, gros bords rares). Les niveaux veulent enfin dire quelque chose.
const PK_SHAPE: Record<string, number[]> = {
  low:  [4, 2, 1.3, 1.0, 0.7, 0.55, 0.5, 0.55, 0.7, 1.0, 1.3, 2, 4],
  med:  [10, 3.5, 1.6, 0.9, 0.4, 0.15, 0, 0.15, 0.4, 0.9, 1.6, 3.5, 10],
  high: [22, 8, 3, 0.6, 0, 0, 0, 0, 0, 0.6, 3, 8, 22],
}
export const PK_MULT: Record<string, number[]> = {
  low:  normMults(PK_SHAPE.low),
  med:  normMults(PK_SHAPE.med),
  high: normMults(PK_SHAPE.high),
}
// Tirage bridé par la cagnotte : seules les cases payables (gain ≤ budget) sont
// tirables ; les cases à 0 passent toujours. La bille tombe donc sur une case payable.
export function playPlinko(bet: number, risk: string, budget: number) {
  const mult = PK_MULT[risk] ?? PK_MULT.med
  const w    = PK_BINOM.map((p, i) => (mult[i] * bet <= budget ? p : 0))
  const bin  = pickWeighted(w)
  const m    = mult[bin]
  return { bin, mult: m, gain: Math.round(bet * m) }
}

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
  if (Wb === 0 || balValue === RTP) throw new Error('normWheel: balancier invalide (Wb=0 ou balValue=RTP)')
  const f = (RTP * B - A) / (Wb * (balValue - RTP))
  if (!(f >= 0)) throw new Error('normWheel: facteur negatif (poids bruts incompatibles avec RTP)')
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

/* ---------------- DICE ----------------
   Tir uniforme. Gagne si roll < chance. Multiplicateur équitable × RTP.
   EV = (chance/100) · mise · (100/chance · RTP) = mise · RTP, exact pour tout seuil.
*/
export function playDice(bet: number, chance: number, budget: number) {
  chance = Math.max(2, Math.min(95, chance))
  const mult = (100 / chance) * RTP
  // bridage : si le gain n'est pas payable, le tir est forcé perdant (roll ≥ chance)
  const affordable = bet * mult <= budget
  const roll = affordable
    ? +(rnd() * 100).toFixed(2)
    : +(chance + rnd() * (100 - chance)).toFixed(2)
  const win = roll < chance
  return {
    roll, win,
    mult: +mult.toFixed(2),
    gain: win ? Math.round(bet * mult) : 0,
  }
}

/* ---------------- BLACKJACK (stateful) ----------------
   Croupier fortement avantagé via BJ_BIAS (cartes orientées) +
   gains réduits. RTP visé ~0.70 (variable selon le jeu du joueur).
*/
export const BJ_BIAS     = 47    // % de tirages orientés maison → RTP ~70% (recalibré par simulation pour mult 2.0/2.5)
export const BJ_WIN_MULT = 2.0   // gain sur victoire normale (mise incluse) — paiement "réel" ×2
export const BJ_BJ_MULT  = 2.5   // gain sur blackjack naturel (mise incluse) — paiement "réel" 3:2

const SUITS: [string, 'b' | 'red'][] = [['♠', 'b'], ['♣', 'b'], ['♥', 'red'], ['♦', 'red']]
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export function freshDeck(): Card[] {
  const d: Card[] = []
  for (const [s, c] of SUITS) for (const r of RANKS) d.push({ r, s, c })
  return shuffle(d)
}
export function cardVal(c: Card): number {
  if (c.r === 'A') return 11
  if (['K', 'Q', 'J'].includes(c.r)) return 10
  return +c.r
}
export function handVal(h: Card[]): number {
  let v = 0, a = 0
  for (const c of h) { v += cardVal(c); if (c.r === 'A') a++ }
  while (v > 21 && a) { v -= 10; a-- }
  return v
}
export function bjDraw(deck: Card[], hand: Card[], otherIsPlayer: boolean, bias: number): Card {
  if (deck.length < 10) { const fresh = freshDeck(); deck.push(...fresh) }
  if (favored(bias)) {
    const cur = handVal(hand)
    const idx = deck.findIndex(c => {
      const nv = cur + cardVal(c)
      // pour le joueur : on cherche à le faire sauter ; pour le croupier : à le renforcer
      return otherIsPlayer
        ? (cur >= 12 && nv > 21)                       // pousse le joueur au bust
        : ((cur >= 12 && nv <= 21) || cardVal(c) <= 5) // aide le croupier à finir bien
    })
    if (idx >= 0) return deck.splice(idx, 1)[0]
  }
  return deck.splice((rnd() * deck.length) | 0, 1)[0]
}

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

// Plafond de mise Blackjack imposé par la cagnotte (gain max d'une main = mise × BJ_BJ_MULT)
// +1e-9 corrige l'arrondi flottant IEEE-754 (ex : 2200/2.2 = 999.9999… sans epsilon)
export function bjMaxBet(budget: number): number {
  return Math.floor(budget / BJ_BJ_MULT + 1e-9)
}

/* ---------------- INFOS PUBLIQUES (admin lecture seule) ---------------- */
export const GAME_INFO = [
  { key: 'slots',     label: 'Slots',     rtp: 0.70, note: '37% de tours payants · jackpot 7️⃣ = 20×' },
  { key: 'dice',      label: 'Dice',      rtp: 0.70, note: 'RTP exact quel que soit le seuil choisi' },
  { key: 'wheel',     label: 'Roue',      rtp: 0.70, note: 'Jackpot 15× rare, beaucoup de 0×' },
  { key: 'plinko',    label: 'Plinko',    rtp: 0.70, note: 'RTP identique sur les 3 niveaux de risque' },
  { key: 'blackjack', label: 'Blackjack', rtp: 0.70, note: 'Croupier avantagé · gains 1.8× / BJ 2.2×' },
  { key: 'mines',     label: 'Démineur',  rtp: 0.70, note: '~11% de marge par case · la cupidité coûte cher' },
] as const

/* ---------------- JACKPOT ADMIN ----------------
   Montant d'un jackpot : pct du pool (GROS) ou du budget = reserve*pool (PETIT). */
export function jackpotAmount(base: 'pool' | 'budget', pool: number, reserve: number, pct: number): number {
  const p = Math.max(0, pool)
  const baseAmount = base === 'pool' ? p : reserve * p
  return Math.round(baseAmount * pct)
}

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
  return [...new Set(seg)].filter(m => m > 1).sort((a, b) => b - a)
}
export function wheelJackpot(bet: number, risk: string, mult: number): { index: number; mult: number; gain: number } {
  const seg = WHEEL[risk as keyof typeof WHEEL] ?? WHEEL.med
  const idxs = seg.map((v, i) => (v === mult ? i : -1)).filter(i => i >= 0)
  const index = idxs.length ? idxs[(rnd() * idxs.length) | 0] : 0
  return { index, mult, gain: Math.round(bet * mult) }
}

export function plinkoMults(risk: string): number[] {
  const arr = PK_MULT[risk] ?? PK_MULT.med
  return [...new Set(arr)].filter(m => m > 1).sort((a, b) => b - a)
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
