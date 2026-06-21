/**
 * useHome.ts
 *
 * Single public API for the Home feature.
 * Connects infrastructure (homeService) ↔ Zustand (homeStore).
 * No UI component should import from infrastructure directly.
 *
 * Responsibilities:
 *  - Initialise all home data on mount
 *  - Expose actions: logMood, addJournal, addGoal, updateGoal, etc.
 *  - Manage Realtime subscription lifecycle
 *  - Refresh data when app comes back to foreground
 */

import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '@features/auth';
import { supabase } from '@shared/lib/supabase';
import * as homeService from '@infrastructure/home';
import * as profileRepo from '@infrastructure/profile';
import { useHomeStore } from '../store';
import { journalRepo, goalRepo, moodRepo, promptResponseRepo, streakRepo } from '@shared/db/repo';
import { db } from '@shared/db/client';
import * as schema from '@shared/db/schema';
import { eq } from 'drizzle-orm';
import { useNetworkStatus } from '@shared/network/NetworkProvider';
import type {
  CreateMoodLogInput,
  CreateJournalInput,
  UpdateJournalInput,
  CreateGoalInput,
  UpdateGoalInput,
  Result,
  MoodLog,
  JournalEntry,
  Goal,
  PromptResponse,
} from '../types';

// Refresh if data is older than 5 minutes
const STALE_MS = 5 * 60 * 1000;

function mergeListById<T extends { id: string }>(
  existingList: T[],
  fetchedList: T[],
  isPageOne: boolean
): T[] {
  if (isPageOne) {
    const fetchedIds = new Set(fetchedList.map(x => x.id));
    const pendingOrExtra = existingList.filter(item => {
      const isPending = 'syncStatus' in item && item.syncStatus && String(item.syncStatus).startsWith('pending');
      const isNotFetched = !fetchedIds.has(item.id);
      return isPending || isNotFetched;
    });

    const mergedMap = new Map<string, T>();
    fetchedList.forEach(item => mergedMap.set(item.id, item));

    const finalItems = [...fetchedList];
    pendingOrExtra.forEach(item => {
      if (!mergedMap.has(item.id)) {
        finalItems.unshift(item);
        mergedMap.set(item.id, item);
      }
    });
    return finalItems;
  } else {
    const mergedMap = new Map<string, T>();
    existingList.forEach(item => mergedMap.set(item.id, item));

    const finalItems = [...existingList];
    fetchedList.forEach(item => {
      if (mergedMap.has(item.id)) {
        const index = finalItems.findIndex(x => x.id === item.id);
        if (index !== -1) {
          finalItems[index] = item;
        }
      } else {
        finalItems.push(item);
        mergedMap.set(item.id, item);
      }
    });
    return finalItems;
  }
}

