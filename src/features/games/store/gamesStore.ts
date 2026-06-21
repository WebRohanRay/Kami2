import { create } from 'zustand';
import type { GameSession, GameStats, GameType, TicTacToeCell } from '../types';

type LoadingState = 'idle' | 'loading' | 'refreshing' | 'error';

// ─── Store Interface ──────────────────────────────────────────────────────────

interface GamesState {
  // ── Active Game Session ──────────────────────────────────────
  activeSession: GameSession | null;

  // ── Invitation State ─────────────────────────────────────────
  pendingInvite: GameSession | null;   // incoming invite from partner
  sentInvite: GameSession | null;      // outgoing invite I sent

  // ── Ready Lobby (Presence) ───────────────────────────────────
  myReady: boolean;
  partnerReady: boolean;
  partnerOnScreen: boolean;

  // ── Optimistic Move ──────────────────────────────────────────
  optimisticBoard: TicTacToeCell[] | null;

  // ── Stats ────────────────────────────────────────────────────
  myStats: GameStats | null;
  partnerStats: GameStats | null;

  // ── History ──────────────────────────────────────────────────
  gameHistory: GameSession[];
  historyPage: number;
  historyHasMore: boolean;

  // ── Loading States ───────────────────────────────────────────
  sessionLoading: LoadingState;
  statsLoading: LoadingState;
  historyLoading: LoadingState;

  // ── Toast ────────────────────────────────────────────────────
  toast: { title: string; message: string; icon: string } | null;

  // ── Setters ──────────────────────────────────────────────────
  setActiveSession: (s: GameSession | null) => void;
  updateActiveSession: (partial: Partial<GameSession>) => void;
  setPendingInvite: (s: GameSession | null) => void;
  setSentInvite: (s: GameSession | null) => void;
  setMyReady: (r: boolean) => void;
  setPartnerReady: (r: boolean) => void;
  setPartnerOnScreen: (v: boolean) => void;
  setOptimisticBoard: (b: TicTacToeCell[] | null) => void;
  setMyStats: (s: GameStats | null) => void;
  setPartnerStats: (s: GameStats | null) => void;
  setGameHistory: (h: GameSession[]) => void;
  appendGameHistory: (h: GameSession[]) => void;
  setHistoryPage: (p: number) => void;
  setHistoryHasMore: (hm: boolean) => void;
  setSessionLoading: (s: LoadingState) => void;
  setStatsLoading: (s: LoadingState) => void;
  setHistoryLoading: (s: LoadingState) => void;
  setToast: (t: { title: string; message: string; icon: string } | null) => void;

  // ── Reset ────────────────────────────────────────────────────
  reset: () => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState = {
  activeSession: null as GameSession | null,
  pendingInvite: null as GameSession | null,
  sentInvite: null as GameSession | null,
  myReady: false,
  partnerReady: false,
  partnerOnScreen: false,
  optimisticBoard: null as TicTacToeCell[] | null,
  myStats: null as GameStats | null,
  partnerStats: null as GameStats | null,
  gameHistory: [] as GameSession[],
  historyPage: 1,
  historyHasMore: true,
  sessionLoading: 'idle' as LoadingState,
  statsLoading: 'idle' as LoadingState,
  historyLoading: 'idle' as LoadingState,
  toast: null as { title: string; message: string; icon: string } | null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGamesStore = create<GamesState>((set) => ({
  ...initialState,

  setActiveSession: (s) => set({ activeSession: s, optimisticBoard: null }),
  updateActiveSession: (partial) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, ...partial }
        : null,
      optimisticBoard: null,
    })),
  setPendingInvite: (s) => set({ pendingInvite: s }),
  setSentInvite: (s) => set({ sentInvite: s }),
  setMyReady: (r) => set({ myReady: r }),
  setPartnerReady: (r) => set({ partnerReady: r }),
  setPartnerOnScreen: (v) => set({ partnerOnScreen: v }),
  setOptimisticBoard: (b) => set({ optimisticBoard: b }),
  setMyStats: (s) => set({ myStats: s }),
  setPartnerStats: (s) => set({ partnerStats: s }),
  setGameHistory: (h) => set({ gameHistory: h }),
  appendGameHistory: (h) =>
    set((state) => ({ gameHistory: [...state.gameHistory, ...h] })),
  setHistoryPage: (p) => set({ historyPage: p }),
  setHistoryHasMore: (hm) => set({ historyHasMore: hm }),
  setSessionLoading: (s) => set({ sessionLoading: s }),
  setStatsLoading: (s) => set({ statsLoading: s }),
  setHistoryLoading: (s) => set({ historyLoading: s }),
  setToast: (t) => set({ toast: t }),

  reset: () => set(initialState),
}));
