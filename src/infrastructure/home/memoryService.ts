import { supabase } from '@shared/lib/supabase';
import { deleteImages, getRelativePathFromSignedUrl } from '@shared/lib/storage';
import type { Memory, CreateMemoryInput, UpdateMemoryInput, Result } from '@features/home/types';
import { useAuthStore } from '@features/auth';
import { memoryRepo } from '@shared/db/repo';
import { enqueueMutation, enqueueUpload, processSyncQueue } from '@shared/db/sync';

function friendly(raw: string): string {
  console.error('[MemoryService friendly error debug]:', raw);
  if (raw.includes('JWT') || raw.includes('not authenticated'))
    return 'Your session expired. Please sign in again.';
  if (raw.includes('network') || raw.includes('fetch'))
    return 'No connection. Please check your internet.';
  return 'Something went wrong. Please try again.';
}

function err(e: unknown): string {
  console.error('[MemoryService err exception caught]:', e);
  if (e instanceof Error) return friendly(e.message);
  if (typeof e === 'string') return friendly(e);
  return 'Something went wrong.';
}

function mapMemory(row: Record<string, any>, resolvedUrls?: string[]): Memory {
  return {
    id:         row.id          as string,
    userId:     row.user_id     as string,
    title:      row.title       as string,
    body:       (row.body       as string | null) ?? '',
    emoji:      (row.emoji      as string) ?? '🌸',
    mood:       (row.mood       as string | null) ?? null,
    imageUrls:  resolvedUrls    ?? (row.image_urls as string[]) ?? [],
    memoryDate: row.memory_date as string,
    createdAt:  row.created_at  as string,
  };
}

/** Fetch recent memories, supporting text search */
export async function fetchMemories(searchQuery?: string, limit = 15, page = 1): Promise<Result<Memory[]>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const rows = await memoryRepo.fetchMemories(user.id, searchQuery, page, limit);

    const mapped: Memory[] = [];
    for (const r of rows) {
      mapped.push({
        id: r.id,
        userId: r.userId,
        title: r.title,
        body: r.body || '',
        emoji: r.emoji,
        mood: r.mood,
        imageUrls: r.imageUrls,
        memoryDate: r.memoryDate,
        createdAt: r.createdAt,
      });
    }

    return { success: true, data: mapped };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Create a new photo memory entry */
export async function createMemory(
  id: string,
  input: CreateMemoryInput
): Promise<Result<Memory>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const localUris: string[] = [];
    if (input.imageUrls && input.imageUrls.length > 0) {
      for (let i = 0; i < input.imageUrls.length; i++) {
        const pickerUri = input.imageUrls[i];
        if (pickerUri.startsWith('file://') || pickerUri.startsWith('content://')) {
          const remotePath = `${user.id}/${id}/${Date.now()}_${i}.jpg`;
          const cachedUri = await enqueueUpload('memories', id, pickerUri, remotePath, 'memory_images');
          localUris.push(cachedUri);
        } else {
          localUris.push(getRelativePathFromSignedUrl(pickerUri, 'memory_images'));
        }
      }
    }

    const localMemory = {
      id,
      userId: user.id,
      title: input.title,
      body: input.body ?? null,
      emoji: input.emoji ?? '🌸',
      mood: input.mood ?? null,
      imageUrls: localUris,
      memoryDate: today,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending_insert',
    };

    await memoryRepo.saveMemory(localMemory);

    await enqueueMutation('memories', id, 'insert', localMemory);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: { ...localMemory, body: localMemory.body ?? '' } };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update an existing memory entry */
export async function updateMemory(
  id: string,
  input: UpdateMemoryInput
): Promise<Result<Memory>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const entry = await memoryRepo.fetchMemoryById(id);
    if (!entry) return { success: false, error: 'Memory not found.' };

    const now = new Date().toISOString();

    const localUris: string[] = [];
    if (input.imageUrls) {
      for (let i = 0; i < input.imageUrls.length; i++) {
        const url = input.imageUrls[i];
        if (url.startsWith('file://') || url.startsWith('content://')) {
          const remotePath = `${user.id}/${id}/${Date.now()}_${i}.jpg`;
          const cachedUri = await enqueueUpload('memories', id, url, remotePath, 'memory_images');
          localUris.push(cachedUri);
        } else {
          localUris.push(getRelativePathFromSignedUrl(url, 'memory_images'));
        }
      }
    } else {
      localUris.push(...entry.imageUrls);
    }

    const updatedMemory = {
      ...entry,
      title: input.title !== undefined ? input.title : entry.title,
      body: input.body !== undefined ? (input.body ?? null) : entry.body,
      emoji: input.emoji !== undefined ? input.emoji : entry.emoji,
      mood: input.mood !== undefined ? input.mood : entry.mood,
      imageUrls: localUris,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await memoryRepo.saveMemory(updatedMemory);

    await enqueueMutation('memories', id, 'update', updatedMemory);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: { ...updatedMemory, body: updatedMemory.body ?? '' } };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a memory and all its storage image attachments */
export async function deleteMemory(id: string): Promise<Result<void>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const now = new Date().toISOString();
    await memoryRepo.softDeleteMemory(id, now);

    await enqueueMutation('memories', id, 'delete', { id });

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}
