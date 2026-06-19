/* ============================================================
   BlackState Casino — serveur API (ElysiaJS + Bun)
   Toute la logique d'argent et de win rate vit ICI.
============================================================ */
import { Elysia } from 'elysia'
import { staticPlugin } from '@elysiajs/static'
import { cors } from '@elysiajs/cors'
import { randomBytes } from 'node:crypto'
import db from './db.ts'
import * as G from './games.ts'
import type { User, Session } from './db.ts'

/* ── types internes ───────────────────────────────────────── */
interface BjState {
  bet: number; deck: G.Card[]; bias: number; payout: number
  player: G.Card[]; dealer: G.Card[]; live: boolean; startedAt: number
}
interface MinesState {
  bet: number; bombs: number; bombSet: Set<number>; revealed: Set<number>
  picks: number; gems: number; mult: number; live: boolean
  bias: number; payout: number; startedAt: number
}

/* ── constantes ───────────────────────────────────────────── */
const PORT         = parseInt(process.env.PORT ?? '3000')
const DAY          = 86_400_000
const SESSION_TTL  = 30 * 24 * 60 * 60 * 1_000
const GAME_TTL     =  2 * 60 * 60 * 1_000
const LOG_MAX_AGE  = 30 * 24 * 60 * 60 * 1_000
const CHAT_MAX_AGE = 24 * 60 * 60 * 1_000

/* ── requêtes préparées ───────────────────────────────────── */
const Q = {
  userByName  : db.prepare('SELECT * FROM users WHERE username = ?'),
  userById    : db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser  : db.prepare('INSERT INTO users (username, pass_hash, is_admin, credit, created) VALUES (?,?,?,?,?)'),
  setCredit   : db.prepare('UPDATE users SET credit = ? WHERE id = ?'),
  bumpWager   : db.prepare('UPDATE users SET credit = credit - ?, wagered = wagered + ?, played = played + 1 WHERE id = ?'),
  bumpWin     : db.prepare('UPDATE users SET credit = credit + ?, won = won + ?, biggest = MAX(biggest, ?) WHERE id = ?'),
  addCredit   : db.prepare('UPDATE users SET credit = credit + ? WHERE id = ?'),
  setBonus    : db.prepare('UPDATE users SET last_bonus = ? WHERE id = ?'),
  delUser     : db.prepare('DELETE FROM users WHERE username = ? AND is_admin = 0'),
  allUsers    : db.prepare('SELECT username, credit, wagered, is_admin, xp, level FROM users ORDER BY credit DESC'),
  topUsers    : db.prepare('SELECT username, credit, is_admin, level FROM users ORDER BY credit DESC LIMIT 10'),
  settings    : db.prepare('SELECT * FROM settings'),
  setSetting  : db.prepare('UPDATE settings SET bias = ?, payout = ? WHERE game = ?'),
  insSession  : db.prepare('INSERT INTO sessions (token, user_id, created) VALUES (?,?,?)'),
  getSession  : db.prepare('SELECT * FROM sessions WHERE token = ?'),
  delSession  : db.prepare('DELETE FROM sessions WHERE token = ?'),
  insLog      : db.prepare('INSERT INTO logs (ts, username, type, msg, amount) VALUES (?,?,?,?,?)'),
  logsAll     : db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 300'),
  logsByType  : db.prepare('SELECT * FROM logs WHERE type = ? ORDER BY id DESC LIMIT 300'),
  clearLogs   : db.prepare('DELETE FROM logs'),
  insHistory  : db.prepare('INSERT INTO game_history (user_id, game, bet, gain, result, ts) VALUES (?,?,?,?,?,?)'),
  getHistory  : db.prepare('SELECT * FROM game_history WHERE user_id = ? ORDER BY ts DESC LIMIT 100'),
  insChat     : db.prepare('INSERT INTO chat_messages (user_id, username, msg, ts) VALUES (?,?,?,?)'),
  getChat     : db.prepare(`
    SELECT c.id, c.username, c.msg, c.ts, u.is_admin
    FROM chat_messages c JOIN users u ON u.id = c.user_id
    WHERE c.ts > ? ORDER BY c.ts ASC LIMIT 50
  `),
}

/* ── état des parties stateful ────────────────────────────── */
const activeBJ    = new Map<number, BjState>()
const activeMines = new Map<number, MinesState>()

