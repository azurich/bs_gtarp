/* ============================================================
   BlackState Casino — base de données (bun:sqlite)
============================================================ */
import { Database } from 'bun:sqlite'
import { join } from 'node:path'

export const DB_FILE = process.env.DB_FILE ?? join(import.meta.dir, 'casino.db')
export const db = new Database(DB_FILE)
/* ── PRAGMA (prod) ─────────────────────────────────────────────
   WAL        : lectures concurrentes pendant l'écriture
   synchronous NORMAL : sûr avec WAL, plus rapide que FULL
   busy_timeout : attend 5 s au lieu d'échouer si la base est verrouillée
   foreign_keys : prêt si on ajoute des contraintes plus tard            */
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA synchronous = NORMAL;')
db.exec('PRAGMA busy_timeout = 5000;')
db.exec('PRAGMA foreign_keys = ON;')

/* ── schéma ───────────────────────────────────────────────── */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    UNIQUE NOT NULL,
  pass_hash  TEXT    NOT NULL,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  credit     REAL    NOT NULL DEFAULT 1000,
  wagered    REAL    NOT NULL DEFAULT 0,
  won        REAL    NOT NULL DEFAULT 0,
  played     INTEGER NOT NULL DEFAULT 0,
  biggest    REAL    NOT NULL DEFAULT 0,
  xp         REAL    NOT NULL DEFAULT 0,
  level      INTEGER NOT NULL DEFAULT 1,
  created    INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token   TEXT    PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS logs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  username TEXT    NOT NULL,
  type     TEXT    NOT NULL,
  msg      TEXT    NOT NULL,
  amount   REAL    NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS game_history (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game    TEXT    NOT NULL,
  bet     REAL    NOT NULL,
  gain    REAL    NOT NULL DEFAULT 0,
  result  TEXT,
  ts      INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  token      TEXT    PRIMARY KEY,
  credits    REAL    NOT NULL DEFAULT 1000,
  used       INTEGER NOT NULL DEFAULT 0,
  used_by    TEXT,
  created    INTEGER NOT NULL,
  created_by TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS casino (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  wagered REAL NOT NULL DEFAULT 0,
  paid    REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_logs_ts   ON logs(ts);
CREATE INDEX IF NOT EXISTS idx_hist_user ON game_history(user_id, ts);
`)
db.exec(`INSERT OR IGNORE INTO casino (id, wagered, paid) VALUES (1, 0, 0)`)

/* ── migrations (colonnes ajoutées après v1) ──────────────── */
const addCol = (tbl: string, col: string, def: string) => {
  try { db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`) } catch (_) {}
}
addCol('users', 'xp',    'REAL    NOT NULL DEFAULT 0')
addCol('users', 'level', 'INTEGER NOT NULL DEFAULT 1')
addCol('users', 'rp_nom',    "TEXT NOT NULL DEFAULT ''")
addCol('users', 'rp_prenom', "TEXT NOT NULL DEFAULT ''")
addCol('users', 'rp_phone',  "TEXT NOT NULL DEFAULT ''")
addCol('users', 'discord',   "TEXT NOT NULL DEFAULT ''")
addCol('users', 'totp_secret',  "TEXT NOT NULL DEFAULT ''")   // secret base32 (2FA)
addCol('users', 'totp_enabled', 'INTEGER NOT NULL DEFAULT 0')  // 1 quand la 2FA est confirmée
addCol('users', 'blocked',      'INTEGER NOT NULL DEFAULT 0')  // 1 = compte suspendu

/* L'économie (RTP) est codée en dur dans games.ts — plus de table settings. */

/* ── types exportés ───────────────────────────────────────── */
export interface User {
  id        : number
  username  : string
  pass_hash : string
  is_admin  : number
  credit    : number
  wagered   : number
  won       : number
  played    : number
  biggest   : number
  xp        : number
  level     : number
  created   : number
  rp_nom    : string
  rp_prenom : string
  rp_phone  : string
  discord   : string
  totp_secret  : string
  totp_enabled : number
  blocked      : number
}

export interface Session {
  token  : string
  user_id: number
  created: number
}

export default db
