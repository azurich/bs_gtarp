/* ============================================================
   BlackState Casino — serveur API (ElysiaJS + Bun)
   Toute la logique d'argent et de win rate vit ICI.
============================================================ */
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import db, { DB_FILE } from './db.ts'
import { unlinkSync } from 'node:fs'
import { generateSecret, verifyTOTP, otpauthURI } from './totp.ts'
import * as G from './games.ts'
import type { User, Session } from './db.ts'

/* ── types internes ───────────────────────────────────────── */
interface BjState {
  bet: number; deck: G.Card[]
  player: G.Card[]; dealer: G.Card[]; live: boolean; startedAt: number
}
interface MinesState {
  bet: number; bombs: number; bombSet: Set<number>; revealed: Set<number>
  picks: number; gems: number; mult: number; live: boolean
  startedAt: number; maxReached?: boolean
}

/* ── constantes ───────────────────────────────────────────── */
const PORT         = parseInt(process.env.PORT ?? '3000')
const SESSION_TTL  = 30 * 60 * 1_000          // 30 min d'inactivité (expiration glissante)
const SESSION_TOUCH = 60 * 1_000              // refresh au plus 1×/min pour limiter les écritures
const GAME_TTL     =  2 * 60 * 60 * 1_000
const LOG_MAX_AGE  = 30 * 24 * 60 * 60 * 1_000
// SECURITY: mise maximale absolue par tour (évite les gros paris instantanés déstabilisants)
const MAX_BET      = parseInt(process.env.MAX_BET ?? '50000')
// Types MIME servis depuis ./public
const MIME: Record<string, string> = {
  css: 'text/css', js: 'application/javascript', html: 'text/html',
  json: 'application/json', svg: 'image/svg+xml', ico: 'image/x-icon',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
}

/* ── requêtes préparées ───────────────────────────────────── */
const Q = {
  userByName  : db.prepare('SELECT * FROM users WHERE username = ?'),
  userById    : db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser  : db.prepare('INSERT INTO users (username, pass_hash, is_admin, credit, created, rp_nom, rp_prenom, rp_phone, discord) VALUES (?,?,?,?,?,?,?,?,?)'),
  setCredit   : db.prepare('UPDATE users SET credit = ? WHERE id = ?'),
  // SECURITY (race condition): bumpWager inclut une condition WHERE credit >= ? pour être atomique
  bumpWager   : db.prepare('UPDATE users SET credit = credit - ?, wagered = wagered + ?, played = played + 1 WHERE id = ? AND credit >= ?'),
  bumpWin     : db.prepare('UPDATE users SET credit = credit + ?, won = won + ?, biggest = MAX(biggest, ?) WHERE id = ?'),
  addCredit   : db.prepare('UPDATE users SET credit = credit + ? WHERE id = ?'),
  delUser     : db.prepare('DELETE FROM users WHERE username = ? AND is_admin = 0'),
  allUsers    : db.prepare('SELECT username, credit, wagered, is_admin, xp, level, rp_nom, rp_prenom, discord, totp_enabled, blocked FROM users ORDER BY credit DESC'),
  topUsers    : db.prepare('SELECT username, won, credit, level FROM users WHERE is_admin = 0 ORDER BY won DESC LIMIT 10'),
  lbLevel     : db.prepare('SELECT username, won, credit, level, xp FROM users WHERE is_admin = 0 ORDER BY level DESC, xp DESC LIMIT 10'),
  lbLost      : db.prepare('SELECT username, won, credit, level, (wagered - won) AS lost FROM users WHERE is_admin = 0 ORDER BY (wagered - won) DESC LIMIT 10'),
  insSession  : db.prepare('INSERT INTO sessions (token, user_id, created) VALUES (?,?,?)'),
  getSession  : db.prepare('SELECT * FROM sessions WHERE token = ?'),
  delSession  : db.prepare('DELETE FROM sessions WHERE token = ?'),
  touchSession: db.prepare('UPDATE sessions SET created = ? WHERE token = ?'),
  setTotpSecret    : db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?'),
  enableTotp       : db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?'),
  disableTotp      : db.prepare("UPDATE users SET totp_secret = '', totp_enabled = 0 WHERE id = ?"),
  disableTotpByName: db.prepare("UPDATE users SET totp_secret = '', totp_enabled = 0 WHERE username = ?"),
  insLog      : db.prepare('INSERT INTO logs (ts, username, type, msg, amount) VALUES (?,?,?,?,?)'),
  logsAll     : db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 300'),
  logsByType  : db.prepare('SELECT * FROM logs WHERE type = ? ORDER BY id DESC LIMIT 300'),
  clearLogs   : db.prepare('DELETE FROM logs'),
  insHistory  : db.prepare('INSERT INTO game_history (user_id, game, bet, gain, result, ts) VALUES (?,?,?,?,?,?)'),
  getHistory  : db.prepare('SELECT * FROM game_history WHERE user_id = ? ORDER BY ts DESC LIMIT 100'),
  bigWins     : db.prepare('SELECT u.username, h.game, h.gain, h.ts FROM game_history h JOIN users u ON u.id = h.user_id WHERE h.gain > 0 AND h.gain >= h.bet * 2 AND u.is_admin = 0 ORDER BY h.ts DESC LIMIT 12'),
  getCasino   : db.prepare('SELECT wagered, paid FROM casino WHERE id = 1'),
  bookCasino  : db.prepare('UPDATE casino SET wagered = wagered + ?, paid = paid + ? WHERE id = 1'),
  resetCasino : db.prepare('UPDATE casino SET wagered = 0, paid = 0 WHERE id = 1'),
  addXP       : db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?'),
  setLevel    : db.prepare('UPDATE users SET level = ? WHERE id = ?'),
  setProfile  : db.prepare('UPDATE users SET rp_nom = ?, rp_prenom = ?, rp_phone = ?, discord = ? WHERE id = ?'),
}

