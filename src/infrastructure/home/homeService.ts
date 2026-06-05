/**
 * homeService.ts
 *
 * All Supabase interactions for the Home feature.
 * Never imported by UI — only by useHome hook.
 *
 * Security guarantees:
 *  - Every query scoped to auth.uid() via RLS (server-enforced)
 *  - No user_id passed from client — Supabase infers from JWT
 *  - All errors normalised to user-friendly strings
 *  - Realtime channel per user (not broadcast — private)
 */

import { supabase } from '@shared/lib/supabase';
import type {
  MoodLog,
  JournalEntry,
  Goal,
  DailyPrompt,
  PromptResponse,
  Streak,
  CreateMoodLogInput,
  CreateJournalInput,
  UpdateJournalInput,
  CreateGoalInput,
  UpdateGoalInput,
  Result,
} from '../types';

// ─── Error normaliser ────────────────────────────────────────────────────────

function friendly(raw: string): string {
  if (raw.includes('duplicate key') || raw.includes('unique'))
    return 'You already logged this today.';
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

// ─── Mood ────────────────────────────────────────────────────────────────────

/** Log or update today's mood. Returns the saved log. */
export async function upsertMoodLog(
  input: CreateMoodLogInput,
): Promise<Result<MoodLog>> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('mood_logs')
      .upsert(
        {
          mood_id:    input.moodId,
          mood_emoji: input.moodEmoji,
          mood_label: input.moodLabel,
          note:       input.note ?? null,
          logged_date: today,
        },
        { onConflict: 'user_id,logged_date' },
      )
      .select()
      .single();

    if (error || !data) return { success: false, error: friendly(error?.message ?? '') };
    return { success: true, data: mapMoodLog(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch today's mood log for the current user. */
export async function fetchTodayMood(): Promise<Result<MoodLog | null>> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('mood_logs')
      .select('*')
      .eq('logged_date', today)
      .maybeSingle();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: data ? mapMoodLog(data) : null };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch last 7 days of mood logs for the mini-graph. */
export async function fetchRecentMoods(days = 7): Promise<Result<MoodLog[]>> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('mood_logs')
      .select('*')
      .gte('logged_date', sinceStr)
      .order('logged_date', { ascending: true });

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: (data ?? []).map(mapMoodLog) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── Journal ─────────────────────────────────────────────────────────────────

/** Create a new journal entry. */
export async function createJournalEntry(
  input: CreateJournalInput,
): Promise<Result<JournalEntry>> {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        title:      input.title ?? null,
        body:       input.body,
        mood_id:    input.moodId ?? null,
        tags:       input.tags ?? [],
        entry_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error || !data) return { success: false, error: friendly(error?.message ?? '') };
    return { success: true, data: mapJournalEntry(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update an existing journal entry. */
export async function updateJournalEntry(
  id: string,
  input: UpdateJournalInput,
): Promise<Result<JournalEntry>> {
  try {
    const patch: Record<string, unknown> = {};
    if (input.title     !== undefined) patch.title     = input.title;
    if (input.body      !== undefined) patch.body      = input.body;
    if (input.moodId    !== undefined) patch.mood_id   = input.moodId;
    if (input.tags      !== undefined) patch.tags      = input.tags;
    if (input.isPinned  !== undefined) patch.is_pinned = input.isPinned;

    const { data, error } = await supabase
      .from('journal_entries')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return { success: false, error: friendly(error?.message ?? '') };
    return { success: true, data: mapJournalEntry(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a journal entry. */
export async function deleteJournalEntry(id: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch recent journal entries (latest first). */
export async function fetchJournalEntries(limit = 5): Promise<Result<JournalEntry[]>> {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: (data ?? []).map(mapJournalEntry) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── Goals ───────────────────────────────────────────────────────────────────

/** Create a new goal. */
export async function createGoal(input: CreateGoalInput): Promise<Result<Goal>> {
  try {
    const { data, error } = await supabase
      .from('goals')
      .insert({
        title:       input.title,
        description: input.description ?? null,
        category:    input.category,
        target_date: input.targetDate ?? null,
        emoji:       input.emoji ?? '🌱',
      })
      .select()
      .single();

    if (error || !data) return { success: false, error: friendly(error?.message ?? '') };
    return { success: true, data: mapGoal(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update goal fields or progress. */
export async function updateGoal(
  id: string,
  input: UpdateGoalInput,
): Promise<Result<Goal>> {
  try {
    const patch: Record<string, unknown> = {};
    if (input.title       !== undefined) patch.title       = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.category    !== undefined) patch.category    = input.category;
    if (input.status      !== undefined) {
      patch.status = input.status;
      if (input.status === 'completed') patch.completed_at = new Date().toISOString();
    }
    if (input.progress  !== undefined) patch.progress    = input.progress;
    if (input.targetDate !== undefined) patch.target_date = input.targetDate;
    if (input.emoji      !== undefined) patch.emoji       = input.emoji;

    const { data, error } = await supabase
      .from('goals')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return { success: false, error: friendly(error?.message ?? '') };
    return { success: true, data: mapGoal(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a goal. */
export async function deleteGoal(id: string): Promise<Result<void>> {
  try {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch active goals. */
export async function fetchGoals(): Promise<Result<Goal[]>> {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .in('status', ['active', 'paused'])
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: (data ?? []).map(mapGoal) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

/** Fetch today's prompt — deterministic by day-of-year so it's the same for everyone. */
export async function fetchTodayPrompt(): Promise<Result<DailyPrompt>> {
  try {
    const { data, error } = await supabase
      .from('daily_prompts')
      .select('id, content, category')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error || !data?.length)
      return { success: false, error: 'Could not load today\'s prompt.' };

    // Deterministic selection: day-of-year mod total count
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const prompt = data[dayOfYear % data.length];
    return { success: true, data: { id: prompt.id, content: prompt.content, category: prompt.category } };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Save user's response to today's prompt. */
export async function savePromptResponse(
  promptId: string,
  response: string,
): Promise<Result<PromptResponse>> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('prompt_responses')
      .upsert(
        { prompt_id: promptId, response, response_date: today },
        { onConflict: 'user_id,prompt_id,response_date' },
      )
      .select()
      .single();

    if (error || !data) return { success: false, error: friendly(error?.message ?? '') };
    return {
      success: true,
      data: {
        id:           data.id,
        userId:       data.user_id,
        promptId:     data.prompt_id,
        response:     data.response,
        responseDate: data.response_date,
        createdAt:    data.created_at,
      },
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Check if user has already responded to today's prompt. */
export async function fetchTodayPromptResponse(
  promptId: string,
): Promise<Result<PromptResponse | null>> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('prompt_responses')
      .select('*')
      .eq('prompt_id', promptId)
      .eq('response_date', today)
      .maybeSingle();

    if (error) return { success: false, error: friendly(error.message) };
    if (!data) return { success: true, data: null };
    return {
      success: true,
      data: {
        id:           data.id,
        userId:       data.user_id,
        promptId:     data.prompt_id,
        response:     data.response,
        responseDate: data.response_date,
        createdAt:    data.created_at,
      },
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── Streak ──────────────────────────────────────────────────────────────────

/** Fetch streak for the current user. */
export async function fetchStreak(): Promise<Result<Streak>> {
  try {
    const { data, error } = await supabase
      .from('streaks')
      .select('*')
      .maybeSingle();

    if (error) return { success: false, error: friendly(error.message) };

    // No row yet — user hasn't checked in
    if (!data) {
      return {
        success: true,
        data: {
          userId:          '',
          currentStreak:   0,
          longestStreak:   0,
          lastCheckinDate: null,
          totalCheckins:   0,
        },
      };
    }

    return {
      success: true,
      data: {
        userId:          data.user_id,
        currentStreak:   data.current_streak,
        longestStreak:   data.longest_streak,
        lastCheckinDate: data.last_checkin_date,
        totalCheckins:   data.total_checkins,
      },
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── Realtime ────────────────────────────────────────────────────────────────

type RealtimeCallback = (table: string, payload: unknown) => void;

/**
 * Subscribe to realtime changes on the user's home data.
 * Returns an unsubscribe function — always call on cleanup.
 *
 * Uses a private channel per user (user_id in channel name)
 * so only this user's changes arrive on this channel.
 */
export function subscribeToHomeUpdates(
  userId: string,
  onChange: RealtimeCallback,
): () => void {
  const channel = supabase
    .channel(`home:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mood_logs',      filter: `user_id=eq.${userId}` },
      (payload) => onChange('mood_logs', payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'journal_entries', filter: `user_id=eq.${userId}` },
      (payload) => onChange('journal_entries', payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'goals',           filter: `user_id=eq.${userId}` },
      (payload) => onChange('goals', payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'streaks',         filter: `user_id=eq.${userId}` },
      (payload) => onChange('streaks', payload),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── Row mappers (snake_case DB → camelCase TS) ──────────────────────────────

function mapMoodLog(row: Record<string, unknown>): MoodLog {
  return {
    id:         row.id         as string,
    userId:     row.user_id    as string,
    moodId:     row.mood_id    as string,
    moodEmoji:  row.mood_emoji as string,
    moodLabel:  row.mood_label as string,
    note:       (row.note      as string | null) ?? null,
    loggedDate: row.logged_date as string,
    createdAt:  row.created_at  as string,
    updatedAt:  row.updated_at  as string,
  };
}

function mapJournalEntry(row: Record<string, unknown>): JournalEntry {
  return {
    id:        row.id          as string,
    userId:    row.user_id     as string,
    title:     (row.title      as string | null) ?? null,
    body:      row.body        as string,
    moodId:    (row.mood_id    as string | null) ?? null,
    tags:      (row.tags       as string[]) ?? [],
    entryDate: row.entry_date  as string,
    isPinned:  (row.is_pinned  as boolean) ?? false,
    createdAt: row.created_at  as string,
    updatedAt: row.updated_at  as string,
  };
}

function mapGoal(row: Record<string, unknown>): Goal {
  return {
    id:          row.id          as string,
    userId:      row.user_id     as string,
    title:       row.title       as string,
    description: (row.description as string | null) ?? null,
    category:    row.category    as Goal['category'],
    status:      row.status      as Goal['status'],
    progress:    (row.progress   as number) ?? 0,
    targetDate:  (row.target_date as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    emoji:       (row.emoji      as string) ?? '🌱',
    sortOrder:   (row.sort_order as number) ?? 0,
    createdAt:   row.created_at  as string,
    updatedAt:   row.updated_at  as string,
  };
}
