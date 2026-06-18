import { db } from './client';
import * as schema from './schema';
import { eq, and, or, asc, isNull, sql, ne } from 'drizzle-orm';
import { Paths, File, Directory } from 'expo-file-system';
import { copyAsync } from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@shared/lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import { 
  journalRepo, goalRepo, memoryRepo, letterRepo, moodRepo, profileRepo, promptResponseRepo,
  coupleJournalRepo, coupleGoalRepo, coupleMemoryRepo, coupleLetterRepo, coupleCommentRepo
} from './repo';
import type { 
  ProfileInput, MoodInput, JournalInput, GoalInput, MemoryInput, LetterInput,
  CoupleLetterInput, CoupleGoalInput, CoupleMemoryInput, CoupleLetterInput as CoupleLetterInputType, CoupleCommentInput, CoupleJournalInput
} from './repo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHomeStore } from '@features/home/store';
import { useCoupleStore } from '@features/couple/store/coupleStore';

// ==========================================
// Helper functions
// ==========================================

import { uuid } from '../lib/uuid';

const MAX_RETRIES = 5;
let hasAlertedConflictThisRun = false;

function isValidUuid(id: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function updateStoreSyncState(extra: Partial<{ isSyncing: boolean; syncError: string | null; pendingSyncCount: number; lastSyncedAt: string | null }> = {}) {
  try {
    const pendingCount = await getPendingSyncCount();
    useHomeStore.getState().setSyncState({
      pendingSyncCount: pendingCount,
      ...extra
    });
  } catch (err) {
    console.error('[SyncEngine] Failed to update store sync state:', err);
  }
}

function ensureAbsoluteUri(uri: string): string {
  if (!uri) return '';
  if (uri.includes('://')) {
    return uri;
  }
  // If it's a raw file path, prepend file://
  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }
  return `file://${uri}`;
}

function withTimeout<T>(promise: PromiseLike<T> | Promise<T>, ms = 15000): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('TimeoutError: Operation timed out'));
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

// Map entity type to Supabase table name
const supabaseTables: Record<string, string> = {
  profiles: 'profiles',
  mood_logs: 'mood_logs',
  journal_entries: 'journal_entries',
  goals: 'goals',
  memories: 'memories',
  future_letters: 'future_letters',
  prompt_responses: 'prompt_responses',
  couple_journals: 'couple_journals',
  couple_goals: 'couple_goals',
  couple_memories: 'couple_memories',
  couple_letters: 'couple_letters',
  couple_comments: 'couple_journal_comments',
};

