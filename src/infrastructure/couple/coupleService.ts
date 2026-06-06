import { supabase } from '@shared/lib/supabase';
import { resolveSignedUrls, deleteImages } from '@shared/lib/storage';
import type { Result } from '@features/home/types';
import type { 
  Couple, CoupleInvitation, CoupleJournal, CoupleComment, CoupleReaction, 
  CoupleMemory, CoupleGoal, CoupleLetter, CoupleDailyQuestion, CoupleAnswer, 
  RelationshipEvent 
} from '@features/couple/types';

function friendly(raw: string): string {
  if (raw.includes('JWT') || raw.includes('not authenticated'))
    return 'Your session expired. Please sign in again.';
  if (raw.includes('network') || raw.includes('fetch'))
    return 'No connection. Please check your internet.';
  if (raw.includes('unique_user'))
    return 'This user is already connected to another Couple Space.';
  return 'Something went wrong. Please try again.';
}

function err(e: unknown): string {
  if (e instanceof Error) return friendly(e.message);
  if (typeof e === 'string') return friendly(e);
  return 'Something went wrong.';
}

// ─── PARTNER INVITATIONS ─────────────────────────────────────────────────────

/** Search for a partner by their unique short ID (KAMI-XXXXXX) */
export async function searchPartnerByShortId(shortId: string): Promise<Result<{ id: string; nickname: string; email: string; avatarUrl: string | null }>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, email, avatar_url')
      .eq('kami_id', shortId.trim().toUpperCase())
      .maybeSingle();

    if (error) return { success: false, error: friendly(error.message) };
    if (!data) return { success: false, error: 'No user found with that ID.' };
    return {
      success: true,
      data: {
        id: data.id,
        nickname: data.nickname || '',
        email: data.email || '',
        avatarUrl: data.avatar_url,
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Send invitation to create a shared couple space */
export async function sendCoupleInvitation(receiverId: string): Promise<Result<CoupleInvitation>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('couple_invitations')
      .insert({
        sender_id: userRes.user.id,
        receiver_id: receiverId,
        status: 'pending'
      })
      .select('*, profiles!couple_invitations_receiver_id_fkey(nickname, email)')
      .single();

    if (error) {
      if (error.code === '23505') return { success: false, error: 'An invitation is already pending between you two.' };
      return { success: false, error: friendly(error.message) };
    }

    return {
      success: true,
      data: {
        id: data.id,
        senderId: data.sender_id,
        receiverId: data.receiver_id,
        status: data.status,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        senderNickname: data.profiles?.nickname,
        senderEmail: data.profiles?.email
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch invitations received by the current user */
export async function fetchReceivedInvitations(): Promise<Result<CoupleInvitation[]>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('couple_invitations')
      .select('*, profiles!couple_invitations_sender_id_fkey(nickname, email)')
      .eq('receiver_id', userRes.user.id)
      .eq('status', 'pending');

    if (error) return { success: false, error: friendly(error.message) };

    const list = (data ?? []).map(r => ({
      id: r.id,
      senderId: r.sender_id,
      receiverId: r.receiver_id,
      status: r.status as any,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      senderNickname: r.profiles?.nickname || 'Partner',
      senderEmail: r.profiles?.email || '',
    }));

    return { success: true, data: list };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch invitations sent by the current user */
export async function fetchSentInvitations(): Promise<Result<CoupleInvitation[]>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('couple_invitations')
      .select('*, profiles!couple_invitations_receiver_id_fkey(nickname, email)')
      .eq('sender_id', userRes.user.id)
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: friendly(error.message) };

    const list = (data ?? []).map(r => ({
      id: r.id,
      senderId: r.sender_id,
      receiverId: r.receiver_id,
      status: r.status as any,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      receiverNickname: r.profiles?.nickname || 'Partner',
      receiverEmail: r.profiles?.email || '',
    }));

    return { success: true, data: list };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Decline or cancel a couple invitation */
export async function updateInvitationStatus(invitationId: string, status: 'declined' | 'accepted'): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('couple_invitations')
      .update({ status })
      .eq('id', invitationId);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Permanently delete an invitation */
export async function deleteInvitation(invitationId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('couple_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Accept an invitation and create a Couple Space */
export async function acceptInvitation(
  invitationId: string, 
  senderId: string, 
  receiverId: string, 
  myNickname: string, 
  senderNickname: string
): Promise<Result<string>> {
  try {
    const coupleName = `${senderNickname} & ${myNickname}`;
    const { data: couple, error: cErr } = await supabase
      .from('couples')
      .insert({ name: coupleName })
      .select('id')
      .single();

    if (cErr || !couple) return { success: false, error: cErr?.message || 'Failed to create couple.' };

    const { error: mErr } = await supabase
      .from('couple_members')
      .insert([
        { couple_id: couple.id, user_id: senderId },
        { couple_id: couple.id, user_id: receiverId }
      ]);

    if (mErr) {
      await supabase.from('couples').delete().eq('id', couple.id);
      if (mErr.code === '23505') return { success: false, error: 'One of the partners is already connected to a Couple Space.' };
      return { success: false, error: mErr.message };
    }

    await supabase
      .from('couple_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitationId);

    return { success: true, data: couple.id };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── COUPLE CORE METADATA ────────────────────────────────────────────────────

/** Fetch active couple connection details */
export async function fetchActiveCouple(): Promise<Result<{ couple: Couple | null; partner: { id: string; nickname: string; email: string; avatarUrl: string | null; lastSeenAt?: string | null } | null }>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data: memberData, error: mErr } = await supabase
      .from('couple_members')
      .select('couple_id, couples(*)')
      .eq('user_id', userRes.user.id)
      .maybeSingle();

    if (mErr) return { success: false, error: friendly(mErr.message) };
    if (!memberData) return { success: true, data: { couple: null, partner: null } };

    const cRow = memberData.couples as any;
    const coupleObj: Couple = {
      id: cRow.id,
      name: cRow.name,
      anniversaryDate: cRow.anniversary_date,
      pendingDeletion: cRow.pending_deletion,
      deleteAt: cRow.delete_at,
      createdAt: cRow.created_at,
      updatedAt: cRow.updated_at
    };

    // Get partner info
    const { data: partnerMember, error: pErr } = await supabase
      .from('couple_members')
      .select('user_id, profiles(id, nickname, email, avatar_url, last_seen_at)')
      .eq('couple_id', coupleObj.id)
      .neq('user_id', userRes.user.id)
      .maybeSingle();

    let partnerObj = null;
    if (partnerMember && partnerMember.profiles) {
      const p = partnerMember.profiles as any;
      partnerObj = {
        id: p.id,
        nickname: p.nickname || 'Partner',
        email: p.email || '',
        avatarUrl: p.avatar_url,
        lastSeenAt: p.last_seen_at,
      };
    }

    return {
      success: true,
      data: {
        couple: coupleObj,
        partner: partnerObj
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update Couple metadata (anniversary date, custom name) */
export async function updateCoupleDetails(coupleId: string, name: string, anniversaryDate: string | null): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('couples')
      .update({
        name: name.trim() || undefined,
        anniversary_date: anniversaryDate || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', coupleId);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Initiate deletion countdown (7-day recovery period) */
export async function scheduleCoupleDeletion(coupleId: string): Promise<Result<string>> {
  try {
    const deleteAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const { error } = await supabase
      .from('couples')
      .update({
        pending_deletion: true,
        delete_at: deleteAt
      })
      .eq('id', coupleId);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: deleteAt };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Restore/Cancel Couple deletion */
export async function cancelCoupleDeletion(coupleId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('couples')
      .update({
        pending_deletion: false,
        delete_at: null
      })
      .eq('id', coupleId);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── DAILY QUESTIONS ─────────────────────────────────────────────────────────

const DEFAULT_POOL = [
  "What is something your partner did recently that made you smile?",
  "What is a favorite memory you have of our first month together?",
  "What is one goal you want us to accomplish together this year?",
  "If we could travel anywhere next weekend, where would we go?",
  "What is something you appreciate about how your partner handles stress?",
  "What is a song that always makes you think of your partner?",
  "What is one small thing we can do to make tonight feel like a date night?",
  "What is a dream or project you'd love for us to build together?",
];

/** Fetch today's couple reflection question (creates/seeds one if missing) */
export async function fetchTodayDailyQuestion(): Promise<Result<CoupleDailyQuestion>> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('couple_daily_questions')
      .select('*')
      .eq('active_date', todayStr)
      .maybeSingle();

    if (data) {
      return { success: true, data: { id: data.id, content: data.content, activeDate: data.active_date } };
    }

    // Seed a question for today
    const dayIndex = new Date().getDate() % DEFAULT_POOL.length;
    const content = DEFAULT_POOL[dayIndex];

    const { data: seeded, error: sErr } = await supabase
      .from('couple_daily_questions')
      .insert({ content, active_date: todayStr })
      .select('*')
      .single();

    if (sErr || !seeded) {
      // If another partner already inserted it in parallel, try fetching again
      const { data: retryData } = await supabase
        .from('couple_daily_questions')
        .select('*')
        .eq('active_date', todayStr)
        .single();
      if (retryData) {
        return { success: true, data: { id: retryData.id, content: retryData.content, activeDate: retryData.active_date } };
      }
      return { success: false, error: sErr?.message || 'Failed to seed question.' };
    }

    return { success: true, data: { id: seeded.id, content: seeded.content, activeDate: seeded.active_date } };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch answers for a daily question in a couple space */
export async function fetchQuestionAnswers(questionId: string, coupleId: string): Promise<Result<CoupleAnswer[]>> {
  try {
    const { data, error } = await supabase
      .from('couple_answers')
      .select('*, profiles(nickname)')
      .eq('question_id', questionId)
      .eq('couple_id', coupleId);

    if (error) return { success: false, error: friendly(error.message) };

    const mapped = (data ?? []).map(r => ({
      id: r.id,
      questionId: r.question_id,
      coupleId: r.couple_id,
      userId: r.user_id,
      response: r.response,
      createdAt: r.created_at,
      userNickname: r.profiles?.nickname || 'Partner',
    }));

    return { success: true, data: mapped };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Answer today's daily question */
export async function submitDailyAnswer(questionId: string, coupleId: string, response: string): Promise<Result<CoupleAnswer>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('couple_answers')
      .insert({
        question_id: questionId,
        couple_id: coupleId,
        user_id: userRes.user.id,
        response: response.trim()
      })
      .select('*, profiles(nickname)')
      .single();

    if (error) return { success: false, error: friendly(error.message) };

    return {
      success: true,
      data: {
        id: data.id,
        questionId: data.question_id,
        coupleId: data.couple_id,
        userId: data.user_id,
        response: data.response,
        createdAt: data.created_at,
        userNickname: data.profiles?.nickname || 'You'
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── RELATIONSHIP JOURNAL ────────────────────────────────────────────────────

/** Fetch shared couple journals */
export async function fetchCoupleJournals(coupleId: string): Promise<Result<CoupleJournal[]>> {
  try {
    const { data, error } = await supabase
      .from('couple_journals')
      .select('*, couple_journal_comments(*, profiles(nickname, avatar_url)), couple_journal_reactions(*), profiles(nickname, avatar_url)')
      .eq('couple_id', coupleId)
      .order('entry_date', { ascending: false });

    if (error) return { success: false, error: friendly(error.message) };

    const mapped: CoupleJournal[] = [];
    for (const r of data ?? []) {
      const resolvedImgs = await resolveSignedUrls('journal_images', r.image_urls || []);
      mapped.push({
        id: r.id,
        coupleId: r.couple_id,
        userId: r.user_id,
        title: r.title,
        body: r.body,
        moodId: r.mood_id,
        imageUrls: resolvedImgs,
        tags: r.tags || [],
        entryDate: r.entry_date,
        isPinned: r.is_pinned,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        userNickname: r.profiles?.nickname || 'Partner',
        userAvatarUrl: r.profiles?.avatar_url,
        comments: (r.couple_journal_comments ?? []).map((c: any) => ({
          id: c.id,
          entryId: c.entry_id,
          userId: c.user_id,
          body: c.body,
          createdAt: c.created_at,
          userNickname: c.profiles?.nickname || 'Partner',
          userAvatarUrl: c.profiles?.avatar_url
        })),
        reactions: (r.couple_journal_reactions ?? []).map((rx: any) => ({
          entryId: rx.entry_id,
          userId: rx.user_id,
          emoji: rx.emoji
        }))
      });
    }

    return { success: true, data: mapped };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Create a new couple journal entry */
export async function createCoupleJournal(
  coupleId: string, 
  body: string, 
  title?: string, 
  tags: string[] = [], 
  imageUrls: string[] = []
): Promise<Result<CoupleJournal>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('couple_journals')
      .insert({
        couple_id: coupleId,
        user_id: userRes.user.id,
        body: body.trim(),
        title: title?.trim() || null,
        tags,
        image_urls: imageUrls
      })
      .select('*, profiles(nickname, avatar_url)')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return {
      success: true,
      data: {
        id: data.id,
        coupleId: data.couple_id,
        userId: data.user_id,
        title: data.title,
        body: data.body,
        moodId: data.mood_id,
        imageUrls: data.image_urls || [],
        tags: data.tags || [],
        entryDate: data.entry_date,
        isPinned: data.is_pinned,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userNickname: data.profiles?.nickname || 'You',
        userAvatarUrl: data.profiles?.avatar_url,
        comments: [],
        reactions: []
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Add a comment on a couple journal entry */
export async function createCoupleComment(entryId: string, body: string): Promise<Result<CoupleComment>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('couple_journal_comments')
      .insert({
        entry_id: entryId,
        user_id: userRes.user.id,
        body: body.trim()
      })
      .select('*, profiles(nickname, avatar_url)')
      .single();

    if (error) return { success: false, error: friendly(error.message) };

    return {
      success: true,
      data: {
        id: data.id,
        entryId: data.entry_id,
        userId: data.user_id,
        body: data.body,
        createdAt: data.created_at,
        userNickname: data.profiles?.nickname || 'You',
        userAvatarUrl: data.profiles?.avatar_url
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Toggle emoji reaction on a shared journal entry */
export async function toggleCoupleReaction(entryId: string, emoji: string): Promise<Result<boolean>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data: existing } = await supabase
      .from('couple_journal_reactions')
      .select('emoji')
      .eq('entry_id', entryId)
      .eq('user_id', userRes.user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      // Remove it
      await supabase
        .from('couple_journal_reactions')
        .delete()
        .eq('entry_id', entryId)
        .eq('user_id', userRes.user.id)
        .eq('emoji', emoji);
      return { success: true, data: false }; // unreacted
    } else {
      // Add it
      await supabase
        .from('couple_journal_reactions')
        .insert({
          entry_id: entryId,
          user_id: userRes.user.id,
          emoji
        });
      return { success: true, data: true }; // reacted
    }
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── RELATIONSHIP MEMORIES ───────────────────────────────────────────────────

/** Fetch shared memory timeline */
export async function fetchCoupleMemories(coupleId: string): Promise<Result<CoupleMemory[]>> {
  try {
    const { data, error } = await supabase
      .from('couple_memories')
      .select('*')
      .eq('couple_id', coupleId)
      .order('memory_date', { ascending: false });

    if (error) return { success: false, error: friendly(error.message) };

    const mapped: CoupleMemory[] = [];
    for (const r of data ?? []) {
      const resolved = await resolveSignedUrls('memory_images', r.image_urls || []);
      mapped.push({
        id: r.id,
        coupleId: r.couple_id,
        title: r.title,
        description: r.description,
        imageUrls: resolved,
        memoryDate: r.memory_date,
        tags: r.tags || [],
        createdAt: r.created_at
      });
    }

    return { success: true, data: mapped };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Create a memory card */
export async function createCoupleMemory(
  coupleId: string, 
  title: string, 
  description?: string, 
  imageUrls: string[] = [], 
  memoryDate: string = new Date().toISOString().split('T')[0], 
  tags: string[] = []
): Promise<Result<CoupleMemory>> {
  try {
    const { data, error } = await supabase
      .from('couple_memories')
      .insert({
        couple_id: coupleId,
        title: title.trim(),
        description: description?.trim() || null,
        image_urls: imageUrls,
        memory_date: memoryDate,
        tags
      })
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return {
      success: true,
      data: {
        id: data.id,
        coupleId: data.couple_id,
        title: data.title,
        description: data.description,
        imageUrls: data.image_urls || [],
        memoryDate: data.memory_date,
        tags: data.tags || [],
        createdAt: data.created_at
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update a couple memory */
export async function updateCoupleMemory(
  memoryId: string, 
  title: string, 
  description?: string, 
  imageUrls: string[] = [], 
  memoryDate?: string, 
  tags: string[] = []
): Promise<Result<CoupleMemory>> {
  try {
    const { data, error } = await supabase
      .from('couple_memories')
      .update({
        title: title.trim(),
        description: description?.trim() || null,
        image_urls: imageUrls,
        memory_date: memoryDate,
        tags
      })
      .eq('id', memoryId)
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return {
      success: true,
      data: {
        id: data.id,
        coupleId: data.couple_id,
        title: data.title,
        description: data.description,
        imageUrls: data.image_urls || [],
        memoryDate: data.memory_date,
        tags: data.tags || [],
        createdAt: data.created_at
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a couple memory */
export async function deleteCoupleMemory(memoryId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('couple_memories')
      .delete()
      .eq('id', memoryId);
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── RELATIONSHIP GOALS ───────────────────────────────────────────────────────

/** Fetch active shared goals */
export async function fetchCoupleGoals(coupleId: string): Promise<Result<CoupleGoal[]>> {
  try {
    const { data, error } = await supabase
      .from('couple_goals')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: friendly(error.message) };

    const list = (data ?? []).map(r => ({
      id: r.id,
      coupleId: r.couple_id,
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status as any,
      progress: r.progress,
      targetDate: r.target_date,
      completedAt: r.completed_at,
      emoji: r.emoji,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return { success: true, data: list };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Create a shared goal */
export async function createCoupleGoal(
  coupleId: string, 
  title: string, 
  description?: string, 
  emoji: string = '🌱', 
  category: string = 'relationship'
): Promise<Result<CoupleGoal>> {
  try {
    const { data, error } = await supabase
      .from('couple_goals')
      .insert({
        couple_id: coupleId,
        title: title.trim(),
        description: description?.trim() || null,
        emoji,
        category
      })
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };

    return {
      success: true,
      data: {
        id: data.id,
        coupleId: data.couple_id,
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status as any,
        progress: data.progress,
        targetDate: data.target_date,
        completedAt: data.completed_at,
        emoji: data.emoji,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update shared goal progress */
export async function updateCoupleGoalProgress(goalId: string, progress: number): Promise<Result<void>> {
  try {
    const status = progress >= 100 ? 'completed' : 'active';
    const completedAt = progress >= 100 ? new Date().toISOString() : null;

    const { error } = await supabase
      .from('couple_goals')
      .update({
        progress,
        status,
        completed_at: completedAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', goalId);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update couple goal fields (e.g. title, description, category, status, emoji, targetDate) */
export async function updateCoupleGoal(
  goalId: string, 
  fields: { 
    title?: string; 
    description?: string | null; 
    category?: string; 
    status?: 'active' | 'completed' | 'paused' | 'abandoned'; 
    emoji?: string; 
    targetDate?: string | null;
    progress?: number;
  }
): Promise<Result<CoupleGoal>> {
  try {
    const updatePayload: any = {};
    if (fields.title !== undefined) updatePayload.title = fields.title.trim();
    if (fields.description !== undefined) updatePayload.description = fields.description?.trim() || null;
    if (fields.category !== undefined) updatePayload.category = fields.category;
    if (fields.status !== undefined) {
      updatePayload.status = fields.status;
      if (fields.status === 'completed') {
        updatePayload.completed_at = new Date().toISOString();
        updatePayload.progress = 100;
      } else {
        updatePayload.completed_at = null;
      }
    }
    if (fields.emoji !== undefined) updatePayload.emoji = fields.emoji;
    if (fields.targetDate !== undefined) updatePayload.target_date = fields.targetDate || null;
    if (fields.progress !== undefined) {
      updatePayload.progress = fields.progress;
      if (fields.progress >= 100) {
        updatePayload.status = 'completed';
        updatePayload.completed_at = new Date().toISOString();
      } else {
        updatePayload.status = 'active';
        updatePayload.completed_at = null;
      }
    }
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('couple_goals')
      .update(updatePayload)
      .eq('id', goalId)
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return {
      success: true,
      data: {
        id: data.id,
        coupleId: data.couple_id,
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status as any,
        progress: data.progress,
        targetDate: data.target_date,
        completedAt: data.completed_at,
        emoji: data.emoji,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a couple goal */
export async function deleteCoupleGoal(goalId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('couple_goals')
      .delete()
      .eq('id', goalId);
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── RELATIONSHIP LETTERS ─────────────────────────────────────────────────────

/** Fetch sealed couple letters list */
export async function fetchCoupleLetters(coupleId: string): Promise<Result<CoupleLetter[]>> {
  try {
    const { data, error } = await supabase
      .from('couple_letters')
      .select('id, couple_id, sender_id, subject, deliver_at, created_at')
      .eq('couple_id', coupleId)
      .order('deliver_at', { ascending: true });

    if (error) return { success: false, error: friendly(error.message) };

    const mapped = (data ?? []).map(r => {
      const unlockTime = new Date(r.deliver_at).getTime();
      return {
        id: r.id,
        coupleId: r.couple_id,
        senderId: r.sender_id,
        subject: r.subject,
        deliverAt: r.deliver_at,
        isUnlocked: Date.now() >= unlockTime,
        createdAt: r.created_at
      };
    });

    return { success: true, data: mapped };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Create a couple capsule letter */
export async function createCoupleLetter(
  coupleId: string, 
  subject: string, 
  body: string, 
  deliverAt: string, 
  imageUrls: string[] = []
): Promise<Result<CoupleLetter>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('couple_letters')
      .insert({
        couple_id: coupleId,
        sender_id: userRes.user.id,
        subject: subject.trim(),
        body: body.trim(),
        deliver_at: deliverAt,
        image_urls: imageUrls
      })
      .select('id, couple_id, sender_id, subject, deliver_at, created_at')
      .single();

    if (error) return { success: false, error: friendly(error.message) };

    return {
      success: true,
      data: {
        id: data.id,
        coupleId: data.couple_id,
        senderId: data.sender_id,
        subject: data.subject,
        deliverAt: data.deliver_at,
        isUnlocked: false,
        createdAt: data.created_at
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Open/Read unlocked couple letter */
export async function fetchCoupleLetterDetails(letterId: string): Promise<Result<{ body: string; imageUrls: string[] }>> {
  try {
    const { data, error } = await supabase
      .from('couple_letters')
      .select('body, image_urls')
      .eq('id', letterId)
      .single();

    if (error) return { success: false, error: 'Could not open letter. It is still sealed.' };

    const resolvedUrls = await resolveSignedUrls('letter_images', data.image_urls || []);
    return {
      success: true,
      data: {
        body: data.body,
        imageUrls: resolvedUrls
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Delete a couple letter */
export async function deleteCoupleLetter(letterId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('couple_letters')
      .delete()
      .eq('id', letterId);
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── SHARED CALENDAR ──────────────────────────────────────────────────────────

/** Fetch upcoming relationship calendar events */
export async function fetchRelationshipEvents(coupleId: string): Promise<Result<RelationshipEvent[]>> {
  try {
    const { data, error } = await supabase
      .from('relationship_events')
      .select('*')
      .eq('couple_id', coupleId)
      .order('event_date', { ascending: true });

    if (error) return { success: false, error: friendly(error.message) };

    const list = (data ?? []).map(r => ({
      id: r.id,
      coupleId: r.couple_id,
      title: r.title,
      description: r.description,
      eventDate: r.event_date,
      eventType: r.event_type as any,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return { success: true, data: list };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Create a calendar event */
export async function createRelationshipEvent(
  coupleId: string, 
  title: string, 
  description: string | undefined, 
  eventDate: string, 
  eventType: 'anniversary' | 'birthday' | 'date_night' | 'trip' | 'other'
): Promise<Result<RelationshipEvent>> {
  try {
    const { data, error } = await supabase
      .from('relationship_events')
      .insert({
        couple_id: coupleId,
        title: title.trim(),
        description: description?.trim() || null,
        event_date: eventDate,
        event_type: eventType
      })
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };

    return {
      success: true,
      data: {
        id: data.id,
        coupleId: data.couple_id,
        title: data.title,
        description: data.description,
        eventDate: data.event_date,
        eventType: data.event_type as any,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}
