import { supabase } from '@shared/lib/supabase';
import { resolveSignedUrls, deleteImages } from '@shared/lib/storage';
import type { Letter, CreateLetterInput, Result } from '@features/home/types';

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
  };
}

/** Fetch metadata for all letters (excludes body/imageUrls) */
export async function fetchLetters(): Promise<Result<Letter[]>> {
  try {
    const { data, error } = await supabase
      .from('future_letters')
      .select('id, user_id, subject, deliver_at, created_at')
      .order('deliver_at', { ascending: true });

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: (data ?? []).map(mapLetterRow) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch body and image attachments for an unlocked letter using RPC */
export async function fetchLetter(
  id: string
): Promise<Result<{ body: string; imageUrls: string[] }>> {
  try {
    const { data, error } = await supabase.rpc('fetch_unlocked_letter', { p_letter_id: id });
    if (error || !data || data.length === 0) {
      return { success: false, error: 'Could not unlock letter. It may still be sealed.' };
    }

    const row = data[0];
    const resolved = await resolveSignedUrls('letter_images', row.image_urls || []);

    return {
      success: true,
      data: {
        body: row.body,
        imageUrls: resolved,
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
    const { data, error } = await supabase
      .from('future_letters')
      .insert({
        id,
        subject:    input.subject,
        body:       input.body,
        deliver_at: input.deliverAt,
        image_urls: input.imageUrls ?? [],
      })
      .select('id, user_id, subject, deliver_at, created_at')
      .single();

    if (error || !data) return { success: false, error: friendly(error?.message ?? '') };
    return { success: true, data: mapLetterRow(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a future letter and all its attachments */
export async function deleteLetter(id: string): Promise<Result<void>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes?.user) {
      await deleteImages('letter_images', userRes.user.id, id);
    }

    const { error } = await supabase
      .from('future_letters')
      .delete()
      .eq('id', id)
      .eq('user_id', userRes?.user?.id ?? '');

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}
