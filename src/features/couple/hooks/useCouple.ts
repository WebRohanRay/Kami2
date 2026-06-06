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
    const qRes = await coupleService.fetchTodayDailyQuestion();
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

  const loadJournals = useCallback(async () => {
    const s = store.getState();
    if (!s.couple) return;
    s.setJournalsLoading('loading');
    const r = await coupleService.fetchCoupleJournals(s.couple.id);
    if (r.success) s.setCoupleJournals(r.data);
    else s.setJournalsError(r.error);
    s.setJournalsLoading('idle');
  }, []);

  const loadGoals = useCallback(async () => {
    const s = store.getState();
    if (!s.couple) return;
    s.setGoalsLoading('loading');
    const r = await coupleService.fetchCoupleGoals(s.couple.id);
    if (r.success) s.setCoupleGoals(r.data);
    s.setGoalsLoading('idle');
  }, []);

  const loadMemories = useCallback(async () => {
    const s = store.getState();
    if (!s.couple) return;
    s.setMemoriesLoading('loading');
    const r = await coupleService.fetchCoupleMemories(s.couple.id);
    if (r.success) s.setCoupleMemories(r.data);
    s.setMemoriesLoading('idle');
  }, []);

  const loadLetters = useCallback(async () => {
    const s = store.getState();
    if (!s.couple) return;
    s.setLettersLoading('loading');
    const r = await coupleService.fetchCoupleLetters(s.couple.id);
    if (r.success) s.setCoupleLetters(r.data);
    s.setLettersLoading('idle');
  }, []);

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
      const qRes = await coupleService.fetchTodayDailyQuestion();
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

      if (jRes.success) store.getState().setCoupleJournals(jRes.data);
      if (gRes.success) store.getState().setCoupleGoals(gRes.data);
      if (mRes.success) store.getState().setCoupleMemories(mRes.data);
      if (lRes.success) store.getState().setCoupleLetters(lRes.data);
      if (eRes.success) store.getState().setRelationshipEvents(eRes.data);
    }
  }, [loadCoupleMeta]);

  return {
    loadAll,
    loadCoupleMeta,
    loadDailyQuestion,
    loadJournals,
    loadGoals,
    loadMemories,
    loadLetters,
    loadEvents,
    submitAnswer: async (qId: string, cId: string, response: string) => {
      const r = await coupleService.submitDailyAnswer(qId, cId, response);
      if (r.success) {
        store.getState().addDailyAnswer(r.data);
      }
      return r;
    },
    addJournal: async (cId: string, body: string, title?: string, tags: string[] = [], imageUrls: string[] = []) => {
      const r = await coupleService.createCoupleJournal(cId, body, title, tags, imageUrls);
      if (r.success) {
        store.getState().prependCoupleJournal(r.data);
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
    addMemory: async (cId: string, title: string, description?: string, imageUrls: string[] = [], memoryDate?: string, tags: string[] = []) => {
      const r = await coupleService.createCoupleMemory(cId, title, description, imageUrls, memoryDate, tags);
      if (r.success) {
        store.getState().prependCoupleMemory(r.data);
      }
      return r;
    },
    updateMemory: async (memoryId: string, title: string, description?: string, imageUrls: string[] = [], memoryDate?: string, tags: string[] = []) => {
      const r = await coupleService.updateCoupleMemory(memoryId, title, description, imageUrls, memoryDate, tags);
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
    addLetter: async (cId: string, subject: string, body: string, deliverAt: string, imageUrls: string[] = [], isDraft: boolean = false) => {
      const r = await coupleService.createCoupleLetter(cId, subject, body, deliverAt, imageUrls, isDraft);
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
