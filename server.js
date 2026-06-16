/* ============================================================
   NEON SANTOS — serveur API (Express + SQLite)
   Toute la logique d'argent et de win rate vit ICI, pas chez le client.
============================================================ */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const G = require('./games');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const DAY = 86400000;

/* ---------- état des parties "stateful" en mémoire (par user) ---------- */
const activeBJ = new Map();     // userId -> {bet, deck, player, dealer, live}
const activeMines = new Map();  // userId -> {bet, bombs, bombSet, picks, gems, mult, live}

/* ---------- helpers DB ---------- */
const Q = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (username, pass_hash, is_admin, credit, created) VALUES (?,?,?,?,?)'),
  setCredit: db.prepare('UPDATE users SET credit = ? WHERE id = ?'),
  bumpWager: db.prepare('UPDATE users SET credit = credit - ?, wagered = wagered + ?, played = played + 1 WHERE id = ?'),
  bumpWin: db.prepare('UPDATE users SET credit = credit + ?, won = won + ?, biggest = MAX(biggest, ?) WHERE id = ?'),
  addCredit: db.prepare('UPDATE users SET credit = credit + ? WHERE id = ?'),
  setBonus: db.prepare('UPDATE users SET last_bonus = ? WHERE id = ?'),
  delUser: db.prepare('DELETE FROM users WHERE username = ? AND is_admin = 0'),
  allUsers: db.prepare('SELECT username, credit, wagered, is_admin FROM users ORDER BY credit DESC'),
  topUsers: db.prepare('SELECT username, credit, is_admin FROM users ORDER BY credit DESC LIMIT 10'),
  settings: db.prepare('SELECT * FROM settings'),
  setSetting: db.prepare('UPDATE settings SET bias = ?, payout = ? WHERE game = ?'),
  insSession: db.prepare('INSERT INTO sessions (token, user_id, created) VALUES (?,?,?)'),
  getSession: db.prepare('SELECT * FROM sessions WHERE token = ?'),
  delSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  insLog: db.prepare('INSERT INTO logs (ts, username, type, msg, amount) VALUES (?,?,?,?,?)'),
  logsAll: db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 300'),
  logsByType: db.prepare('SELECT * FROM logs WHERE type = ? ORDER BY id DESC LIMIT 300'),
  clearLogs: db.prepare('DELETE FROM logs'),
};

function getSettings() {
  const m = {}; for (const r of Q.settings.all()) m[r.game] = { bias: r.bias, payout: r.payout }; return m;
}
function logEvent(username, type, msg, amount = 0) { Q.insLog.run(Date.now(), username, type, msg, amount); }
function publicUser(u) {
  return { username: u.username, credit: Math.floor(u.credit), admin: !!u.is_admin,
    stats: { wagered: Math.floor(u.wagered), won: Math.floor(u.won), played: u.played, biggest: Math.floor(u.biggest) },
    lastBonus: u.last_bonus };
}
const LABELS = { slots: 'Slots', blackjack: 'Blackjack', mines: 'Démineur', plinko: 'Plinko', wheel: 'Roue', dice: 'Dice' };

/* charge/payout côté serveur — la source de vérité du solde */
function charge(user, bet, gameKey) {
  const fresh = Q.userById.get(user.id);
  if (fresh.credit < bet) return false;
  Q.bumpWager.run(bet, bet, user.id);
  logEvent(user.username, 'bet', 'Mise ' + LABELS[gameKey], -bet);
  return true;
}
function payout(user, gain, gameKey) {
  if (gain <= 0) return;
  Q.bumpWin.run(gain, gain, gain, user.id);
  logEvent(user.username, 'win', 'Gain ' + LABELS[gameKey], gain);
}
function balanceOf(id) { return Math.floor(Q.userById.get(id).credit); }

/* ---------- auth middleware ---------- */
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '') || req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Non connecté' });
  const s = Q.getSession.get(token);
  if (!s) return res.status(401).json({ error: 'Session invalide' });
  const u = Q.userById.get(s.user_id);
  if (!u) return res.status(401).json({ error: 'Compte introuvable' });
  req.user = u; req.token = token; next();
}
function adminOnly(req, res, next) { if (!req.user.is_admin) return res.status(403).json({ error: 'Réservé admin' }); next(); }
const intBet = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : null; };