/* ── helpers ──────────────────────────────────────────────── */
const RE_USER   = /^[a-zA-Z0-9_-]{3,20}$/
const validUser = (u: string) => RE_USER.test(u)
const intBet    = (v: unknown) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? n : null
}
const LABELS: Record<string, string> = {
  slots: 'Slots', blackjack: 'Blackjack', mines: 'Démineur',
  plinko: 'Plinko', wheel: 'Roue', dice: 'Dice',
}
const LEVEL_XP = [0, 500, 2000, 5000, 10_000, 20_000, 35_000, 55_000, 80_000, 110_000]

function computeLevel(xp: number): number {
  let l = 1
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) l = i + 1
  return l
}
function getSettings(): Record<string, { bias: number; payout: number }> {
  const m: Record<string, { bias: number; payout: number }> = {}
  for (const r of Q.settings.all() as any[]) m[r.game] = { bias: r.bias, payout: r.payout }
  return m
}
function logEvent(username: string, type: string, msg: string, amount = 0) {
  Q.insLog.run(Date.now(), username, type, msg, amount)
}
function publicUser(u: User) {
  return {
    username : u.username,
    credit   : Math.floor(u.credit),
    admin    : !!u.is_admin,
    xp       : u.xp   ?? 0,
    level    : u.level ?? 1,
    stats    : { wagered: Math.floor(u.wagered), won: Math.floor(u.won), played: u.played, biggest: Math.floor(u.biggest) },
    lastBonus: u.last_bonus,
  }
}
function userSnapshot(id: number) {
  const u = Q.userById.get(id) as User
  return { balance: Math.floor(u.credit), xp: u.xp ?? 0, level: u.level ?? 1 }
}
function awardXP(userId: number, bet: number) {
  const gain = Math.max(1, Math.floor(bet / 10))
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(gain, userId)
  const row = Q.userById.get(userId) as User
  db.prepare('UPDATE users SET level = ? WHERE id = ?').run(computeLevel(row.xp ?? 0), userId)
}
function charge(user: User, bet: number, gameKey: string): boolean {
  const fresh = Q.userById.get(user.id) as User
  if (fresh.credit < bet) return false
  Q.bumpWager.run(bet, bet, user.id)
  logEvent(user.username, 'bet', 'Mise ' + LABELS[gameKey], -bet)
  return true
}
function payout(user: User, gain: number, gameKey: string) {
  if (gain <= 0) return
  Q.bumpWin.run(gain, gain, gain, user.id)
  logEvent(user.username, 'win', 'Gain ' + LABELS[gameKey], gain)
}
function recordHistory(userId: number, game: string, bet: number, gain: number, result: string | null) {
  Q.insHistory.run(userId, game, bet, gain, result ?? null, Date.now())
}

/* ── blackjack helpers ────────────────────────────────────── */
function bjView(st: BjState, reveal: boolean) {
  return {
    player     : st.player,
    playerScore: G.handVal(st.player),
    dealer     : reveal ? st.dealer : [st.dealer[0], { back: true }],
    dealerScore: reveal ? G.handVal(st.dealer) : G.cardVal(st.dealer[0]),
    live       : st.live,
    reveal,
  }
}
function bjResolve(user: User, st: BjState) {
  while (G.handVal(st.dealer) < 17) st.dealer.push(G.bjDraw(st.deck, st.dealer, false, st.bias))
  st.live = false
  const p = G.handVal(st.player), d = G.handVal(st.dealer)
  let outcome: 'win' | 'lose' | 'push'
  let gain = 0
  if (p > 21)               outcome = 'lose'
  else if (d > 21 || p > d) outcome = 'win'
  else if (p < d)           outcome = 'lose'
  else                      outcome = 'push'
  if (outcome === 'win') {
    const bj = st.player.length === 2 && p === 21
    gain = G.scale(st.bet * (bj ? 2.5 : 2), st.payout)
    payout(user, gain, 'blackjack')
  } else if (outcome === 'push') {
    Q.addCredit.run(st.bet, user.id)
  }
  recordHistory(user.id, 'blackjack', st.bet, gain, outcome)
  activeBJ.delete(user.id)
  return { ...bjView(st, true), outcome, gain, ...userSnapshot(user.id) }
}

