import { db } from './client';
import * as schema from './schema';
import { eq, and, or, asc, isNull, sql, ne } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@shared/lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import { journalRepo, goalRepo, memoryRepo, letterRepo, moodRepo, profileRepo } from './repo';
import type { ProfileInput, MoodInput, JournalInput, GoalInput, MemoryInput, LetterInput } from './repo';

// ==========================================
// Helper functions
// ==========================================

import { uuid } from '../lib/uuid';

interface DBRepository {
  upsertProfile?: (r: ProfileInput) => Promise<void>;
  upsertMood?: (r: MoodInput) => Promise<void>;
  saveJournal?: (r: JournalInput) => Promise<void>;
  saveGoal?: (r: GoalInput) => Promise<void>;
  saveMemory?: (r: MemoryInput) => Promise<void>;
  saveLetter?: (r: LetterInput) => Promise<void>;
  fetchJournalById?: (id: string) => Promise<unknown>;
  fetchGoalById?: (id: string) => Promise<unknown>;
  fetchMemoryById?: (id: string) => Promise<unknown>;
  fetchLetterById?: (id: string) => Promise<unknown>;
}

// Map entity type to SQLite tables and repositories
const repos: Record<string, DBRepository> = {
  profiles: profileRepo,
  mood_logs: moodRepo,
  journal_entries: journalRepo,
  goals: goalRepo,
  memories: memoryRepo,
  future_letters: letterRepo,
};

// Map entity type to Supabase table name
const supabaseTables: Record<string, string> = {
  profiles: 'profiles',
  mood_logs: 'mood_logs',
  journal_entries: 'journal_entries',
  goals: 'goals',
  memories: 'memories',
  future_letters: 'future_letters',
};

// Ensure uploads directory exists
const UPLOADS_DIR = `${FileSystem.documentDirectory!}uploads/`;
async function ensureUploadsDir() {
  const info = await FileSystem.getInfoAsync(UPLOADS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(UPLOADS_DIR, { intermediates: true });
  }
}

// ==========================================
// Mutation Outbox Operations
// ==========================================

