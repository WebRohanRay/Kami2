import { useCallback } from 'react';
import { useCoupleStore } from '../store/coupleStore';
import * as coupleService from '@infrastructure/couple/coupleService';
import { useAuthStore } from '@features/auth';
import { 
  coupleLetterRepo, 
  coupleJournalRepo, 
  coupleMemoryRepo, 
  coupleGoalRepo, 
  coupleCommentRepo 
} from '@shared/db/repo';
import { enqueueMutation, processSyncQueue } from '@shared/db/sync';
import { uuid } from '@shared/lib/uuid';
import type { Result } from '@shared/types/result';

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

    try {
      const local = await coupleJournalRepo.fetchJournals(s.couple.id, page, 20);
      const currentUser = useAuthStore.getState().user;
      const partner = s.partner;

      const mapped = await Promise.all(local.map(async (entry) => {
        const comments = await coupleCommentRepo.fetchCommentsForEntry(entry.id);
        const commentsMapped = comments.map(c => ({
          id: c.id,
          entryId: c.entryId,
          userId: c.userId,
          body: c.body,
          createdAt: c.createdAt,
          userNickname: c.userId === currentUser?.id ? (currentUser?.nickname || 'You') : (partner?.nickname || 'Partner'),
          userAvatarUrl: c.userId === currentUser?.id ? currentUser?.avatarUrl : partner?.avatarUrl,
        }));

        return {
          id: entry.id,
          coupleId: entry.coupleId,
          userId: entry.userId,
          title: entry.title,
          body: entry.body,
          moodId: entry.moodId,
          imageUrls: entry.imageUrls,
          tags: entry.tags,
          entryDate: entry.entryDate,
          isPinned: !!entry.isPinned,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          comments: commentsMapped,
          reactions: [], // reactions fetched online or realtime
          userNickname: entry.userId === currentUser?.id ? (currentUser?.nickname || 'You') : (partner?.nickname || 'Partner'),
          userAvatarUrl: entry.userId === currentUser?.id ? currentUser?.avatarUrl : partner?.avatarUrl,
        };
      }));

      if (page === 1) {
        s.setCoupleJournals(mapped as any);
      } else {
        s.setCoupleJournals([...s.coupleJournals, ...mapped] as any);
      }
      s.setJournalsPage(page);
      s.setJournalsHasMore(local.length === 20);
    } catch (err) {
      s.setJournalsError(err instanceof Error ? err.message : String(err));
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

    try {
      const local = await coupleGoalRepo.fetchGoals(s.couple.id, page, 20);
      const mapped = local.map((g) => ({
        id: g.id,
        coupleId: g.coupleId,
        title: g.title,
        description: g.description,
        category: g.category,
        status: g.status as any,
        progress: g.progress,
        targetDate: g.targetDate,
        completedAt: g.completedAt,
        emoji: g.emoji,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      }));

      if (page === 1) {
        s.setCoupleGoals(mapped);
      } else {
        s.setCoupleGoals([...s.coupleGoals, ...mapped]);
      }
      s.setGoalsPage(page);
      s.setGoalsHasMore(local.length === 20);
    } catch (err) {
      console.error('[loadGoals] Failed:', err);
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

    try {
      const local = await coupleMemoryRepo.fetchMemories(s.couple.id, page, 15);
      const currentUser = useAuthStore.getState().user;
      const partner = s.partner;

      const mapped = local.map((m) => ({
        id: m.id,
        coupleId: m.coupleId,
        title: m.title,
        description: m.description,
        imageUrls: m.imageUrls,
        memoryDate: m.memoryDate,
        tags: m.tags,
        createdAt: m.createdAt,
        location: m.location,
        mood: m.mood,
        memoryTime: m.memoryTime,
        lastEditedBy: m.lastEditedBy,
        lastEditedNickname: m.lastEditedBy === currentUser?.id ? (currentUser?.nickname || 'You') : (partner?.nickname || 'Partner'),
      }));

      if (page === 1) {
        s.setCoupleMemories(mapped);
      } else {
        s.setCoupleMemories([...s.coupleMemories, ...mapped]);
      }
      s.setMemoriesPage(page);
      s.setMemoriesHasMore(local.length === 15);
    } catch (err) {
      console.error('[loadMemories] Failed:', err);
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

    try {
      const local = await coupleLetterRepo.fetchLetters(s.couple.id, page, 20);
      const currentUser = useAuthStore.getState().user;
      const partner = s.partner;

      const mapped = local.map((l) => ({
        id: l.id,
        coupleId: l.coupleId,
        senderId: l.senderId,
        subject: l.subject,
        deliverAt: l.deliverAt,
        isUnlocked: new Date(l.deliverAt).getTime() <= Date.now(),
        createdAt: l.createdAt,
        body: l.body,
        imageUrls: l.imageUrls,
        senderNickname: l.senderId === currentUser?.id ? (currentUser?.nickname || 'You') : (partner?.nickname || 'Partner'),
        isRead: !!l.isRead,
        isFavorite: !!l.isFavorite,
        isDraft: !!l.isDraft,
        isArchived: !!l.isArchived,
        parentLetterId: l.parentLetterId,
        updatedAt: l.updatedAt,
      }));

      if (page === 1) {
        s.setCoupleLetters(mapped);
      } else {
        s.setCoupleLetters([...s.coupleLetters, ...mapped]);
      }
      s.setLettersPage(page);
      s.setLettersHasMore(local.length === 20);
    } catch (err) {
      console.error('[loadLetters] Failed:', err);
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
      // Load daily question and answers (online)
      const qRes = await coupleService.fetchTodayDailyQuestion(user?.timezone);
      if (qRes.success) {
        store.getState().setTodayQuestion(qRes.data);
        const aRes = await coupleService.fetchQuestionAnswers(qRes.data.id, cId);
        if (aRes.success) store.getState().setDailyAnswers(aRes.data);
      }
      
      // Load SQLite components & relationship events in parallel
      await Promise.all([
        loadJournals(1),
        loadGoals(1),
        loadMemories(1),
        loadLetters(1),
        loadEvents(),
      ]);
    }
  }, [loadCoupleMeta, loadEvents, loadJournals, loadGoals, loadMemories, loadLetters]);

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
    submitAnswer: async (qId: string, cId: string, response: string): Promise<Result<any>> => {
      const r = await coupleService.submitDailyAnswer(qId, cId, response);
      if (r.success) {
        store.getState().addDailyAnswer(r.data);
      }
      return r;
    },
    addJournal: async (cId: string, body: string, title?: string, tags: string[] = [], imageUrls: string[] = [], moodId?: string | null): Promise<Result<any>> => {
      const entryId = uuid();
      const now = new Date().toISOString();
      const localEntry = {
        id: entryId,
        coupleId: cId,
        userId: user?.id || '',
        title: title || null,
        body,
        moodId: moodId || null,
        tags,
        imageUrls,
        entryDate: now.split('T')[0],
        isPinned: 0,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending_insert' as const,
      };

      await coupleJournalRepo.saveJournal(localEntry);
      await enqueueMutation('couple_journals', entryId, 'insert', localEntry);

      const currentUser = useAuthStore.getState().user;
      const storeEntry = {
        ...localEntry,
        isPinned: false,
        comments: [],
        reactions: [],
        userNickname: currentUser?.nickname || 'You',
        userAvatarUrl: currentUser?.avatarUrl || undefined,
      };
      store.getState().prependCoupleJournal(storeEntry as any);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: storeEntry as any };
    },
    updateJournal: async (entryId: string, body: string, title?: string, tags: string[] = [], imageUrls: string[] = [], moodId?: string | null): Promise<Result<any>> => {
      const journal = await coupleJournalRepo.fetchJournalById(entryId);
      if (!journal) return { success: false, error: 'Journal entry not found' };

      const now = new Date().toISOString();
      const updated = {
        ...journal,
        body,
        title: title || null,
        tags,
        imageUrls,
        moodId: moodId || null,
        updatedAt: now,
        syncStatus: 'pending_update' as const,
      };

      await coupleJournalRepo.saveJournal(updated);
      await enqueueMutation('couple_journals', entryId, 'update', updated);

      const currentUser = useAuthStore.getState().user;
      const storeEntry = {
        ...updated,
        isPinned: !!updated.isPinned,
        userNickname: currentUser?.nickname || 'You',
        userAvatarUrl: currentUser?.avatarUrl || undefined,
      };
      store.getState().updateCoupleJournalInList(storeEntry as any);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: storeEntry as any };
    },
    deleteJournal: async (entryId: string): Promise<Result<void>> => {
      const now = new Date().toISOString();
      await coupleJournalRepo.softDeleteJournal(entryId, now);
      await enqueueMutation('couple_journals', entryId, 'delete', { id: entryId });
      store.getState().removeCoupleJournalFromList(entryId);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: undefined };
    },
    addComment: async (entryId: string, body: string): Promise<Result<any>> => {
      const commentId = uuid();
      const now = new Date().toISOString();
      const localComment = {
        id: commentId,
        entryId,
        userId: user?.id || '',
        body,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending_insert' as const,
      };

      await coupleCommentRepo.saveComment(localComment);
      await enqueueMutation('couple_comments', commentId, 'insert', localComment);

      const currentUser = useAuthStore.getState().user;
      const commentObj = {
        id: commentId,
        entryId,
        userId: localComment.userId,
        body,
        createdAt: now,
        userNickname: currentUser?.nickname || 'You',
        userAvatarUrl: currentUser?.avatarUrl || undefined,
      };

      // Find entry in store to append comment
      const timeline = store.getState().coupleJournals;
      const entry = timeline.find(t => t.id === entryId);
      if (entry) {
        const comments = [...(entry.comments || []), commentObj];
        store.getState().updateCoupleJournalInList({ ...entry, comments });
      }

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: commentObj as any };
    },
    toggleReaction: async (entryId: string, emoji: string): Promise<Result<any>> => {
      const r = await coupleService.toggleCoupleReaction(entryId, emoji);
      if (r.success) {
        await loadJournals();
      }
      return r;
    },
    addGoal: async (cId: string, title: string, description?: string, emoji?: string): Promise<Result<any>> => {
      const goalId = uuid();
      const now = new Date().toISOString();
      const localGoal = {
        id: goalId,
        coupleId: cId,
        title,
        description: description ?? null,
        category: 'relationship',
        status: 'active' as const,
        progress: 0,
        targetDate: null,
        completedAt: null,
        emoji: emoji || '🌱',
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending_insert' as const,
      };

      await coupleGoalRepo.saveGoal(localGoal);
      await enqueueMutation('couple_goals', goalId, 'insert', localGoal);
      store.getState().prependCoupleGoal(localGoal as any);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: localGoal as any };
    },
    updateGoalProgress: async (goalId: string, progress: number): Promise<Result<any>> => {
      const goal = await coupleGoalRepo.fetchGoalById(goalId);
      if (!goal) return { success: false, error: 'Goal not found' };

      const now = new Date().toISOString();
      const updated = {
        ...goal,
        progress,
        status: progress >= 100 ? ('completed' as const) : (goal.status as any),
        completedAt: progress >= 100 ? now : null,
        updatedAt: now,
        syncStatus: 'pending_update' as const,
      };

      await coupleGoalRepo.saveGoal(updated);
      await enqueueMutation('couple_goals', goalId, 'update', updated);
      await loadGoals();

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: updated as any };
    },
    updateGoal: async (goalId: string, fields: any): Promise<Result<any>> => {
      const goal = await coupleGoalRepo.fetchGoalById(goalId);
      if (!goal) return { success: false, error: 'Goal not found' };

      const now = new Date().toISOString();
      const updated = {
        ...goal,
        ...fields,
        updatedAt: now,
        syncStatus: 'pending_update' as const,
      };

      await coupleGoalRepo.saveGoal(updated);
      await enqueueMutation('couple_goals', goalId, 'update', updated);
      await loadGoals();

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: updated as any };
    },
    deleteGoal: async (goalId: string): Promise<Result<void>> => {
      const now = new Date().toISOString();
      await coupleGoalRepo.softDeleteGoal(goalId, now);
      await enqueueMutation('couple_goals', goalId, 'delete', { id: goalId });
      store.getState().removeCoupleGoalFromList(goalId);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: undefined };
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
    ): Promise<Result<any>> => {
      const memoryId = uuid();
      const now = new Date().toISOString();
      const localMemory = {
        id: memoryId,
        coupleId: cId,
        title,
        description: description ?? null,
        imageUrls,
        memoryDate: memoryDate || now.split('T')[0],
        tags,
        lastEditedBy: user?.id || null,
        location: location ?? null,
        mood: mood ?? null,
        memoryTime: memoryTime ?? null,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending_insert' as const,
      };

      await coupleMemoryRepo.saveMemory(localMemory);
      await enqueueMutation('couple_memories', memoryId, 'insert', localMemory);

      const currentUser = useAuthStore.getState().user;
      const storeMemory = {
        ...localMemory,
        lastEditedNickname: currentUser?.nickname || 'You',
      };
      store.getState().prependCoupleMemory(storeMemory as any);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: storeMemory as any };
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
    ): Promise<Result<any>> => {
      const memory = await coupleMemoryRepo.fetchMemoryById(memoryId);
      if (!memory) return { success: false, error: 'Memory not found' };

      const now = new Date().toISOString();
      const updated = {
        ...memory,
        title,
        description: description ?? null,
        imageUrls,
        memoryDate: memoryDate || memory.memoryDate,
        tags,
        location: location ?? null,
        mood: mood ?? null,
        memoryTime: memoryTime ?? null,
        lastEditedBy: user?.id || null,
        updatedAt: now,
        syncStatus: 'pending_update' as const,
      };

      await coupleMemoryRepo.saveMemory(updated);
      await enqueueMutation('couple_memories', memoryId, 'update', updated);

      const currentUser = useAuthStore.getState().user;
      const storeMemory = {
        ...updated,
        lastEditedNickname: currentUser?.nickname || 'You',
      };
      store.getState().updateCoupleMemoryInList(storeMemory as any);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: storeMemory as any };
    },
    deleteMemory: async (memoryId: string): Promise<Result<void>> => {
      const now = new Date().toISOString();
      await coupleMemoryRepo.softDeleteMemory(memoryId, now);
      await enqueueMutation('couple_memories', memoryId, 'delete', { id: memoryId });
      store.getState().removeCoupleMemoryFromList(memoryId);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: undefined };
    },
    addLetter: async (cId: string, subject: string, body: string, deliverAt: string, imageUrls: string[] = [], isDraft: boolean = false, parentLetterId?: string): Promise<Result<any>> => {
      const letterId = uuid();
      const now = new Date().toISOString();
      const localLetter = {
        id: letterId,
        coupleId: cId,
        senderId: user?.id || '',
        subject,
        body,
        deliverAt,
        imageUrls,
        isRead: 0,
        isFavorite: 0,
        isDraft: isDraft ? 1 : 0,
        isArchived: 0,
        parentLetterId: parentLetterId || null,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending_insert' as const,
      };

      await coupleLetterRepo.saveLetter(localLetter);
      await enqueueMutation('couple_letters', letterId, 'insert', localLetter);

      const currentUser = useAuthStore.getState().user;
      const storeLetter = {
        ...localLetter,
        isRead: false,
        isFavorite: false,
        isDraft: !!localLetter.isDraft,
        isArchived: false,
        isUnlocked: new Date(deliverAt).getTime() <= Date.now(),
        senderNickname: currentUser?.nickname || 'You',
      };
      store.getState().prependCoupleLetter(storeLetter as any);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: storeLetter as any };
    },
    updateLetter: async (letterId: string, fields: any): Promise<Result<any>> => {
      const letter = await coupleLetterRepo.fetchLetterById(letterId);
      if (!letter) return { success: false, error: 'Letter not found' };

      const now = new Date().toISOString();
      const updated = {
        ...letter,
        ...fields,
        updatedAt: now,
        syncStatus: 'pending_update' as const,
      };

      await coupleLetterRepo.saveLetter(updated);
      await enqueueMutation('couple_letters', letterId, 'update', updated);
      await loadLetters();

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: updated as any };
    },
    toggleLetterReaction: async (letterId: string, emoji: string): Promise<Result<any>> => {
      const r = await coupleService.toggleCoupleLetterReaction(letterId, emoji);
      if (r.success) {
        await loadLetters();
      }
      return r;
    },
    toggleLetterArchive: async (letterId: string, currentVal: boolean): Promise<Result<void>> => {
      const letter = await coupleLetterRepo.fetchLetterById(letterId);
      if (!letter) return { success: false, error: 'Letter not found' };

      const now = new Date().toISOString();
      const updated = {
        ...letter,
        isArchived: !currentVal,
        updatedAt: now,
        syncStatus: 'pending_update' as const,
      };

      await coupleLetterRepo.saveLetter(updated);
      await enqueueMutation('couple_letters', letterId, 'update', updated);
      await loadLetters();

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: undefined };
    },
    deleteLetter: async (letterId: string): Promise<Result<void>> => {
      const now = new Date().toISOString();
      await coupleLetterRepo.softDeleteLetter(letterId, now);
      await enqueueMutation('couple_letters', letterId, 'delete', { id: letterId });
      store.getState().removeCoupleLetterFromList(letterId);

      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
      return { success: true, data: undefined };
    },
    addEvent: async (cId: string, title: string, description: string | undefined, eventDate: string, eventType: any): Promise<Result<any>> => {
      const r = await coupleService.createRelationshipEvent(cId, title, description, eventDate, eventType);
      if (r.success) {
        store.getState().prependRelationshipEvent(r.data);
      }
      return r;
    }
  };
}
export default useCouple;
