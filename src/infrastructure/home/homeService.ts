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
} from '@features/home/types';
import { resolveSignedUrls, deleteImages } from '@shared/lib/storage';
import { useAuthStore } from '@features/auth';
import { journalRepo, goalRepo, moodRepo } from '@shared/db/repo';
import { enqueueMutation, enqueueUpload, processSyncQueue } from '@shared/db/sync';

import { uuid } from '@shared/lib/uuid';

// ─── Error normaliser ────────────────────────────────────────────────────────

function friendly(raw: string): string {
  console.error('[Supabase Error Debug - Raw Message]:', raw);
  if (raw.includes('duplicate key') || raw.includes('unique'))
    return 'You already logged this today.';
  if (raw.includes('JWT') || raw.includes('not authenticated'))
    return 'Your session expired. Please sign in again.';
  if (raw.includes('network') || raw.includes('fetch'))
    return 'No connection. Please check your internet.';
  return 'Something went wrong. Please try again.';
}

function err(e: unknown): string {
  console.error('[Supabase Error Debug - Exception Caught]:', e);
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
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const localMood = {
      id: uuid(),
      userId: user.id,
      moodId: input.moodId,
      moodEmoji: input.moodEmoji,
      moodLabel: input.moodLabel,
      note: input.note ?? null,
      loggedDate: today,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await moodRepo.upsertMood(localMood);

    await enqueueMutation('mood_logs', localMood.id, 'update', localMood);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: localMood };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch today's mood log for the current user. */
export async function fetchTodayMood(): Promise<Result<MoodLog | null>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };
    const today = new Date().toISOString().split('T')[0];
    const data = await moodRepo.fetchTodayMood(user.id, today);
    return { success: true, data: data ? mapMoodLog(data) : null };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch last 7 days of mood logs for the mini-graph. */
export async function fetchRecentMoods(days = 7): Promise<Result<MoodLog[]>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];
    const data = await moodRepo.fetchRecentMoods(user.id, sinceStr);
    return { success: true, data: data.map(mapMoodLog) };
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
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const entryId = uuid();
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Handle local image attachment copying & queueing
    const localUris: string[] = [];
    if (input.imageUrls && input.imageUrls.length > 0) {
      for (let i = 0; i < input.imageUrls.length; i++) {
        const pickerUri = input.imageUrls[i];
        const bucket = user.activeSpace === 'couple' ? 'couple_journal_images' : 'journal_images';
        const ownerId = user.id;
        const timestamp = Date.now();
        const remotePath = `${ownerId}/${entryId}/${timestamp}_${i}.jpg`;
        
        const cachedUri = await enqueueUpload('journal_entries', entryId, pickerUri, remotePath, bucket);
        localUris.push(cachedUri);
      }
    }

    const localEntry = {
      id: entryId,
      userId: user.id,
      title: input.title ?? null,
      body: input.body,
      moodId: input.moodId ?? null,
      tags: input.tags ?? [],
      imageUrls: localUris,
      entryDate: today,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending_insert',
    };

    await journalRepo.saveJournal(localEntry);

    await enqueueMutation('journal_entries', entryId, 'insert', localEntry);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: localEntry };
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
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const entry = await journalRepo.fetchJournalById(id);
    if (!entry) return { success: false, error: 'Journal entry not found.' };

    const now = new Date().toISOString();
    
    // Copy new picker files if any
    const localUris = [...(input.imageUrls ?? entry.imageUrls)];
    if (input.imageUrls) {
      for (let i = 0; i < input.imageUrls.length; i++) {
        const url = input.imageUrls[i];
        if (url.startsWith('file://') || url.startsWith('content://')) {
          const bucket = user.activeSpace === 'couple' ? 'couple_journal_images' : 'journal_images';
          const ownerId = user.id;
          const timestamp = Date.now();
          const remotePath = `${ownerId}/${id}/${timestamp}_${i}.jpg`;
          const cachedUri = await enqueueUpload('journal_entries', id, url, remotePath, bucket);
          const idx = localUris.indexOf(url);
          if (idx !== -1) localUris[idx] = cachedUri;
        }
      }
    }

    const updatedEntry = {
      ...entry,
      title: input.title !== undefined ? input.title : entry.title,
      body: input.body !== undefined ? input.body : entry.body,
      moodId: input.moodId !== undefined ? input.moodId : entry.moodId,
      tags: input.tags !== undefined ? input.tags : entry.tags,
      isPinned: input.isPinned !== undefined ? input.isPinned : entry.isPinned,
      imageUrls: localUris,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await journalRepo.saveJournal(updatedEntry);

    await enqueueMutation('journal_entries', id, 'update', updatedEntry);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: updatedEntry };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a journal entry. */