/* ── état des parties stateful ────────────────────────────── */
const activeBJ    = new Map<number, BjState>()
const activeMines = new Map<number, MinesState>()

/* ── helpers ──────────────────────────────────────────────── */
const RE_USER   = /^[a-zA-Z0-9_-]{3,20}$/
const validUser = (u: string) => RE_USER.test(u)
const clip = (v: unknown, max = 40) => String(v ?? '').trim().slice(0, max)
const intBet    = (v: unknown) => {
  const n = Math.floor(Number(v))
  // SECURITY: vérifie que la mise est un entier positif et ne dépasse pas MAX_BET
  return Number.isFinite(n) && n > 0 && n <= MAX_BET ? n : null
}
const LABELS: Record<string, string> = {
  slots: 'Slots', blackjack: 'Blackjack', mines: 'Démineur',
  plinko: 'Plinko', wheel: 'Roue', dice: 'Dice',
}
// Niveaux 1→100. Palier du niveau n : XP_K*(n-1)^2. XP = 1 par crédit misé →
// niveau 10 ≈ 8 100 misés, niveau 100 ≈ 980 100 misés (maison toujours nette positive après bonus).
const MAX_LEVEL = 100
const XP_K      = 100
const levelThreshold = (n: number) => XP_K * (n - 1) * (n - 1)

function computeLevel(xp: number): number {
  const n = Math.floor(Math.sqrt(Math.max(0, xp) / XP_K)) + 1
  return Math.max(1, Math.min(MAX_LEVEL, n))
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
    rp       : { nom: u.rp_nom ?? '', prenom: u.rp_prenom ?? '', phone: u.rp_phone ?? '', discord: u.discord ?? '' },
    totp     : !!u.totp_enabled,
  }
}
function userSnapshot(id: number) {
  const u = Q.userById.get(id) as User
  return { balance: Math.floor(u.credit), xp: u.xp ?? 0, level: u.level ?? 1, budget: Math.floor(casinoBudget()) }
}
function awardXP(userId: number, bet: number) {
  // XP proportionnelle à la mise dépensée : 1 XP par crédit misé
  const gain     = Math.max(1, Math.floor(bet))
  const before   = Q.userById.get(userId) as User
  const oldLevel = before.level ?? 1
  Q.addXP.run(gain, userId)
  const row      = Q.userById.get(userId) as User
  const newLevel = computeLevel(row.xp ?? 0)
  if (newLevel !== oldLevel) Q.setLevel.run(newLevel, userId)
  // Récompense tous les 10 niveaux : (palier/10) × 1000 crédits — petit bonus, couvert par la marge maison
  for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
    if (lvl % 10 === 0) {
      const reward = (lvl / 10) * 1000
      Q.addCredit.run(reward, userId)
      logEvent(before.username, 'level', `Niveau ${lvl} atteint — bonus ${reward} crédits`, reward)
    }
  }
}
function charge(user: User, bet: number, gameKey: string): boolean {
  // SECURITY: UPDATE atomique avec WHERE credit >= bet — élimine la race condition TOCTOU.
  // Si le solde est insuffisant (ou a changé entre-temps), rowsAffected = 0.
  const result = Q.bumpWager.run(bet, bet, user.id, bet)
  if (result.changes === 0) return false
  logEvent(user.username, 'bet', 'Mise ' + LABELS[gameKey], -bet)
  return true
}
function payout(user: User, gain: number, gameKey: string) {
  if (gain <= 0) return
  Q.bumpWin.run(gain, gain, gain, user.id)
  logEvent(user.username, 'win', 'Gain ' + LABELS[gameKey], gain)
}
/* ── Cagnotte (pool global redistributif) ─────────────────────
   budget = 30% de la cagnotte (= total misé − total payé), 70% en réserve.
   À passer aux jeux pour brider le tirage. bookCasino() met à jour W et P. */