export async function enqueueMutation(
  entityType: string,
  entityId: string,
  operation: 'insert' | 'update' | 'delete',
  payload: unknown
) {
  const now = new Date().toISOString();
  await db.insert(schema.outboxMutations).values({
    id: uuid(),
    entityType,
    entityId,
    operation,
    payloadJson: JSON.stringify(payload),
    status: 'pending',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function fetchServerEntityById(entityType: string, id: string) {
  const tableName = supabaseTables[entityType];
  if (!tableName) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', id)
    .maybeSingle();

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
  await ensureUploadsDir();
  const filename = localUri.split('/').pop() || `${uuid()}.jpg`;
  const permanentUri = `${UPLOADS_DIR}${filename}`;

  // Copy picker file to permanent local cache directory
  await FileSystem.copyAsync({
    from: localUri,
    to: permanentUri,
  });

  const now = new Date().toISOString();
  await db.insert(schema.fileUploadQueue).values({
    id: uuid(),
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

  return permanentUri;
}

// ==========================================
// Queue Sync Engine
// ==========================================

let isSyncing = false;

export async function processSyncQueue(): Promise<void> {
  if (isSyncing) return;

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  isSyncing = true;
  console.log('[SyncEngine] Starting background sync execution...');

  try {
    // 1. Process File Upload Queue
    await processFileUploads();

    // 2. Process Outbox Mutations
    await processOutboxMutations();

  } catch (error) {
    console.error('[SyncEngine] Error during sync queue execution:', error);
  } finally {
    isSyncing = false;
    console.log('[SyncEngine] Background sync execution finished.');
  }
}

// Processor for uploads
async function processFileUploads() {
  const uploads = await db
    .select()
    .from(schema.fileUploadQueue)
    .where(
      and(
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

      const fileInfo = await FileSystem.getInfoAsync(row.localUri);
      if (!fileInfo.exists) {
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

      const thumbPath = row.remotePath.replace('.jpg', '_thumb.jpg');

      // Upload original to Supabase
      const { error: errorOrig } = await supabase.storage
        .from(row.bucketName)
        .upload(row.remotePath, decode(compressedOriginal.base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (errorOrig) throw errorOrig;

      // Upload thumbnail to Supabase
      const { error: errorThumb } = await supabase.storage
        .from(row.bucketName)
        .upload(thumbPath, decode(compressedThumb.base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (errorThumb) {
        // Rollback original on thumbnail failure
        await supabase.storage.from(row.bucketName).remove([row.remotePath]);
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
      }

      // Mark queue item complete
      await db
        .update(schema.fileUploadQueue)
        .set({ status: 'completed', updatedAt: new Date().toISOString() })
        .where(eq(schema.fileUploadQueue.id, row.id));

      // Clean up permanent cached local file
      await FileSystem.deleteAsync(row.localUri, { idempotent: true });

    } catch (err) {
      console.error(`[SyncEngine] File upload failed for ID ${row.id}:`, err);
      const retryCount = row.retryCount + 1;
      const backoffSec = Math.pow(2, retryCount) * 10; // exponential backoff 20s, 40s, 80s...
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
    }
  }
}

// Processor for outbox mutations
async function processOutboxMutations() {
  const mutations = await db
    .select()
    .from(schema.outboxMutations)
    .where(
      and(
        sql`${schema.outboxMutations.status} IN ('pending', 'failed')`,
        or(
          isNull(schema.outboxMutations.nextRetryAt),
          sql`${schema.outboxMutations.nextRetryAt} <= ${new Date().toISOString()}`
        )
      )
    )
    .orderBy(asc(schema.outboxMutations.createdAt));

  for (const row of mutations) {
    try {
      // Mark as syncing
      await db
        .update(schema.outboxMutations)
        .set({ status: 'syncing', updatedAt: new Date().toISOString() })
        .where(eq(schema.outboxMutations.id, row.id));

      const payload = JSON.parse(row.payloadJson);
      const tableName = supabaseTables[row.entityType];

      // 1. Conflict Detection (skip for insert or profiles updates where user owns single record)
      if (row.operation !== 'insert' && row.entityType !== 'profiles') {
        const { data: serverRow, error: fetchError } = await supabase
          .from(tableName)
          .select('updated_at')
          .eq('id', row.entityId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (serverRow) {
          let localRow;
          if (row.entityType === 'journal_entries') {
            localRow = await journalRepo.fetchJournalById(row.entityId);
          } else if (row.entityType === 'goals') {
            localRow = await goalRepo.fetchGoalById(row.entityId);
          } else if (row.entityType === 'memories') {
            localRow = await memoryRepo.fetchMemoryById(row.entityId);
          } else if (row.entityType === 'future_letters') {
            localRow = await letterRepo.fetchLetterById(row.entityId);
          } else if (row.entityType === 'mood_logs') {
            localRow = await moodRepo.fetchTodayMood(payload.userId, payload.loggedDate);
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
        // Ensure we match schema formatting (profiles has specific mappings, but profiles is not enqueued for insert)
        const dbPayload = mapPayloadToSupabase(row.entityType, payload);
        const { data, error } = await supabase
          .from(tableName)
          .insert(dbPayload)
          .select()
          .single();
        resultError = error;
        returnedData = data;
      } else if (row.operation === 'update') {
        const dbPayload = mapPayloadToSupabase(row.entityType, payload);
        const { data, error } = await supabase
          .from(tableName)
          .update(dbPayload)
          .eq('id', row.entityId)
          .select()
          .single();
        resultError = error;
        returnedData = data;
      } else if (row.operation === 'delete') {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', row.entityId);
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
        // Delete permanently from local SQLite database
        const localRepo = repos[row.entityType];
        if (row.entityType === 'journal_entries') {
          await db.delete(schema.journalEntries).where(eq(schema.journalEntries.id, row.entityId));
        } else if (row.entityType === 'goals') {
          await db.delete(schema.goals).where(eq(schema.goals.id, row.entityId));
        } else if (row.entityType === 'memories') {
          await db.delete(schema.memories).where(eq(schema.memories.id, row.entityId));
        } else if (row.entityType === 'future_letters') {
          await db.delete(schema.futureLetters).where(eq(schema.futureLetters.id, row.entityId));
        }
      } else if (returnedData) {
        // Update local entity record with synced status and updated serverUpdatedAt
        await updateLocalEntitySyncSuccess(row.entityType, row.entityId, returnedData.updated_at);
      }

    } catch (err) {
      const isConflict = err instanceof Error && err.message === 'conflict';
      console.error(`[SyncEngine] Outbox mutation failed for ID ${row.id}:`, err);
      
      const retryCount = row.retryCount + 1;
      const backoffSec = isConflict ? 3600 * 24 : Math.pow(2, retryCount) * 10; // If conflict, push far out (rely on user action)
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
  }
}

type SyncPayloadInput = Partial<ProfileInput & MoodInput & JournalInput & GoalInput & MemoryInput & LetterInput>;

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
  }

  return result;
}

export async function getPendingSyncCount(): Promise<number> {
  try {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.outboxMutations)
      .where(ne(schema.outboxMutations.status, 'synced'));
    return rows[0]?.count || 0;
  } catch {
    return 0;
  }
}
