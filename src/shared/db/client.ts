import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'kami.db';

export const expoDb = SQLite.openDatabaseSync(DB_NAME);
export const db = drizzle(expoDb, { schema });

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT,
  nickname TEXT,
  avatar_url TEXT,
  theme TEXT NOT NULL DEFAULT 'blush',
  text_size TEXT NOT NULL DEFAULT 'medium',
  daily_reminder_enabled INTEGER NOT NULL DEFAULT 1,
  weekly_digest_enabled INTEGER NOT NULL DEFAULT 0,
  streak_alerts_enabled INTEGER NOT NULL DEFAULT 1,
  push_token TEXT,
  timezone TEXT,
  kami_id TEXT,
  active_space TEXT,
  current_mood_label TEXT,
  current_mood_emoji TEXT,
  last_seen_at TEXT,
  hero_bg_url TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS mood_logs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  mood_id TEXT NOT NULL,
  mood_emoji TEXT NOT NULL,
  mood_label TEXT NOT NULL,
  note TEXT,
  logged_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  mood_id TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  image_urls TEXT NOT NULL DEFAULT '[]',
  entry_date TEXT NOT NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'personal',
  status TEXT NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  completed_at TEXT,
  emoji TEXT NOT NULL DEFAULT '🌱',
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  emoji TEXT NOT NULL DEFAULT '🌸',
  mood TEXT,
  image_urls TEXT NOT NULL DEFAULT '[]',
  memory_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS future_letters (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  deliver_at TEXT NOT NULL,
  image_urls TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_draft INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS outbox_mutations (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_upload_queue (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  remote_path TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date ON mood_logs(user_id, logged_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_memories_user_date ON memories(user_id, memory_date);
CREATE INDEX IF NOT EXISTS idx_future_letters_user_deliver ON future_letters(user_id, deliver_at);
CREATE INDEX IF NOT EXISTS idx_outbox_mutations_status ON outbox_mutations(status, created_at);
CREATE INDEX IF NOT EXISTS idx_file_upload_queue_status ON file_upload_queue(status, created_at);
`;

export async function initDb(): Promise<void> {
  try {
    await expoDb.execAsync(INIT_SQL);

    // Add columns dynamically for existing databases
    const columnsToAlter = [
      'timezone',
      'kami_id',
      'active_space',
      'current_mood_label',
      'current_mood_emoji',
      'last_seen_at',
      'hero_bg_url'
    ];
    for (const col of columnsToAlter) {
      try {
        await expoDb.execAsync(`ALTER TABLE profiles ADD COLUMN ${col} TEXT;`);
      } catch (e) {
        // Ignore errors if columns already exist
      }
    }

    console.log('[SQLite DB] Successfully initialized database schema.');
  } catch (error) {
    console.error('[SQLite DB] Error initializing schema:', error);
    throw error;
  }
}
