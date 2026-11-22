import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DATABASE_PATH || './data/config.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    prefix TEXT DEFAULT '!',
    welcome_channel TEXT,
    log_channel TEXT,
    status_channel TEXT,
    erlc_api_key TEXT,
    erlc_server_id TEXT,
    accent_color TEXT DEFAULT '#7c3aed',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    guild_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export function getGuildSettings(guildId) {
  let settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!settings) {
    db.prepare('INSERT INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  }
  return settings;
}

export function updateGuildSettings(guildId, patch) {
  const allowed = ['prefix', 'welcome_channel', 'log_channel', 'status_channel', 'erlc_api_key', 'erlc_server_id', 'accent_color'];
  const entries = Object.entries(patch).filter(([key]) => allowed.includes(key));
  if (!entries.length) return getGuildSettings(guildId);
  getGuildSettings(guildId);
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  db.prepare(`UPDATE guild_settings SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`)
    .run(...entries.map(([, value]) => value || null), guildId);
  return getGuildSettings(guildId);
}
