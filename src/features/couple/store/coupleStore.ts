import { create } from 'zustand';
import type { 
  Couple, CoupleInvitation, CoupleJournal, CoupleComment, CoupleReaction, 
  CoupleMemory, CoupleGoal, CoupleLetter, CoupleDailyQuestion, CoupleAnswer, 
  RelationshipEvent 
} from '../types';

type LoadingState = 'idle' | 'loading' | 'refreshing' | 'error';

export type PartnerActionType = 
  | 'writing_letter' 
  | 'reading_memories' 
  | 'creating_goal' 
  | 'reading_letter' 
  | 'writing_journal' 
  | 'sending_love' 
  | 'writing_memory' 
  | 'viewing_memory' 
  | 'reading_journal'
  | 'viewing_goals'
  | 'viewing_letters'
  | 'idle';

interface CoupleState {
  // ── Connection & Meta ───────────────────────────────────
  couple: Couple | null;
  partner: { id: string; nickname: string; email: string; avatarUrl: string | null; lastSeenAt?: string | null } | null;
  receivedInvitations: CoupleInvitation[];
  sentInvitations: CoupleInvitation[];
  metaLoading: LoadingState;
  metaError: string | null;

  // ── Shared Journals ─────────────────────────────────────
  coupleJournals: CoupleJournal[];
  journalsLoading: LoadingState;
  journalsError: string | null;

  // ── Shared Memories ─────────────────────────────────────
  coupleMemories: CoupleMemory[];
  memoriesLoading: LoadingState;

  // ── Shared Goals ────────────────────────────────────────
  coupleGoals: CoupleGoal[];
  goalsLoading: LoadingState;

  // ── Sealed Letters ──────────────────────────────────────
  coupleLetters: CoupleLetter[];
  lettersLoading: LoadingState;

  // ── Calendar Events ─────────────────────────────────────
  relationshipEvents: RelationshipEvent[];
  eventsLoading: LoadingState;

  // ── Daily Question & Answers ────────────────────────────
  todayQuestion: CoupleDailyQuestion | null;
  dailyAnswers: CoupleAnswer[];
  questionLoading: LoadingState;

  // ── Toast Notification ──────────────────────────────────
  toast: { title: string; message: string; icon: string; targetScreen?: string } | null;

  // ── Home Alerts ─────────────────────────────────────────
  homeAlerts: { id: string; type: 'letter' | 'goal' | 'memory' | 'reaction' | 'completed_goal'; title: string; message: string; targetScreen: string }[];
  addHomeAlert: (alert: { type: 'letter' | 'goal' | 'memory' | 'reaction' | 'completed_goal'; title: string; message: string; targetScreen: string }) => void;
  removeHomeAlert: (id: string) => void;

  // ── Partner Real-time Activity Presence Status ─────────
  partnerAction: PartnerActionType;
  setPartnerAction: (action: PartnerActionType) => void;
  myActiveAction: PartnerActionType;
  setMyActiveAction: (action: PartnerActionType) => void;
  clearMyActiveAction: (action: PartnerActionType) => boolean;
  realtimeChannel: any | null;
  setRealtimeChannel: (ch: any | null) => void;

  // ── Setters ─────────────────────────────────────────────
  setCouple: (c: Couple | null) => void;
  setPartner: (p: { id: string; nickname: string; email: string; avatarUrl: string | null; lastSeenAt?: string | null } | null) => void;
  setReceivedInvitations: (invites: CoupleInvitation[]) => void;
  setSentInvitations: (invites: CoupleInvitation[]) => void;
  setMetaLoading: (s: LoadingState) => void;
  setMetaError: (e: string | null) => void;

  setCoupleJournals: (j: CoupleJournal[]) => void;
  prependCoupleJournal: (j: CoupleJournal) => void;
  updateCoupleJournalInList: (j: CoupleJournal) => void;
  setJournalsLoading: (s: LoadingState) => void;
  setJournalsError: (e: string | null) => void;

  setCoupleMemories: (m: CoupleMemory[]) => void;
  prependCoupleMemory: (m: CoupleMemory) => void;
  updateCoupleMemoryInList: (m: CoupleMemory) => void;
  removeCoupleMemoryFromList: (id: string) => void;
  setMemoriesLoading: (s: LoadingState) => void;

  setCoupleGoals: (g: CoupleGoal[]) => void;
  prependCoupleGoal: (g: CoupleGoal) => void;
  updateCoupleGoalInList: (g: CoupleGoal) => void;
  removeCoupleGoalFromList: (id: string) => void;
  setGoalsLoading: (s: LoadingState) => void;

  setCoupleLetters: (l: CoupleLetter[]) => void;
  prependCoupleLetter: (l: CoupleLetter) => void;
  removeCoupleLetterFromList: (id: string) => void;
  setLettersLoading: (s: LoadingState) => void;

  setRelationshipEvents: (e: RelationshipEvent[]) => void;
  prependRelationshipEvent: (e: RelationshipEvent) => void;
  setEventsLoading: (s: LoadingState) => void;

  setTodayQuestion: (q: CoupleDailyQuestion | null) => void;
  setDailyAnswers: (answers: CoupleAnswer[]) => void;
  addDailyAnswer: (answer: CoupleAnswer) => void;
  setQuestionLoading: (s: LoadingState) => void;

