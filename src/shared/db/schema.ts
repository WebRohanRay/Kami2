import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

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
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
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
}, (t) => ({
  userLoggedDateUnique: unique('mood_logs_user_id_logged_date_unq').on(t.userId, t.loggedDate),
}));

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

export const promptResponses = sqliteTable('prompt_responses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  promptId: text('prompt_id').notNull(),
  response: text('response').notNull(),
  responseDate: text('response_date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
}, (t) => ({
  unq: unique('prompt_responses_unq').on(t.userId, t.promptId, t.responseDate),
}));

export const streaks = sqliteTable('streaks', {
  userId: text('user_id').primaryKey(),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastCheckinDate: text('last_checkin_date'),
  totalCheckins: integer('total_checkins').notNull().default(0),
  updatedAt: text('updated_at'),
});

export const dailyPrompts = sqliteTable('daily_prompts', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  category: text('category').notNull(),
  isActive: integer('is_active').notNull().default(1),
  displayOrder: integer('display_order').notNull().default(0),
});

export const outboxMutations = sqliteTable('outbox_mutations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default(''),
  entityType: text('entity_type').notNull(), // 'profiles', 'mood_logs', 'journal_entries', 'goals', 'memories', 'future_letters'
  entityId: text('entity_id').notNull(),
  operation: text('operation').notNull(), // 'insert', 'update', 'delete'
  payloadJson: text('payload_json').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'syncing', 'failed', 'synced', 'discarded'
  retryCount: integer('retry_count').notNull().default(0),
  nextRetryAt: text('next_retry_at'),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const fileUploadQueue = sqliteTable('file_upload_queue', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default(''),
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

export const coupleLetters = sqliteTable('couple_letters', {
  id: text('id').primaryKey(),
  coupleId: text('couple_id').notNull(),
  senderId: text('sender_id').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  deliverAt: text('deliver_at').notNull(),
  imageUrls: text('image_urls').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isRead: integer('is_read').notNull().default(0),
  isFavorite: integer('is_favorite').notNull().default(0),
  isDraft: integer('is_draft').notNull().default(0),
  isArchived: integer('is_archived').notNull().default(0),
  parentLetterId: text('parent_letter_id'),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
  retryCount: integer('retry_count').notNull().default(0),
});

export const coupleJournals = sqliteTable('couple_journals', {
  id: text('id').primaryKey(),
  coupleId: text('couple_id').notNull(),
  userId: text('user_id').notNull(),
  title: text('title'),
  body: text('body').notNull(),
  moodId: text('mood_id'),
  tags: text('tags').notNull().default('[]'),
  imageUrls: text('image_urls').notNull().default('[]'),
  entryDate: text('entry_date').notNull(),
  isPinned: integer('is_pinned').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
  retryCount: integer('retry_count').notNull().default(0),
});

export const coupleMemories = sqliteTable('couple_memories', {
  id: text('id').primaryKey(),
  coupleId: text('couple_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  imageUrls: text('image_urls').notNull().default('[]'),
  memoryDate: text('memory_date').notNull(),
  tags: text('tags').notNull().default('[]'),
  lastEditedBy: text('last_edited_by'),
  location: text('location'),
  mood: text('mood'),
  memoryTime: text('memory_time'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
  retryCount: integer('retry_count').notNull().default(0),
});

export const coupleGoals = sqliteTable('couple_goals', {
  id: text('id').primaryKey(),
  coupleId: text('couple_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull().default('relationship'),
  status: text('status').notNull().default('active'),
  progress: integer('progress').notNull().default(0),
  targetDate: text('target_date'),
  completedAt: text('completed_at'),
  emoji: text('emoji').notNull().default('🌱'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
  retryCount: integer('retry_count').notNull().default(0),
});

export const coupleComments = sqliteTable('couple_comments', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').notNull(),
  userId: text('user_id').notNull(),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('synced'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
  retryCount: integer('retry_count').notNull().default(0),
});

export const imageRecords = sqliteTable('image_records', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'memory', 'journal', 'goal', 'letter', etc.
  entityId: text('entity_id').notNull(),
  localUri: text('local_uri'),            // file:///path/to/local/image
  supabasePath: text('supabase_path'),     // userId/entityId/timestamp.jpg
  bucketName: text('bucket_name').notNull(),
  syncStatus: text('sync_status').notNull().default('pending'), // pending|syncing|synced|failed
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const coupleCandids = sqliteTable('couple_candids', {
  id: text('id').primaryKey(),
  coupleId: text('couple_id').notNull(),
  senderId: text('sender_id').notNull(),
  imagePath: text('image_path').notNull(),     // Supabase storage path OR local file URI
  thumbPath: text('thumb_path'),               // Thumbnail path
  caption: text('caption'),                    // Optional short text
  reactionEmoji: text('reaction_emoji'),       // Partner's emoji reaction
  isSeen: integer('is_seen').notNull().default(0),
  seenAt: text('seen_at'),
  isFirstCandid: integer('is_first_candid').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('pending'),
  serverUpdatedAt: text('server_updated_at'),
  deletedAt: text('deleted_at'),
});

export const coupleCandidStreaks = sqliteTable('couple_candid_streaks', {
  coupleId: text('couple_id').primaryKey(),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastBothSentDate: text('last_both_sent_date'),
  user1LastSentDate: text('user1_last_sent_date'),
  user2LastSentDate: text('user2_last_sent_date'),
  updatedAt: text('updated_at').notNull(),
});

