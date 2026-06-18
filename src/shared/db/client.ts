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
  updated_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT
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
  user_id TEXT NOT NULL DEFAULT '',
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
  user_id TEXT NOT NULL DEFAULT '',
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

CREATE TABLE IF NOT EXISTS prompt_responses (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  response TEXT NOT NULL,
  response_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS streaks (
  user_id TEXT PRIMARY KEY NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_checkin_date TEXT,
  total_checkins INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS daily_prompts (
  id TEXT PRIMARY KEY NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS couple_letters (
  id TEXT PRIMARY KEY NOT NULL,
  couple_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
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
  parent_letter_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS couple_journals (
  id TEXT PRIMARY KEY NOT NULL,
  couple_id TEXT NOT NULL,
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
  deleted_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS couple_memories (
  id TEXT PRIMARY KEY NOT NULL,
  couple_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_urls TEXT NOT NULL DEFAULT '[]',
  memory_date TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  last_edited_by TEXT,
  location TEXT,
  mood TEXT,
  memory_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS couple_goals (
  id TEXT PRIMARY KEY NOT NULL,
  couple_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'relationship',
  status TEXT NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  completed_at TEXT,
  emoji TEXT NOT NULL DEFAULT '🌱',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS couple_comments (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  server_updated_at TEXT,
  deleted_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS image_records (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  local_uri TEXT,
  supabase_path TEXT,
  bucket_name TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_logs_user_date ON mood_logs(user_id, logged_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_responses_unq ON prompt_responses(user_id, prompt_id, response_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_memories_user_date ON memories(user_id, memory_date);
CREATE INDEX IF NOT EXISTS idx_future_letters_user_deliver ON future_letters(user_id, deliver_at);
CREATE INDEX IF NOT EXISTS idx_outbox_mutations_status ON outbox_mutations(status, created_at);
CREATE INDEX IF NOT EXISTS idx_file_upload_queue_status ON file_upload_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_mutations_user_status ON outbox_mutations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_file_upload_queue_user_status ON file_upload_queue(user_id, status);

CREATE INDEX IF NOT EXISTS idx_couple_letters_couple ON couple_letters(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_journals_couple ON couple_journals(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_memories_couple ON couple_memories(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_goals_couple ON couple_goals(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_comments_entry ON couple_comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_image_records_entity ON image_records(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS couple_candids (
  id TEXT PRIMARY KEY NOT NULL,
  couple_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  image_path TEXT NOT NULL,
  thumb_path TEXT,
  caption TEXT,
  reaction_emoji TEXT,
  is_seen INTEGER NOT NULL DEFAULT 0,
  seen_at TEXT,
  is_first_candid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  server_updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS couple_candid_streaks (
  couple_id TEXT PRIMARY KEY NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_both_sent_date TEXT,
  user1_last_sent_date TEXT,
  user2_last_sent_date TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_couple_candids_couple ON couple_candids(couple_id, created_at);
`;

export async function initDb(): Promise<void> {
  try {
    // Enable WAL mode & normal synchronous for performance and crash safety
    try {
      await expoDb.execAsync('PRAGMA journal_mode=WAL;');
      await expoDb.execAsync('PRAGMA synchronous=NORMAL;');
      console.log('[SQLite DB] WAL mode and synchronous=NORMAL configured.');
    } catch (pragmaErr) {
      console.error('[SQLite DB] Failed to configure PRAGMAs:', pragmaErr);
    }

    await expoDb.execAsync(INIT_SQL);

    // Ensure mood_logs has a unique index on (user_id, logged_date)
    try {
      await expoDb.execAsync("DROP INDEX IF EXISTS idx_mood_logs_user_date;");
    } catch (e) {
      // Ignore
    }
    try {
      await expoDb.execAsync("CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_logs_user_date ON mood_logs(user_id, logged_date);");
    } catch (e) {
      console.error('[SQLite DB] Failed to create unique index on mood_logs:', e);
    }

    // Alter outbox_mutations and file_upload_queue tables to add user_id column dynamically
    try {
      await expoDb.execAsync("ALTER TABLE outbox_mutations ADD COLUMN user_id TEXT NOT NULL DEFAULT '';");
    } catch (e) {
      // Ignore if column already exists
    }
    try {
      await expoDb.execAsync("ALTER TABLE file_upload_queue ADD COLUMN user_id TEXT NOT NULL DEFAULT '';");
    } catch (e) {
      // Ignore if column already exists
    }

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

    try {
      await expoDb.execAsync("ALTER TABLE profiles ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'synced';");
    } catch (e) {
      // Ignore if already exists
    }
    try {
      await expoDb.execAsync("ALTER TABLE profiles ADD COLUMN server_updated_at TEXT;");
    } catch (e) {
      // Ignore if already exists
    }
    try {
      await expoDb.execAsync("ALTER TABLE profiles ADD COLUMN deleted_at TEXT;");
    } catch (e) {
      // Ignore if already exists
    }

    // Alter existing tables to add offline sync columns dynamically if missing
    const tablesToAlter = ['mood_logs', 'journal_entries', 'goals', 'memories', 'future_letters'];
    for (const table of tablesToAlter) {
      try {
        await expoDb.execAsync(`ALTER TABLE ${table} ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'synced';`);
      } catch (e) {
        // Ignore if already exists
      }
      try {
        await expoDb.execAsync(`ALTER TABLE ${table} ADD COLUMN server_updated_at TEXT;`);
      } catch (e) {
        // Ignore if already exists
      }
      try {
        await expoDb.execAsync(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT;`);
      } catch (e) {
        // Ignore if already exists
      }
    }

    console.log('[SQLite DB] Successfully initialized database schema.');
  } catch (error) {
    console.error('[SQLite DB] Error initializing schema:', error);
    throw error;
  }
}
