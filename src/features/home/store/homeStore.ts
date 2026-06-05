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
  reset:              ()                        => void;
}

const initial: Omit<HomeState, keyof Omit<HomeState, keyof {
  todayMood: null; recentMoods: []; moodLoading: 'idle'; moodError: null;
  journalEntries: []; journalLoading: 'idle'; journalError: null;
  goals: []; goalsLoading: 'idle'; goalsError: null;
  todayPrompt: null; promptResponse: null; promptLoading: 'idle';
  streak: null; isInitialised: false; lastRefreshed: null;
}>> = {
  todayMood:       null,
  recentMoods:     [],
  moodLoading:     'idle',
  moodError:       null,

  journalEntries:  [],
  journalLoading:  'idle',
  journalError:    null,

  goals:           [],
  goalsLoading:    'idle',
  goalsError:      null,

  todayPrompt:     null,
  promptResponse:  null,
  promptLoading:   'idle',

  streak:          null,

  isInitialised:   false,
  lastRefreshed:   null,
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
  reset:              ()   => set({ ...initial }),
}));
