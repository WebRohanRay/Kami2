import { create } from 'zustand';
import { uuid } from '@shared/lib/uuid';
import type { 
  Couple, CoupleInvitation, CoupleJournal, CoupleComment, CoupleReaction, 
  CoupleMemory, CoupleGoal, CoupleLetter, CoupleDailyQuestion, CoupleAnswer, 
  RelationshipEvent, CoupleCandid, CoupleCandidStreak 
} from '../types';

type LoadingState = 'idle' | 'loading' | 'refreshing' | 'error';

export type PartnerActionType = 
  // Letters / Future screen
  | 'writing_letter'       // composing a brand new letter  
  | 'editing_draft'        // editing an existing saved draft
  | 'reading_letter'       // reading an unlocked letter
  | 'viewing_letters'      // browsing the letters list
  // Journal screen
  | 'writing_journal'      // composing a new or editing an existing journal entry
  | 'answering_prompt'     // responding to the daily reflection prompt
  | 'commenting_journal'   // writing a comment on partner's journal entry
  | 'reading_journal'      // browsing the journal feed
  // Memories screen
  | 'writing_memory'       // creating or editing a memory card
  | 'viewing_memory'       // looking at a specific memory detail
  | 'reading_memories'     // browsing the memories timeline
  // Goals screen
  | 'creating_goal'        // composing a brand new goal
  | 'editing_goal'         // editing an existing goal
  | 'viewing_goals'        // browsing the goals list
  // Home screen
  | 'sending_love'         // tapped the love/heart button
  | 'answering_question'   // responding to today's couple daily question
  | 'idle';

interface CoupleState {
  // ── Connection & Meta ───────────────────────────────────
  couple: Couple | null;
  partner: { id: string; nickname: string; email: string; avatarUrl: string | null; lastSeenAt?: string | null; currentMoodEmoji?: string | null; currentMoodLabel?: string | null } | null;
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

  // ── Pagination State ─────────────────────────────────────
  journalsPage: number;
  journalsHasMore: boolean;
  memoriesPage: number;
  memoriesHasMore: boolean;
  goalsPage: number;
  goalsHasMore: boolean;
  lettersPage: number;
  lettersHasMore: boolean;
  candidsPage: number;
  candidsHasMore: boolean;

  // ── Calendar Events ─────────────────────────────────────
  relationshipEvents: RelationshipEvent[];
  eventsLoading: LoadingState;

  // ── Random Candids ───────────────────────────────
  candids: CoupleCandid[];
  unseenCandidCount: number;
  candidsLoading: LoadingState;
  candidStreak: CoupleCandidStreak | null;
  showFirstCandidCeremony: boolean;
  firstCandidImagePath: string | null;

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

  // ── Candid Actions ──────────────────────────────
  setCandids: (c: CoupleCandid[], myUserId: string) => void;
  prependCandid: (c: CoupleCandid, myUserId: string) => void;
  updateCandidInList: (c: CoupleCandid, myUserId: string) => void;
  removeCandidFromList: (id: string, myUserId: string) => void;
  markCandidSeen: (id: string, myUserId: string) => void;
  setCandidsLoading: (s: LoadingState) => void;
  setCandidStreak: (s: CoupleCandidStreak | null) => void;
  triggerFirstCandidCeremony: (imagePath: string) => void;
  dismissFirstCandidCeremony: () => void;

  // ── Setters ─────────────────────────────────────────────
  setCouple: (c: Couple | null) => void;
  setPartner: (p: { id: string; nickname: string; email: string; avatarUrl: string | null; lastSeenAt?: string | null; currentMoodEmoji?: string | null; currentMoodLabel?: string | null } | null) => void;
  setReceivedInvitations: (invites: CoupleInvitation[]) => void;
  setSentInvitations: (invites: CoupleInvitation[]) => void;
  setMetaLoading: (s: LoadingState) => void;
  setMetaError: (e: string | null) => void;

  setCoupleJournals: (j: CoupleJournal[]) => void;
  prependCoupleJournal: (j: CoupleJournal) => void;
  updateCoupleJournalInList: (j: CoupleJournal) => void;
  removeCoupleJournalFromList: (id: string) => void;
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
  updateCoupleLetterInList: (l: CoupleLetter) => void;
  removeCoupleLetterFromList: (id: string) => void;
  setLettersLoading: (s: LoadingState) => void;

  setJournalsPage: (p: number) => void;
  setJournalsHasMore: (hm: boolean) => void;
  setMemoriesPage: (p: number) => void;
  setMemoriesHasMore: (hm: boolean) => void;
  setGoalsPage: (p: number) => void;
  setGoalsHasMore: (hm: boolean) => void;
  setLettersPage: (p: number) => void;
  setLettersHasMore: (hm: boolean) => void;
  setCandidsPage: (p: number) => void;
  setCandidsHasMore: (hm: boolean) => void;

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

