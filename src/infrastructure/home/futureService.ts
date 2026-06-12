import { supabase } from '@shared/lib/supabase';
import { resolveSignedUrls, deleteImages } from '@shared/lib/storage';
import type { Letter, CreateLetterInput, Result } from '@features/home/types';
import { useAuthStore } from '@features/auth';
import { letterRepo } from '@shared/db/repo';
import { enqueueMutation, enqueueUpload, processSyncQueue } from '@shared/db/sync';

function friendly(raw: string): string {
  if (raw.includes('JWT') || raw.includes('not authenticated'))
    return 'Your session expired. Please sign in again.';
  if (raw.includes('network') || raw.includes('fetch'))
    return 'No connection. Please check your internet.';
  return 'Something went wrong. Please try again.';
}

function err(e: unknown): string {
  if (e instanceof Error) return friendly(e.message);
  if (typeof e === 'string') return friendly(e);
  return 'Something went wrong.';
}

function mapLetterRow(row: Record<string, any>): Letter {
  const unlockTime = new Date(row.deliver_at).getTime();
  return {
    id:           row.id         as string,
    userId:       row.user_id    as string,
    subject:      row.subject    as string,
    deliverAt:    row.deliver_at as string,
    isUnlocked:   Date.now() >= unlockTime,
    createdAt:    row.created_at as string,
    isRead:       row.is_read    as boolean,
    isFavorite:   row.is_favorite as boolean,
    isDraft:      row.is_draft    as boolean,
    isArchived:   row.is_archived as boolean,
  };
}

/** Fetch metadata for all letters (excludes body/imageUrls) */
export async function fetchLetters(limit = 20, page = 1): Promise<Result<Letter[]>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const rows = await letterRepo.fetchLetters(user.id, page, limit);
    return { success: true, data: rows };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch body and image attachments for an unlocked letter using local DB */
