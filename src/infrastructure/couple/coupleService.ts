import { supabase } from '@shared/lib/supabase';
import { resolveSignedUrls, deleteImages } from '@shared/lib/storage';
import type { Result } from '@features/home/types';
import { resolveAvatarUrl } from '../profile';
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
    const resolvedAvatar = await resolveAvatarUrl(data.avatar_url);
    return {
      success: true,
      data: {
        id: data.id,
        nickname: data.nickname || '',
        email: data.email || '',
        avatarUrl: resolvedAvatar,
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
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { error } = await supabase
      .from('couple_invitations')
      .update({ status })
      .eq('id', invitationId)
      .or(`sender_id.eq.${userRes.user.id},receiver_id.eq.${userRes.user.id}`);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Permanently delete an invitation */
export async function deleteInvitation(invitationId: string): Promise<Result<void>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { error } = await supabase
      .from('couple_invitations')
      .delete()
      .eq('id', invitationId)
      .or(`sender_id.eq.${userRes.user.id},receiver_id.eq.${userRes.user.id}`);

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
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    // Verify current user is receiver
    if (userRes.user.id !== receiverId) {
      return { success: false, error: 'You are not the receiver of this invitation.' };
    }

    const coupleName = `${senderNickname} & ${myNickname}`;
    const { data, error } = await supabase
      .rpc('accept_couple_invitation', {
        p_invitation_id: invitationId,
        p_couple_name: coupleName
      });

    if (error || !data) return { success: false, error: friendly(error?.message ?? 'Failed to accept invitation.') };
    return { success: true, data };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── COUPLE CORE METADATA ────────────────────────────────────────────────────

/** Fetch active couple connection details */
export async function fetchActiveCouple(): Promise<Result<{ couple: Couple | null; partner: { id: string; nickname: string; email: string; avatarUrl: string | null; lastSeenAt?: string | null; currentMoodEmoji?: string | null; currentMoodLabel?: string | null } | null }>> {
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
      .select('user_id, profiles(id, nickname, email, avatar_url, last_seen_at, current_mood_emoji, current_mood_label)')
      .eq('couple_id', coupleObj.id)
      .neq('user_id', userRes.user.id)
      .maybeSingle();

    let partnerObj = null;
    if (partnerMember && partnerMember.profiles) {
      const p = partnerMember.profiles as any;
      const resolvedAvatar = await resolveAvatarUrl(p.avatar_url);
      partnerObj = {
        id: p.id,
        nickname: p.nickname || 'Partner',
        email: p.email || '',
        avatarUrl: resolvedAvatar,
        lastSeenAt: p.last_seen_at,
        currentMoodEmoji: p.current_mood_emoji,
        currentMoodLabel: p.current_mood_label,
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

/** Helper to verify current user is a member of the couple space */
async function checkMembership(coupleId: string): Promise<boolean> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return false;
  const { data, error } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('couple_id', coupleId)
    .eq('user_id', userRes.user.id)
    .maybeSingle();
  return !!data && !error;
}

/** Update Couple metadata (anniversary date, custom name) */
export async function updateCoupleDetails(coupleId: string, name: string, anniversaryDate: string | null): Promise<Result<void>> {
  try {
    const isMember = await checkMembership(coupleId);
    if (!isMember) return { success: false, error: 'Not a member of this couple.' };

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
    const isMember = await checkMembership(coupleId);
    if (!isMember) return { success: false, error: 'Not a member of this couple.' };

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
    const isMember = await checkMembership(coupleId);
    if (!isMember) return { success: false, error: 'Not a member of this couple.' };

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

    const resolvedImgsList = await Promise.all(
      (data ?? []).map(r => resolveSignedUrls('journal_images', r.image_urls || []))
    );

    const mapped = (data ?? []).map((r, i) => ({
      id: r.id,
      coupleId: r.couple_id,
      userId: r.user_id,
      title: r.title,
      body: r.body,
      moodId: r.mood_id,
      imageUrls: resolvedImgsList[i],
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
    }));

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
  imageUrls: string[] = [],
  moodId?: string | null
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
        image_urls: imageUrls,
        mood_id: moodId || null
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

/** Update an existing couple journal entry */
export async function updateCoupleJournal(
  entryId: string,
  body: string,
  title?: string,
  tags: string[] = [],
  imageUrls: string[] = [],
  moodId?: string | null
): Promise<Result<CoupleJournal>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('couple_journals')
      .update({
        body: body.trim(),
        title: title?.trim() || null,
        tags,
        image_urls: imageUrls,
        mood_id: moodId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', entryId)
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

/** Delete a couple journal entry */
export async function deleteCoupleJournal(entryId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('couple_journals')
      .delete()
      .eq('id', entryId);
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
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
      .select('*, profiles!couple_memories_last_edited_by_fkey(nickname)')
      .eq('couple_id', coupleId)
      .order('memory_date', { ascending: false });

    if (error) return { success: false, error: friendly(error.message) };

    const resolvedImgsList = await Promise.all(
      (data ?? []).map(r => resolveSignedUrls('memory_images', r.image_urls || []))
    );

    const mapped = (data ?? []).map((r: any, i: number) => ({
      id: r.id,
      coupleId: r.couple_id,
      title: r.title,
      description: r.description,
      imageUrls: resolvedImgsList[i],
      memoryDate: r.memory_date,
      tags: r.tags || [],
      createdAt: r.created_at,
      location: r.location || null,
      mood: r.mood || null,
      memoryTime: r.memory_time || null,
      lastEditedBy: r.last_edited_by || null,
      lastEditedNickname: r.profiles?.nickname || null
    }));

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
  tags: string[] = [],
  location?: string,
  mood?: string,
  memoryTime?: string
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
        tags,
        location: location || null,
        mood: mood || null,
        memory_time: memoryTime || null
      })
      .select('*, profiles!couple_memories_last_edited_by_fkey(nickname)')
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
        createdAt: data.created_at,
        location: data.location || null,
        mood: data.mood || null,
        memoryTime: data.memory_time || null,
        lastEditedBy: data.last_edited_by || null,
        lastEditedNickname: data.profiles?.nickname || null
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
  tags: string[] = [],
  location?: string,
  mood?: string,
  memoryTime?: string
): Promise<Result<CoupleMemory>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('couple_memories')
      .update({
        title: title.trim(),
        description: description?.trim() || null,
        image_urls: imageUrls,
        memory_date: memoryDate,
        tags,
        location: location || null,
        mood: mood || null,
        memory_time: memoryTime || null,
        last_edited_by: userRes.user.id
      })
      .eq('id', memoryId)
      .select('*, profiles!couple_memories_last_edited_by_fkey(nickname)')
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
        createdAt: data.created_at,
        location: data.location || null,
        mood: data.mood || null,
        memoryTime: data.memory_time || null,
        lastEditedBy: data.last_edited_by || null,
        lastEditedNickname: data.profiles?.nickname || null
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
      .rpc('fetch_couple_letters_secure', { p_couple_id: coupleId });

    if (error) return { success: false, error: friendly(error.message) };

    const resolvedImgsList = await Promise.all(
      (data ?? []).map((r: any) => r.image_urls && r.image_urls.length > 0 ? resolveSignedUrls('letter_images', r.image_urls) : Promise.resolve([]))
    );

    const mapped = (data ?? []).map((r: any, i: number) => {
      const unlockTime = new Date(r.deliver_at).getTime();
      return {
        id: r.id,
        coupleId: r.couple_id,
        senderId: r.sender_id,
        subject: r.subject,
        body: r.body || null,
        deliverAt: r.deliver_at,
        isUnlocked: Date.now() >= unlockTime,
        createdAt: r.created_at,
        senderNickname: r.sender_nickname,
        isRead: r.is_read,
        isFavorite: r.is_favorite,
        isDraft: r.is_draft,
        isArchived: r.is_archived,
        parentLetterId: r.parent_letter_id,
        deliveredAt: r.delivered_at,
        readAt: r.read_at,
        updatedAt: r.updated_at,
        imageUrls: resolvedImgsList[i],
        reactions: (r.reactions ?? []).map((rx: any) => ({
          userId: rx.user_id,
          emoji: rx.emoji
        }))
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
  imageUrls: string[] = [],
  isDraft: boolean = false,
  parentLetterId?: string
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
        image_urls: imageUrls,
        is_draft: isDraft,
        parent_letter_id: parentLetterId || null
      })
      .select('id, couple_id, sender_id, subject, deliver_at, created_at, is_read, is_favorite, is_draft, is_archived, parent_letter_id, delivered_at, read_at, updated_at')
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
        createdAt: data.created_at,
        isRead: data.is_read,
        isFavorite: data.is_favorite,
        isDraft: data.is_draft,
        isArchived: data.is_archived,
        parentLetterId: data.parent_letter_id,
        deliveredAt: data.delivered_at,
        readAt: data.read_at,
        updatedAt: data.updated_at
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
      .rpc('fetch_unlocked_couple_letter', { p_letter_id: letterId });

    if (error || !data || data.length === 0) return { success: false, error: 'Could not open letter. It is still sealed.' };

    const row = data[0];
    const resolvedUrls = await resolveSignedUrls('letter_images', row.image_urls || []);
    return {
      success: true,
      data: {
        body: row.body,
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

export async function toggleCoupleLetterFavorite(id: string, currentVal: boolean): Promise<Result<boolean>> {
  try {
    const nextVal = !currentVal;
    const { error } = await supabase
      .from('couple_letters')
      .update({ is_favorite: nextVal })
      .eq('id', id);
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: nextVal };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

export async function markCoupleLetterRead(id: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('couple_letters')
      .update({ is_read: true })
      .eq('id', id);
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

export async function toggleCoupleLetterReaction(letterId: string, emoji: string): Promise<Result<void>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const userId = userRes.user.id;
    const { data, error: sErr } = await supabase
      .from('couple_letter_reactions')
      .select('*')
      .eq('letter_id', letterId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();

    if (sErr) return { success: false, error: friendly(sErr.message) };

    if (data) {
      const { error: dErr } = await supabase
        .from('couple_letter_reactions')
        .delete()
        .eq('letter_id', letterId)
        .eq('user_id', userId)
        .eq('emoji', emoji);
      if (dErr) return { success: false, error: friendly(dErr.message) };
    } else {
      const { error: iErr } = await supabase
        .from('couple_letter_reactions')
        .insert({ letter_id: letterId, user_id: userId, emoji });
      if (iErr) return { success: false, error: friendly(iErr.message) };
    }

    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

export async function toggleCoupleLetterArchive(id: string, currentVal: boolean): Promise<Result<boolean>> {
  try {
    const nextVal = !currentVal;
    const { error } = await supabase
      .from('couple_letters')
      .update({ is_archived: nextVal })
      .eq('id', id);
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: nextVal };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

export async function updateCoupleLetter(
  letterId: string, 
  fields: Partial<{ subject: string; body: string; deliverAt: string; isDraft: boolean; isArchived: boolean }>
): Promise<Result<CoupleLetter>> {
  try {
    const updatePayload: any = {};
    if (fields.subject !== undefined) updatePayload.subject = fields.subject;
    if (fields.body !== undefined) updatePayload.body = fields.body;
    if (fields.deliverAt !== undefined) updatePayload.deliver_at = fields.deliverAt;
    if (fields.isDraft !== undefined) updatePayload.is_draft = fields.isDraft;
    if (fields.isArchived !== undefined) updatePayload.is_archived = fields.isArchived;

    const { data, error } = await supabase
      .from('couple_letters')
      .update(updatePayload)
      .eq('id', letterId)
      .select('id, couple_id, sender_id, subject, deliver_at, created_at, is_read, is_favorite, is_draft, is_archived, parent_letter_id, delivered_at, read_at, updated_at')
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
        createdAt: data.created_at,
        isRead: data.is_read,
        isFavorite: data.is_favorite,
        isDraft: data.is_draft,
        isArchived: data.is_archived,
        parentLetterId: data.parent_letter_id,
        deliveredAt: data.delivered_at,
        readAt: data.read_at,
        updatedAt: data.updated_at
      }
    };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}
