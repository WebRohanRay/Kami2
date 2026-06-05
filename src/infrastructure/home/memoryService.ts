import { supabase } from '@shared/lib/supabase';
import { resolveSignedUrls, deleteImages } from '@shared/lib/storage';
import type { Memory, CreateMemoryInput, UpdateMemoryInput, Result } from '@features/home/types';

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
export async function fetchMemories(searchQuery?: string): Promise<Result<Memory[]>> {
  try {
    let query = supabase.from('memories').select('*');

    if (searchQuery?.trim()) {
      const trimmed = searchQuery.trim();
      query = query.or(`title.ilike.%${trimmed}%,body.ilike.%${trimmed}%`);
    }

    const { data, error } = await query
      .order('memory_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: friendly(error.message) };

    const mapped: Memory[] = [];
    for (const row of (data ?? [])) {
      const resolved = await resolveSignedUrls('memory_images', row.image_urls || []);
      mapped.push(mapMemory(row, resolved));
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
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('memories')
      .insert({
        id,
        title:       input.title,
        body:        input.body ?? null,
        emoji:       input.emoji ?? '🌸',
        mood:        input.mood ?? null,
        image_urls:  input.imageUrls ?? [],
        memory_date: today,
      })
      .select()
      .single();

    if (error || !data) return { success: false, error: friendly(error?.message ?? '') };
    const resolved = await resolveSignedUrls('memory_images', data.image_urls || []);
    return { success: true, data: mapMemory(data, resolved) };
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
    const patch: Record<string, any> = {};
    if (input.title     !== undefined) patch.title      = input.title;
    if (input.body      !== undefined) patch.body       = input.body;
    if (input.emoji     !== undefined) patch.emoji      = input.emoji;
    if (input.mood      !== undefined) patch.mood       = input.mood;
    if (input.imageUrls !== undefined) patch.image_urls = input.imageUrls;

    const { data, error } = await supabase
      .from('memories')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return { success: false, error: friendly(error?.message ?? '') };
    const resolved = await resolveSignedUrls('memory_images', data.image_urls || []);
    return { success: true, data: mapMemory(data, resolved) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a memory and all its storage image attachments */
export async function deleteMemory(id: string): Promise<Result<void>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes?.user) {
      await deleteImages('memory_images', userRes.user.id, id);
    }

    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('user_id', userRes?.user?.id ?? '');

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}