/* ============================ AUTH ============================ */
app.post('/api/register', (req, res) => {
  const u = String(req.body.user || '').trim(), p = String(req.body.pass || '');
  if (u.length < 3) return res.status(400).json({ error: 'Pseudo trop court (3 min).' });
  if (p.length < 3) return res.status(400).json({ error: 'Mot de passe trop court.' });
  if (Q.userByName.get(u)) return res.status(400).json({ error: 'Ce pseudo existe déjà.' });
  const info = Q.insertUser.run(u, bcrypt.hashSync(p, 10), 0, 1000, Date.now());
  const token = crypto.randomBytes(24).toString('hex');
  const newId = Number(info.lastInsertRowid);
  Q.insSession.run(token, newId, Date.now());
  logEvent(u, 'auth', 'Nouveau compte');
  res.json({ token, user: publicUser(Q.userById.get(newId)) });
});
app.post('/api/login', (req, res) => {
  const u = String(req.body.user || '').trim(), p = String(req.body.pass || '');
  const row = Q.userByName.get(u);
  if (!row || !bcrypt.compareSync(p, row.pass_hash)) return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect.' });
  const token = crypto.randomBytes(24).toString('hex');
  Q.insSession.run(token, row.id, Date.now());
  logEvent(u, 'auth', 'Connexion');
  res.json({ token, user: publicUser(row) });
});
app.post('/api/logout', auth, (req, res) => { Q.delSession.run(req.token); logEvent(req.user.username, 'auth', 'Déconnexion'); res.json({ ok: true }); });
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/config', auth, (req, res) => res.json({ dicePayout: getSettings().dice.payout }));

app.post('/api/bonus', auth, (req, res) => {
  const now = Date.now();
  if (now - req.user.last_bonus < DAY) return res.status(400).json({ error: 'Bonus déjà récupéré', wait: DAY - (now - req.user.last_bonus) });
  Q.addCredit.run(500, req.user.id); Q.setBonus.run(now, req.user.id);
  logEvent(req.user.username, 'bonus', 'Bonus quotidien', 500);
  res.json({ balance: balanceOf(req.user.id) });
});

/* ============================ JEUX (one-shot) ============================ */
app.post('/api/play/slots', auth, (req, res) => {
  const bet = intBet(req.body.bet); if (!bet) return res.status(400).json({ error: 'Mise invalide' });
  const s = getSettings().slots;
  if (!charge(req.user, bet, 'slots')) return res.status(400).json({ error: 'Crédits insuffisants' });
  const r = G.playSlots(bet, s.bias, s.payout);
  payout(req.user, r.gain, 'slots');
  res.json({ reels: r.reels, gain: r.gain, balance: balanceOf(req.user.id) });
});
app.post('/api/play/plinko', auth, (req, res) => {
  const bet = intBet(req.body.bet); if (!bet) return res.status(400).json({ error: 'Mise invalide' });
  const risk = ['low', 'med', 'high'].includes(req.body.risk) ? req.body.risk : 'med';
  const s = getSettings().plinko;
  if (!charge(req.user, bet, 'plinko')) return res.status(400).json({ error: 'Crédits insuffisants' });
  const r = G.playPlinko(bet, risk, s.bias, s.payout);
  payout(req.user, r.gain, 'plinko');
  res.json({ bin: r.bin, mult: r.mult, gain: r.gain, balance: balanceOf(req.user.id) });
});
app.post('/api/play/wheel', auth, (req, res) => {
  const bet = intBet(req.body.bet); if (!bet) return res.status(400).json({ error: 'Mise invalide' });
  const s = getSettings().wheel;
  if (!charge(req.user, bet, 'wheel')) return res.status(400).json({ error: 'Crédits insuffisants' });
  const r = G.playWheel(bet, s.bias, s.payout);
  payout(req.user, r.gain, 'wheel');
  res.json({ index: r.index, mult: r.mult, gain: r.gain, balance: balanceOf(req.user.id) });
});
app.post('/api/play/dice', auth, (req, res) => {
  const bet = intBet(req.body.bet); if (!bet) return res.status(400).json({ error: 'Mise invalide' });
  const chance = Math.max(2, Math.min(95, Math.floor(Number(req.body.chance) || 50)));
  const s = getSettings().dice;
  if (!charge(req.user, bet, 'dice')) return res.status(400).json({ error: 'Crédits insuffisants' });
  const r = G.playDice(bet, chance, s.bias, s.payout);
  payout(req.user, r.gain, 'dice');
  res.json({ roll: r.roll, win: r.win, mult: r.mult, gain: r.gain, balance: balanceOf(req.user.id) });
});

