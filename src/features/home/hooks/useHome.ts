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

import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '@features/auth';
import * as homeService from '@infrastructure/home';
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

  const unsubRealtime = useRef<(() => void) | null>(null);
  const appState      = useRef<AppStateStatus>(AppState.currentState);

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
  }, [user?.id]);

  // ── Mount: init data + realtime + app-state listener ────────────────────

  useEffect(() => {
    if (!user?.id) return;

    loadAll();

    // Realtime: subscribe to user's own data changes
    unsubRealtime.current = homeService.subscribeToHomeUpdates(
      user.id,
      handleRealtimeChange,
    );

    // Re-fetch when app comes back to foreground
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        store().setLastRefreshed(0); // force stale
        loadAll();
      }
      appState.current = next;
    });

    return () => {
      unsubRealtime.current?.();
      sub.remove();
    };
  }, [user?.id, loadAll]);

  // ── Realtime handler ─────────────────────────────────────────────────────

  function handleRealtimeChange(table: string, payload: unknown) {
    const p = payload as { eventType: string; new: Record<string, unknown>; old: { id?: string } };

    switch (table) {
      case 'mood_logs':
        // Re-fetch mood on any change — keeps streak + recent moods in sync
        loadMood();
        break;
      case 'journal_entries':
        loadJournal();
        break;
      case 'goals':
        loadGoals();
        break;
      case 'streaks':
        loadStreak();
        break;
    }
  }

  // ── Individual loaders ───────────────────────────────────────────────────

  async function loadMood() {
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
  }

  async function loadJournal() {
    const s = store();
    s.setJournalLoading('loading');
    const result = await homeService.fetchJournalEntries(5);
    if (result.success) s.setJournalEntries(result.data);
    else                s.setJournalError(result.error);
    s.setJournalLoading('idle');
  }

  async function loadGoals() {
    const s = store();
    s.setGoalsLoading('loading');
    const result = await homeService.fetchGoals();
    if (result.success) s.setGoals(result.data);
    else                s.setGoalsError(result.error);
    s.setGoalsLoading('idle');
  }

  async function loadPrompt() {
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
  }

  async function loadStreak() {
    const result = await homeService.fetchStreak();
    if (result.success) store().setStreak(result.data);
  }

  // ── Public actions ───────────────────────────────────────────────────────

  async function logMood(input: CreateMoodLogInput): Promise<Result<MoodLog>> {
    const s = store();
    s.setMoodError(null);
    const result = await homeService.upsertMoodLog(input);
    if (result.success) {
      s.setTodayMood(result.data);
      // Reload streak — triggered by DB but pull fresh immediately for UI
      loadStreak();
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