export async function fetchLetter(
  id: string
): Promise<Result<{ body: string; imageUrls: string[] }>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const letter = await letterRepo.fetchLetterById(id);
    if (!letter) return { success: false, error: 'Letter not found.' };

    if (!letter.isUnlocked) {
      return { success: false, error: 'Could not unlock letter. It may still be sealed.' };
    }

    const localPickerUris = letter.imageUrls.filter((u: string) => u.startsWith('file://') || u.startsWith('content://'));
    const remotePaths = letter.imageUrls.filter((u: string) => !u.startsWith('file://') && !u.startsWith('content://'));

    const resolved = await resolveSignedUrls('letter_images', remotePaths);

    return {
      success: true,
      data: {
        body: letter.body || '',
        imageUrls: [...localPickerUris, ...resolved],
      },
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Create a new sealed future letter */
export async function createLetter(
  id: string,
  input: CreateLetterInput
): Promise<Result<Letter>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const now = new Date().toISOString();

    const localUris: string[] = [];
    if (input.imageUrls && input.imageUrls.length > 0) {
      for (let i = 0; i < input.imageUrls.length; i++) {
        const pickerUri = input.imageUrls[i];
        const remotePath = `${user.id}/${id}/${Date.now()}_${i}.jpg`;
        const cachedUri = await enqueueUpload('future_letters', id, pickerUri, remotePath, 'letter_images');
        localUris.push(cachedUri);
      }
    }

    const localLetter = {
      id,
      userId: user.id,
      subject: input.subject,
      body: input.body,
      deliverAt: input.deliverAt,
      imageUrls: localUris,
      createdAt: now,
      updatedAt: now,
      isRead: 0,
      isFavorite: 0,
      isDraft: input.isDraft ? 1 : 0,
      isArchived: input.isArchived ? 1 : 0,
      syncStatus: 'pending_insert',
    };

    await letterRepo.saveLetter(localLetter);

    await enqueueMutation('future_letters', id, 'insert', localLetter);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return {
      success: true,
      data: {
        id: localLetter.id,
        userId: localLetter.userId,
        subject: localLetter.subject,
        deliverAt: localLetter.deliverAt,
        isUnlocked: Date.now() >= new Date(localLetter.deliverAt).getTime(),
        createdAt: localLetter.createdAt,
        isRead: false,
        isFavorite: false,
        isDraft: !!localLetter.isDraft,
        isArchived: !!localLetter.isArchived,
      },
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a future letter and all its attachments */
export async function deleteLetter(id: string): Promise<Result<void>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const now = new Date().toISOString();
    await letterRepo.softDeleteLetter(id, now);

    await enqueueMutation('future_letters', id, 'delete', { id });

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

export async function toggleFavoriteLetter(id: string, currentVal: boolean): Promise<Result<boolean>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const letter = await letterRepo.fetchLetterById(id);
    if (!letter) return { success: false, error: 'Letter not found.' };

    const nextVal = !currentVal;
    const now = new Date().toISOString();

    const updated = {
      ...letter,
      isFavorite: nextVal ? 1 : 0,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await letterRepo.saveLetter(updated);

    await enqueueMutation('future_letters', id, 'update', updated);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: nextVal };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

export async function markLetterRead(id: string): Promise<Result<void>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const letter = await letterRepo.fetchLetterById(id);
    if (!letter) return { success: false, error: 'Letter not found.' };

    const now = new Date().toISOString();

    const updated = {
      ...letter,
      isRead: 1,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await letterRepo.saveLetter(updated);

    await enqueueMutation('future_letters', id, 'update', updated);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

export async function toggleLetterArchive(id: string, currentVal: boolean): Promise<Result<boolean>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const letter = await letterRepo.fetchLetterById(id);
    if (!letter) return { success: false, error: 'Letter not found.' };

    const nextVal = !currentVal;
    const now = new Date().toISOString();

    const updated = {
      ...letter,
      isArchived: nextVal ? 1 : 0,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await letterRepo.saveLetter(updated);

    await enqueueMutation('future_letters', id, 'update', updated);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: nextVal };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

export async function updateLetter(
  id: string,
  fields: Partial<{ subject: string; body: string; deliverAt: string; isDraft: boolean; isArchived: boolean; imageUrls: string[] }>
): Promise<Result<Letter>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const letter = await letterRepo.fetchLetterById(id);
    if (!letter) return { success: false, error: 'Letter not found.' };

    const now = new Date().toISOString();

    const localUris = [...(fields.imageUrls ?? letter.imageUrls)];
    if (fields.imageUrls) {
      for (let i = 0; i < fields.imageUrls.length; i++) {
        const url = fields.imageUrls[i];
        if (url.startsWith('file://') || url.startsWith('content://')) {
          const remotePath = `${user.id}/${id}/${Date.now()}_${i}.jpg`;
          const cachedUri = await enqueueUpload('future_letters', id, url, remotePath, 'letter_images');
          const idx = localUris.indexOf(url);
          if (idx !== -1) localUris[idx] = cachedUri;
        }
      }
    }

    const updated = {
      ...letter,
      subject: fields.subject !== undefined ? fields.subject : letter.subject,
      body: fields.body !== undefined ? fields.body : letter.body,
      deliverAt: fields.deliverAt !== undefined ? fields.deliverAt : letter.deliverAt,
      isDraft: fields.isDraft !== undefined ? (fields.isDraft ? 1 : 0) : letter.isDraft,
      isArchived: fields.isArchived !== undefined ? (fields.isArchived ? 1 : 0) : letter.isArchived,
      imageUrls: localUris,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await letterRepo.saveLetter(updated);

    await enqueueMutation('future_letters', id, 'update', updated);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return {
      success: true,
      data: {
        id: updated.id,
        userId: updated.userId,
        subject: updated.subject,
        deliverAt: updated.deliverAt,
        isUnlocked: Date.now() >= new Date(updated.deliverAt).getTime(),
        createdAt: updated.createdAt,
        isRead: !!updated.isRead,
        isFavorite: !!updated.isFavorite,
        isDraft: !!updated.isDraft,
        isArchived: !!updated.isArchived,
      },
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}