/* ============================ BLACKJACK (stateful) ============================ */
function bjView(st, reveal) {
  return {
    player: st.player, playerScore: G.handVal(st.player),
    dealer: reveal ? st.dealer : [st.dealer[0], { back: true }],
    dealerScore: reveal ? G.handVal(st.dealer) : G.cardVal(st.dealer[0]),
    live: st.live, reveal,
  };
}
app.post('/api/bj/deal', auth, (req, res) => {
  const bet = intBet(req.body.bet); if (!bet) return res.status(400).json({ error: 'Mise invalide' });
  const s = getSettings().blackjack;
  if (!charge(req.user, bet, 'blackjack')) return res.status(400).json({ error: 'Crédits insuffisants' });
  const deck = G.freshDeck();
  const st = { bet, deck, bias: s.bias, payout: s.payout, player: [], dealer: [], live: true };
  st.player.push(G.bjDraw(deck, st.player, true, s.bias));
  st.dealer.push(G.bjDraw(deck, st.dealer, false, s.bias));
  st.player.push(G.bjDraw(deck, st.player, true, s.bias));
  st.dealer.push(G.bjDraw(deck, st.dealer, false, s.bias));
  activeBJ.set(req.user.id, st);
  if (G.handVal(st.player) === 21) return bjResolve(req, res, st);
  res.json({ ...bjView(st, false), balance: balanceOf(req.user.id) });
});
app.post('/api/bj/hit', auth, (req, res) => {
  const st = activeBJ.get(req.user.id);
  if (!st || !st.live) return res.status(400).json({ error: 'Aucune partie en cours' });
  st.player.push(G.bjDraw(st.deck, st.player, true, st.bias));
  if (G.handVal(st.player) > 21) return bjResolve(req, res, st);
  res.json({ ...bjView(st, false), balance: balanceOf(req.user.id) });
});
app.post('/api/bj/stand', auth, (req, res) => {
  const st = activeBJ.get(req.user.id);
  if (!st || !st.live) return res.status(400).json({ error: 'Aucune partie en cours' });
  return bjResolve(req, res, st);
});
function bjResolve(req, res, st) {
  while (G.handVal(st.dealer) < 17) st.dealer.push(G.bjDraw(st.deck, st.dealer, false, st.bias));
  st.live = false;
  const p = G.handVal(st.player), d = G.handVal(st.dealer);
  let outcome, gain = 0;
  if (p > 21) outcome = 'lose';
  else if (d > 21 || p > d) outcome = 'win';
  else if (p < d) outcome = 'lose';
  else outcome = 'push';
  if (outcome === 'win') { const bj = st.player.length === 2 && p === 21; gain = G.scale(st.bet * (bj ? 2.5 : 2), st.payout); payout(req.user, gain, 'blackjack'); }
  else if (outcome === 'push') { Q.addCredit.run(st.bet, req.user.id); } // remboursement
  activeBJ.delete(req.user.id);
  res.json({ ...bjView(st, true), outcome, gain, balance: balanceOf(req.user.id) });
}

/* ============================ MINES (stateful) ============================ */
app.post('/api/mines/start', auth, (req, res) => {
  const bet = intBet(req.body.bet); if (!bet) return res.status(400).json({ error: 'Mise invalide' });
  const bombs = Math.max(1, Math.min(24, Math.floor(Number(req.body.bombs) || 5)));
  const s = getSettings().mines;
  if (!charge(req.user, bet, 'mines')) return res.status(400).json({ error: 'Crédits insuffisants' });
  activeMines.set(req.user.id, { bet, bombs, bombSet: G.placeBombs(bombs), revealed: new Set(), picks: 0, gems: 0, mult: 1, live: true, bias: s.bias, payout: s.payout });
  res.json({ bombs, mult: 1, pot: 0, balance: balanceOf(req.user.id) });
});
app.post('/api/mines/pick', auth, (req, res) => {
  const st = activeMines.get(req.user.id);
  if (!st || !st.live) return res.status(400).json({ error: 'Aucune partie en cours' });
  const i = Math.floor(Number(req.body.i));
  if (!(i >= 0 && i < 25)) return res.status(400).json({ error: 'Case invalide' });
  if (st.revealed.has(i)) return res.status(400).json({ error: 'Case déjà révélée' });
  st.revealed.add(i);
  let isBomb = st.bombSet.has(i);
  if (isBomb && G.favored(st.bias)) { // faveur joueur : déplace la bombe vers une autre case non révélée
    for (let j = 0; j < 25; j++) if (j !== i && !st.bombSet.has(j) && !st.revealed.has(j)) { st.bombSet.delete(i); st.bombSet.add(j); isBomb = false; break; }
  }
  if (isBomb) {
    st.live = false; activeMines.delete(req.user.id);
    return res.json({ result: 'bomb', i, bombs: [...st.bombSet], balance: balanceOf(req.user.id) });
  }
  const safe = 25 - st.bombs, k = st.picks;
  st.mult *= ((25 - k) / (safe - k)) * (1 - 0.03);
  st.gems++; st.picks++;
  const pot = G.scale(st.bet * st.mult, st.payout);
  if (st.gems === safe) { // tout déminé -> cashout auto
    payout(req.user, pot, 'mines'); st.live = false; activeMines.delete(req.user.id);
    return res.json({ result: 'gem', i, mult: +st.mult.toFixed(2), pot, cashedOut: true, gain: pot, bombs: [...st.bombSet], balance: balanceOf(req.user.id) });
  }
  res.json({ result: 'gem', i, mult: +st.mult.toFixed(2), pot, balance: balanceOf(req.user.id) });
});
app.post('/api/mines/cashout', auth, (req, res) => {
  const st = activeMines.get(req.user.id);
  if (!st || !st.live) return res.status(400).json({ error: 'Aucune partie en cours' });
  const gain = G.scale(st.bet * st.mult, st.payout);
  payout(req.user, gain, 'mines'); st.live = false; activeMines.delete(req.user.id);
  res.json({ gain, mult: +st.mult.toFixed(2), bombs: [...st.bombSet], balance: balanceOf(req.user.id) });
});