export async function deleteJournalEntry(id: string): Promise<Result<void>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const now = new Date().toISOString();
    await journalRepo.softDeleteJournal(id, now);

    await enqueueMutation('journal_entries', id, 'delete', { id });

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch recent journal entries (latest first, supporting search & tag filters). */
export async function fetchJournalEntries(
  limit = 20,
  searchQuery?: string,
  tagFilter?: string,
  page = 1
): Promise<Result<JournalEntry[]>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const rows = await journalRepo.fetchJournals(user.id, searchQuery, tagFilter, page, limit);
    
    const mapped: JournalEntry[] = [];
    for (const r of rows) {
      const localPickerUris = r.imageUrls.filter((u: string) => u.startsWith('file://') || u.startsWith('content://'));
      const remotePaths = r.imageUrls.filter((u: string) => !u.startsWith('file://') && !u.startsWith('content://'));
      
      const bucket = user.activeSpace === 'couple' ? 'couple_journal_images' : 'journal_images';
      const resolvedRemote = await resolveSignedUrls(bucket, remotePaths);
      
      mapped.push({
        id: r.id,
        userId: r.userId,
        title: r.title,
        body: r.body,
        moodId: r.moodId,
        tags: r.tags,
        imageUrls: [...localPickerUris, ...resolvedRemote],
        entryDate: r.entryDate,
        isPinned: r.isPinned,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
    }

    return { success: true, data: mapped };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── Goals ───────────────────────────────────────────────────────────────────

/** Create a new goal. */
export async function createGoal(input: CreateGoalInput): Promise<Result<Goal>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const goalId = uuid();
    const now = new Date().toISOString();

    let cachedUrl = input.imageUrl ?? null;
    if (input.imageUrl && (input.imageUrl.startsWith('file://') || input.imageUrl.startsWith('content://'))) {
      const remotePath = `${user.id}/${goalId}/${Date.now()}.jpg`;
      cachedUrl = await enqueueUpload('goals', goalId, input.imageUrl, remotePath, 'goal_images');
    }

    const localGoal = {
      id: goalId,
      userId: user.id,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      status: 'active' as const,
      progress: 0,
      targetDate: input.targetDate ?? null,
      completedAt: null,
      emoji: input.emoji ?? '🌱',
      sortOrder: 0,
      imageUrl: cachedUrl,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending_insert',
    };

    await goalRepo.saveGoal(localGoal);

    await enqueueMutation('goals', goalId, 'insert', localGoal);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: { ...localGoal, category: localGoal.category as Goal['category'], status: localGoal.status as Goal['status'] } };
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
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const goal = await goalRepo.fetchGoalById(id);
    if (!goal) return { success: false, error: 'Goal not found.' };

    const now = new Date().toISOString();

    let cachedUrl = input.imageUrl !== undefined ? input.imageUrl : goal.imageUrl;
    if (input.imageUrl && (input.imageUrl.startsWith('file://') || input.imageUrl.startsWith('content://'))) {
      const remotePath = `${user.id}/${id}/${Date.now()}.jpg`;
      cachedUrl = await enqueueUpload('goals', id, input.imageUrl, remotePath, 'goal_images');
    }

    const updatedGoal = {
      ...goal,
      title: input.title !== undefined ? input.title : goal.title,
      description: input.description !== undefined ? input.description : goal.description,
      category: input.category !== undefined ? input.category : goal.category,
      status: input.status !== undefined ? input.status : goal.status,
      progress: input.progress !== undefined ? input.progress : goal.progress,
      targetDate: input.targetDate !== undefined ? input.targetDate : goal.targetDate,
      completedAt: input.status === 'completed' ? now : (input.status ? null : goal.completedAt),
      emoji: input.emoji !== undefined ? input.emoji : goal.emoji,
      imageUrl: cachedUrl,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await goalRepo.saveGoal(updatedGoal);

    await enqueueMutation('goals', id, 'update', updatedGoal);

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: { ...updatedGoal, category: updatedGoal.category as Goal['category'], status: updatedGoal.status as Goal['status'] } };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a goal. */
export async function deleteGoal(id: string): Promise<Result<void>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const now = new Date().toISOString();
    await goalRepo.softDeleteGoal(id, now);

    await enqueueMutation('goals', id, 'delete', { id });

    processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));

    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch active goals. */
export async function fetchGoals(): Promise<Result<Goal[]>> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated.' };

    const rows = await goalRepo.fetchGoals(user.id);

    const mapped: Goal[] = [];
    for (const r of rows) {
      let resolved = r.imageUrl;
      if (r.imageUrl && !r.imageUrl.startsWith('file://') && !r.imageUrl.startsWith('content://')) {
        resolved = (await resolveSignedUrls('goal_images', [r.imageUrl]))[0] || null;
      }
      mapped.push({
        id: r.id,
        userId: r.userId,
        title: r.title,
        description: r.description,
        category: r.category as Goal['category'],
        status: r.status as Goal['status'],
        progress: r.progress,
        targetDate: r.targetDate,
        completedAt: r.completedAt,
        emoji: r.emoji,
        sortOrder: r.sortOrder,
        imageUrl: resolved,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
    }

    return { success: true, data: mapped };
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

function mapJournalEntry(row: Record<string, any>, resolvedUrls?: string[]): JournalEntry {
  return {
    id:        row.id          as string,
    userId:    row.user_id     as string,
    title:     (row.title      as string | null) ?? null,
    body:      row.body        as string,
    moodId:    (row.mood_id    as string | null) ?? null,
    tags:      (row.tags       as string[]) ?? [],
    imageUrls: resolvedUrls    ?? (row.image_urls as string[]) ?? [],
    entryDate: row.entry_date  as string,
    isPinned:  (row.is_pinned  as boolean) ?? false,
    createdAt: row.created_at  as string,
    updatedAt: row.updated_at  as string,
  };
}

function mapGoal(row: Record<string, any>, resolvedUrl?: string | null): Goal {
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
    imageUrl:    resolvedUrl     ?? row.image_url ?? null,
    sortOrder:   (row.sort_order as number) ?? 0,
    createdAt:   row.created_at  as string,
    updatedAt:   row.updated_at  as string,
  };
}
