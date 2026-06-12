/**
 * homeStore.ts
 *
 * Zustand store for all Home feature state.
 * Only mutated by useHome hook — never by UI directly.
 */

import { create } from 'zustand';
import type {
  MoodLog,
  JournalEntry,
  Goal,
  DailyPrompt,
  PromptResponse,
  Streak,
} from '../types';

type LoadingState = 'idle' | 'loading' | 'refreshing' | 'error';

interface HomeState {
  // ── Mood ────────────────────────────────────────────────
  todayMood:       MoodLog | null;
  recentMoods:     MoodLog[];
  moodLoading:     LoadingState;
  moodError:       string | null;

  // ── Journal ─────────────────────────────────────────────
  journalEntries:  JournalEntry[];
  journalLoading:  LoadingState;
  journalError:    string | null;
  journalPage:     number;
  journalHasMore:  boolean;

  // ── Goals ───────────────────────────────────────────────
  goals:           Goal[];
  goalsLoading:    LoadingState;
  goalsError:      string | null;

  // ── Prompt ──────────────────────────────────────────────
  todayPrompt:     DailyPrompt | null;
  promptResponse:  PromptResponse | null;
  promptLoading:   LoadingState;

  // ── Streak ──────────────────────────────────────────────
  streak:          Streak | null;

  // ── Global ──────────────────────────────────────────────
  isInitialised:   boolean;
  lastRefreshed:   number | null; // unix ms

  // ── Sync ────────────────────────────────────────────────
  isSyncing:        boolean;
  syncError:        string | null;
  pendingSyncCount: number;
  lastSyncedAt:     string | null;

  // ── Setters ─────────────────────────────────────────────
  setTodayMood:       (m: MoodLog | null)       => void;
  setRecentMoods:     (m: MoodLog[])            => void;
  setMoodLoading:     (s: LoadingState)         => void;
  setMoodError:       (e: string | null)        => void;

  setJournalEntries:  (e: JournalEntry[])       => void;
  prependJournal:     (e: JournalEntry)         => void;
  updateJournalInList:(e: JournalEntry)         => void;
  removeJournal:      (id: string)              => void;
  setJournalLoading:  (s: LoadingState)         => void;
  setJournalError:    (e: string | null)        => void;
  setJournalPage:     (p: number)               => void;
  setJournalHasMore:  (hm: boolean)             => void;

  setGoals:           (g: Goal[])               => void;
  prependGoal:        (g: Goal)                 => void;
  updateGoalInList:   (g: Goal)                 => void;
  removeGoal:         (id: string)              => void;
  setGoalsLoading:    (s: LoadingState)         => void;
  setGoalsError:      (e: string | null)        => void;

  setTodayPrompt:     (p: DailyPrompt | null)   => void;
  setPromptResponse:  (r: PromptResponse | null) => void;
  setPromptLoading:   (s: LoadingState)         => void;

  setStreak:          (s: Streak)               => void;

  setInitialised:     (v: boolean)              => void;
  setLastRefreshed:   (t: number)               => void;
  setSyncState:       (state: Partial<{ isSyncing: boolean; syncError: string | null; pendingSyncCount: number; lastSyncedAt: string | null }>) => void;
  reset:              ()                        => void;
}

const initial = {
  todayMood:       null,
  recentMoods:     [],
  moodLoading:     'idle' as LoadingState,
  moodError:       null,

  journalEntries:  [],
  journalLoading:  'idle' as LoadingState,
  journalError:    null,
  journalPage:     1,
  journalHasMore:  true,

  goals:           [],
  goalsLoading:    'idle' as LoadingState,
  goalsError:      null,

  todayPrompt:     null,
  promptResponse:  null,
  promptLoading:   'idle' as LoadingState,

  streak:          null,

  isInitialised:   false,
  lastRefreshed:   null,

  isSyncing:        false,
  syncError:        null,
  pendingSyncCount: 0,
  lastSyncedAt:     null,
};

export const useHomeStore = create<HomeState>((set) => ({
  ...initial,

  setTodayMood:       (m)  => set({ todayMood: m }),
  setRecentMoods:     (m)  => set({ recentMoods: m }),
  setMoodLoading:     (s)  => set({ moodLoading: s }),
  setMoodError:       (e)  => set({ moodError: e }),

  setJournalEntries:  (e)  => set({ journalEntries: e }),
  prependJournal:     (e)  => set((s) => ({ journalEntries: [e, ...s.journalEntries] })),
  updateJournalInList:(e)  => set((s) => ({
    journalEntries: s.journalEntries.map((x) => x.id === e.id ? e : x),
  })),
  removeJournal:      (id) => set((s) => ({
    journalEntries: s.journalEntries.filter((x) => x.id !== id),
  })),
  setJournalLoading:  (s)  => set({ journalLoading: s }),
  setJournalError:    (e)  => set({ journalError: e }),
  setJournalPage:     (p)  => set({ journalPage: p }),
  setJournalHasMore:  (hm) => set({ journalHasMore: hm }),

  setGoals:           (g)  => set({ goals: g }),
  prependGoal:        (g)  => set((s) => ({ goals: [g, ...s.goals] })),
  updateGoalInList:   (g)  => set((s) => ({
    goals: s.goals.map((x) => x.id === g.id ? g : x),
  })),
  removeGoal:         (id) => set((s) => ({
    goals: s.goals.filter((x) => x.id !== id),
  })),
  setGoalsLoading:    (s)  => set({ goalsLoading: s }),
  setGoalsError:      (e)  => set({ goalsError: e }),

  setTodayPrompt:     (p)  => set({ todayPrompt: p }),
  setPromptResponse:  (r)  => set({ promptResponse: r }),
  setPromptLoading:   (s)  => set({ promptLoading: s }),

  setStreak:          (s)  => set({ streak: s }),

  setInitialised:     (v)  => set({ isInitialised: v }),
  setLastRefreshed:   (t)  => set({ lastRefreshed: t }),
  setSyncState:       (state) => set((s) => ({ ...s, ...state })),
  reset:              ()   => set({ ...initial }),
}));