/* ── nettoyages périodiques ───────────────────────────────── */
function cleanup() {
  const now = Date.now()
  db.prepare('DELETE FROM sessions WHERE created < ?').run(now - SESSION_TTL)
  db.prepare('DELETE FROM logs WHERE ts < ?').run(now - LOG_MAX_AGE)
  db.prepare('DELETE FROM chat_messages WHERE ts < ?').run(now - CHAT_MAX_AGE)
  const cut = now - GAME_TTL
  for (const [id, st] of activeBJ)    if (st.startedAt < cut) activeBJ.delete(id)
  for (const [id, st] of activeMines) if (st.startedAt < cut) activeMines.delete(id)
}
cleanup()
setInterval(cleanup, 60 * 60_000)

/* ── rate limiters ────────────────────────────────────────── */
type Bucket = { n: number; reset: number }
function rateLimit(windowMs: number, max: number, message: object) {
  const store = new Map<string, Bucket>()
  return new Elysia()
    .onBeforeHandle({ as: 'scoped' }, ({ request, set }) => {
      const ip  = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
      const now = Date.now()
      const b   = store.get(ip) ?? { n: 0, reset: now + windowMs }
      if (now > b.reset) { b.n = 0; b.reset = now + windowMs }
      b.n++
      store.set(ip, b)
      if (b.n > max) { set.status = 429; return message }
    })
}
const authRL = rateLimit(15 * 60_000, 15, { error: 'Trop de tentatives, réessaie dans 15 minutes.' })
const chatRL = rateLimit(10_000, 5, { error: 'Tu envoies trop vite, ralentis !' })

/* ── CSP ──────────────────────────────────────────────────── */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self'",
  "img-src 'self' data:",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

/* ── plugins d'authentification ───────────────────────────── */
const withAuth = new Elysia({ name: 'auth' })
  .derive({ as: 'scoped' }, ({ headers, error }) => {
    const token = (headers['authorization'] ?? '').replace(/^Bearer\s+/i, '').trim()
               || (headers['x-token'] ?? '').trim()
    if (!token) return error(401, { error: 'Non connecté' })
    const session = Q.getSession.get(token) as Session | null
    if (!session) return error(401, { error: 'Session invalide' })
    if (Date.now() - session.created > SESSION_TTL) {
      Q.delSession.run(token)
      return error(401, { error: 'Session expirée, reconnecte-toi.' })
    }
    const user = Q.userById.get(session.user_id) as User | null
    if (!user) return error(401, { error: 'Compte introuvable' })
    return { user, authToken: token }
  })

const withAdmin = new Elysia({ name: 'admin-guard' })
  .use(withAuth)
  .onBeforeHandle({ as: 'scoped' }, ({ user, set }) => {
    if (!(user as User | undefined)?.is_admin) {
      set.status = 403
      return { error: 'Réservé admin' }
    }
  })

/* ── seed admin (top-level await, s'exécute avant le démarrage) */
{
  const adminUser = process.env.ADMIN_USER ?? 'admin'
  const adminPass = process.env.ADMIN_PASS ?? 'admin'
  if (adminUser === 'admin' && adminPass === 'admin')
    console.warn('[SÉCURITÉ] Identifiants admin par défaut — définis ADMIN_USER et ADMIN_PASS dans .env')
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser)
  if (!exists) {
    const hash = await Bun.password.hash(adminPass, { algorithm: 'bcrypt', cost: 10 })
    db.prepare('INSERT INTO users (username, pass_hash, is_admin, credit, created) VALUES (?,?,?,?,?)')
      .run(adminUser, hash, 1, 100_000, Date.now())
    console.log(`[seed] Admin créé : "${adminUser}"`)
  }
}

