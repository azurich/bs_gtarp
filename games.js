/* ============================================================
   Logique de jeu CÔTÉ SERVEUR.
   Le client n'envoie que sa mise ; le serveur décide l'issue.
   bias  = fréquence de gain (0-100, 50 ≈ équilibré)
   payout = % du gain réellement versé (100 = multiplicateurs affichés)
============================================================ */
const GAME_KEYS = ['slots', 'blackjack', 'mines', 'plinko', 'wheel', 'dice'];

const rnd = () => Math.random();
const randItem = (a) => a[(rnd() * a.length) | 0];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const favored = (bias) => rnd() * 100 < bias;
const scale = (amount, payout) => Math.round(amount * (payout ?? 100) / 100);

/* ---------------- SLOTS ---------------- */
const SYM = ['🍒', '🔔', '💎', '7️⃣', '🍋', '⭐'];
const SLOT_PAY = { '7️⃣': 50, '💎': 25, '🔔': 12, '🍒': 8, '⭐': 5, '🍋': 5 };
function fill3(s) { return [s, s, s]; }
function twoOfKind() { const s = randItem(SYM); let o = randItem(SYM); while (o === s) o = randItem(SYM); return shuffle([s, s, o]); }
function loseCombo() { let a, b, c; do { a = randItem(SYM); b = randItem(SYM); c = randItem(SYM); } while (a === b || b === c || a === c); return [a, b, c]; }
function evalSlots(r, bet) {
  if (r[0] === r[1] && r[1] === r[2]) return bet * (SLOT_PAY[r[0]] || 5);
  if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) return bet * 1.5;
  return 0;
}
function playSlots(bet, bias, payout) {
  let reels;
  if (favored(bias)) {
    const r = rnd();
    if (r < 0.10) reels = ['7️⃣', '7️⃣', '7️⃣'];
    else if (r < 0.25) reels = fill3('💎');
    else if (r < 0.45) reels = fill3(randItem(['🔔', '🍒']));
    else if (r < 0.75) reels = fill3(randItem(SYM));
    else reels = twoOfKind();
  } else reels = loseCombo();
  return { reels, gain: scale(evalSlots(reels, bet), payout) };
}

/* ---------------- PLINKO ---------------- */
const PK_ROWS = 12;
const PK_MULT = {
  low:  [2.1, 1.6, 1.3, 1.1, 1, 0.7, 0.5, 0.7, 1, 1.1, 1.3, 1.6, 2.1],
  med:  [8.1, 3, 1.6, 1, 0.7, 0.4, 0.3, 0.4, 0.7, 1, 1.6, 3, 8.1],
  high: [26, 8, 3, 1.2, 0.5, 0.3, 0.2, 0.3, 0.5, 1.2, 3, 8, 26],
};
function weightedBin(mult, fav) {
  const w = mult.map(m => fav ? Math.pow(m, 1.4) + 0.05 : 1 / (Math.pow(m, 1.1) + 0.2));
  const tot = w.reduce((a, b) => a + b, 0); let r = rnd() * tot;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return w.length - 1;
}
function playPlinko(bet, risk, bias, payout) {
  const mult = PK_MULT[risk] || PK_MULT.med;
  const bin = weightedBin(mult, favored(bias));
  const m = mult[bin];
  return { bin, mult: m, gain: scale(bet * m, payout) };
}

/* ---------------- WHEEL ---------------- */
const WHEEL = [0, 1.5, 0, 2, 0, 1.5, 3, 0, 1.5, 2, 0, 5, 0, 1.5, 10, 50];
function pickWheelSeg(fav) {
  const w = WHEEL.map(m => fav ? Math.pow(m + 0.3, 1.35) : 1 / (Math.pow(m, 1.25) + 0.35));
  const tot = w.reduce((a, b) => a + b, 0); let r = rnd() * tot;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return w.length - 1;
}
function playWheel(bet, bias, payout) {
  const idx = pickWheelSeg(favored(bias));
  const m = WHEEL[idx];
  return { index: idx, mult: m, gain: scale(bet * m, payout) };
}

/* ---------------- DICE ---------------- */
function playDice(bet, chance, bias, payout) {
  chance = Math.max(2, Math.min(95, chance));
  const fairMult = 100 / chance;
  const r1 = rnd() * 100, r2 = rnd() * 100;
  const useMin = rnd() * 100 < bias;          // faveur joueur = garde le meilleur tirage
  const roll = useMin ? Math.min(r1, r2) : Math.max(r1, r2);
  const win = roll < chance;
  return { roll: +roll.toFixed(2), win, mult: +(fairMult * (payout / 100)).toFixed(2), gain: win ? scale(bet * fairMult, payout) : 0 };
}

/* ---------------- BLACKJACK (stateful) ---------------- */
const SUITS = [['♠', 'b'], ['♣', 'b'], ['♥', 'red'], ['♦', 'red']];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function freshDeck() { const d = []; for (const [s, c] of SUITS) for (const r of RANKS) d.push({ r, s, c }); return shuffle(d); }
function cardVal(c) { if (c.r === 'A') return 11; if (['K', 'Q', 'J'].includes(c.r)) return 10; return +c.r; }
function handVal(h) { let v = 0, a = 0; for (const c of h) { v += cardVal(c); if (c.r === 'A') a++; } while (v > 21 && a) { v -= 10; a--; } return v; }
function bjDraw(deck, hand, otherIsPlayer, bias) {
  if (deck.length < 10) { const fresh = freshDeck(); deck.push(...fresh); }
  if (favored(bias)) {
    const cur = handVal(hand);
    const idx = deck.findIndex(c => {
      const nv = cur + cardVal(c);
      return otherIsPlayer
        ? ((cur <= 11 && cardVal(c) >= 9) || (cur >= 12 && nv <= 21))   // bonne carte pour le joueur
        : ((cur >= 12 && nv > 21) || cardVal(c) <= 3);                  // mauvaise carte pour le croupier
    });
    if (idx >= 0) return deck.splice(idx, 1)[0];
  }
  return deck.splice((rnd() * deck.length) | 0, 1)[0];
}

/* ---------------- MINES (stateful) ---------------- */
function placeBombs(n) { const s = new Set(); while (s.size < n) s.add((rnd() * 25) | 0); return s; }

module.exports = {
  GAME_KEYS, scale, favored,
  playSlots, playPlinko, playWheel, playDice, PK_MULT, WHEEL,
  freshDeck, cardVal, handVal, bjDraw,
  placeBombs,
};