const CASINO_RESERVE = 0.30
function casinoBudget(): number {
  const c = Q.getCasino.get() as { wagered: number; paid: number }
  return CASINO_RESERVE * Math.max(0, c.wagered - c.paid)
}
function bookCasino(bet: number, gain: number) {
  Q.bookCasino.run(bet, gain)
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
  while (G.handVal(st.dealer) < 17) st.dealer.push(G.bjDraw(st.deck, st.dealer, false, G.BJ_BIAS))
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
    gain = Math.round(st.bet * (bj ? G.BJ_BJ_MULT : G.BJ_WIN_MULT))
    payout(user, gain, 'blackjack')
  } else if (outcome === 'push') {
    Q.addCredit.run(st.bet, user.id)
  }
  // cagnotte : win -> (bet, gain) ; push -> (bet, bet) [mise rendue] ; lose -> (bet, 0)
  bookCasino(st.bet, outcome === 'push' ? st.bet : gain)
  recordHistory(user.id, 'blackjack', st.bet, gain, outcome)
  activeBJ.delete(user.id)
  return { ...bjView(st, true), outcome, gain, ...userSnapshot(user.id) }
}

/* ── nettoyages périodiques ───────────────────────────────── */
function cleanup() {
  const now = Date.now()
  db.prepare('DELETE FROM sessions WHERE created < ?').run(now - SESSION_TTL)
  db.prepare('DELETE FROM logs WHERE ts < ?').run(now - LOG_MAX_AGE)
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
    .onBeforeHandle({ as: 'scoped' }, ({ request, set, server }) => {
      // IP réelle : x-forwarded-for derrière un proxy, sinon l'IP de la connexion
      const ip  = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
               || server?.requestIP(request)?.address
               || 'unknown'
      const now = Date.now()
      const b   = store.get(ip) ?? { n: 0, reset: now + windowMs }
      if (now > b.reset) { b.n = 0; b.reset = now + windowMs }
      b.n++
      store.set(ip, b)
      if (b.n > max) { set.status = 429; return message }
    })
}
const authRL = rateLimit(15 * 60_000, 15, { error: 'Trop de tentatives, réessaie dans 15 minutes.' })

/* ── CSP ──────────────────────────────────────────────────── */
// script-src 'self' (sans unsafe-inline) : bloque les blocs <script> injectés — XSS réduit.
// script-src-attr 'unsafe-inline' : requis pour les onclick="…" dans les pages HTML.
// Ces deux directives sont indépendantes. Supprimer script-src-attr casserait toute l'UI.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
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
  .derive({ as: 'scoped' }, ({ headers, status }) => {
    // Elysia 1.3+ : le helper de court-circuit s'appelle `status` (ex-`error`).
    const token = (headers['authorization'] ?? '').replace(/^Bearer\s+/i, '').trim()
               || (headers['x-token'] ?? '').trim()
    if (!token) return status(401, { error: 'Non connecté' })
    const session = Q.getSession.get(token) as Session | null
    if (!session) return status(401, { error: 'Session invalide' })
    const now = Date.now()
    if (now - session.created > SESSION_TTL) {
      Q.delSession.run(token)
      return status(401, { error: 'Session expirée, reconnecte-toi.' })
    }
    const user = Q.userById.get(session.user_id) as User | null
    if (!user) return status(401, { error: 'Compte introuvable' })
    if (user.blocked) { Q.delSession.run(token); return status(403, { error: 'Compte suspendu.' }) }
    if (now - session.created > SESSION_TOUCH) Q.touchSession.run(now, token)   // expiration glissante
    return { user, authToken: token }
  })

function checkAdmin(headers: Record<string, string | undefined>): User | null {
  const token = ((headers['authorization'] ?? '').replace(/^Bearer\s+/i, '').trim()
              || (headers['x-token'] ?? '').trim())
  if (!token) return null
  const session = Q.getSession.get(token) as Session | null
  if (!session) return null
  const now = Date.now()
  if (now - session.created > SESSION_TTL) { Q.delSession.run(token); return null }
  const user = Q.userById.get(session.user_id) as User | null
  if (!user) return null
  if (now - session.created > SESSION_TOUCH) Q.touchSession.run(now, token)
  return user.is_admin ? user : null
}

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

