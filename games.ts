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
   Paytable affichée : 7️⃣=20× 💎=8× 🔔=3× 🍒=2× ⭐/🍋=1.5× paire=1.5×
   EV = .003·20 + .008·8 + .015·3 + .02·2 + .025·1.5 + .30·1.5 = 0.6965
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
  else if (r < 0.071) { reels = fill3(randItem(['⭐', '🍋'])); mult = 1.5 }
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
   16 segments visuels, sélection pondérée (invisible au joueur).
   EV = Σ pᵢ·multᵢ = 0.70 exactement, multiplicateurs ronds conservés.
   15×→p .005 | 5×→p .02 | 2×(×2)→p .03 ch. | 1.5×(×4)→p .0675 ch. | 0×(×8)→p .080625 ch.
*/
export const WHEEL   = [0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0, 15]
const WHEEL_W = [0.080625, 0.0675, 0.080625, 0.03, 0.080625, 0.0675, 0.080625, 0.02,
                 0.080625, 0.0675, 0.080625, 0.03, 0.080625, 0.0675, 0.080625, 0.005]
export function playWheel(bet: number, budget: number) {
  // bridage : poids à 0 pour les segments non payables (les 0× passent toujours)
  const w   = WHEEL_W.map((wt, i) => (WHEEL[i] * bet <= budget ? wt : 0))
  const idx = pickWeighted(w)
  const m   = WHEEL[idx]
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
export const BJ_BIAS     = 36    // % de tirages orientés maison → RTP ~70% (calibré par simulation)
export const BJ_WIN_MULT = 1.8   // gain sur victoire normale (mise incluse)
export const BJ_BJ_MULT  = 2.2   // gain sur blackjack naturel (mise incluse)

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

/* ---------------- MINES (stateful) ----------------
   Placement de bombes équitable, AUCUN sauvetage du joueur.
   Marge prélevée par case via MINES_RAKE : RTP = (1-rake)^picks.
   Plus le joueur est cupide, plus la maison gagne.
*/
export const MINES_RAKE = 0.11   // ~11% de marge par case dévoilée
export function placeBombs(n: number): Set<number> {
  const s = new Set<number>()
  while (s.size < n) s.add((rnd() * 25) | 0)
  return s
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
