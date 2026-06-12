import { useCallback } from 'react';
import { useCoupleStore } from '../store/coupleStore';
import * as coupleService from '@infrastructure/couple/coupleService';
import { useAuthStore } from '@features/auth';

export function useCouple() {
  const user = useAuthStore(s => s.user);
  const store = useCoupleStore;

  const loadCoupleMeta = useCallback(async () => {
    const s = store.getState();
    s.setMetaLoading('loading');
    const r = await coupleService.fetchActiveCouple();
    if (r.success) {
      s.setCouple(r.data.couple);
      s.setPartner(r.data.partner);
    } else {
      s.setMetaError(r.error);
    }
    s.setMetaLoading('idle');
    return r;
  }, []);

  const loadDailyQuestion = useCallback(async () => {
    const s = store.getState();
    s.setQuestionLoading('loading');
    const qRes = await coupleService.fetchTodayDailyQuestion(user?.timezone);
    if (qRes.success) {
      s.setTodayQuestion(qRes.data);
      const currentCouple = store.getState().couple;
      if (currentCouple) {
        const aRes = await coupleService.fetchQuestionAnswers(qRes.data.id, currentCouple.id);
        if (aRes.success) {
          s.setDailyAnswers(aRes.data);
        }
      }
    }
    s.setQuestionLoading('idle');
  }, []);

  const loadJournals = useCallback(async (page = 1) => {
    const s = store.getState();
    if (!s.couple) return;
    s.setJournalsLoading('loading');
    const r = await coupleService.fetchCoupleJournals(s.couple.id, 20, page);
    if (r.success) {
      if (page === 1) {
        s.setCoupleJournals(r.data);
      } else {
        s.setCoupleJournals([...s.coupleJournals, ...r.data]);
      }
      s.setJournalsPage(page);
      s.setJournalsHasMore(r.data.length === 20);
    } else {
      s.setJournalsError(r.error);
    }
    s.setJournalsLoading('idle');
  }, []);

  const loadMoreJournals = useCallback(async () => {
    const s = store.getState();
    if (s.journalsLoading === 'loading' || !s.journalsHasMore) return;
    await loadJournals(s.journalsPage + 1);
  }, [loadJournals]);

  const loadGoals = useCallback(async (page = 1) => {
    const s = store.getState();
    if (!s.couple) return;
    s.setGoalsLoading('loading');
    const r = await coupleService.fetchCoupleGoals(s.couple.id, 20, page);
    if (r.success) {
      if (page === 1) {
        s.setCoupleGoals(r.data);
      } else {
        s.setCoupleGoals([...s.coupleGoals, ...r.data]);
      }
      s.setGoalsPage(page);
      s.setGoalsHasMore(r.data.length === 20);
    }
    s.setGoalsLoading('idle');
  }, []);

  const loadMoreGoals = useCallback(async () => {
    const s = store.getState();
    if (s.goalsLoading === 'loading' || !s.goalsHasMore) return;
    await loadGoals(s.goalsPage + 1);
  }, [loadGoals]);

  const loadMemories = useCallback(async (page = 1) => {
    const s = store.getState();
    if (!s.couple) return;
    s.setMemoriesLoading('loading');
    const r = await coupleService.fetchCoupleMemories(s.couple.id, 15, page);
    if (r.success) {
      if (page === 1) {
        s.setCoupleMemories(r.data);
      } else {
        s.setCoupleMemories([...s.coupleMemories, ...r.data]);
      }
      s.setMemoriesPage(page);
      s.setMemoriesHasMore(r.data.length === 15);
    }
    s.setMemoriesLoading('idle');
  }, []);

  const loadMoreMemories = useCallback(async () => {
    const s = store.getState();
    if (s.memoriesLoading === 'loading' || !s.memoriesHasMore) return;
    await loadMemories(s.memoriesPage + 1);
  }, [loadMemories]);

  const loadLetters = useCallback(async (page = 1) => {
    const s = store.getState();
    if (!s.couple) return;
    s.setLettersLoading('loading');
    const r = await coupleService.fetchCoupleLetters(s.couple.id, 20, page);
    if (r.success) {
      if (page === 1) {
        s.setCoupleLetters(r.data);
      } else {
        s.setCoupleLetters([...s.coupleLetters, ...r.data]);
      }
      s.setLettersPage(page);
      s.setLettersHasMore(r.data.length === 20);
    }
    s.setLettersLoading('idle');
  }, []);

  const loadMoreLetters = useCallback(async () => {
    const s = store.getState();
    if (s.lettersLoading === 'loading' || !s.lettersHasMore) return;
    await loadLetters(s.lettersPage + 1);
  }, [loadLetters]);

  const loadEvents = useCallback(async () => {
    const s = store.getState();
    if (!s.couple) return;
    s.setEventsLoading('loading');
    const r = await coupleService.fetchRelationshipEvents(s.couple.id);
    if (r.success) s.setRelationshipEvents(r.data);
    s.setEventsLoading('idle');
  }, []);

  const loadAll = useCallback(async () => {
    const metaRes = await loadCoupleMeta();
    if (metaRes.success && metaRes.data.couple) {
      const cId = metaRes.data.couple.id;
      // Load other tables using couple ID
      const qRes = await coupleService.fetchTodayDailyQuestion(user?.timezone);
      if (qRes.success) {
        store.getState().setTodayQuestion(qRes.data);
        const aRes = await coupleService.fetchQuestionAnswers(qRes.data.id, cId);
        if (aRes.success) store.getState().setDailyAnswers(aRes.data);
      }
      
      const [jRes, gRes, mRes, lRes, eRes] = await Promise.all([
        coupleService.fetchCoupleJournals(cId),
        coupleService.fetchCoupleGoals(cId),
        coupleService.fetchCoupleMemories(cId),
        coupleService.fetchCoupleLetters(cId),
        coupleService.fetchRelationshipEvents(cId)
      ]);

      if (jRes.success) {
        store.getState().setCoupleJournals(jRes.data);
        store.getState().setJournalsPage(1);
        store.getState().setJournalsHasMore(jRes.data.length === 20);
      }
      if (gRes.success) {
        store.getState().setCoupleGoals(gRes.data);
        store.getState().setGoalsPage(1);
        store.getState().setGoalsHasMore(gRes.data.length === 20);
      }
      if (mRes.success) {
        store.getState().setCoupleMemories(mRes.data);
        store.getState().setMemoriesPage(1);
        store.getState().setMemoriesHasMore(mRes.data.length === 15);
      }
      if (lRes.success) {
        store.getState().setCoupleLetters(lRes.data);
        store.getState().setLettersPage(1);
        store.getState().setLettersHasMore(lRes.data.length === 20);
      }
      if (eRes.success) store.getState().setRelationshipEvents(eRes.data);
    }
  }, [loadCoupleMeta]);

  return {
    loadAll,
    loadCoupleMeta,
    loadDailyQuestion,
    loadJournals,
    loadMoreJournals,
    loadGoals,
    loadMoreGoals,
    loadMemories,
    loadMoreMemories,
    loadLetters,
    loadMoreLetters,
    loadEvents,
    submitAnswer: async (qId: string, cId: string, response: string) => {
      const r = await coupleService.submitDailyAnswer(qId, cId, response);
      if (r.success) {
        store.getState().addDailyAnswer(r.data);
      }
      return r;
    },
    addJournal: async (cId: string, body: string, title?: string, tags: string[] = [], imageUrls: string[] = [], moodId?: string | null) => {
      const r = await coupleService.createCoupleJournal(cId, body, title, tags, imageUrls, moodId);
      if (r.success) {
        store.getState().prependCoupleJournal(r.data);
      }
      return r;
    },
    updateJournal: async (entryId: string, body: string, title?: string, tags: string[] = [], imageUrls: string[] = [], moodId?: string | null) => {
      const r = await coupleService.updateCoupleJournal(entryId, body, title, tags, imageUrls, moodId);
      if (r.success) {
        store.getState().updateCoupleJournalInList(r.data);
      }
      return r;
    },
    deleteJournal: async (entryId: string) => {
      const r = await coupleService.deleteCoupleJournal(entryId);
      if (r.success) {
        store.getState().removeCoupleJournalFromList(entryId);
      }
      return r;
    },
    addComment: async (entryId: string, body: string) => {
      const r = await coupleService.createCoupleComment(entryId, body);
      if (r.success) {
        await loadJournals();
      }
      return r;
    },
    toggleReaction: async (entryId: string, emoji: string) => {
      const r = await coupleService.toggleCoupleReaction(entryId, emoji);
      if (r.success) {
        await loadJournals();
      }
      return r;
    },
    addGoal: async (cId: string, title: string, description?: string, emoji?: string) => {
      const r = await coupleService.createCoupleGoal(cId, title, description, emoji);
      if (r.success) {
        store.getState().prependCoupleGoal(r.data);
      }
      return r;
    },
    updateGoalProgress: async (goalId: string, progress: number) => {
      const r = await coupleService.updateCoupleGoalProgress(goalId, progress);
      if (r.success) {
        await loadGoals();
      }
      return r;
    },
    updateGoal: async (goalId: string, fields: any) => {
      const r = await coupleService.updateCoupleGoal(goalId, fields);
      if (r.success) {
        store.getState().updateCoupleGoalInList(r.data);
      }
      return r;
    },
    deleteGoal: async (goalId: string) => {
      const r = await coupleService.deleteCoupleGoal(goalId);
      if (r.success) {
        store.getState().removeCoupleGoalFromList(goalId);
      }
      return r;
    },
    addMemory: async (
      cId: string, 
      title: string, 
      description?: string, 
      imageUrls: string[] = [], 
      memoryDate?: string, 
      tags: string[] = [],
      location?: string,
      mood?: string,
      memoryTime?: string
    ) => {
      const r = await coupleService.createCoupleMemory(cId, title, description, imageUrls, memoryDate, tags, location, mood, memoryTime);
      if (r.success) {
        store.getState().prependCoupleMemory(r.data);
      }
      return r;
    },
    updateMemory: async (
      memoryId: string, 
      title: string, 
      description?: string, 
      imageUrls: string[] = [], 
      memoryDate?: string, 
      tags: string[] = [],
      location?: string,
      mood?: string,
      memoryTime?: string
    ) => {
      const r = await coupleService.updateCoupleMemory(memoryId, title, description, imageUrls, memoryDate, tags, location, mood, memoryTime);
      if (r.success) {
        store.getState().updateCoupleMemoryInList(r.data);
      }
      return r;
    },
    deleteMemory: async (memoryId: string) => {
      const r = await coupleService.deleteCoupleMemory(memoryId);
      if (r.success) {
        store.getState().removeCoupleMemoryFromList(memoryId);
      }
      return r;
    },
    addLetter: async (cId: string, subject: string, body: string, deliverAt: string, imageUrls: string[] = [], isDraft: boolean = false, parentLetterId?: string) => {
      const r = await coupleService.createCoupleLetter(cId, subject, body, deliverAt, imageUrls, isDraft, parentLetterId);
      if (r.success) {
        store.getState().prependCoupleLetter(r.data);
      }
      return r;
    },
    updateLetter: async (letterId: string, fields: any) => {
      const r = await coupleService.updateCoupleLetter(letterId, fields);
      if (r.success) {
        await loadLetters();
      }
      return r;
    },
    toggleLetterReaction: async (letterId: string, emoji: string) => {
      const r = await coupleService.toggleCoupleLetterReaction(letterId, emoji);
      if (r.success) {
        await loadLetters();
      }
      return r;
    },
    toggleLetterArchive: async (letterId: string, currentVal: boolean) => {
      const r = await coupleService.toggleCoupleLetterArchive(letterId, currentVal);
      if (r.success) {
        await loadLetters();
      }
      return r;
    },
    deleteLetter: async (letterId: string) => {
      const r = await coupleService.deleteCoupleLetter(letterId);
      if (r.success) {
        store.getState().removeCoupleLetterFromList(letterId);
      }
      return r;
    },
    addEvent: async (cId: string, title: string, description: string | undefined, eventDate: string, eventType: any) => {
      const r = await coupleService.createRelationshipEvent(cId, title, description, eventDate, eventType);
      if (r.success) {
        store.getState().prependRelationshipEvent(r.data);
      }
      return r;
    }
  };
}
export default useCouple;