  setToast: (toast: { title: string; message: string; icon: string; targetScreen?: string } | null) => void;

  reset: () => void;
}

const initial = {
  couple: null,
  partner: null,
  receivedInvitations: [],
  sentInvitations: [],
  metaLoading: 'idle' as LoadingState,
  metaError: null,

  coupleJournals: [],
  journalsLoading: 'idle' as LoadingState,
  journalsError: null,

  coupleMemories: [],
  memoriesLoading: 'idle' as LoadingState,

  coupleGoals: [],
  goalsLoading: 'idle' as LoadingState,

  coupleLetters: [],
  lettersLoading: 'idle' as LoadingState,

  relationshipEvents: [],
  eventsLoading: 'idle' as LoadingState,

  todayQuestion: null,
  dailyAnswers: [],
  questionLoading: 'idle' as LoadingState,

  toast: null,
  homeAlerts: [],
  partnerAction: 'idle' as PartnerActionType,
  myActiveAction: 'idle' as PartnerActionType,
  realtimeChannel: null,
};

export const useCoupleStore = create<CoupleState>((set) => ({
  ...initial,

  setCouple: (c) => set({ couple: c }),
  setPartner: (p) => set({ partner: p }),
  setReceivedInvitations: (invites) => set({ receivedInvitations: invites }),
  setSentInvitations: (invites) => set({ sentInvitations: invites }),
  setMetaLoading: (s) => set({ metaLoading: s }),
  setMetaError: (e) => set({ metaError: e }),

  setCoupleJournals: (j) => set({ coupleJournals: j }),
  prependCoupleJournal: (j) => set((s) => ({ coupleJournals: [j, ...s.coupleJournals] })),
  updateCoupleJournalInList: (j) => set((s) => ({
    coupleJournals: s.coupleJournals.map((x) => x.id === j.id ? j : x),
  })),
  setJournalsLoading: (s) => set({ journalsLoading: s }),
  setJournalsError: (e) => set({ journalsError: e }),

  setCoupleMemories: (m) => set({ coupleMemories: m }),
  prependCoupleMemory: (m) => set((s) => ({ coupleMemories: [m, ...s.coupleMemories] })),
  updateCoupleMemoryInList: (m) => set((s) => ({
    coupleMemories: s.coupleMemories.map((x) => x.id === m.id ? m : x),
  })),
  removeCoupleMemoryFromList: (id) => set((s) => ({
    coupleMemories: s.coupleMemories.filter((x) => x.id !== id),
  })),
  setMemoriesLoading: (s) => set({ memoriesLoading: s }),

  setCoupleGoals: (g) => set({ coupleGoals: g }),
  prependCoupleGoal: (g) => set((s) => ({ coupleGoals: [g, ...s.coupleGoals] })),
  updateCoupleGoalInList: (g) => set((s) => ({
    coupleGoals: s.coupleGoals.map((x) => x.id === g.id ? g : x),
  })),
  removeCoupleGoalFromList: (id) => set((s) => ({
    coupleGoals: s.coupleGoals.filter((x) => x.id !== id),
  })),
  setGoalsLoading: (s) => set({ goalsLoading: s }),

  setCoupleLetters: (l) => set({ coupleLetters: l }),
  prependCoupleLetter: (l) => set((s) => ({ coupleLetters: [l, ...s.coupleLetters] })),
  removeCoupleLetterFromList: (id) => set((s) => ({
    coupleLetters: s.coupleLetters.filter((x) => x.id !== id),
  })),
  setLettersLoading: (s) => set({ lettersLoading: s }),

  setRelationshipEvents: (e) => set({ relationshipEvents: e }),
  prependRelationshipEvent: (e) => set((s) => ({ relationshipEvents: [...s.relationshipEvents, e].sort((a, b) => a.eventDate.localeCompare(b.eventDate)) })),
  setEventsLoading: (s) => set({ eventsLoading: s }),

  setTodayQuestion: (q) => set({ todayQuestion: q }),
  setDailyAnswers: (answers) => set({ dailyAnswers: answers }),
  addDailyAnswer: (answer) => set((s) => ({ dailyAnswers: [...s.dailyAnswers.filter(a => a.userId !== answer.userId), answer] })),
  setQuestionLoading: (s) => set({ questionLoading: s }),

  setToast: (toast) => set({ toast }),

  addHomeAlert: (alert) => set((s) => ({
    homeAlerts: [...s.homeAlerts, { ...alert, id: Math.random().toString(36).substring(7) }]
  })),
  removeHomeAlert: (id) => set((s) => ({
    homeAlerts: s.homeAlerts.filter((x) => x.id !== id)
  })),
  setPartnerAction: (action) => set({ partnerAction: action }),
  setMyActiveAction: (action) => set({ myActiveAction: action }),
  clearMyActiveAction: (action) => {
    let changed = false;
    set((s) => {
      if (s.myActiveAction === action) {
        changed = true;
        return { myActiveAction: 'idle' };
      }
      return {};
    });
    return changed;
  },
  setRealtimeChannel: (ch) => set({ realtimeChannel: ch }),

  reset: () => set(initial),
}));