/* ══════════════════════════════════════════════════════════
   APPLICATION
══════════════════════════════════════════════════════════ */
const app = new Elysia()

  /* CORS optionnel */
  .use(process.env.ALLOWED_ORIGIN
    ? cors({ origin: process.env.ALLOWED_ORIGIN, credentials: true })
    : new Elysia({ name: 'cors-noop' })
  )

  /* En-têtes de sécurité */
  .onRequest(({ set }) => {
    set.headers['Content-Security-Policy'] = CSP
    set.headers['X-Content-Type-Options']  = 'nosniff'
    set.headers['X-Frame-Options']         = 'DENY'
    set.headers['Referrer-Policy']         = 'strict-origin-when-cross-origin'
    set.headers['X-XSS-Protection']        = '0'
  })

  /* ── Vérification d'invitation (publique) ─────────────── */
  .get('/api/invite/:token', ({ params, set }) => {
    const row = db.prepare('SELECT credits, used FROM invites WHERE token = ?').get(params.token) as { credits: number; used: number } | null
    if (!row) { set.status = 404; return { error: 'Invitation introuvable' } }
    if (row.used) { set.status = 410; return { error: 'Ce lien a déjà été utilisé.' } }
    return { valid: true, credits: row.credits }
  })

  /* ── Inscription & connexion (rate limitées) ──────────── */
  .use(new Elysia()
    .use(authRL)

    .post('/api/register', async ({ body, set }) => {
      const b = body as Record<string, unknown>
      const u = String(b.user ?? '').trim()
      const p = String(b.pass ?? '')
      const inviteCode = String(b.invite ?? '').trim()
      if (!validUser(u))  { set.status = 400; return { error: 'Pseudo invalide (3-20 cars, lettres/chiffres/_ ou -).' } }
      if (p.length < 8)  { set.status = 400; return { error: 'Mot de passe trop court (8 min).' } }
      if (Q.userByName.get(u)) { set.status = 400; return { error: 'Ce pseudo existe déjà.' } }
      if (!inviteCode)   { set.status = 403; return { error: "Un lien d'invitation est requis pour créer un compte." } }
      const invite = db.prepare('SELECT * FROM invites WHERE token = ? AND used = 0').get(inviteCode) as { credits: number } | null
      if (!invite) { set.status = 400; return { error: "Lien d'invitation invalide ou déjà utilisé." } }
      const hash  = await Bun.password.hash(p, { algorithm: 'bcrypt', cost: 10 })
      const info  = Q.insertUser.run(u, hash, 0, invite.credits, Date.now())
      const token = randomBytes(32).toString('hex')
      const newId = Number(info.lastInsertRowid)
      Q.insSession.run(token, newId, Date.now())
      db.prepare('UPDATE invites SET used = 1, used_by = ? WHERE token = ?').run(u, inviteCode)
      logEvent(u, 'auth', `Compte créé via invitation (${invite.credits} crédits)`, invite.credits)
      return { token, user: publicUser(Q.userById.get(newId) as User) }
    })

    .post('/api/login', async ({ body, set }) => {
      const b = body as Record<string, unknown>
      const u = String(b.user ?? '').trim()
      const p = String(b.pass ?? '')
      const row = Q.userByName.get(u) as User | null
      if (!row || !(await Bun.password.verify(p, row.pass_hash))) {
        set.status = 401; return { error: 'Pseudo ou mot de passe incorrect.' }
      }
      const token = randomBytes(32).toString('hex')
      Q.insSession.run(token, row.id, Date.now())
      logEvent(u, 'auth', 'Connexion')
      return { token, user: publicUser(row) }
    })
  )

  /* ── Routes protégées ─────────────────────────────────── */
  .use(new Elysia()
    .use(withAuth)

    .post('/api/logout', ({ user, authToken }) => {
      Q.delSession.run(authToken as string)
      logEvent((user as User).username, 'auth', 'Déconnexion')
      return { ok: true }
    })

    .get('/api/me', ({ user }) => ({ user: publicUser(user as User) }))

    .get('/api/config', () => ({ dicePayout: getSettings().dice.payout }))

    .post('/api/bonus', ({ user, set }) => {
      const u   = user as User
      const now = Date.now()
      if (now - u.last_bonus < DAY) {
        set.status = 400; return { error: 'Bonus déjà récupéré', wait: DAY - (now - u.last_bonus) }
      }
      Q.addCredit.run(500, u.id); Q.setBonus.run(now, u.id)
      logEvent(u.username, 'bonus', 'Bonus quotidien', 500)
      return userSnapshot(u.id)
    })

    /* ── Jeux one-shot ──────────────────────────────────── */
    .post('/api/play/slots', ({ body, user, set }) => {
      const u   = user as User
      const bet = intBet((body as any).bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const s = getSettings().slots
      if (!charge(u, bet, 'slots')) { set.status = 400; return { error: 'Crédits insuffisants' } }
      const r = G.playSlots(bet, s.bias, s.payout)
      payout(u, r.gain, 'slots'); awardXP(u.id, bet)
      recordHistory(u.id, 'slots', bet, r.gain, r.reels.join('|'))
      return { reels: r.reels, gain: r.gain, ...userSnapshot(u.id) }
    })

    .post('/api/play/plinko', ({ body, user, set }) => {
      const u   = user as User
      const b   = body as any
      const bet = intBet(b.bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const risk = (['low', 'med', 'high'] as const).find(x => x === b.risk) ?? 'med'
      const s    = getSettings().plinko
      if (!charge(u, bet, 'plinko')) { set.status = 400; return { error: 'Crédits insuffisants' } }
      const r = G.playPlinko(bet, risk, s.bias, s.payout)
      payout(u, r.gain, 'plinko'); awardXP(u.id, bet)
      recordHistory(u.id, 'plinko', bet, r.gain, `x${r.mult}`)
      return { bin: r.bin, mult: r.mult, gain: r.gain, ...userSnapshot(u.id) }
    })

    .post('/api/play/wheel', ({ body, user, set }) => {
      const u   = user as User
      const bet = intBet((body as any).bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const s = getSettings().wheel
      if (!charge(u, bet, 'wheel')) { set.status = 400; return { error: 'Crédits insuffisants' } }
      const r = G.playWheel(bet, s.bias, s.payout)
      payout(u, r.gain, 'wheel'); awardXP(u.id, bet)
      recordHistory(u.id, 'wheel', bet, r.gain, `x${r.mult}`)
      return { index: r.index, mult: r.mult, gain: r.gain, ...userSnapshot(u.id) }
    })

    .post('/api/play/dice', ({ body, user, set }) => {
      const u      = user as User
      const b      = body as any
      const bet    = intBet(b.bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const chance = Math.max(2, Math.min(95, Math.floor(Number(b.chance) || 50)))
      const s      = getSettings().dice
      if (!charge(u, bet, 'dice')) { set.status = 400; return { error: 'Crédits insuffisants' } }
      const r = G.playDice(bet, chance, s.bias, s.payout)
      payout(u, r.gain, 'dice'); awardXP(u.id, bet)
      recordHistory(u.id, 'dice', bet, r.gain, r.roll + (r.win ? '✓' : '✗'))
      return { roll: r.roll, win: r.win, mult: r.mult, gain: r.gain, ...userSnapshot(u.id) }
    })

    /* ── Blackjack ──────────────────────────────────────── */
    .post('/api/bj/deal', ({ body, user, set }) => {
      const u   = user as User
      const bet = intBet((body as any).bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const s    = getSettings().blackjack
      if (!charge(u, bet, 'blackjack')) { set.status = 400; return { error: 'Crédits insuffisants' } }
      const deck = G.freshDeck()
      const st: BjState = { bet, deck, bias: s.bias, payout: s.payout, player: [], dealer: [], live: true, startedAt: Date.now() }
      st.player.push(G.bjDraw(deck, st.player, true,  s.bias))
      st.dealer.push(G.bjDraw(deck, st.dealer, false, s.bias))
      st.player.push(G.bjDraw(deck, st.player, true,  s.bias))
      st.dealer.push(G.bjDraw(deck, st.dealer, false, s.bias))
      activeBJ.set(u.id, st)
      awardXP(u.id, bet)
      if (G.handVal(st.player) === 21) return bjResolve(u, st)
      return { ...bjView(st, false), ...userSnapshot(u.id) }
    })

    .post('/api/bj/hit', ({ user, set }) => {
      const u  = user as User
      const st = activeBJ.get(u.id)
      if (!st || !st.live) { set.status = 400; return { error: 'Aucune partie en cours' } }
      st.player.push(G.bjDraw(st.deck, st.player, true, st.bias))
      if (G.handVal(st.player) > 21) return bjResolve(u, st)
      return { ...bjView(st, false), ...userSnapshot(u.id) }
    })

    .post('/api/bj/stand', ({ user, set }) => {
      const u  = user as User
      const st = activeBJ.get(u.id)
      if (!st || !st.live) { set.status = 400; return { error: 'Aucune partie en cours' } }
      return bjResolve(u, st)
    })

    /* ── Mines ──────────────────────────────────────────── */
    .post('/api/mines/start', ({ body, user, set }) => {
      const u     = user as User
      const b     = body as any
      const bet   = intBet(b.bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const bombs = Math.max(1, Math.min(24, Math.floor(Number(b.bombs) || 5)))
      const s     = getSettings().mines
      if (!charge(u, bet, 'mines')) { set.status = 400; return { error: 'Crédits insuffisants' } }
      awardXP(u.id, bet)
      activeMines.set(u.id, {
        bet, bombs, bombSet: G.placeBombs(bombs), revealed: new Set(),
        picks: 0, gems: 0, mult: 1, live: true,
        bias: s.bias, payout: s.payout, startedAt: Date.now(),
      })
      return { bombs, mult: 1, pot: 0, ...userSnapshot(u.id) }
    })

    .post('/api/mines/pick', ({ body, user, set }) => {
      const u  = user as User
      const st = activeMines.get(u.id)
      if (!st || !st.live) { set.status = 400; return { error: 'Aucune partie en cours' } }
      const i = Math.floor(Number((body as any).i))
      if (!(i >= 0 && i < 25)) { set.status = 400; return { error: 'Case invalide' } }
      if (st.revealed.has(i))  { set.status = 400; return { error: 'Case déjà révélée' } }
      st.revealed.add(i)
      let isBomb = st.bombSet.has(i)
      if (isBomb && G.favored(st.bias)) {
        for (let j = 0; j < 25; j++) {
          if (j !== i && !st.bombSet.has(j) && !st.revealed.has(j)) {
            st.bombSet.delete(i); st.bombSet.add(j); isBomb = false; break
          }
        }
      }
      if (isBomb) {
        st.live = false
        recordHistory(u.id, 'mines', st.bet, 0, 'bomb')
        activeMines.delete(u.id)
        return { result: 'bomb', i, bombs: [...st.bombSet], ...userSnapshot(u.id) }
      }
      const safe = 25 - st.bombs, k = st.picks
      st.mult *= ((25 - k) / (safe - k)) * (1 - 0.03)
      st.gems++; st.picks++
      const pot = G.scale(st.bet * st.mult, st.payout)
      if (st.gems === safe) {
        payout(u, pot, 'mines')
        recordHistory(u.id, 'mines', st.bet, pot, 'sweep')
        st.live = false; activeMines.delete(u.id)
        return { result: 'gem', i, mult: +st.mult.toFixed(2), pot, cashedOut: true, gain: pot, bombs: [...st.bombSet], ...userSnapshot(u.id) }
      }
      return { result: 'gem', i, mult: +st.mult.toFixed(2), pot, ...userSnapshot(u.id) }
    })

    .post('/api/mines/cashout', ({ user, set }) => {
      const u  = user as User
      const st = activeMines.get(u.id)
      if (!st || !st.live) { set.status = 400; return { error: 'Aucune partie en cours' } }
      const gain = G.scale(st.bet * st.mult, st.payout)
      payout(u, gain, 'mines')
      recordHistory(u.id, 'mines', st.bet, gain, `${st.gems} gems`)
      st.live = false; activeMines.delete(u.id)
      return { gain, mult: +st.mult.toFixed(2), bombs: [...st.bombSet], ...userSnapshot(u.id) }
    })

    /* ── Historique / Leaderboard ───────────────────────── */
    .get('/api/history', ({ user }) => ({
      history: Q.getHistory.all((user as User).id)
    }))

    .get('/api/leaderboard', () => ({
      top: (Q.topUsers.all() as any[]).map(u => ({
        name  : u.username,
        credit: Math.floor(u.credit),
        admin : !!u.is_admin,
        level : u.level || 1,
      }))
    }))

    /* ── Chat (rate limité) ─────────────────────────────── */
    .use(new Elysia()
      .use(chatRL)
      .post('/api/chat', ({ body, user, set }) => {
        const u   = user as User
        const msg = String((body as any).msg ?? '').trim().slice(0, 200)
        if (!msg) { set.status = 400; return { error: 'Message vide' } }
        Q.insChat.run(u.id, u.username, msg, Date.now())
        return { ok: true }
      })
    )

    .get('/api/chat', ({ query }) => ({
      messages: Q.getChat.all(Number(query.since) || 0)
    }))
  )

  /* ── Routes admin ─────────────────────────────────────── */
  .use(new Elysia()
    .use(withAdmin)

    .get('/api/admin/users', () => ({
      users: (Q.allUsers.all() as any[]).map(u => ({
        name   : u.username,
        credit : Math.floor(u.credit),
        wagered: Math.floor(u.wagered),
        admin  : !!u.is_admin,
        level  : u.level || 1,
        xp     : Math.floor(u.xp || 0),
      }))
    }))

    .post('/api/admin/users', async ({ body, user, set }) => {
      const b = body as any
      const u = String(b.user ?? '').trim()
      const p = String(b.pass ?? '1234')
      const c = Math.floor(Number(b.credit) || 0)
      if (!validUser(u)) { set.status = 400; return { error: 'Pseudo invalide (3-20 cars, lettres/chiffres/_ ou -).' } }
      if (Q.userByName.get(u)) { set.status = 400; return { error: 'Existe déjà' } }
      const hash = await Bun.password.hash(p, { algorithm: 'bcrypt', cost: 10 })
      Q.insertUser.run(u, hash, 0, c, Date.now())
      logEvent((user as User).username, 'admin', `Compte créé « ${u} » (${c})`, c)
      return { ok: true }
    })

    .post('/api/admin/credit', ({ body, user, set }) => {
      const b   = body as any
      const u   = String(b.user ?? '')
      const n   = Math.floor(Number(b.amount) || 0)
      const row = Q.userByName.get(u) as User | null
      if (!row) { set.status = 404; return { error: 'Joueur introuvable' } }
      Q.setCredit.run(Math.max(0, row.credit + n), row.id)
      logEvent((user as User).username, 'admin', `Crédit ${n >= 0 ? '+' : ''}${n} sur « ${u} »`, n)
      return { ok: true }
    })

    .post('/api/admin/delete', ({ body, user }) => {
      const u = String((body as any).user ?? '')
      Q.delUser.run(u)
      logEvent((user as User).username, 'admin', `Compte supprimé « ${u} »`)
      return { ok: true }
    })

    .get('/api/admin/settings', () => ({ settings: getSettings() }))

    .post('/api/admin/settings', ({ body, user, set }) => {
      const b    = body as any
      const game = String(b.game ?? '')
      if (!(G.GAME_KEYS as readonly string[]).includes(game)) { set.status = 400; return { error: 'Jeu inconnu' } }
      const cur  = getSettings()[game]
      const bias = b.bias   != null ? Math.max(0, Math.min(100, Number(b.bias)))                : cur.bias
      const pay  = b.payout != null ? Math.max(0, Math.min(500, Math.round(Number(b.payout)))) : cur.payout
      Q.setSetting.run(bias, pay, game)
      logEvent((user as User).username, 'admin', `Réglage ${LABELS[game]} → fréq ${bias}% / gains ${pay}%`)
      return { ok: true, settings: getSettings() }
    })

    .get('/api/admin/logs', ({ query }) => {
      const f = query.filter as string | undefined
      return { logs: (f && f !== 'all') ? Q.logsByType.all(f) : Q.logsAll.all() }
    })

    .delete('/api/admin/logs', ({ user }) => {
      Q.clearLogs.run()
      logEvent((user as User).username, 'admin', 'Logs effacés')
      return { ok: true }
    })

    .post('/api/admin/invite', ({ body, user }) => {
      const credits = Math.max(0, Math.floor(Number((body as any).credits ?? 1000) || 0))
      const token   = randomBytes(8).toString('hex')
      db.prepare('INSERT INTO invites (token, credits, created, created_by) VALUES (?,?,?,?)')
        .run(token, credits, Date.now(), (user as User).username)
      logEvent((user as User).username, 'admin', `Invitation créée (${credits} crédits)`, credits)
      return { ok: true, token, credits }
    })

    .get('/api/admin/invites', () => ({
      invites: db.prepare('SELECT * FROM invites ORDER BY created DESC LIMIT 200').all()
    }))

    .delete('/api/admin/invite/:token', ({ params }) => {
      db.prepare('DELETE FROM invites WHERE token = ? AND used = 0').run(params.token)
      return { ok: true }
    })
  )

  /* ── Fichiers statiques + fallback SPA ────────────────── */
  .use(staticPlugin({ assets: './public', prefix: '/' }))
  .get('/*', () => Bun.file('./public/index.html'))

  /* ── Gestionnaire d'erreurs ───────────────────────────── */
  .onError(({ code, error, set }) => {
    if (code === 'NOT_FOUND') return // laisse le catch-all /* gérer
    console.error('[ERROR]', error)
    set.status = 500
    return { error: 'Erreur serveur interne' }
  })

  .listen(PORT, () => console.log(`BlackState Casino → http://localhost:${PORT}`))

export type App = typeof app
