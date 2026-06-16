/* ============================================================
   Base de données — SQLite intégré à Node (node:sqlite, Node >= 22.5)
   Aucune compilation, aucune dépendance native : se déploie partout.
   Pour passer sur la MySQL de ton serveur FiveM plus tard :
   remplace cette couche par le paquet "mysql2" (API très proche).
============================================================ */
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'casino.db');
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  username  TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  is_admin  INTEGER NOT NULL DEFAULT 0,
  credit    REAL NOT NULL DEFAULT 1000,
  wagered   REAL NOT NULL DEFAULT 0,
  won       REAL NOT NULL DEFAULT 0,
  played    INTEGER NOT NULL DEFAULT 0,
  biggest   REAL NOT NULL DEFAULT 0,
  last_bonus INTEGER NOT NULL DEFAULT 0,
  created   INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token   TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  game   TEXT PRIMARY KEY,
  bias   REAL NOT NULL,
  payout REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS logs (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,
  username TEXT NOT NULL,
  type   TEXT NOT NULL,
  msg    TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts);
`);

const DEFAULT_SETTINGS = {
  slots:     { bias: 35, payout: 100 },
  blackjack: { bias: 48, payout: 100 },
  mines:     { bias: 45, payout: 100 },
  plinko:    { bias: 40, payout: 100 },
  wheel:     { bias: 40, payout: 100 },
  dice:      { bias: 45, payout: 97 },
};
const seedSetting = db.prepare('INSERT OR IGNORE INTO settings (game, bias, payout) VALUES (?,?,?)');
for (const g in DEFAULT_SETTINGS) seedSetting.run(g, DEFAULT_SETTINGS[g].bias, DEFAULT_SETTINGS[g].payout);

const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASS || 'admin';
const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser);
if (!exists) {
  db.prepare('INSERT INTO users (username, pass_hash, is_admin, credit, created) VALUES (?,?,?,?,?)')
    .run(adminUser, bcrypt.hashSync(adminPass, 10), 1, 100000, Date.now());
  console.log(`[seed] Compte admin créé : "${adminUser}" / "${adminPass}" — pense à le changer.`);
}

module.exports = db;