  journalsPage: 1,
  journalsHasMore: true,
  memoriesPage: 1,
  memoriesHasMore: true,
  goalsPage: 1,
  goalsHasMore: true,
  lettersPage: 1,
  lettersHasMore: true,
  candidsPage: 1,
  candidsHasMore: true,

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

  candids: [],
  unseenCandidCount: 0,
  candidsLoading: 'idle' as LoadingState,
  candidStreak: null,
  showFirstCandidCeremony: false,
  firstCandidImagePath: null,
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
  removeCoupleJournalFromList: (id) => set((s) => ({
    coupleJournals: s.coupleJournals.filter((x) => x.id !== id),
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
  updateCoupleLetterInList: (l) => set((s) => ({
    coupleLetters: s.coupleLetters.map((x) => x.id === l.id ? l : x),
  })),
  removeCoupleLetterFromList: (id) => set((s) => ({
    coupleLetters: s.coupleLetters.filter((x) => x.id !== id),
  })),
  setLettersLoading: (s) => set({ lettersLoading: s }),

  setJournalsPage: (p) => set({ journalsPage: p }),
  setJournalsHasMore: (hm) => set({ journalsHasMore: hm }),
  setMemoriesPage: (p) => set({ memoriesPage: p }),
  setMemoriesHasMore: (hm) => set({ memoriesHasMore: hm }),
  setGoalsPage: (p) => set({ goalsPage: p }),
  setGoalsHasMore: (hm) => set({ goalsHasMore: hm }),
  setLettersPage: (p) => set({ lettersPage: p }),
  setLettersHasMore: (hm) => set({ lettersHasMore: hm }),
  setCandidsPage: (p) => set({ candidsPage: p }),
  setCandidsHasMore: (hm) => set({ candidsHasMore: hm }),

  setRelationshipEvents: (e) => set({ relationshipEvents: e }),
  prependRelationshipEvent: (e) => set((s) => ({ relationshipEvents: [...s.relationshipEvents, e].sort((a, b) => a.eventDate.localeCompare(b.eventDate)) })),
  setEventsLoading: (s) => set({ eventsLoading: s }),

  setTodayQuestion: (q) => set({ todayQuestion: q }),
  setDailyAnswers: (answers) => set({ dailyAnswers: answers }),
  addDailyAnswer: (answer) => set((s) => ({ dailyAnswers: [...s.dailyAnswers.filter(a => a.userId !== answer.userId), answer] })),
  setQuestionLoading: (s) => set({ questionLoading: s }),

  setToast: (toast) => set({ toast }),

  addHomeAlert: (alert) => set((s) => ({
    homeAlerts: [...s.homeAlerts, { ...alert, id: uuid() }]
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

  // ── Candid Actions ──────────────────────────────
  setCandids: (c, myUserId) => set({
    candids: c,
    unseenCandidCount: c.filter(x => !x.isSeen && x.senderId !== myUserId).length,
  }),
  prependCandid: (c, myUserId) => set((s) => {
    const updated = [c, ...s.candids];
    return {
      candids: updated,
      unseenCandidCount: updated.filter(x => !x.isSeen && x.senderId !== myUserId).length,
    };
  }),
  updateCandidInList: (c, myUserId) => set((s) => {
    const updated = s.candids.map((x) => x.id === c.id ? c : x);
    return {
      candids: updated,
      unseenCandidCount: updated.filter(x => !x.isSeen && x.senderId !== myUserId).length,
    };
  }),
  removeCandidFromList: (id, myUserId) => set((s) => {
    const updated = s.candids.filter((x) => x.id !== id);
    return {
      candids: updated,
      unseenCandidCount: updated.filter(x => !x.isSeen && x.senderId !== myUserId).length,
    };
  }),
  markCandidSeen: (id, myUserId) => set((s) => {
    const updated = s.candids.map((x) =>
      x.id === id ? { ...x, isSeen: true, seenAt: new Date().toISOString() } : x
    );
    return {
      candids: updated,
      unseenCandidCount: updated.filter(x => !x.isSeen && x.senderId !== myUserId).length,
    };
  }),
  setCandidsLoading: (s) => set({ candidsLoading: s }),
  setCandidStreak: (s) => set({ candidStreak: s }),
  triggerFirstCandidCeremony: (imagePath) => set({ showFirstCandidCeremony: true, firstCandidImagePath: imagePath }),
  dismissFirstCandidCeremony: () => set({ showFirstCandidCeremony: false, firstCandidImagePath: null }),

  reset: () => set(initial),
}));