// Ensure uploads directory exists
const UPLOADS_DIR = `${Paths.document.uri}uploads/`;
async function ensureUploadsDir() {
  const dir = new Directory(ensureAbsoluteUri(UPLOADS_DIR));
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

// ==========================================
// Mutation Outbox Operations
// ==========================================

export async function enqueueMutation(
  entityType: string,
  entityId: string,
  operation: 'insert' | 'update' | 'delete',
  payload: unknown,
  previousState?: unknown
) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || '';

  const now = new Date().toISOString();

  if (operation === 'delete') {
    // Select any localUris for the uploads we are discarding so we can delete their files
    const uploadsToDiscard = await db
      .select({ localUri: schema.fileUploadQueue.localUri })
      .from(schema.fileUploadQueue)
      .where(
        and(
          eq(schema.fileUploadQueue.entityId, entityId),
          sql`${schema.fileUploadQueue.status} IN ('pending', 'failed', 'uploading')`
        )
      );

    for (const upload of uploadsToDiscard) {
      try {
        const fileToDelete = new File(ensureAbsoluteUri(upload.localUri));
        if (fileToDelete.exists) {
          fileToDelete.delete();
        }
      } catch (err) {
        console.error('[SyncEngine] Failed to delete local file for discarded upload:', err);
      }
    }

    // Set outbox mutations to discarded for the same entity
    await db
      .update(schema.outboxMutations)
      .set({ status: 'discarded', updatedAt: now })
      .where(
        and(
          eq(schema.outboxMutations.entityId, entityId),
          sql`${schema.outboxMutations.status} IN ('pending', 'failed', 'syncing')`
        )
      );

    // Set file uploads to discarded for the same entity
    await db
      .update(schema.fileUploadQueue)
      .set({ status: 'discarded', updatedAt: now })
      .where(
        and(
          eq(schema.fileUploadQueue.entityId, entityId),
          sql`${schema.fileUploadQueue.status} IN ('pending', 'failed', 'uploading')`
        )
      );
  }

  const wrappedPayload = {
    current: payload,
    previous: previousState || null
  };

  await db.insert(schema.outboxMutations).values({
    id: uuid(),
    userId,
    entityType,
    entityId,
    operation,
    payloadJson: JSON.stringify(wrappedPayload),
    status: 'pending',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  updateStoreSyncState();
}

export async function fetchServerEntityById(entityType: string, id: string) {
  const tableName = supabaseTables[entityType];
  if (!tableName) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  const selectQuery = entityType === 'couple_letters' 
    ? 'id, couple_id, sender_id, subject, deliver_at, is_draft, is_read, is_favorite, is_archived, created_at, updated_at' 
    : '*';
  const { data, error } = await withTimeout(
    supabase
      .from(tableName)
      .select(selectQuery)
      .eq('id', id)
      .maybeSingle(),
    15000
  );

  if (error) throw error;
  return data;
}

// ==========================================
// File Upload Queue Operations
// ==========================================

export async function enqueueUpload(
  entityType: string,
  entityId: string,
  localUri: string,
  remotePath: string,
  bucketName: string
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || '';

  await ensureUploadsDir();
  const rawFilename = localUri.split('/').pop() || 'file.jpg';
  const filename = `${uuid()}_${rawFilename}`;
  const permanentUri = `${UPLOADS_DIR}${filename}`;

  // Copy picker file to permanent local cache directory
  await copyAsync({
    from: localUri,
    to: permanentUri,
  });

  const now = new Date().toISOString();
  await db.insert(schema.fileUploadQueue).values({
    id: uuid(),
    userId,
    entityType,
    entityId,
    localUri: permanentUri,
    remotePath,
    bucketName,
    status: 'pending',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Create image_records entry immediately with pending status
  await db.insert(schema.imageRecords).values({
    id: uuid(),
    entityType,
    entityId,
    localUri: permanentUri,
    supabasePath: remotePath,
    bucketName,
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  updateStoreSyncState();

  return permanentUri;
}

// ==========================================
// Queue Sync Engine
// ==========================================

// Clean up synced outbox and upload queues older than 30 days
async function cleanOldSyncedMutations() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await db
      .delete(schema.outboxMutations)
      .where(
        and(
          or(
            eq(schema.outboxMutations.status, 'synced'),
            eq(schema.outboxMutations.status, 'discarded')
          ),
          sql`${schema.outboxMutations.createdAt} < ${thirtyDaysAgo}`
        )
      );

    await db
      .delete(schema.fileUploadQueue)
      .where(
        and(
          eq(schema.fileUploadQueue.status, 'completed'),
          sql`${schema.fileUploadQueue.createdAt} < ${thirtyDaysAgo}`
        )
      );

    console.log('[SyncEngine] Synced outbox mutations and upload queues older than 30 days cleaned up.');
  } catch (e) {
    console.error('[SyncEngine] Failed to clean up old synced mutations:', e);
  }
}

// Supabase row to SQLite DB mappers for couple space
function mapSupabaseCoupleJournal(row: any) {
  return {
    id: row.id,
    coupleId: row.couple_id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    moodId: row.mood_id,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    imageUrls: typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : (row.image_urls || []),
    entryDate: row.entry_date,
    isPinned: row.is_pinned ? 1 : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabaseCoupleGoal(row: any) {
  return {
    id: row.id,
    coupleId: row.couple_id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    progress: row.progress,
    targetDate: row.target_date,
    completedAt: row.completed_at,
    emoji: row.emoji,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabaseCoupleMemory(row: any) {
  return {
    id: row.id,
    coupleId: row.couple_id,
    title: row.title,
    description: row.description,
    imageUrls: typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : (row.image_urls || []),
    memoryDate: row.memory_date,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    lastEditedBy: row.last_edited_by,
    location: row.location,
    mood: row.mood,
    memoryTime: row.memory_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabaseCoupleLetter(row: any) {
  return {
    id: row.id,
    coupleId: row.couple_id,
    senderId: row.sender_id,
    subject: row.subject,
    body: row.body || '',
    deliverAt: row.deliver_at,
    imageUrls: typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : (row.image_urls || []),
    isRead: row.is_read ? 1 : 0,
    isFavorite: row.is_favorite ? 1 : 0,
    isDraft: row.is_draft ? 1 : 0,
    isArchived: row.is_archived ? 1 : 0,
    parentLetterId: row.parent_letter_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabaseCoupleComment(row: any) {
  return {
    id: row.id,
    entryId: row.entry_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at || row.created_at,
  };
}

async function upsertCoupleJournalTx(tx: any, r: any) {
  await tx.insert(schema.coupleJournals).values({
    id: r.id,
    coupleId: r.coupleId,
    userId: r.userId,
    title: r.title,
    body: r.body,
    moodId: r.moodId,
    tags: JSON.stringify(r.tags),
    imageUrls: JSON.stringify(r.imageUrls),
    entryDate: r.entryDate,
    isPinned: r.isPinned,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.coupleJournals.id,
    set: {
      title: r.title,
      body: r.body,
      moodId: r.moodId,
      tags: JSON.stringify(r.tags),
      imageUrls: JSON.stringify(r.imageUrls),
      entryDate: r.entryDate,
      isPinned: r.isPinned,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertCoupleGoalTx(tx: any, r: any) {
  await tx.insert(schema.coupleGoals).values({
    id: r.id,
    coupleId: r.coupleId,
    title: r.title,
    description: r.description,
    category: r.category,
    status: r.status,
    progress: r.progress,
    targetDate: r.targetDate,
    completedAt: r.completedAt,
    emoji: r.emoji,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.coupleGoals.id,
    set: {
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      progress: r.progress,
      targetDate: r.targetDate,
      completedAt: r.completedAt,
      emoji: r.emoji,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertCoupleMemoryTx(tx: any, r: any) {
  await tx.insert(schema.coupleMemories).values({
    id: r.id,
    coupleId: r.coupleId,
    title: r.title,
    description: r.description,
    imageUrls: JSON.stringify(r.imageUrls),
    memoryDate: r.memoryDate,
    tags: JSON.stringify(r.tags),
    lastEditedBy: r.lastEditedBy,
    location: r.location,
    mood: r.mood,
    memoryTime: r.memoryTime,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.coupleMemories.id,
    set: {
      title: r.title,
      description: r.description,
      imageUrls: JSON.stringify(r.imageUrls),
      memoryDate: r.memoryDate,
      tags: JSON.stringify(r.tags),
      lastEditedBy: r.lastEditedBy,
      location: r.location,
      mood: r.mood,
      memoryTime: r.memoryTime,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertCoupleLetterTx(tx: any, r: any) {
  await tx.insert(schema.coupleLetters).values({
    id: r.id,
    coupleId: r.coupleId,
    senderId: r.senderId,
    subject: r.subject,
    body: r.body,
    deliverAt: r.deliverAt,
    imageUrls: JSON.stringify(r.imageUrls),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    isRead: r.isRead,
    isFavorite: r.isFavorite,
    isDraft: r.isDraft,
    isArchived: r.isArchived,
    parentLetterId: r.parentLetterId,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.coupleLetters.id,
    set: {
      subject: r.subject,
      body: r.body,
      deliverAt: r.deliverAt,
      imageUrls: JSON.stringify(r.imageUrls),
      updatedAt: r.updatedAt,
      isRead: r.isRead,
      isFavorite: r.isFavorite,
      isDraft: r.isDraft,
      isArchived: r.isArchived,
      parentLetterId: r.parentLetterId,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertCoupleCommentTx(tx: any, r: any) {
  await tx.insert(schema.coupleComments).values({
    id: r.id,
    entryId: r.entryId,
    userId: r.userId,
    body: r.body,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.coupleComments.id,
    set: {
      body: r.body,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

// Supabase row to SQLite DB mappers
function mapSupabaseProfile(row: any) {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    theme: row.theme,
    textSize: row.text_size,
    dailyReminderEnabled: row.daily_reminder_enabled ? 1 : 0,
    weeklyDigestEnabled: row.weekly_digest_enabled ? 1 : 0,
    streakAlertsEnabled: row.streak_alerts_enabled ? 1 : 0,
    pushToken: row.push_token,
    timezone: row.timezone,
    kamiId: row.kami_id,
    activeSpace: row.active_space,
    currentMoodLabel: row.current_mood_label,
    currentMoodEmoji: row.current_mood_emoji,
    lastSeenAt: row.last_seen_at,
    heroBgUrl: row.hero_bg_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabaseMoodLog(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    moodId: row.mood_id,
    moodEmoji: row.mood_emoji,
    moodLabel: row.mood_label,
    note: row.note,
    loggedDate: row.logged_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabaseJournalEntry(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    moodId: row.mood_id,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    imageUrls: typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : (row.image_urls || []),
    entryDate: row.entry_date,
    isPinned: row.is_pinned ? 1 : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabaseGoal(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    progress: row.progress,
    targetDate: row.target_date,
    completedAt: row.completed_at,
    emoji: row.emoji,
    imageUrl: row.image_url,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabaseMemory(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    emoji: row.emoji,
    mood: row.mood,
    imageUrls: typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : (row.image_urls || []),
    memoryDate: row.memory_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabaseFutureLetter(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    body: row.body || '',
    deliverAt: row.deliver_at,
    imageUrls: typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : (row.image_urls || []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isRead: row.is_read ? 1 : 0,
    isFavorite: row.is_favorite ? 1 : 0,
    isDraft: row.is_draft ? 1 : 0,
    isArchived: row.is_archived ? 1 : 0,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

function mapSupabasePromptResponse(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    promptId: row.prompt_id,
    response: row.response,
    responseDate: row.response_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    serverUpdatedAt: row.updated_at,
  };
}

async function upsertProfileTx(tx: any, r: any) {
  await tx.insert(schema.profiles).values({
    id: r.id,
    email: r.email,
    nickname: r.nickname,
    avatarUrl: r.avatarUrl,
    theme: r.theme,
    textSize: r.textSize,
    dailyReminderEnabled: r.dailyReminderEnabled,
    weeklyDigestEnabled: r.weeklyDigestEnabled,
    streakAlertsEnabled: r.streakAlertsEnabled,
    pushToken: r.pushToken,
    timezone: r.timezone,
    kamiId: r.kamiId,
    activeSpace: r.activeSpace,
    currentMoodLabel: r.currentMoodLabel,
    currentMoodEmoji: r.currentMoodEmoji,
    lastSeenAt: r.lastSeenAt,
    heroBgUrl: r.heroBgUrl,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.profiles.id,
    set: {
      email: r.email,
      nickname: r.nickname,
      avatarUrl: r.avatarUrl,
      theme: r.theme,
      textSize: r.textSize,
      dailyReminderEnabled: r.dailyReminderEnabled,
      weeklyDigestEnabled: r.weeklyDigestEnabled,
      streakAlertsEnabled: r.streakAlertsEnabled,
      pushToken: r.pushToken,
      timezone: r.timezone,
      kamiId: r.kamiId,
      activeSpace: r.activeSpace,
      currentMoodLabel: r.currentMoodLabel,
      currentMoodEmoji: r.currentMoodEmoji,
      lastSeenAt: r.lastSeenAt,
      heroBgUrl: r.heroBgUrl,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertMoodTx(tx: any, r: any) {
  await tx.insert(schema.moodLogs).values({
    id: r.id,
    userId: r.userId,
    moodId: r.moodId,
    moodEmoji: r.moodEmoji,
    moodLabel: r.moodLabel,
    note: r.note,
    loggedDate: r.loggedDate,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: [schema.moodLogs.userId, schema.moodLogs.loggedDate],
    set: {
      moodId: r.moodId,
      moodEmoji: r.moodEmoji,
      moodLabel: r.moodLabel,
      note: r.note,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertJournalTx(tx: any, r: any) {
  await tx.insert(schema.journalEntries).values({
    id: r.id,
    userId: r.userId,
    title: r.title,
    body: r.body,
    moodId: r.moodId,
    tags: JSON.stringify(r.tags),
    imageUrls: JSON.stringify(r.imageUrls),
    entryDate: r.entryDate,
    isPinned: r.isPinned,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.journalEntries.id,
    set: {
      title: r.title,
      body: r.body,
      moodId: r.moodId,
      tags: JSON.stringify(r.tags),
      imageUrls: JSON.stringify(r.imageUrls),
      entryDate: r.entryDate,
      isPinned: r.isPinned,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertGoalTx(tx: any, r: any) {
  await tx.insert(schema.goals).values({
    id: r.id,
    userId: r.userId,
    title: r.title,
    description: r.description,
    category: r.category,
    status: r.status,
    progress: r.progress,
    targetDate: r.targetDate,
    completedAt: r.completedAt,
    emoji: r.emoji,
    imageUrl: r.imageUrl,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.goals.id,
    set: {
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      progress: r.progress,
      targetDate: r.targetDate,
      completedAt: r.completedAt,
      emoji: r.emoji,
      imageUrl: r.imageUrl,
      sortOrder: r.sortOrder,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertMemoryTx(tx: any, r: any) {
  await tx.insert(schema.memories).values({
    id: r.id,
    userId: r.userId,
    title: r.title,
    body: r.body,
    emoji: r.emoji,
    mood: r.mood,
    imageUrls: JSON.stringify(r.imageUrls),
    memoryDate: r.memoryDate,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.memories.id,
    set: {
      title: r.title,
      body: r.body,
      emoji: r.emoji,
      mood: r.mood,
      imageUrls: JSON.stringify(r.imageUrls),
      memoryDate: r.memoryDate,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertLetterTx(tx: any, r: any) {
  await tx.insert(schema.futureLetters).values({
    id: r.id,
    userId: r.userId,
    subject: r.subject,
    body: r.body,
    deliverAt: r.deliverAt,
    imageUrls: JSON.stringify(r.imageUrls),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    isRead: r.isRead,
    isFavorite: r.isFavorite,
    isDraft: r.isDraft,
    isArchived: r.isArchived,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: schema.futureLetters.id,
    set: {
      subject: r.subject,
      body: r.body,
      deliverAt: r.deliverAt,
      imageUrls: JSON.stringify(r.imageUrls),
      updatedAt: r.updatedAt,
      isRead: r.isRead,
      isFavorite: r.isFavorite,
      isDraft: r.isDraft,
      isArchived: r.isArchived,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

async function upsertPromptResponseTx(tx: any, r: any) {
  await tx.insert(schema.promptResponses).values({
    id: r.id,
    userId: r.userId,
    promptId: r.promptId,
    response: r.response,
    responseDate: r.responseDate,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    syncStatus: r.syncStatus,
    serverUpdatedAt: r.serverUpdatedAt,
  }).onConflictDoUpdate({
    target: [schema.promptResponses.userId, schema.promptResponses.promptId, schema.promptResponses.responseDate],
    set: {
      response: r.response,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }
  });
}

export async function pullFromServer(): Promise<void> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.log('[SyncEngine] No active authenticated session. Skipping pull sync.');
      return;
    }
    const currentUserId = session.user.id;

    // Get the couple space ID
    let coupleId = useCoupleStore.getState().couple?.id || null;
    if (!isValidUuid(coupleId)) {
      coupleId = null;
      // Try to find a coupleId from existing local couple records
      const localJournal = await db.select({ coupleId: schema.coupleJournals.coupleId }).from(schema.coupleJournals).limit(1);
      if (localJournal.length > 0 && isValidUuid(localJournal[0].coupleId)) {
        coupleId = localJournal[0].coupleId;
      } else {
        const localGoal = await db.select({ coupleId: schema.coupleGoals.coupleId }).from(schema.coupleGoals).limit(1);
        if (localGoal.length > 0 && isValidUuid(localGoal[0].coupleId)) {
          coupleId = localGoal[0].coupleId;
        }
      }
    }

    const tables = [
      { name: 'profiles', remoteName: 'profiles', mapper: mapSupabaseProfile, repoSaveTx: upsertProfileTx },
      { name: 'mood_logs', remoteName: 'mood_logs', mapper: mapSupabaseMoodLog, repoSaveTx: upsertMoodTx },
      { name: 'journal_entries', remoteName: 'journal_entries', mapper: mapSupabaseJournalEntry, repoSaveTx: upsertJournalTx },
      { name: 'goals', remoteName: 'goals', mapper: mapSupabaseGoal, repoSaveTx: upsertGoalTx },
      { name: 'memories', remoteName: 'memories', mapper: mapSupabaseMemory, repoSaveTx: upsertMemoryTx },
      { name: 'future_letters', remoteName: 'future_letters', mapper: mapSupabaseFutureLetter, repoSaveTx: upsertLetterTx },
      { name: 'prompt_responses', remoteName: 'prompt_responses', mapper: mapSupabasePromptResponse, repoSaveTx: upsertPromptResponseTx },
      
      // Couple tables:
      { name: 'couple_journals', remoteName: 'couple_journals', mapper: mapSupabaseCoupleJournal, repoSaveTx: upsertCoupleJournalTx, isCoupleTable: true },
      { name: 'couple_goals', remoteName: 'couple_goals', mapper: mapSupabaseCoupleGoal, repoSaveTx: upsertCoupleGoalTx, isCoupleTable: true },
      { name: 'couple_memories', remoteName: 'couple_memories', mapper: mapSupabaseCoupleMemory, repoSaveTx: upsertCoupleMemoryTx, isCoupleTable: true },
      { name: 'couple_letters', remoteName: 'couple_letters', mapper: mapSupabaseCoupleLetter, repoSaveTx: upsertCoupleLetterTx, isCoupleTable: true },
      { name: 'couple_comments', remoteName: 'couple_journal_comments', mapper: mapSupabaseCoupleComment, repoSaveTx: upsertCoupleCommentTx, isCoupleTable: true },
    ];

    console.log('[SyncEngine] Running pull sync from server...');

    for (const table of tables) {
      try {
        const lastSyncKey = `last_sync_at:${currentUserId}:${table.name}`;
        const lastSyncVal = await AsyncStorage.getItem(lastSyncKey);
        
        // For comments table on Supabase (since it only has created_at instead of updated_at)
        const isCommentsTable = table.name === 'couple_comments';
        const timestampColumn = isCommentsTable ? 'created_at' : 'updated_at';

        let query;
        if (isCommentsTable) {
          if (!coupleId) continue;
          query = supabase.from('couple_journal_comments')
            .select('id, entry_id, user_id, body, created_at, couple_journals!inner(couple_id)')
            .eq('couple_journals.couple_id', coupleId);
          if (lastSyncVal) {
            query = query.gt('created_at', lastSyncVal);
          }
        } else {
          query = supabase.from(table.remoteName).select('*');
          if (lastSyncVal) {
            query = query.gt('updated_at', lastSyncVal);
          }
          if (table.name === 'profiles') {
            query = query.eq('id', currentUserId);
          } else if (table.isCoupleTable) {
            if (!coupleId) continue;
            query = query.eq('couple_id', coupleId);
          } else {
            query = query.eq('user_id', currentUserId);
          }
        }

        const { data: serverRows, error: fetchError } = await withTimeout(query, 20000);
        if (fetchError) {
          console.error(`[SyncEngine] Failed to pull ${table.name}:`, fetchError);
          continue;
        }

        if (serverRows && serverRows.length > 0) {
          console.log(`[SyncEngine] Pulled ${serverRows.length} updates for ${table.name}.`);
          
          await db.transaction(async (tx) => {
            for (const row of serverRows) {
              let localRecord: any = null;
              if (table.name === 'profiles') {
                const rows = await tx.select().from(schema.profiles).where(eq(schema.profiles.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'journal_entries') {
                const rows = await tx.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'goals') {
                const rows = await tx.select().from(schema.goals).where(eq(schema.goals.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'memories') {
                const rows = await tx.select().from(schema.memories).where(eq(schema.memories.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'future_letters') {
                const rows = await tx.select().from(schema.futureLetters).where(eq(schema.futureLetters.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'mood_logs') {
                const rows = await tx.select().from(schema.moodLogs).where(eq(schema.moodLogs.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'prompt_responses') {
                const rows = await tx.select().from(schema.promptResponses).where(eq(schema.promptResponses.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'couple_journals') {
                const rows = await tx.select().from(schema.coupleJournals).where(eq(schema.coupleJournals.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'couple_goals') {
                const rows = await tx.select().from(schema.coupleGoals).where(eq(schema.coupleGoals.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'couple_memories') {
                const rows = await tx.select().from(schema.coupleMemories).where(eq(schema.coupleMemories.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'couple_letters') {
                const rows = await tx.select().from(schema.coupleLetters).where(eq(schema.coupleLetters.id, row.id));
                localRecord = rows[0];
              } else if (table.name === 'couple_comments') {
                const rows = await tx.select().from(schema.coupleComments).where(eq(schema.coupleComments.id, row.id));
                localRecord = rows[0];
              }

              let hasPendingMutation = false;
              if (table.name === 'profiles') {
                const pending = await tx
                  .select()
                  .from(schema.outboxMutations)
                  .where(
                    and(
                      eq(schema.outboxMutations.entityType, 'profiles'),
                      eq(schema.outboxMutations.entityId, row.id),
                      sql`${schema.outboxMutations.status} IN ('pending', 'failed', 'syncing')`
                    )
                  )
                  .limit(1);
                if (pending.length > 0) {
                  hasPendingMutation = true;
                }
              }

              if (hasPendingMutation) {
                console.log(`[SyncEngine] Skipping pull upsert for ${table.name} ID ${row.id} due to pending outbox mutation.`);
                continue;
              }

              if (localRecord && (localRecord.syncStatus === 'pending_update' || localRecord.syncStatus === 'pending_insert' || localRecord.syncStatus === 'conflict')) {
                if (localRecord.serverUpdatedAt) {
                  const serverTime = new Date(row[timestampColumn]).getTime();
                  const localBaseTime = new Date(localRecord.serverUpdatedAt).getTime();
                  if (serverTime > localBaseTime) {
                    if (table.name === 'journal_entries') {
                      await tx.update(schema.journalEntries).set({ syncStatus: 'conflict' }).where(eq(schema.journalEntries.id, row.id));
                    } else if (table.name === 'goals') {
                      await tx.update(schema.goals).set({ syncStatus: 'conflict' }).where(eq(schema.goals.id, row.id));
                    } else if (table.name === 'memories') {
                      await tx.update(schema.memories).set({ syncStatus: 'conflict' }).where(eq(schema.memories.id, row.id));
                    } else if (table.name === 'future_letters') {
                      await tx.update(schema.futureLetters).set({ syncStatus: 'conflict' }).where(eq(schema.futureLetters.id, row.id));
                    } else if (table.name === 'mood_logs') {
                      await tx.update(schema.moodLogs).set({ syncStatus: 'conflict' }).where(eq(schema.moodLogs.id, row.id));
                    } else if (table.name === 'prompt_responses') {
                      await tx.update(schema.promptResponses).set({ syncStatus: 'conflict' }).where(eq(schema.promptResponses.id, row.id));
                    } else if (table.name === 'profiles') {
                      await tx.update(schema.profiles).set({ syncStatus: 'conflict' }).where(eq(schema.profiles.id, row.id));
                    } else if (table.name === 'couple_journals') {
                      await tx.update(schema.coupleJournals).set({ syncStatus: 'conflict' }).where(eq(schema.coupleJournals.id, row.id));
                    } else if (table.name === 'couple_goals') {
                      await tx.update(schema.coupleGoals).set({ syncStatus: 'conflict' }).where(eq(schema.coupleGoals.id, row.id));
                    } else if (table.name === 'couple_memories') {
                      await tx.update(schema.coupleMemories).set({ syncStatus: 'conflict' }).where(eq(schema.coupleMemories.id, row.id));
                    } else if (table.name === 'couple_letters') {
                      await tx.update(schema.coupleLetters).set({ syncStatus: 'conflict' }).where(eq(schema.coupleLetters.id, row.id));
                    } else if (table.name === 'couple_comments') {
                      await tx.update(schema.coupleComments).set({ syncStatus: 'conflict' }).where(eq(schema.coupleComments.id, row.id));
                    }
                    continue;
                  }
                }
              }

              const mapped = table.mapper(row);
              await table.repoSaveTx(tx, mapped);
            }
          });

          const timestamps = serverRows.map(r => new Date(r[timestampColumn]).getTime());
          const latestTime = new Date(Math.max(...timestamps)).toISOString();
          await AsyncStorage.setItem(lastSyncKey, latestTime);
        }
      } catch (tableErr) {
        console.error(`[SyncEngine] Pull failed for table ${table.name}:`, tableErr);
      }
    }

    console.log('[SyncEngine] Pull sync completed.');
  } catch (err) {
    console.error('[SyncEngine] pullFromServer failed:', err);
  }
}

async function rollbackMutation(entityType: string, entityId: string, payloadJson: string) {
  try {
    const payloadObj = JSON.parse(payloadJson);
    const previous = payloadObj.previous;

    console.warn(`[SyncEngine] Rolling back mutation for ${entityType} ID ${entityId}`);

    if (!previous) {
      // If there is no previous version, it was a failed INSERT. We rollback by deleting the local record.
      if (entityType === 'journal_entries') {
        await db.delete(schema.journalEntries).where(eq(schema.journalEntries.id, entityId));
        useHomeStore.getState().removeJournal(entityId);
      } else if (entityType === 'goals') {
        await db.delete(schema.goals).where(eq(schema.goals.id, entityId));
        useHomeStore.getState().removeGoal(entityId);
      } else if (entityType === 'memories') {
        await db.delete(schema.memories).where(eq(schema.memories.id, entityId));
      } else if (entityType === 'future_letters') {
        await db.delete(schema.futureLetters).where(eq(schema.futureLetters.id, entityId));
      } else if (entityType === 'mood_logs') {
        await db.delete(schema.moodLogs).where(eq(schema.moodLogs.id, entityId));
        const state = useHomeStore.getState();
        if (state.todayMood?.id === entityId) {
          state.setTodayMood(null);
        }
      } else if (entityType === 'prompt_responses') {
        await db.delete(schema.promptResponses).where(eq(schema.promptResponses.id, entityId));
        useHomeStore.getState().setPromptResponse(null);
      } else if (entityType === 'couple_journals') {
        await db.delete(schema.coupleJournals).where(eq(schema.coupleJournals.id, entityId));
        useCoupleStore.getState().removeCoupleJournalFromList(entityId);
      } else if (entityType === 'couple_goals') {
        await db.delete(schema.coupleGoals).where(eq(schema.coupleGoals.id, entityId));
        useCoupleStore.getState().removeCoupleGoalFromList(entityId);
      } else if (entityType === 'couple_memories') {
        await db.delete(schema.coupleMemories).where(eq(schema.coupleMemories.id, entityId));
        useCoupleStore.getState().removeCoupleMemoryFromList(entityId);
      } else if (entityType === 'couple_letters') {
        await db.delete(schema.coupleLetters).where(eq(schema.coupleLetters.id, entityId));
        useCoupleStore.getState().removeCoupleLetterFromList(entityId);
      } else if (entityType === 'couple_comments') {
        await db.delete(schema.coupleComments).where(eq(schema.coupleComments.id, entityId));
      }
    } else {
      // Restore previous version in SQLite
      if (entityType === 'journal_entries') {
        const mapped = mapSupabaseJournalEntry(previous);
        await db.insert(schema.journalEntries).values(mapped).onConflictDoUpdate({
          target: schema.journalEntries.id,
          set: mapped
        });
        useHomeStore.getState().updateJournalInList(mapped as any);
      } else if (entityType === 'goals') {
        const mapped = mapSupabaseGoal(previous);
        await db.insert(schema.goals).values(mapped).onConflictDoUpdate({
          target: schema.goals.id,
          set: mapped
        });
        useHomeStore.getState().updateGoalInList(mapped as any);
      } else if (entityType === 'memories') {
        const mapped = mapSupabaseMemory(previous);
        await db.insert(schema.memories).values(mapped).onConflictDoUpdate({
          target: schema.memories.id,
          set: mapped
        });
      } else if (entityType === 'future_letters') {
        const mapped = mapSupabaseFutureLetter(previous);
        await db.insert(schema.futureLetters).values(mapped).onConflictDoUpdate({
          target: schema.futureLetters.id,
          set: mapped
        });
      } else if (entityType === 'mood_logs') {
        const mapped = mapSupabaseMoodLog(previous);
        await db.insert(schema.moodLogs).values(mapped).onConflictDoUpdate({
          target: [schema.moodLogs.userId, schema.moodLogs.loggedDate],
          set: mapped
        });
        const state = useHomeStore.getState();
        if (state.todayMood?.id === entityId) {
          state.setTodayMood(mapped as any);
        }
      } else if (entityType === 'prompt_responses') {
        const mapped = mapSupabasePromptResponse(previous);
        await db.insert(schema.promptResponses).values(mapped).onConflictDoUpdate({
          target: [schema.promptResponses.userId, schema.promptResponses.promptId, schema.promptResponses.responseDate],
          set: mapped
        });
        const state = useHomeStore.getState();
        if (state.promptResponse?.id === entityId) {
          state.setPromptResponse(mapped as any);
        }
      } else if (entityType === 'profiles') {
        const mapped = mapSupabaseProfile(previous);
        await db.insert(schema.profiles).values(mapped).onConflictDoUpdate({
          target: schema.profiles.id,
          set: mapped
        });
      } else if (entityType === 'couple_journals') {
        const mapped = mapSupabaseCoupleJournal(previous);
        await db.insert(schema.coupleJournals).values(mapped).onConflictDoUpdate({
          target: schema.coupleJournals.id,
          set: mapped
        });
        useCoupleStore.getState().updateCoupleJournalInList(mapped as any);
      } else if (entityType === 'couple_goals') {
        const mapped = mapSupabaseCoupleGoal(previous);
        await db.insert(schema.coupleGoals).values(mapped).onConflictDoUpdate({
          target: schema.coupleGoals.id,
          set: mapped
        });
        useCoupleStore.getState().updateCoupleGoalInList(mapped as any);
      } else if (entityType === 'couple_memories') {
        const mapped = mapSupabaseCoupleMemory(previous);
        await db.insert(schema.coupleMemories).values(mapped).onConflictDoUpdate({
          target: schema.coupleMemories.id,
          set: mapped
        });
        useCoupleStore.getState().updateCoupleMemoryInList(mapped as any);
      } else if (entityType === 'couple_letters') {
        const mapped = mapSupabaseCoupleLetter(previous);
        await db.insert(schema.coupleLetters).values(mapped).onConflictDoUpdate({
          target: schema.coupleLetters.id,
          set: mapped
        });
        useCoupleStore.getState().updateCoupleLetterInList(mapped as any);
      } else if (entityType === 'couple_comments') {
        const mapped = mapSupabaseCoupleComment(previous);
        await db.insert(schema.coupleComments).values(mapped).onConflictDoUpdate({
          target: schema.coupleComments.id,
          set: mapped
        });
      }
    }

    // Show non-blocking alert / toast
    Alert.alert(
      'Sync Issue',
      "One change couldn't be saved and was reverted to keep your data consistent. ⚠️",
      [{ text: 'OK' }]
    );
  } catch (err) {
    console.error('[SyncEngine] Rollback failed:', err);
  }
}

let isSyncing = false;

export async function processSyncQueue(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  let globalError: string | null = null;
  try {
    await updateStoreSyncState({ isSyncing: true, syncError: null });

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return;
    }

    console.log('[SyncEngine] Starting background sync execution...');
    hasAlertedConflictThisRun = false;

    // Reset stuck 'syncing' and 'uploading' rows to 'pending'
    try {
      await db
        .update(schema.outboxMutations)
        .set({ status: 'pending', updatedAt: new Date().toISOString() })
        .where(eq(schema.outboxMutations.status, 'syncing'));

      await db
        .update(schema.fileUploadQueue)
        .set({ status: 'pending', updatedAt: new Date().toISOString() })
        .where(eq(schema.fileUploadQueue.status, 'uploading'));

      console.log('[SyncEngine] Reset stuck syncing/uploading rows to pending.');
    } catch (resetErr) {
      console.error('[SyncEngine] Failed to reset stuck syncing/uploading rows:', resetErr);
    }

    // Diagnostics
    try {
      const summary = await db
        .select({
          status: schema.outboxMutations.status,
          count: sql<number>`count(*)`
        })
        .from(schema.outboxMutations)
        .groupBy(schema.outboxMutations.status);
      console.log('[SyncEngine] Diagnostics - Local outbox status breakdown:', JSON.stringify(summary));
    } catch (diagErr) {
      console.error('[SyncEngine] Diagnostics query failed:', diagErr);
    }

    // Run TTL cleanup once on app start / sync trigger
    await cleanOldSyncedMutations();

    // 0. Pull server updates
    await pullFromServer();
    await updateStoreSyncState({ isSyncing: true });

    // 1. Process File Upload Queue
    await processFileUploads();
    await updateStoreSyncState({ isSyncing: true });

    // 2. Process Outbox Mutations
    await processOutboxMutations();

  } catch (error) {
    console.error('[SyncEngine] Error during sync queue execution:', error);
    globalError = error instanceof Error ? error.message : String(error);
  } finally {
    isSyncing = false;
    await updateStoreSyncState({
      isSyncing: false,
      syncError: globalError,
      lastSyncedAt: globalError ? useHomeStore.getState().lastSyncedAt : new Date().toISOString()
    });
    console.log('[SyncEngine] Background sync execution finished.');
  }
}

// Processor for uploads
async function processFileUploads() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.log('[SyncEngine] No active authenticated session. Skipping file uploads.');
    return;
  }

  // Hydrate client state with the active session to guarantee auth headers are attached
  try {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (err) {
    console.error('[SyncEngine] Failed to set session for file uploads:', err);
  }

  const currentUserId = session.user.id;

  const uploads = await db
    .select()
    .from(schema.fileUploadQueue)
    .where(
      and(
        eq(schema.fileUploadQueue.userId, currentUserId), // Scoped to active user at query level
        sql`${schema.fileUploadQueue.status} IN ('pending', 'failed')`,
        or(
          isNull(schema.fileUploadQueue.nextRetryAt),
          sql`${schema.fileUploadQueue.nextRetryAt} <= ${new Date().toISOString()}`
        )
      )
    )
    .orderBy(asc(schema.fileUploadQueue.createdAt));

  for (const row of uploads) {
    try {
      // Mark as uploading
      await db
        .update(schema.fileUploadQueue)
        .set({ status: 'uploading', updatedAt: new Date().toISOString() })
        .where(eq(schema.fileUploadQueue.id, row.id));

      // Mark image record as syncing
      try {
        await db
          .update(schema.imageRecords)
          .set({
            syncStatus: 'syncing',
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(schema.imageRecords.entityId, row.entityId),
              eq(schema.imageRecords.localUri, row.localUri)
            )
          );
      } catch (imgErr) {
        console.error('[SyncEngine] Failed to update image_records status to syncing:', imgErr);
      }

      const file = new File(ensureAbsoluteUri(row.localUri));
      if (!file.exists) {
        // Source file doesn't exist locally, fail permanently
        throw new Error('Local file not found.');
      }

      // Compress original (max width 1200px)
      const compressedOriginal = await ImageManipulator.manipulateAsync(
        row.localUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Compress thumbnail (max width 300px)
      const compressedThumb = await ImageManipulator.manipulateAsync(
        row.localUri,
        [{ resize: { width: 300 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!compressedOriginal.base64 || !compressedThumb.base64) {
        throw new Error('Image manipulation base64 conversion failed.');
      }

      const thumbPath = row.remotePath.replace(/(\.[^.]+)$/, '_thumb$1');

      // Upload original to Supabase
      const { error: errorOrig } = await withTimeout(
        supabase.storage
          .from(row.bucketName)
          .upload(row.remotePath, decode(compressedOriginal.base64), {
            contentType: 'image/jpeg',
            upsert: true,
          }),
        30000
      );

      if (errorOrig) throw errorOrig;

      // Upload thumbnail to Supabase
      const { error: errorThumb } = await withTimeout(
        supabase.storage
          .from(row.bucketName)
          .upload(thumbPath, decode(compressedThumb.base64), {
            contentType: 'image/jpeg',
            upsert: true,
          }),
        30000
      );

      if (errorThumb) {
        // Rollback original on thumbnail failure
        try {
          await withTimeout(
            supabase.storage.from(row.bucketName).remove([row.remotePath]),
            10000
          );
        } catch (removeErr) {
          console.error('[SyncEngine] Failed to rollback original image:', removeErr);
        }
        throw errorThumb;
      }

      // Upload successful! Update local entity's images to replace localUri with remotePath
      if (row.entityType === 'journal_entries') {
        const entry = await journalRepo.fetchJournalById(row.entityId);
        if (entry) {
          const updatedUrls = entry.imageUrls.map((u: string) =>
            u === row.localUri ? row.remotePath : u
          );
          await journalRepo.saveJournal({ ...entry, imageUrls: updatedUrls });
        }
      } else if (row.entityType === 'goals') {
        const entry = await goalRepo.fetchGoalById(row.entityId);
        if (entry) {
          const updatedUrl = entry.imageUrl === row.localUri ? row.remotePath : entry.imageUrl;
          await goalRepo.saveGoal({ ...entry, imageUrl: updatedUrl });
        }
      } else if (row.entityType === 'memories') {
        const entry = await memoryRepo.fetchMemoryById(row.entityId);
        if (entry) {
          const updatedUrls = entry.imageUrls.map((u: string) =>
            u === row.localUri ? row.remotePath : u
          );
          await memoryRepo.saveMemory({ ...entry, imageUrls: updatedUrls });
        }
      } else if (row.entityType === 'future_letters') {
        const entry = await letterRepo.fetchLetterById(row.entityId);
        if (entry) {
          const updatedUrls = entry.imageUrls.map((u: string) =>
            u === row.localUri ? row.remotePath : u
          );
          await letterRepo.saveLetter({ ...entry, imageUrls: updatedUrls });
        }
      } else if (row.entityType === 'couple_journals') {
        const entry = await coupleJournalRepo.fetchJournalById(row.entityId);
        if (entry) {
          const updatedUrls = entry.imageUrls.map((u: string) =>
            u === row.localUri ? row.remotePath : u
          );
          await coupleJournalRepo.saveJournal({ ...entry, imageUrls: updatedUrls });
        }
      } else if (row.entityType === 'couple_memories') {
        const entry = await coupleMemoryRepo.fetchMemoryById(row.entityId);
        if (entry) {
          const updatedUrls = entry.imageUrls.map((u: string) =>
            u === row.localUri ? row.remotePath : u
          );
          await coupleMemoryRepo.saveMemory({ ...entry, imageUrls: updatedUrls });
        }
      } else if (row.entityType === 'couple_letters') {
        const entry = await coupleLetterRepo.fetchLetterById(row.entityId);
        if (entry) {
          const updatedUrls = entry.imageUrls.map((u: string) =>
            u === row.localUri ? row.remotePath : u
          );
          await coupleLetterRepo.saveLetter({ ...entry, imageUrls: updatedUrls });
        }
      }

      // Mark queue item complete
      await db
        .update(schema.fileUploadQueue)
        .set({ status: 'completed', updatedAt: new Date().toISOString() })
        .where(eq(schema.fileUploadQueue.id, row.id));

      // Update corresponding image_records entry to synced
      const nowStr = new Date().toISOString();
      try {
        await db
          .update(schema.imageRecords)
          .set({
            syncStatus: 'synced',
            lastSyncedAt: nowStr,
            updatedAt: nowStr,
          })
          .where(
            and(
              eq(schema.imageRecords.entityId, row.entityId),
              eq(schema.imageRecords.localUri, row.localUri)
            )
          );
      } catch (imgErr) {
        console.error('[SyncEngine] Failed to update image_records on success:', imgErr);
      }

    } catch (err) {
      console.error(`[SyncEngine] File upload failed for ID ${row.id}:`, err);
      
      const isPermissionError = err && typeof err === 'object' && (
        ('code' in err && err.code === '42501') ||
        ('status' in err && (err.status === 403 || err.status === 401)) ||
        ('statusCode' in err && (err.statusCode === '403' || err.statusCode === '401' || err.statusCode === 403 || err.statusCode === 401)) ||
        ('message' in err && typeof err.message === 'string' && (
          err.message.toLowerCase().includes('permission') ||
          err.message.toLowerCase().includes('unauthorized') ||
          err.message.toLowerCase().includes('row-level security') ||
          err.message.toLowerCase().includes('policy')
        ))
      );

      if (isPermissionError) {
        console.warn(`[SyncEngine] Discarding RLS/Forbidden violating file upload ${row.id}:`, err);
        await db
          .update(schema.fileUploadQueue)
          .set({
            status: 'discarded',
            lastError: err instanceof Error ? err.message : String(err),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.fileUploadQueue.id, row.id));

        // Update corresponding image_records entry to failed
        try {
          await db
            .update(schema.imageRecords)
            .set({
              syncStatus: 'failed',
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(schema.imageRecords.entityId, row.entityId),
                eq(schema.imageRecords.localUri, row.localUri)
              )
            );
        } catch (imgErr) {
          console.error('[SyncEngine] Failed to update image_records on discarded:', imgErr);
        }

        // Clean up permanent cached local file
        try {
          const fileToDelete = new File(ensureAbsoluteUri(row.localUri));
          if (fileToDelete.exists) {
            fileToDelete.delete();
          }
        } catch (delErr) {
          console.error(`[SyncEngine] Failed to delete local file for discarded upload:`, delErr);
        }
      } else {
        const retryCount = row.retryCount + 1;
        const backoffSec = Math.min(Math.pow(2, retryCount) * 10, 300); // exponential backoff capped at 300s (5m)
        const nextRetry = new Date(Date.now() + backoffSec * 1000).toISOString();

        await db
          .update(schema.fileUploadQueue)
          .set({
            status: 'failed',
            retryCount,
            nextRetryAt: nextRetry,
            lastError: err instanceof Error ? err.message : String(err),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.fileUploadQueue.id, row.id));

        // Update corresponding image_records entry to failed (so UI knows it's failed for now, though it will retry)
        try {
          await db
            .update(schema.imageRecords)
            .set({
              syncStatus: 'failed',
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(schema.imageRecords.entityId, row.entityId),
                eq(schema.imageRecords.localUri, row.localUri)
              )
            );
        } catch (imgErr) {
          console.error('[SyncEngine] Failed to update image_records on failure:', imgErr);
        }
      }
    }
  }
}

// Processor for outbox mutations
async function processOutboxMutations() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.log('[SyncEngine] No active authenticated session. Skipping outbox mutations.');
    return;
  }

  // Hydrate client state with the active session to guarantee auth headers are attached
  try {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (err) {
    console.error('[SyncEngine] Failed to set session for outbox mutations:', err);
  }

  const currentUserId = session.user.id;

  const mutations = await db
    .select()
    .from(schema.outboxMutations)
    .where(
      and(
        eq(schema.outboxMutations.userId, currentUserId), // Scoped to active user at query level
        sql`${schema.outboxMutations.status} IN ('pending', 'failed')`,
        or(
          isNull(schema.outboxMutations.nextRetryAt),
          sql`${schema.outboxMutations.nextRetryAt} <= ${new Date().toISOString()}`
        )
      )
    )
    .orderBy(asc(schema.outboxMutations.createdAt));

  for (const row of mutations) {
    if (row.retryCount >= MAX_RETRIES) {
      console.warn(`[SyncEngine] Discarding mutation ${row.id} because it exceeded MAX_RETRIES (${MAX_RETRIES}).`);
      await db
        .update(schema.outboxMutations)
        .set({
          status: 'discarded',
          lastError: 'Max retry limit reached.',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.outboxMutations.id, row.id));
      await rollbackMutation(row.entityType, row.entityId, row.payloadJson);
      continue;
    }

    try {
      // Mark as syncing
      await db
        .update(schema.outboxMutations)
        .set({ status: 'syncing', updatedAt: new Date().toISOString() })
        .where(eq(schema.outboxMutations.id, row.id));

      const payloadObj = JSON.parse(row.payloadJson);
      let payload = payloadObj.current !== undefined ? payloadObj.current : payloadObj;
      payload = await resolvePayloadUris(row.entityType, payload);
      const tableName = supabaseTables[row.entityType];

      // File Upload Gate Check: if there are any uploads for this entity that are not completed or discarded, we must skip this mutation for now
      const activeUploads = await db
        .select({ id: schema.fileUploadQueue.id })
        .from(schema.fileUploadQueue)
        .where(
          and(
            eq(schema.fileUploadQueue.entityType, row.entityType),
            eq(schema.fileUploadQueue.entityId, row.entityId),
            ne(schema.fileUploadQueue.status, 'completed'),
            ne(schema.fileUploadQueue.status, 'discarded')
          )
        );

      if (activeUploads.length > 0) {
        console.log(`[SyncEngine] Gating mutation ${row.id} because it has active file uploads.`);
        // Revert its status to 'pending' so it can be retried once uploads finish
        await db
          .update(schema.outboxMutations)
          .set({ status: 'pending', updatedAt: new Date().toISOString() })
          .where(eq(schema.outboxMutations.id, row.id));
        continue;
      }

      // Fetch active coupleId
      let activeCoupleId = useCoupleStore.getState().couple?.id || null;
      if (!isValidUuid(activeCoupleId)) {
        activeCoupleId = null;
        // Try to find a coupleId from existing local couple records
        const localJournal = await db.select({ coupleId: schema.coupleJournals.coupleId }).from(schema.coupleJournals).limit(1);
        if (localJournal.length > 0 && isValidUuid(localJournal[0].coupleId)) {
          activeCoupleId = localJournal[0].coupleId;
        } else {
          const localGoal = await db.select({ coupleId: schema.coupleGoals.coupleId }).from(schema.coupleGoals).limit(1);
          if (localGoal.length > 0 && isValidUuid(localGoal[0].coupleId)) {
            activeCoupleId = localGoal[0].coupleId;
          }
        }
      }

      const isCoupleTable = ['couple_letters', 'couple_journals', 'couple_memories', 'couple_goals', 'couple_comments'].includes(row.entityType);
      
      let willSkip = false;
      
      if (row.entityType === 'profiles') {
        const isProfileMismatch = row.entityId !== currentUserId;
        const payloadUserId = payload.userId || payload.user_id || payload.id;
        const isPayloadMismatch = !!(payloadUserId && payloadUserId !== currentUserId);
        willSkip = isProfileMismatch || isPayloadMismatch;
      } else if (isCoupleTable) {
        const payloadCoupleId = payload.coupleId || payload.couple_id;
        
        if (row.entityType === 'couple_comments') {
          const commentEntryId = payload.entryId || payload.entry_id;
          if (commentEntryId) {
            const entryRows = await db.select({ coupleId: schema.coupleJournals.coupleId }).from(schema.coupleJournals).where(eq(schema.coupleJournals.id, commentEntryId));
            const entryCoupleId = entryRows[0]?.coupleId;
            if (entryCoupleId && entryCoupleId !== activeCoupleId) {
              willSkip = true;
            }
          }
        } else if (payloadCoupleId && payloadCoupleId !== activeCoupleId) {
          willSkip = true;
        }
      } else {
        const payloadUserId = payload.userId || payload.user_id;
        if (payloadUserId && payloadUserId !== currentUserId) {
          willSkip = true;
        }
      }

      console.log('[SYNC GUARD]', {
        entityId: row.entityId,
        currentUserId,
        activeCoupleId,
        willSkip
      });

      if (willSkip) {
        console.warn(`[SyncEngine] Skipping mutation ${row.id} due to ownership guard check.`);
        // Discard it so it does not retry.
        await db
          .update(schema.outboxMutations)
          .set({
            status: 'discarded',
            lastError: `Ownership check failed: entityId/payloadUserId/payloadCoupleId does not match user/couple space context`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.outboxMutations.id, row.id));
        continue;
      }

      // 1. Conflict Detection (skip for insert or profiles updates where user owns single record)
      if (row.operation !== 'insert' && row.entityType !== 'profiles') {
        const { data: serverRow, error: fetchError } = await withTimeout(
          supabase
            .from(tableName)
            .select('id, updated_at')
            .eq('id', row.entityId)
            .maybeSingle(),
          15000
        );

        if (fetchError) throw fetchError;

        if (serverRow) {
          let localRow: { serverUpdatedAt?: string | null } | undefined;
          if (row.entityType === 'journal_entries') {
            const rows = await db.select({ serverUpdatedAt: schema.journalEntries.serverUpdatedAt }).from(schema.journalEntries).where(eq(schema.journalEntries.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'goals') {
            const rows = await db.select({ serverUpdatedAt: schema.goals.serverUpdatedAt }).from(schema.goals).where(eq(schema.goals.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'memories') {
            const rows = await db.select({ serverUpdatedAt: schema.memories.serverUpdatedAt }).from(schema.memories).where(eq(schema.memories.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'future_letters') {
            const rows = await db.select({ serverUpdatedAt: schema.futureLetters.serverUpdatedAt }).from(schema.futureLetters).where(eq(schema.futureLetters.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'mood_logs') {
            const rows = await db.select({ serverUpdatedAt: schema.moodLogs.serverUpdatedAt }).from(schema.moodLogs).where(eq(schema.moodLogs.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'prompt_responses') {
            const rows = await db.select({ serverUpdatedAt: schema.promptResponses.serverUpdatedAt }).from(schema.promptResponses).where(eq(schema.promptResponses.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'couple_journals') {
            const rows = await db.select({ serverUpdatedAt: schema.coupleJournals.serverUpdatedAt }).from(schema.coupleJournals).where(eq(schema.coupleJournals.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'couple_goals') {
            const rows = await db.select({ serverUpdatedAt: schema.coupleGoals.serverUpdatedAt }).from(schema.coupleGoals).where(eq(schema.coupleGoals.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'couple_memories') {
            const rows = await db.select({ serverUpdatedAt: schema.coupleMemories.serverUpdatedAt }).from(schema.coupleMemories).where(eq(schema.coupleMemories.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'couple_letters') {
            const rows = await db.select({ serverUpdatedAt: schema.coupleLetters.serverUpdatedAt }).from(schema.coupleLetters).where(eq(schema.coupleLetters.id, row.entityId));
            localRow = rows[0];
          } else if (row.entityType === 'couple_comments') {
            const rows = await db.select({ serverUpdatedAt: schema.coupleComments.serverUpdatedAt }).from(schema.coupleComments).where(eq(schema.coupleComments.id, row.entityId));
            localRow = rows[0];
          }

          if (localRow && localRow.serverUpdatedAt) {
            const serverTime = new Date(serverRow.updated_at).getTime();
            const localTime = new Date(localRow.serverUpdatedAt).getTime();
            
            if (serverTime > localTime) {
              // Server has been modified since we last synced. CONFLICT!
              console.warn(`[SyncEngine] Conflict detected on ${row.entityType} with ID ${row.entityId}`);
              
              // Set local entity status to conflict
              await updateLocalEntitySyncStatus(row.entityType, row.entityId, 'conflict');
              
              // Fail the outbox item
              throw new Error('conflict');
            }
          }
        }
      }

      // 2. Perform the actual Supabase Operation
      let resultError = null;
      let returnedData = null;

      if (row.operation === 'insert') {
        const dbPayload = mapPayloadToSupabase(row.entityType, payload);
        const { data, error } = await withTimeout(
          supabase
            .from(tableName)
            .insert(dbPayload)
            .select('id, updated_at')
            .single(),
          15000
        );

        if (error && error.code === '23505') {
          console.log(`[SyncEngine] Entity ${row.entityId} already exists on server. Falling back to update.`);
          const { data: updateData, error: updateError } = await withTimeout(
            supabase
              .from(tableName)
              .update(dbPayload)
              .eq('id', row.entityId)
              .select('id, updated_at')
              .single(),
            15000
          );
          resultError = updateError;
          returnedData = updateData;
        } else {
          resultError = error;
          returnedData = data;
        }
      } else if (row.operation === 'update') {
        const dbPayload = mapPayloadToSupabase(row.entityType, payload);
        
        if (row.entityType === 'profiles') {
          const { data, error } = await withTimeout(
            supabase
              .from('profiles')
              .upsert(dbPayload)
              .select('id, updated_at')
              .single(),
            15000
          );
          resultError = error;
          returnedData = data;
        } else {
          const { data, error } = await withTimeout(
            supabase
              .from(tableName)
              .update(dbPayload)
              .eq('id', row.entityId)
              .select('id, updated_at'),
            15000
          );

          if (error) {
            resultError = error;
          } else if (!data || data.length === 0) {
            console.log(`[SyncEngine] Entity ${row.entityId} not found on server. Fetching local record for fallback insert.`);
            
            let localRecord: any = null;
            if (row.entityType === 'profiles') {
              const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'journal_entries') {
              const rows = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'goals') {
              const rows = await db.select().from(schema.goals).where(eq(schema.goals.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'memories') {
              const rows = await db.select().from(schema.memories).where(eq(schema.memories.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'future_letters') {
              const rows = await db.select().from(schema.futureLetters).where(eq(schema.futureLetters.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'mood_logs') {
              const rows = await db.select().from(schema.moodLogs).where(eq(schema.moodLogs.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'prompt_responses') {
              const rows = await db.select().from(schema.promptResponses).where(eq(schema.promptResponses.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'couple_journals') {
              const rows = await db.select().from(schema.coupleJournals).where(eq(schema.coupleJournals.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'couple_goals') {
              const rows = await db.select().from(schema.coupleGoals).where(eq(schema.coupleGoals.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'couple_memories') {
              const rows = await db.select().from(schema.coupleMemories).where(eq(schema.coupleMemories.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'couple_letters') {
              const rows = await db.select().from(schema.coupleLetters).where(eq(schema.coupleLetters.id, row.entityId));
              localRecord = rows[0];
            } else if (row.entityType === 'couple_comments') {
              const rows = await db.select().from(schema.coupleComments).where(eq(schema.coupleComments.id, row.entityId));
              localRecord = rows[0];
            }

            if (localRecord) {
              const fullPayload = mapLocalRecordToPayload(row.entityType, localRecord);
              const fullDbPayload = mapPayloadToSupabase(row.entityType, fullPayload);
              const { data: insertData, error: insertError } = await withTimeout(
                supabase
                  .from(tableName)
                  .insert(fullDbPayload)
                  .select('id, updated_at')
                  .single(),
                15000
              );
              
              if (insertError && insertError.code === '23505') {
                console.log(`[SyncEngine] Fallback insert returned 23505 for ${row.entityId}. Row exists on server. Retrying update.`);
                const { data: updateData, error: updateError } = await withTimeout(
                  supabase
                    .from(tableName)
                    .update(fullDbPayload)
                    .eq('id', row.entityId)
                    .select('id, updated_at')
                    .single(),
                  15000
                );
                
                if (updateError) {
                  console.error(`[SyncEngine] Retry update also failed for ${row.entityId}:`, updateError);
                  await db
                    .update(schema.outboxMutations)
                    .set({
                      status: updateError.code === '42501' ? 'discarded' : 'failed',
                      lastError: updateError.message,
                      updatedAt: new Date().toISOString(),
                    })
                    .where(eq(schema.outboxMutations.id, row.id));
                  continue;
                }
                
                resultError = null;
                returnedData = updateData;
              } else {
                resultError = insertError;
                returnedData = insertData;
              }
            } else {
              resultError = new Error('Local record not found for fallback insert');
            }
          } else {
            returnedData = data[0];
          }
        }
      } else if (row.operation === 'delete') {
        const { error } = await withTimeout(
          supabase
            .from(tableName)
            .delete()
            .eq('id', row.entityId),
          15000
        );
        resultError = error;
      }

      if (resultError) throw resultError;

      // 3. Mark Outbox Mutation Complete
      await db
        .update(schema.outboxMutations)
        .set({ status: 'synced', updatedAt: new Date().toISOString() })
        .where(eq(schema.outboxMutations.id, row.id));

      // 4. Update Local DB row state to synced
      if (row.operation === 'delete') {
        if (row.entityType === 'journal_entries') {
          await db.delete(schema.journalEntries).where(eq(schema.journalEntries.id, row.entityId));
        } else if (row.entityType === 'goals') {
          await db.delete(schema.goals).where(eq(schema.goals.id, row.entityId));
        } else if (row.entityType === 'memories') {
          await db.delete(schema.memories).where(eq(schema.memories.id, row.entityId));
        } else if (row.entityType === 'future_letters') {
          await db.delete(schema.futureLetters).where(eq(schema.futureLetters.id, row.entityId));
        } else if (row.entityType === 'prompt_responses') {
          await db.delete(schema.promptResponses).where(eq(schema.promptResponses.id, row.entityId));
        } else if (row.entityType === 'couple_journals') {
          await db.delete(schema.coupleJournals).where(eq(schema.coupleJournals.id, row.entityId));
        } else if (row.entityType === 'couple_goals') {
          await db.delete(schema.coupleGoals).where(eq(schema.coupleGoals.id, row.entityId));
        } else if (row.entityType === 'couple_memories') {
          await db.delete(schema.coupleMemories).where(eq(schema.coupleMemories.id, row.entityId));
        } else if (row.entityType === 'couple_letters') {
          await db.delete(schema.coupleLetters).where(eq(schema.coupleLetters.id, row.entityId));
        } else if (row.entityType === 'couple_comments') {
          await db.delete(schema.coupleComments).where(eq(schema.coupleComments.id, row.entityId));
        }
      } else if (returnedData) {
        await updateLocalEntitySyncSuccess(row.entityType, row.entityId, returnedData.updated_at);
      }

    } catch (err) {
      const isConflict = err instanceof Error && err.message === 'conflict';
      const isRLS = err && typeof err === 'object' && 'code' in err && err.code === '42501';
      const isMissingLocalRecord = err instanceof Error && err.message === 'Local record not found for fallback insert';
      const isPermanentError = isRLS || isMissingLocalRecord;

      console.error(`[SyncEngine] Outbox mutation failed for ID ${row.id}:`, err);

      if (isConflict && !hasAlertedConflictThisRun) {
        hasAlertedConflictThisRun = true;
        Alert.alert(
          'Sync Conflict Detected',
          'One or more items have been modified on another device. Please tap the warning badge on the item to resolve it.',
          [{ text: 'OK' }]
        );
      }
      
      if (isPermanentError) {
        console.warn(`[SYNC] Discarded permanent error mutation ${row.id}:`, err);
        await db
          .update(schema.outboxMutations)
          .set({
            status: 'discarded',
            lastError: err instanceof Error ? err.message : String(err),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.outboxMutations.id, row.id));
      } else {
        const retryCount = row.retryCount + 1;
        const backoffSec = isConflict ? 3600 * 24 : Math.min(Math.pow(2, retryCount) * 10, 300);
        const nextRetry = new Date(Date.now() + backoffSec * 1000).toISOString();

        await db
          .update(schema.outboxMutations)
          .set({
            status: 'failed',
            retryCount,
            nextRetryAt: nextRetry,
            lastError: err instanceof Error ? err.message : String(err),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.outboxMutations.id, row.id));
      }
    }
  }
}

// Update local entity status helper
async function updateLocalEntitySyncStatus(entityType: string, entityId: string, syncStatus: 'synced' | 'pending_insert' | 'pending_update' | 'conflict') {
  if (entityType === 'journal_entries') {
    await db.update(schema.journalEntries).set({ syncStatus }).where(eq(schema.journalEntries.id, entityId));
  } else if (entityType === 'goals') {
    await db.update(schema.goals).set({ syncStatus }).where(eq(schema.goals.id, entityId));
  } else if (entityType === 'memories') {
    await db.update(schema.memories).set({ syncStatus }).where(eq(schema.memories.id, entityId));
  } else if (entityType === 'future_letters') {
    await db.update(schema.futureLetters).set({ syncStatus }).where(eq(schema.futureLetters.id, entityId));
  } else if (entityType === 'mood_logs') {
    await db.update(schema.moodLogs).set({ syncStatus }).where(eq(schema.moodLogs.id, entityId));
  } else if (entityType === 'prompt_responses') {
    await db.update(schema.promptResponses).set({ syncStatus }).where(eq(schema.promptResponses.id, entityId));
  } else if (entityType === 'profiles') {
    await db.update(schema.profiles).set({ syncStatus }).where(eq(schema.profiles.id, entityId));
  } else if (entityType === 'couple_journals') {
    await db.update(schema.coupleJournals).set({ syncStatus }).where(eq(schema.coupleJournals.id, entityId));
  } else if (entityType === 'couple_goals') {
    await db.update(schema.coupleGoals).set({ syncStatus }).where(eq(schema.coupleGoals.id, entityId));
  } else if (entityType === 'couple_memories') {
    await db.update(schema.coupleMemories).set({ syncStatus }).where(eq(schema.coupleMemories.id, entityId));
  } else if (entityType === 'couple_letters') {
    await db.update(schema.coupleLetters).set({ syncStatus }).where(eq(schema.coupleLetters.id, entityId));
  } else if (entityType === 'couple_comments') {
    await db.update(schema.coupleComments).set({ syncStatus }).where(eq(schema.coupleComments.id, entityId));
  }
}

// Update local entity success helper
async function updateLocalEntitySyncSuccess(entityType: string, entityId: string, serverUpdatedAt: string) {
  if (entityType === 'journal_entries') {
    await db.update(schema.journalEntries).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.journalEntries.id, entityId));
  } else if (entityType === 'goals') {
    await db.update(schema.goals).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.goals.id, entityId));
  } else if (entityType === 'memories') {
    await db.update(schema.memories).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.memories.id, entityId));
  } else if (entityType === 'future_letters') {
    await db.update(schema.futureLetters).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.futureLetters.id, entityId));
  } else if (entityType === 'mood_logs') {
    await db.update(schema.moodLogs).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.moodLogs.id, entityId));
  } else if (entityType === 'prompt_responses') {
    await db.update(schema.promptResponses).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.promptResponses.id, entityId));
  } else if (entityType === 'profiles') {
    await db.update(schema.profiles).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.profiles.id, entityId));
  } else if (entityType === 'couple_journals') {
    await db.update(schema.coupleJournals).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.coupleJournals.id, entityId));
  } else if (entityType === 'couple_goals') {
    await db.update(schema.coupleGoals).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.coupleGoals.id, entityId));
  } else if (entityType === 'couple_memories') {
    await db.update(schema.coupleMemories).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.coupleMemories.id, entityId));
  } else if (entityType === 'couple_letters') {
    await db.update(schema.coupleLetters).set({
      syncStatus: 'synced',
      serverUpdatedAt
    }).where(eq(schema.coupleLetters.id, entityId));
  } else if (entityType === 'couple_comments') {
    await db.update(schema.coupleComments).set({ syncStatus: 'synced', serverUpdatedAt }).where(eq(schema.coupleComments.id, entityId));
  }
}

async function resolvePayloadUris(entityType: string, payload: any): Promise<any> {
  if (!payload) return payload;
  const resolved = { ...payload };

  if (entityType === 'goals' && resolved.imageUrl) {
    if (resolved.imageUrl.startsWith('file://') || resolved.imageUrl.startsWith('/')) {
      const records = await db
        .select({ supabasePath: schema.imageRecords.supabasePath })
        .from(schema.imageRecords)
        .where(eq(schema.imageRecords.localUri, resolved.imageUrl))
        .limit(1);
      if (records.length > 0 && records[0].supabasePath) {
        resolved.imageUrl = records[0].supabasePath;
      }
    }
  } else if (resolved.imageUrls && Array.isArray(resolved.imageUrls)) {
    const nextUrls: string[] = [];
    for (const url of resolved.imageUrls) {
      if (url && (url.startsWith('file://') || url.startsWith('/'))) {
        const records = await db
          .select({ supabasePath: schema.imageRecords.supabasePath })
          .from(schema.imageRecords)
          .where(eq(schema.imageRecords.localUri, url))
          .limit(1);
        if (records.length > 0 && records[0].supabasePath) {
          nextUrls.push(records[0].supabasePath);
        } else {
          nextUrls.push(url);
        }
      } else {
        nextUrls.push(url);
      }
    }
    resolved.imageUrls = nextUrls;
  }

  return resolved;
}

type SyncPayloadInput = Partial<
  ProfileInput & MoodInput & JournalInput & GoalInput & MemoryInput & LetterInput &
  CoupleJournalInput & CoupleGoalInput & CoupleMemoryInput & CoupleLetterInputType & CoupleCommentInput & {
    promptId?: string;
    response?: string;
    responseDate?: string;
  }
>;
// Map key casing to Supabase Postgres (snake_case)
function mapPayloadToSupabase(entityType: string, payload: SyncPayloadInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  if (entityType === 'journal_entries') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.userId !== undefined) result.user_id = payload.userId;
    if (payload.title !== undefined) result.title = payload.title;
    if (payload.body !== undefined) result.body = payload.body;
    if (payload.moodId !== undefined) result.mood_id = payload.moodId;
    if (payload.tags !== undefined) result.tags = payload.tags;
    if (payload.imageUrls !== undefined) result.image_urls = payload.imageUrls;
    if (payload.entryDate !== undefined) result.entry_date = payload.entryDate;
    if (payload.isPinned !== undefined) result.is_pinned = payload.isPinned;
  } else if (entityType === 'goals') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.userId !== undefined) result.user_id = payload.userId;
    if (payload.title !== undefined) result.title = payload.title;
    if (payload.description !== undefined) result.description = payload.description;
    if (payload.category !== undefined) result.category = payload.category;
    if (payload.status !== undefined) result.status = payload.status;
    if (payload.progress !== undefined) result.progress = payload.progress;
    if (payload.targetDate !== undefined) result.target_date = payload.targetDate;
    if (payload.completedAt !== undefined) result.completed_at = payload.completedAt;
    if (payload.emoji !== undefined) result.emoji = payload.emoji;
    if (payload.sortOrder !== undefined) result.sort_order = payload.sortOrder;
    if (payload.imageUrl !== undefined) result.image_url = payload.imageUrl;
  } else if (entityType === 'memories') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.userId !== undefined) result.user_id = payload.userId;
    if (payload.title !== undefined) result.title = payload.title;
    if (payload.body !== undefined) result.body = payload.body;
    if (payload.emoji !== undefined) result.emoji = payload.emoji;
    if (payload.mood !== undefined) result.mood = payload.mood;
    if (payload.imageUrls !== undefined) result.image_urls = payload.imageUrls;
    if (payload.memoryDate !== undefined) result.memory_date = payload.memoryDate;
  } else if (entityType === 'future_letters') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.userId !== undefined) result.user_id = payload.userId;
    if (payload.subject !== undefined) result.subject = payload.subject;
    if (payload.body !== undefined) result.body = payload.body;
    if (payload.deliverAt !== undefined) result.deliver_at = payload.deliverAt;
    if (payload.imageUrls !== undefined) result.image_urls = payload.imageUrls;
    if (payload.isRead !== undefined) result.is_read = payload.isRead;
    if (payload.isFavorite !== undefined) result.is_favorite = payload.isFavorite;
    if (payload.isDraft !== undefined) result.is_draft = payload.isDraft;
    if (payload.isArchived !== undefined) result.is_archived = payload.isArchived;
  } else if (entityType === 'mood_logs') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.userId !== undefined) result.user_id = payload.userId;
    if (payload.moodId !== undefined) result.mood_id = payload.moodId;
    if (payload.moodEmoji !== undefined) result.mood_emoji = payload.moodEmoji;
    if (payload.moodLabel !== undefined) result.mood_label = payload.moodLabel;
    if (payload.note !== undefined) result.note = payload.note;
    if (payload.loggedDate !== undefined) result.logged_date = payload.loggedDate;
  } else if (entityType === 'profiles') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.email !== undefined) result.email = payload.email;
    if (payload.nickname !== undefined) result.nickname = payload.nickname;
    if (payload.avatarUrl !== undefined) result.avatar_url = payload.avatarUrl;
    if (payload.theme !== undefined) result.theme = payload.theme;
    if (payload.textSize !== undefined) result.text_size = payload.textSize;
    if (payload.dailyReminder !== undefined) result.daily_reminder_enabled = payload.dailyReminder;
    if (payload.weeklyDigest !== undefined) result.weekly_digest_enabled = payload.weeklyDigest;
    if (payload.streakAlerts !== undefined) result.streak_alerts_enabled = payload.streakAlerts;
    if (payload.pushToken !== undefined) result.push_token = payload.pushToken;
    if (payload.timezone !== undefined) result.timezone = payload.timezone;
    if (payload.kamiId !== undefined) result.kami_id = payload.kamiId;
    if (payload.activeSpace !== undefined) result.active_space = payload.activeSpace;
    if (payload.currentMoodLabel !== undefined) result.current_mood_label = payload.currentMoodLabel;
    if (payload.currentMoodEmoji !== undefined) result.current_mood_emoji = payload.currentMoodEmoji;
    if (payload.lastSeenAt !== undefined) result.last_seen_at = payload.lastSeenAt;
    if (payload.heroBgUrl !== undefined) result.hero_bg_url = payload.heroBgUrl;
  } else if (entityType === 'prompt_responses') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.userId !== undefined) result.user_id = payload.userId;
    if (payload.promptId !== undefined) result.prompt_id = payload.promptId;
    if (payload.response !== undefined) result.response = payload.response;
    if (payload.responseDate !== undefined) result.response_date = payload.responseDate;
  } else if (entityType === 'couple_journals') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.coupleId !== undefined) result.couple_id = payload.coupleId;
    if (payload.userId !== undefined) result.user_id = payload.userId;
    if (payload.title !== undefined) result.title = payload.title;
    if (payload.body !== undefined) result.body = payload.body;
    if (payload.moodId !== undefined) result.mood_id = payload.moodId;
    if (payload.tags !== undefined) result.tags = payload.tags;
    if (payload.imageUrls !== undefined) result.image_urls = payload.imageUrls;
    if (payload.entryDate !== undefined) result.entry_date = payload.entryDate;
    if (payload.isPinned !== undefined) result.is_pinned = payload.isPinned;
  } else if (entityType === 'couple_goals') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.coupleId !== undefined) result.couple_id = payload.coupleId;
    if (payload.title !== undefined) result.title = payload.title;
    if (payload.description !== undefined) result.description = payload.description;
    if (payload.category !== undefined) result.category = payload.category;
    if (payload.status !== undefined) result.status = payload.status;
    if (payload.progress !== undefined) result.progress = payload.progress;
    if (payload.targetDate !== undefined) result.target_date = payload.targetDate;
    if (payload.completedAt !== undefined) result.completed_at = payload.completedAt;
    if (payload.emoji !== undefined) result.emoji = payload.emoji;
  } else if (entityType === 'couple_memories') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.coupleId !== undefined) result.couple_id = payload.coupleId;
    if (payload.title !== undefined) result.title = payload.title;
    if (payload.description !== undefined) result.description = payload.description;
    if (payload.imageUrls !== undefined) result.image_urls = payload.imageUrls;
    if (payload.memoryDate !== undefined) result.memory_date = payload.memoryDate;
    if (payload.tags !== undefined) result.tags = payload.tags;
    if (payload.lastEditedBy !== undefined) result.last_edited_by = payload.lastEditedBy;
    if (payload.location !== undefined) result.location = payload.location;
    if (payload.mood !== undefined) result.mood = payload.mood;
    if (payload.memoryTime !== undefined) result.memory_time = payload.memoryTime;
  } else if (entityType === 'couple_letters') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.coupleId !== undefined) result.couple_id = payload.coupleId;
    if (payload.senderId !== undefined) result.sender_id = payload.senderId;
    if (payload.subject !== undefined) result.subject = payload.subject;
    if (payload.body !== undefined) result.body = payload.body;
    if (payload.deliverAt !== undefined) result.deliver_at = payload.deliverAt;
    if (payload.imageUrls !== undefined) result.image_urls = payload.imageUrls;
    if (payload.isRead !== undefined) result.is_read = payload.isRead;
    if (payload.isFavorite !== undefined) result.is_favorite = payload.isFavorite;
    if (payload.isDraft !== undefined) result.is_draft = payload.isDraft;
    if (payload.isArchived !== undefined) result.is_archived = payload.isArchived;
    if (payload.parentLetterId !== undefined) result.parent_letter_id = payload.parentLetterId;
  } else if (entityType === 'couple_comments') {
    if (payload.id !== undefined) result.id = payload.id;
    if (payload.entryId !== undefined) result.entry_id = payload.entryId;
    if (payload.userId !== undefined) result.user_id = payload.userId;
    if (payload.body !== undefined) result.body = payload.body;
  }
  
  return result;
}

export async function getPendingSyncCount(): Promise<number> {
  try {
    const mutRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.outboxMutations)
      .where(
        or(
          eq(schema.outboxMutations.status, 'pending'),
          eq(schema.outboxMutations.status, 'syncing'),
          eq(schema.outboxMutations.status, 'failed')
        )
      );
    const uploadRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.fileUploadQueue)
      .where(
        or(
          eq(schema.fileUploadQueue.status, 'pending'),
          eq(schema.fileUploadQueue.status, 'uploading'),
          eq(schema.fileUploadQueue.status, 'failed')
        )
      );
    return (mutRows[0]?.count || 0) + (uploadRows[0]?.count || 0);
  } catch {
    return 0;
  }
}

function mapLocalRecordToPayload(entityType: string, r: any): SyncPayloadInput {
  if (!r) return {};
  if (entityType === 'prompt_responses') {
    return {
      id: r.id,
      userId: r.userId,
      promptId: r.promptId,
      response: r.response,
      responseDate: r.responseDate,
      createdAt: r.createdAt,
    };
  }
  if (entityType === 'profiles') {
    return {
      id: r.id,
      email: r.email,
      nickname: r.nickname,
      avatarUrl: r.avatarUrl,
      theme: r.theme,
      textSize: r.textSize,
      dailyReminder: !!r.dailyReminderEnabled,
      weeklyDigest: !!r.weeklyDigestEnabled,
      streakAlerts: !!r.streakAlertsEnabled,
      pushToken: r.pushToken,
      timezone: r.timezone,
      kamiId: r.kamiId,
      activeSpace: r.activeSpace,
      currentMoodLabel: r.currentMoodLabel,
      currentMoodEmoji: r.currentMoodEmoji,
      lastSeenAt: r.lastSeenAt,
      heroBgUrl: r.heroBgUrl,
    };
  }
  if (entityType === 'journal_entries') {
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      body: r.body,
      moodId: r.moodId,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : r.tags,
      imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls || '[]') : r.imageUrls,
      entryDate: r.entryDate,
      isPinned: !!r.isPinned,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
  if (entityType === 'goals') {
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      progress: r.progress,
      targetDate: r.targetDate,
      completedAt: r.completedAt,
      emoji: r.emoji,
      sortOrder: r.sortOrder,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
  if (entityType === 'memories') {
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      body: r.body,
      emoji: r.emoji,
      mood: r.mood,
      imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls || '[]') : r.imageUrls,
      memoryDate: r.memoryDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
  if (entityType === 'future_letters') {
    return {
      id: r.id,
      userId: r.userId,
      subject: r.subject,
      body: r.body,
      deliverAt: r.deliverAt,
      imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls || '[]') : r.imageUrls,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isRead: !!r.isRead,
      isFavorite: !!r.isFavorite,
      isDraft: !!r.isDraft,
      isArchived: !!r.isArchived,
    };
  }
  if (entityType === 'mood_logs') {
    return {
      id: r.id,
      userId: r.userId,
      moodId: r.moodId,
      moodEmoji: r.moodEmoji,
      moodLabel: r.moodLabel,
      note: r.note,
      loggedDate: r.loggedDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
  if (entityType === 'couple_journals') {
    return {
      id: r.id,
      coupleId: r.coupleId,
      userId: r.userId,
      title: r.title,
      body: r.body,
      moodId: r.moodId,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : r.tags,
      imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls || '[]') : r.imageUrls,
      entryDate: r.entryDate,
      isPinned: !!r.isPinned,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
  if (entityType === 'couple_goals') {
    return {
      id: r.id,
      coupleId: r.coupleId,
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      progress: r.progress,
      targetDate: r.targetDate,
      completedAt: r.completedAt,
      emoji: r.emoji,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
  if (entityType === 'couple_memories') {
    return {
      id: r.id,
      coupleId: r.coupleId,
      title: r.title,
      description: r.description,
      imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls || '[]') : r.imageUrls,
      memoryDate: r.memoryDate,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : r.tags,
      lastEditedBy: r.lastEditedBy,
      location: r.location,
      mood: r.mood,
      memoryTime: r.memoryTime,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
  if (entityType === 'couple_letters') {
    return {
      id: r.id,
      coupleId: r.coupleId,
      senderId: r.senderId,
      subject: r.subject,
      body: r.body,
      deliverAt: r.deliverAt,
      imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls || '[]') : r.imageUrls,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isRead: !!r.isRead,
      isFavorite: !!r.isFavorite,
      isDraft: !!r.isDraft,
      isArchived: !!r.isArchived,
      parentLetterId: r.parentLetterId,
    };
  }
  if (entityType === 'couple_comments') {
    return {
      id: r.id,
      entryId: r.entryId,
      userId: r.userId,
      body: r.body,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
  return {};
}
