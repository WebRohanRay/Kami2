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
      if (page === 1) {
        s.setJournalEntries(result.data);
      } else {
        s.setJournalEntries([...s.journalEntries, ...result.data]);
      }
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
    if (result.success) s.setGoals(result.data);
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

    // Setup realtime subscription
    const channel = supabase
      .channel(`home_realtime_${user.id}_${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mood_logs', filter: `user_id=eq.${user.id}` },
        () => { loadMood(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'journal_entries', filter: `user_id=eq.${user.id}` },
        () => { loadJournal(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${user.id}` },
        () => { loadGoals(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streaks', filter: `user_id=eq.${user.id}` },
        () => { loadStreak(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prompt_responses', filter: `user_id=eq.${user.id}` },
        () => { loadPrompt(); }
      )
      .subscribe();

    return () => {
      appStateSub.remove();
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadAll, loadMood, loadJournal, loadGoals, loadPrompt, loadStreak]);

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