export function useHome() {
  const user  = useAuthStore((s) => s.user);
  const store = useHomeStore.getState;

  // ── Bootstrap: load all data on first mount ─────────────────────────────

  // ── Individual loaders ───────────────────────────────────────────────────

  const loadMood = useCallback(async () => {
    const s = store();
    s.setMoodLoading('loading');
    const [todayResult, recentResult] = await Promise.all([
      homeService.fetchTodayMood(),
      homeService.fetchRecentMoods(7),
    ]);
    if (todayResult.success)  s.setTodayMood(todayResult.data);
    else                      s.setMoodError(todayResult.error);
    if (recentResult.success) s.setRecentMoods(recentResult.data);
    s.setMoodLoading('idle');
  }, []);

  const loadJournal = useCallback(async (searchQuery?: string, tagFilter?: string, page = 1) => {
    const s = store();
    s.setJournalLoading('loading');
    const result = await homeService.fetchJournalEntries(20, searchQuery, tagFilter, page);
    if (result.success) {
      s.setJournalEntries(mergeListById(s.journalEntries, result.data, page === 1));
      s.setJournalPage(page);
      s.setJournalHasMore(result.data.length === 20);
    } else {
      s.setJournalError(result.error);
    }
    s.setJournalLoading('idle');
  }, []);

  const loadMoreJournal = useCallback(async (searchQuery?: string, tagFilter?: string) => {
    const s = store();
    if (s.journalLoading === 'loading' || !s.journalHasMore) return;
    await loadJournal(searchQuery, tagFilter, s.journalPage + 1);
  }, [loadJournal]);

  const loadGoals = useCallback(async () => {
    const s = store();
    s.setGoalsLoading('loading');
    const result = await homeService.fetchGoals();
    if (result.success) s.setGoals(mergeListById(s.goals, result.data, true));
    else                s.setGoalsError(result.error);
    s.setGoalsLoading('idle');
  }, []);

  const loadPrompt = useCallback(async () => {
    const s = store();
    s.setPromptLoading('loading');
    const promptResult = await homeService.fetchTodayPrompt();
    if (promptResult.success) {
      s.setTodayPrompt(promptResult.data);
      // Check if user already responded today
      const responseResult = await homeService.fetchTodayPromptResponse(promptResult.data.id);
      if (responseResult.success) s.setPromptResponse(responseResult.data);
    }
    s.setPromptLoading('idle');
  }, []);

  const loadStreak = useCallback(async () => {
    const result = await homeService.fetchStreak();
    if (result.success) store().setStreak(result.data);
  }, []);

  // ── Bootstrap: load all data on first mount ─────────────────────────────

  const loadAll = useCallback(async () => {
    const s = store();
    if (!user?.id) return;

    const isStale = !s.lastRefreshed || Date.now() - s.lastRefreshed > STALE_MS;
    if (s.isInitialised && !isStale) return;

    // Run all fetches in parallel — independent data, no dependencies
    await Promise.all([
      loadMood(),
      loadJournal(),
      loadGoals(),
      loadPrompt(),
      loadStreak(),
    ]);

    store().setInitialised(true);
    store().setLastRefreshed(Date.now());
  }, [user?.id, loadMood, loadJournal, loadGoals, loadPrompt, loadStreak]);

  // ── Mount: init data + realtime + app-state listener ────────────────────

  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    if (!user?.id) return;
    loadAll();

    // Foreground listener
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        loadAll();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    if (!isConnected) {
      return () => {
        appStateSub.remove();
      };
    }

    let channel: any = null;
    let debounceTimeout: NodeJS.Timeout | null = null;

    const setupSubscription = () => {
      const channelName = `home_realtime_${user.id}`;
      try {
        const existing = supabase.getChannels().find(
          (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
        );
        if (existing) {
          supabase.removeChannel(existing);
        }
      } catch (e) {
        console.warn('[useHome] Failed to clean up existing channel:', e);
      }

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mood_logs', filter: `user_id=eq.${user.id}` },
          async (payload: any) => {
            try {
              if (payload.eventType === 'DELETE') {
                const oldId = payload.old?.id;
                if (oldId) {
                  await db.update(schema.moodLogs).set({ deletedAt: new Date().toISOString(), syncStatus: 'synced' }).where(eq(schema.moodLogs.id, oldId));
                }
              } else {
                const row = payload.new;
                await moodRepo.upsertMood({
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
                });
              }
            } catch (err) {
              console.error('[Realtime] Failed to sync mood_log to SQLite:', err);
            }
            loadMood();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'journal_entries', filter: `user_id=eq.${user.id}` },
          async (payload: any) => {
            try {
              if (payload.eventType === 'DELETE') {
                const oldId = payload.old?.id;
                if (oldId) {
                  await db.update(schema.journalEntries).set({ deletedAt: new Date().toISOString(), syncStatus: 'synced' }).where(eq(schema.journalEntries.id, oldId));
                }
              } else {
                const row = payload.new;
                await journalRepo.saveJournal({
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
                });
              }
            } catch (err) {
              console.error('[Realtime] Failed to sync journal_entry to SQLite:', err);
            }
            loadJournal();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${user.id}` },
          async (payload: any) => {
            try {
              if (payload.eventType === 'DELETE') {
                const oldId = payload.old?.id;
                if (oldId) {
                  await db.update(schema.goals).set({ deletedAt: new Date().toISOString(), syncStatus: 'synced' }).where(eq(schema.goals.id, oldId));
                }
              } else {
                const row = payload.new;
                await goalRepo.saveGoal({
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
                });
              }
            } catch (err) {
              console.error('[Realtime] Failed to sync goal to SQLite:', err);
            }
            loadGoals();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'streaks', filter: `user_id=eq.${user.id}` },
          async (payload: any) => {
            try {
              if (payload.eventType !== 'DELETE') {
                const row = payload.new;
                await streakRepo.saveStreak(user.id, {
                  currentStreak: row.current_streak,
                  longestStreak: row.longest_streak,
                  lastCheckinDate: row.last_checkin_date,
                  totalCheckins: row.total_checkins,
                  updatedAt: row.updated_at,
                });
              }
            } catch (err) {
              console.error('[Realtime] Failed to sync streak to SQLite:', err);
            }
            loadStreak();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'prompt_responses', filter: `user_id=eq.${user.id}` },
          async (payload: any) => {
            try {
              if (payload.eventType === 'DELETE') {
                const oldId = payload.old?.id;
                if (oldId) {
                  await db.update(schema.promptResponses).set({ deletedAt: new Date().toISOString(), syncStatus: 'synced' }).where(eq(schema.promptResponses.id, oldId));
                }
              } else {
                const row = payload.new;
                await promptResponseRepo.saveResponse({
                  id: row.id,
                  userId: row.user_id,
                  promptId: row.prompt_id,
                  response: row.response,
                  responseDate: row.response_date,
                  createdAt: row.created_at,
                  updatedAt: row.updated_at,
                  syncStatus: 'synced',
                  serverUpdatedAt: row.updated_at,
                });
              }
            } catch (err) {
              console.error('[Realtime] Failed to sync prompt_response to SQLite:', err);
            }
            loadPrompt();
          }
        )
        .subscribe();
    };

    debounceTimeout = setTimeout(() => {
      setupSubscription();
    }, 100);

    return () => {
      appStateSub.remove();
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, isConnected, loadAll, loadMood, loadJournal, loadGoals, loadPrompt, loadStreak]);

  // ── Public actions ───────────────────────────────────────────────────────

  async function logMood(input: CreateMoodLogInput): Promise<Result<MoodLog>> {
    const s = store();
    s.setMoodError(null);
    const result = await homeService.upsertMoodLog(input);
    if (result.success) {
      s.setTodayMood(result.data);
      // Reload streak — triggered by DB but pull fresh immediately for UI
      loadStreak();
      if (user?.id) {
        profileRepo.updateProfile(user.id, {
          currentMoodEmoji: result.data.moodEmoji,
          currentMoodLabel: result.data.moodLabel
        }).then((res) => {
          if (res.success) {
            useAuthStore.getState().setUser(res.data);
          }
        }).catch(err => console.error('Failed to sync mood to profile:', err));
      }
    } else {
      s.setMoodError(result.error);
    }
    return result;
  }

  async function addJournalEntry(
    input: CreateJournalInput,
  ): Promise<Result<JournalEntry>> {
    const s = store();
    s.setJournalError(null);
    const result = await homeService.createJournalEntry(input);
    if (result.success) s.prependJournal(result.data);
    else                s.setJournalError(result.error);
    return result;
  }

  async function editJournalEntry(
    id: string,
    input: UpdateJournalInput,
  ): Promise<Result<JournalEntry>> {
    const s = store();
    const result = await homeService.updateJournalEntry(id, input);
    if (result.success) s.updateJournalInList(result.data);
    return result;
  }

  async function removeJournalEntry(id: string): Promise<Result<void>> {
    const result = await homeService.deleteJournalEntry(id);
    if (result.success) store().removeJournal(id);
    return result;
  }

  async function addGoal(input: CreateGoalInput): Promise<Result<Goal>> {
    const s = store();
    s.setGoalsError(null);
    const result = await homeService.createGoal(input);
    if (result.success) s.prependGoal(result.data);
    else                s.setGoalsError(result.error);
    return result;
  }

  async function editGoal(
    id: string,
    input: UpdateGoalInput,
  ): Promise<Result<Goal>> {
    const result = await homeService.updateGoal(id, input);
    if (result.success) store().updateGoalInList(result.data);
    return result;
  }

  async function removeGoal(id: string): Promise<Result<void>> {
    const result = await homeService.deleteGoal(id);
    if (result.success) store().removeGoal(id);
    return result;
  }

  async function respondToPrompt(
    promptId: string,
    response: string,
  ): Promise<Result<PromptResponse>> {
    const result = await homeService.savePromptResponse(promptId, response);
    if (result.success) store().setPromptResponse(result.data);
    return result;
  }

  async function refresh(): Promise<void> {
    store().setLastRefreshed(0); // force stale
    await loadAll();
  }

  return {
    logMood,
    loadJournal,
    loadMoreJournal,
    addJournalEntry,
    editJournalEntry,
    removeJournalEntry,
    addGoal,
    editGoal,
    removeGoal,
    respondToPrompt,
    refresh,
  };
}
