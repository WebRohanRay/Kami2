import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email'),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  theme: text('theme').notNull().default('blush'),
  textSize: text('text_size').notNull().default('medium'),
  dailyReminderEnabled: integer('daily_reminder_enabled').notNull().default(1),
  weeklyDigestEnabled: integer('weekly_digest_enabled').notNull().default(0),
  streakAlertsEnabled: integer('streak_alerts_enabled').notNull().default(1),
  pushToken: text('push_token'),
  timezone: text('timezone'),
  kamiId: text('kami_id'),
  activeSpace: text('active_space'),
  currentMoodLabel: text('current_mood_label'),
  currentMoodEmoji: text('current_mood_emoji'),
  lastSeenAt: text('last_seen_at'),
  heroBgUrl: text('hero_bg_url'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const moodLogs = sqliteTable('mood_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  moodId: text('mood_id').notNull(),
  moodEmoji: text('mood_emoji').notNull(),
  moodLabel: text('mood_label').notNull(),
  note: text('note'),
  loggedDate: text('logged_date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
});

export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title'),
  body: text('body').notNull(),
  moodId: text('mood_id'),
  tags: text('tags').notNull().default('[]'), // Stored as JSON array string
  imageUrls: text('image_urls').notNull().default('[]'), // Stored as JSON array string
  entryDate: text('entry_date').notNull(),
  isPinned: integer('is_pinned').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
});

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull().default('personal'),
  status: text('status').notNull().default('active'),
  progress: integer('progress').notNull().default(0),
  targetDate: text('target_date'),
  completedAt: text('completed_at'),
  emoji: text('emoji').notNull().default('🌱'),
  sortOrder: integer('sort_order').notNull().default(0),
  imageUrl: text('image_url'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
});

export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  emoji: text('emoji').notNull().default('🌸'),
  mood: text('mood'),
  imageUrls: text('image_urls').notNull().default('[]'), // Stored as JSON array string
  memoryDate: text('memory_date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
});

export const futureLetters = sqliteTable('future_letters', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  deliverAt: text('deliver_at').notNull(),
  imageUrls: text('image_urls').notNull().default('[]'), // Stored as JSON array string
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isRead: integer('is_read').notNull().default(0),
  isFavorite: integer('is_favorite').notNull().default(0),
  isDraft: integer('is_draft').notNull().default(0),
  isArchived: integer('is_archived').notNull().default(0),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
});

export const outboxMutations = sqliteTable('outbox_mutations', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'profiles', 'mood_logs', 'journal_entries', 'goals', 'memories', 'future_letters'
  entityId: text('entity_id').notNull(),
  operation: text('operation').notNull(), // 'insert', 'update', 'delete'
  payloadJson: text('payload_json').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'syncing', 'failed', 'synced'
  retryCount: integer('retry_count').notNull().default(0),
  nextRetryAt: text('next_retry_at'),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const fileUploadQueue = sqliteTable('file_upload_queue', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'journal_entries', 'goals', 'memories', 'future_letters'
  entityId: text('entity_id').notNull(),
  localUri: text('local_uri').notNull(),
  remotePath: text('remote_path').notNull(),
  bucketName: text('bucket_name').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'uploading', 'failed', 'completed'
  retryCount: integer('retry_count').notNull().default(0),
  nextRetryAt: text('next_retry_at'),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