/* ============================ LEADERBOARD ============================ */
app.get('/api/leaderboard', auth, (req, res) => res.json({ top: Q.topUsers.all().map(u => ({ name: u.username, credit: Math.floor(u.credit), admin: !!u.is_admin })) }));

/* ============================ ADMIN ============================ */
app.get('/api/admin/users', auth, adminOnly, (req, res) =>
  res.json({ users: Q.allUsers.all().map(u => ({ name: u.username, credit: Math.floor(u.credit), wagered: Math.floor(u.wagered), admin: !!u.is_admin })) }));
app.post('/api/admin/users', auth, adminOnly, (req, res) => {
  const u = String(req.body.user || '').trim(), p = String(req.body.pass || '1234'), c = Math.floor(Number(req.body.credit) || 0);
  if (u.length < 3) return res.status(400).json({ error: 'Pseudo trop court' });
  if (Q.userByName.get(u)) return res.status(400).json({ error: 'Existe déjà' });
  Q.insertUser.run(u, bcrypt.hashSync(p, 10), 0, c, Date.now());
  logEvent(req.user.username, 'admin', `Compte créé « ${u} » (${c})`, c);
  res.json({ ok: true });
});
app.post('/api/admin/credit', auth, adminOnly, (req, res) => {
  const u = String(req.body.user || ''), n = Math.floor(Number(req.body.amount) || 0);
  const row = Q.userByName.get(u); if (!row) return res.status(404).json({ error: 'Joueur introuvable' });
  Q.setCredit.run(Math.max(0, row.credit + n), row.id);
  logEvent(req.user.username, 'admin', `Crédit ${n >= 0 ? '+' : ''}${n} sur « ${u} »`, n);
  res.json({ ok: true });
});
app.post('/api/admin/delete', auth, adminOnly, (req, res) => {
  const u = String(req.body.user || '');
  Q.delUser.run(u); logEvent(req.user.username, 'admin', `Compte supprimé « ${u} »`);
  res.json({ ok: true });
});
app.get('/api/admin/settings', auth, adminOnly, (req, res) => res.json({ settings: getSettings() }));
app.post('/api/admin/settings', auth, adminOnly, (req, res) => {
  const game = req.body.game;
  if (!G.GAME_KEYS.includes(game)) return res.status(400).json({ error: 'Jeu inconnu' });
  const cur = getSettings()[game];
  const bias = req.body.bias != null ? Math.max(0, Math.min(100, Number(req.body.bias))) : cur.bias;
  const pay = req.body.payout != null ? Math.max(0, Math.min(500, Math.round(Number(req.body.payout)))) : cur.payout;
  Q.setSetting.run(bias, pay, game);
  logEvent(req.user.username, 'admin', `Réglage ${LABELS[game]} → fréq ${bias}% / gains ${pay}%`);
  res.json({ ok: true, settings: getSettings() });
});
app.get('/api/admin/logs', auth, adminOnly, (req, res) => {
  const f = req.query.filter;
  const rows = (f && f !== 'all') ? Q.logsByType.all(f) : Q.logsAll.all();
  res.json({ logs: rows });
});
app.delete('/api/admin/logs', auth, adminOnly, (req, res) => { Q.clearLogs.run(); res.json({ ok: true }); });

app.listen(PORT, () => console.log(`NEON SANTOS en écoute sur http://localhost:${PORT}`));