/* ── static helpers (module scope — créés une seule fois) ─── */
const pub = (f: string) => Bun.file(join(import.meta.dir, 'public', f))
const PAGES: Record<string, string> = {
  '/': 'club.html', '/casino': 'casino.html', '/fight': 'fight.html',
  '/profil': 'profil.html', '/admin': 'admin.html',
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
      if (p.length < 8)   { set.status = 400; return { error: 'Mot de passe trop court (8 min).' } }
      // SECURITY: limite max pour éviter le DoS bcrypt (hash d'une chaîne 1 Mo bloquerait le thread)
      if (p.length > 128) { set.status = 400; return { error: 'Mot de passe trop long (128 max).' } }
      if (Q.userByName.get(u)) { set.status = 400; return { error: 'Ce pseudo existe déjà.' } }
      if (!inviteCode)   { set.status = 403; return { error: "Un lien d'invitation est requis pour créer un compte." } }
      const invite = db.prepare('SELECT credits FROM invites WHERE token = ? AND used = 0').get(inviteCode) as { credits: number } | null
      if (!invite) { set.status = 400; return { error: "Lien d'invitation invalide ou déjà utilisé." } }
      // SECURITY (race TOCTOU) : on RÉSERVE l'invitation de façon atomique AVANT de créer le compte.
      // Si une autre requête l'a déjà prise entre-temps, changes === 0 → on abandonne.
      const claim = db.prepare('UPDATE invites SET used = 1, used_by = ? WHERE token = ? AND used = 0').run(u, inviteCode)
      if (claim.changes === 0) { set.status = 400; return { error: "Lien d'invitation invalide ou déjà utilisé." } }
      const rpNom = clip(b.nom), rpPrenom = clip(b.prenom), rpPhone = clip(b.phone, 20), rpDiscord = clip(b.discord)
      const hash  = await Bun.password.hash(p, { algorithm: 'bcrypt', cost: 10 })
      const info  = Q.insertUser.run(u, hash, 0, invite.credits, Date.now(), rpNom, rpPrenom, rpPhone, rpDiscord)
      const token = randomBytes(32).toString('hex')
      const newId = Number(info.lastInsertRowid)
      Q.insSession.run(token, newId, Date.now())
      logEvent(u, 'auth', `Compte créé via invitation (${invite.credits} crédits)`, invite.credits)
      return { token, user: publicUser(Q.userById.get(newId) as User) }
    })

    .post('/api/login', async ({ body, set }) => {
      const b = body as Record<string, unknown>
      const u = String(b.user ?? '').trim()
      const p = String(b.pass ?? '')
      const code = String(b.code ?? '').trim()
      // SECURITY: rejeter les mots de passe trop longs avant d'appeler bcrypt (DoS)
      if (p.length > 128) { set.status = 401; return { error: 'Pseudo ou mot de passe incorrect.' } }
      const row = Q.userByName.get(u) as User | null
      if (!row || !(await Bun.password.verify(p, row.pass_hash))) {
        set.status = 401; return { error: 'Pseudo ou mot de passe incorrect.' }
      }
      if (row.blocked) { set.status = 403; return { error: 'Compte suspendu. Contacte un administrateur.' } }
      // 2FA : si activée, exiger un code TOTP valide
      if (row.totp_enabled) {
        if (!code) return { totp: true }                       // mot de passe OK → demande le code (pas de token)
        if (!verifyTOTP(row.totp_secret, code)) {
          set.status = 401; return { totp: true, error: 'Code de double authentification incorrect.' }
        }
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

    .post('/api/profile', ({ body, user }) => {
      const b = body as Record<string, unknown>
      const u = user as User
      Q.setProfile.run(clip(b.nom), clip(b.prenom), clip(b.phone, 20), clip(b.discord), u.id)
      return { user: publicUser(Q.userById.get(u.id) as User) }
    })

    .post('/api/password', async ({ body, user, set }) => {
      const b = body as Record<string, unknown>
      const u = user as User
      const current = String(b.current ?? '')
      const next    = String(b.password ?? '')
      if (next.length < 8)   { set.status = 400; return { error: 'Nouveau mot de passe trop court (8 min).' } }
      if (next.length > 128) { set.status = 400; return { error: 'Nouveau mot de passe trop long (128 max).' } }
      const row = Q.userById.get(u.id) as User | null
      if (!row || !(await Bun.password.verify(current, row.pass_hash))) {
        set.status = 403; return { error: 'Mot de passe actuel incorrect.' }
      }
      const hash = await Bun.password.hash(next, { algorithm: 'bcrypt', cost: 10 })
      db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hash, u.id)
      logEvent(row.username, 'auth', 'Mot de passe modifié')
      return { ok: true }
    })

    /* ── Double authentification (TOTP) ───────────────────── */
    .post('/api/2fa/setup', ({ user, set }) => {
      const u = user as User
      if (u.totp_enabled) { set.status = 400; return { error: 'La double authentification est déjà activée.' } }
      const secret = generateSecret()
      Q.setTotpSecret.run(secret, u.id)                      // secret en attente (enabled = 0)
      return { secret, uri: otpauthURI(secret, u.username) }
    })

    .post('/api/2fa/enable', ({ body, user, set }) => {
      const u = user as User
      const code = String((body as Record<string, unknown>).code ?? '').trim()
      const row = Q.userById.get(u.id) as User
      if (!row.totp_secret) { set.status = 400; return { error: 'Lance d\'abord la configuration.' } }
      if (row.totp_enabled) { set.status = 400; return { error: 'Déjà activée.' } }
      if (!verifyTOTP(row.totp_secret, code)) { set.status = 400; return { error: 'Code incorrect, réessaie.' } }
      Q.enableTotp.run(u.id)
      logEvent(row.username, 'auth', 'Double authentification activée')
      return { ok: true }
    })

    .post('/api/2fa/disable', async ({ body, user, set }) => {
      const u = user as User
      const pass = String((body as Record<string, unknown>).password ?? '')
      const row = Q.userById.get(u.id) as User
      if (!row.totp_enabled) { set.status = 400; return { error: 'La double authentification n\'est pas activée.' } }
      if (!(await Bun.password.verify(pass, row.pass_hash))) { set.status = 403; return { error: 'Mot de passe incorrect.' } }
      Q.disableTotp.run(u.id)
      logEvent(row.username, 'auth', 'Double authentification désactivée')
      return { ok: true }
    })

    .get('/api/config', () => ({ rtp: G.RTP, plinko: G.PK_MULT, wheel: G.WHEEL }))

    .get('/api/budget', () => ({ budget: Math.floor(casinoBudget()) }))

    /* ── Jeux one-shot (économie RTP fixe, voir games.ts) ── */
    .post('/api/play/slots', ({ body, user, set }) => {
      const u   = user as User
      const bet = intBet((body as any).bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      if (!charge(u, bet, 'slots')) { set.status = 400; return { error: 'Crédits Club insuffisants' } }
      const r = G.playSlots(bet, casinoBudget())
      payout(u, r.gain, 'slots'); awardXP(u.id, bet); bookCasino(bet, r.gain)
      recordHistory(u.id, 'slots', bet, r.gain, r.reels.join('|'))
      return { reels: r.reels, gain: r.gain, ...userSnapshot(u.id) }
    })

    .post('/api/play/plinko', ({ body, user, set }) => {
      const u   = user as User
      const b   = body as any
      const bet = intBet(b.bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const risk = (['low', 'med', 'high'] as const).find(x => x === b.risk) ?? 'med'
      if (!charge(u, bet, 'plinko')) { set.status = 400; return { error: 'Crédits Club insuffisants' } }
      const r = G.playPlinko(bet, risk, casinoBudget())
      payout(u, r.gain, 'plinko'); awardXP(u.id, bet); bookCasino(bet, r.gain)
      recordHistory(u.id, 'plinko', bet, r.gain, `x${r.mult}`)
      return { bin: r.bin, mult: r.mult, gain: r.gain, ...userSnapshot(u.id) }
    })

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

    .post('/api/play/dice', ({ body, user, set }) => {
      const u      = user as User
      const b      = body as any
      const bet    = intBet(b.bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const chance = Math.max(2, Math.min(95, Math.floor(Number(b.chance) || 50)))
      if (!charge(u, bet, 'dice')) { set.status = 400; return { error: 'Crédits Club insuffisants' } }
      const r = G.playDice(bet, chance, casinoBudget())
      payout(u, r.gain, 'dice'); awardXP(u.id, bet); bookCasino(bet, r.gain)
      recordHistory(u.id, 'dice', bet, r.gain, r.roll + (r.win ? '✓' : '✗'))
      return { roll: r.roll, win: r.win, mult: r.mult, gain: r.gain, ...userSnapshot(u.id) }
    })

    /* ── Blackjack ──────────────────────────────────────── */
    .post('/api/bj/deal', ({ body, user, set }) => {
      const u   = user as User
      const bet = intBet((body as any).bet)
      if (!bet) { set.status = 400; return { error: 'Mise invalide' } }
      const max = G.bjMaxBet(casinoBudget())
      if (bet > max) { set.status = 400; return { error: 'Mise max actuelle : ' + max + ' (cagnotte)' } }
      const existing = activeBJ.get(u.id)
      if (existing?.live) { set.status = 400; return { error: 'Une partie de Blackjack est déjà en cours.' } }
      if (!charge(u, bet, 'blackjack')) { set.status = 400; return { error: 'Crédits Club insuffisants' } }
      const deck = G.freshDeck()
      const st: BjState = { bet, deck, player: [], dealer: [], live: true, startedAt: Date.now() }
      st.player.push(G.bjDraw(deck, st.player, true,  G.BJ_BIAS))
      st.dealer.push(G.bjDraw(deck, st.dealer, false, G.BJ_BIAS))
      st.player.push(G.bjDraw(deck, st.player, true,  G.BJ_BIAS))
      st.dealer.push(G.bjDraw(deck, st.dealer, false, G.BJ_BIAS))
      activeBJ.set(u.id, st)
      awardXP(u.id, bet)
      if (G.handVal(st.player) === 21) return bjResolve(u, st)
      return { ...bjView(st, false), ...userSnapshot(u.id) }
    })

    .post('/api/bj/hit', ({ user, set }) => {
      const u  = user as User
      const st = activeBJ.get(u.id)
      if (!st || !st.live) { set.status = 400; return { error: 'Aucune partie en cours' } }
      st.player.push(G.bjDraw(st.deck, st.player, true, G.BJ_BIAS))
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
      const existingMines = activeMines.get(u.id)
      if (existingMines?.live) { set.status = 400; return { error: 'Une partie de Démineur est déjà en cours.' } }
      const bombs = Math.max(1, Math.min(24, Math.floor(Number(b.bombs) || 5)))
      const startMax = Math.floor(casinoBudget() / G.minesStepFactor(0, bombs))
      if (bet > startMax) { set.status = 400; return { error: 'Mise max actuelle : ' + startMax + ' (cagnotte)' } }
      if (!charge(u, bet, 'mines')) { set.status = 400; return { error: 'Crédits Club insuffisants' } }
      awardXP(u.id, bet)
      activeMines.set(u.id, {
        bet, bombs, bombSet: G.placeBombs(bombs), revealed: new Set(),
        picks: 0, gems: 0, mult: 1, live: true, startedAt: Date.now(),
      })
      return { bombs, mult: 1, pot: 0, ...userSnapshot(u.id) }
    })

    .post('/api/mines/pick', ({ body, user, set }) => {
      const u  = user as User
      const st = activeMines.get(u.id)
      if (!st || !st.live) { set.status = 400; return { error: 'Aucune partie en cours' } }
      if (st.maxReached) { set.status = 400; return { error: 'Max atteint — encaisse' } }
      const i = Math.floor(Number((body as any).i))
      if (!(i >= 0 && i < 25)) { set.status = 400; return { error: 'Case invalide' } }
      if (st.revealed.has(i))  { set.status = 400; return { error: 'Case déjà révélée' } }
      st.revealed.add(i)
      if (st.bombSet.has(i)) {
        st.live = false
        bookCasino(st.bet, 0)
        recordHistory(u.id, 'mines', st.bet, 0, 'bomb')
        activeMines.delete(u.id)
        return { result: 'bomb', i, bombs: [...st.bombSet], ...userSnapshot(u.id) }
      }
      const safe = 25 - st.bombs, k = st.picks
      st.mult *= G.minesStepFactor(k, st.bombs)
      st.gems++; st.picks++
      const pot = Math.round(st.bet * st.mult)
      if (st.gems === safe) {
        payout(u, pot, 'mines')
        bookCasino(st.bet, pot)
        recordHistory(u.id, 'mines', st.bet, pot, 'sweep')
        st.live = false; activeMines.delete(u.id)
        return { result: 'gem', i, mult: +st.mult.toFixed(2), pot, cashedOut: true, gain: pot, bombs: [...st.bombSet], ...userSnapshot(u.id) }
      }
      st.maxReached = st.picks < safe && st.bet * st.mult * G.minesStepFactor(st.picks, st.bombs) > casinoBudget()
      return { result: 'gem', i, mult: +st.mult.toFixed(2), pot, maxReached: st.maxReached, ...userSnapshot(u.id) }
    })

    .post('/api/mines/cashout', ({ user, set }) => {
      const u  = user as User
      const st = activeMines.get(u.id)
      if (!st || !st.live) { set.status = 400; return { error: 'Aucune partie en cours' } }
      const gain = Math.round(st.bet * st.mult)
      payout(u, gain, 'mines')
      bookCasino(st.bet, gain)
      recordHistory(u.id, 'mines', st.bet, gain, `${st.gems} gems`)
      st.live = false; activeMines.delete(u.id)
      return { gain, mult: +st.mult.toFixed(2), bombs: [...st.bombSet], ...userSnapshot(u.id) }
    })

    /* ── Historique / Leaderboard ───────────────────────── */
    .get('/api/history', ({ user }) => ({
      history: Q.getHistory.all((user as User).id)
    }))

    .get('/api/leaderboard', ({ query }) => {
      const type = (query as any).type === 'level' ? 'level'
                 : (query as any).type === 'lost'  ? 'lost'  : 'won'
      const rows = (type === 'level' ? Q.lbLevel : type === 'lost' ? Q.lbLost : Q.topUsers).all() as any[]
      return {
        type,
        top: rows.map(u => {
          const value = type === 'level' ? (u.level || 1)
                      : type === 'lost'  ? Math.max(0, Math.floor(u.lost ?? 0))
                      : Math.floor(u.won || 0)
          return { name: u.username, level: u.level || 1, won: Math.floor(u.won || 0), value }
        })
      }
    })

    .get('/api/biggest-wins', () => ({
      wins: (Q.bigWins.all() as any[]).map(w => ({
        name: w.username, game: w.game, gain: Math.floor(w.gain), ts: w.ts,
      }))
    }))

  )

  /* ── Routes admin — checkAdmin() inline dans chaque handler ── */
  .use(new Elysia()

    .get('/api/admin/users', ({ headers, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      return { users: (Q.allUsers.all() as any[]).map(u => ({
        name: u.username, credit: Math.floor(u.credit), wagered: Math.floor(u.wagered),
        admin: !!u.is_admin, level: u.level || 1, xp: Math.floor(u.xp || 0),
        rp_nom: u.rp_nom ?? '', rp_prenom: u.rp_prenom ?? '', discord: u.discord ?? '',
        totp: !!u.totp_enabled, blocked: !!u.blocked,
      })) }
    })

    .post('/api/admin/credit', ({ headers, body, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      const b = body as any
      const u = String(b.user ?? ''), n = Math.floor(Number(b.amount) || 0)
      const row = Q.userByName.get(u) as User | null
      if (!row) { set.status = 404; return { error: 'Joueur introuvable' } }
      Q.setCredit.run(Math.max(0, row.credit + n), row.id)
      logEvent(adm.username, 'admin', `Crédit ${n >= 0 ? '+' : ''}${n} sur « ${u} »`, n)
      return { ok: true }
    })

    .post('/api/admin/delete', ({ headers, body, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      const u   = String((body as any).user ?? '')
      const row = Q.userByName.get(u) as User | null
      if (!row || row.is_admin) { set.status = 400; return { error: 'Compte introuvable ou protégé' } }
      // suppression + nettoyage des données liées (pas de FK CASCADE → manuel)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id)
      db.prepare('DELETE FROM game_history WHERE user_id = ?').run(row.id)
      Q.delUser.run(u)
      activeBJ.delete(row.id); activeMines.delete(row.id)
      logEvent(adm.username, 'admin', `Compte supprimé « ${u} »`)
      return { ok: true }
    })

    /* Économie en lecture seule (RTP fixe, voir games.ts) */
    .get('/api/admin/gameinfo', ({ headers, set }) => {
      if (!checkAdmin(headers as any)) { set.status = 403; return { error: 'Réservé admin' } }
      return { rtp: G.RTP, games: G.GAME_INFO }
    })

    .get('/api/admin/casino', ({ headers, set }) => {
      if (!checkAdmin(headers as any)) { set.status = 403; return { error: 'Réservé admin' } }
      const c = Q.getCasino.get() as { wagered: number; paid: number }
      const pool = Math.max(0, c.wagered - c.paid)
      return {
        wagered: c.wagered, paid: c.paid, pool,
        budget: CASINO_RESERVE * pool,
        rtp:    c.wagered > 0 ? c.paid / c.wagered : 0,
        margin: c.wagered > 0 ? 1 - c.paid / c.wagered : 0,
        reserve: CASINO_RESERVE,
      }
    })

    .post('/api/admin/casino/reset', ({ headers, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      Q.resetCasino.run()
      logEvent(adm.username, 'admin', 'Cagnotte réinitialisée')
      return { ok: true }
    })

    .get('/api/admin/logs', ({ headers, query, set }) => {
      if (!checkAdmin(headers as any)) { set.status = 403; return { error: 'Réservé admin' } }
      const f = query.filter as string | undefined
      return { logs: (f && f !== 'all') ? Q.logsByType.all(f) : Q.logsAll.all() }
    })

    .delete('/api/admin/logs', ({ headers, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      Q.clearLogs.run()
      logEvent(adm.username, 'admin', 'Logs effacés')
      return { ok: true }
    })

    .post('/api/admin/invite', ({ headers, body, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      const credits = Math.max(0, Math.floor(Number((body as any).credits ?? 1000) || 0))
      const token   = randomBytes(16).toString('hex')
      db.prepare('INSERT INTO invites (token, credits, created, created_by) VALUES (?,?,?,?)')
        .run(token, credits, Date.now(), adm.username)
      logEvent(adm.username, 'admin', `Invitation créée (${credits} crédits)`, credits)
      return { ok: true, token, credits }
    })

    .get('/api/admin/invites', ({ headers, set }) => {
      if (!checkAdmin(headers as any)) { set.status = 403; return { error: 'Réservé admin' } }
      return { invites: db.prepare('SELECT * FROM invites ORDER BY created DESC LIMIT 200').all() }
    })

    .delete('/api/admin/invite/:token', ({ headers, params, set }) => {
      if (!checkAdmin(headers as any)) { set.status = 403; return { error: 'Réservé admin' } }
      db.prepare('DELETE FROM invites WHERE token = ?').run(params.token)   // utilisées comprises
      return { ok: true }
    })

    /* ── Désactiver la 2FA d'un joueur (récupération) ─────── */
    .post('/api/admin/2fa-disable', ({ headers, body, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      const name = String((body as Record<string, unknown>).user ?? '').trim()
      Q.disableTotpByName.run(name)
      logEvent(adm.username, 'admin', `2FA désactivée pour ${name}`)
      return { ok: true }
    })

    /* ── Réinitialiser le mot de passe d'un joueur ────────── */
    .post('/api/admin/reset-password', async ({ headers, body, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      const name = String((body as Record<string, unknown>).user ?? '').trim()
      const pw   = String((body as Record<string, unknown>).password ?? '')
      if (pw.length < 8)   { set.status = 400; return { error: 'Mot de passe trop court (8 min).' } }
      if (pw.length > 128) { set.status = 400; return { error: 'Mot de passe trop long (128 max).' } }
      const target = Q.userByName.get(name) as User | null
      if (!target) { set.status = 404; return { error: 'Joueur introuvable.' } }
      const hash = await Bun.password.hash(pw, { algorithm: 'bcrypt', cost: 10 })
      db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hash, target.id)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id)   // force la reconnexion
      logEvent(adm.username, 'admin', `Mot de passe réinitialisé pour ${name}`)
      return { ok: true }
    })

    /* ── Bloquer / débloquer un compte ────────────────────── */
    .post('/api/admin/block', ({ headers, body, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      const name = String((body as Record<string, unknown>).user ?? '').trim()
      const blocked = (body as Record<string, unknown>).blocked ? 1 : 0
      const target = Q.userByName.get(name) as User | null
      if (!target) { set.status = 404; return { error: 'Joueur introuvable.' } }
      if (target.is_admin) { set.status = 400; return { error: 'Impossible de bloquer un administrateur.' } }
      db.prepare('UPDATE users SET blocked = ? WHERE id = ?').run(blocked, target.id)
      if (blocked) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id)   // déconnecte
      logEvent(adm.username, 'admin', (blocked ? 'Compte bloqué : ' : 'Compte débloqué : ') + name)
      return { ok: true }
    })

    /* ── Système : export / import de la base ─────────────── */
    .get('/api/admin/export-db', ({ headers, set }) => {
      if (!checkAdmin(headers as any)) { set.status = 403; return { error: 'Réservé admin' } }
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);') } catch (_) {}   // .db à jour
      set.headers['Content-Disposition'] = 'attachment; filename="blackstate-backup.db"'
      set.headers['Content-Type'] = 'application/octet-stream'
      return Bun.file(DB_FILE)
    })

    .post('/api/admin/import-db', async ({ headers, body, request, set }) => {
      const adm = checkAdmin(headers as any)
      if (!adm) { set.status = 403; return { error: 'Réservé admin' } }
      let ab: ArrayBuffer
      if (body instanceof ArrayBuffer) ab = body
      else if (body && typeof (body as any).arrayBuffer === 'function') ab = await (body as any).arrayBuffer()
      else ab = await request.arrayBuffer()
      const buf = Buffer.from(ab)
      // valide l'entête SQLite ("SQLite format 3\0")
      if (buf.length < 16 || buf.subarray(0, 15).toString('latin1') !== 'SQLite format 3') {
        set.status = 400; return { error: 'Fichier invalide (ce n\'est pas une base SQLite).' }
      }
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);') } catch (_) {}
      // sauvegarde de la base actuelle avant écrasement
      try { await Bun.write(DB_FILE + '.bak-' + Date.now(), Bun.file(DB_FILE)) } catch (_) {}
      try { db.close() } catch (_) {}
      for (const ext of ['-wal', '-shm']) { try { unlinkSync(DB_FILE + ext) } catch (_) {} }
      await Bun.write(DB_FILE, buf)
      console.log(`[import-db] base remplacée par ${adm.username} — redémarrage`)
      // le process redémarre pour recharger la nouvelle base (requêtes préparées liées au démarrage)
      setTimeout(() => process.exit(0), 400)
      return { ok: true, restart: true }
    })
  )

  /* ── Routing multi-pages + fichiers statiques ─────────── */
  .get('/*', async ({ request, set }) => {
    let pathname: string
    try { pathname = decodeURIComponent(new URL(request.url).pathname) }
    catch { return pub('club.html') }
    if (pathname.includes('..') || pathname.includes('\0')) return pub('club.html')
    // Pas de cache agressif : le navigateur revalide → les CSS/JS modifiés sont toujours frais
    set.headers['Cache-Control'] = 'no-cache, must-revalidate'
    const clean = pathname.replace(/\/+$/, '') || '/'
    if (PAGES[clean]) { set.headers['Content-Type'] = 'text/html'; return pub(PAGES[clean]) }
    const ext = pathname.slice(pathname.lastIndexOf('.') + 1).toLowerCase()
    if (MIME[ext]) {
      const file = pub(clean)
      if (await file.exists()) { set.headers['Content-Type'] = MIME[ext]; return file }
      set.status = 404; return 'Not found'   // asset connu introuvable → 404, pas de fallback HTML
    }
    set.headers['Content-Type'] = 'text/html'; return pub('club.html')   // SPA fallback (pages)
  })

  /* ── Gestionnaire d'erreurs ───────────────────────────── */
  .onError(({ code, error, set }) => {
    if (code === 'NOT_FOUND') return // laisse le catch-all /* gérer
    console.error('[ERROR]', error)
    set.status = 500
    return { error: 'Erreur serveur interne' }
  })

  .listen({ port: PORT, hostname: '0.0.0.0' }, () => console.log(`BlackState Casino → http://localhost:${PORT}`))

/* ── Arrêt propre (Docker/host envoie SIGTERM/SIGINT) ──────────
   Checkpoint du WAL pour garder le fichier .db à jour avant de quitter. */
function shutdown(sig: string) {
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);') } catch (_) {}
  try { db.close() } catch (_) {}
  console.log(`[${sig}] arrêt propre, base sauvegardée.`)
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

export type App = typeof app
