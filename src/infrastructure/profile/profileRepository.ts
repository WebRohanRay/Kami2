/**
 * profileRepository.ts
 * Only place in the app that reads/writes the `profiles` table.
 * Returns typed Result<T> — never throws.
 */
import type { User } from '@supabase/supabase-js';
import { supabase } from '@shared/lib/supabase';
import type { AuthUser, Result } from '@features/auth/types';

type ProfileRow = {
  id: string;
  email: string | null;
  nickname: string | null;
  avatar_url: string | null;
  theme: string;
  text_size: string;
  daily_reminder_enabled: boolean;
  weekly_digest_enabled: boolean;
  streak_alerts_enabled: boolean;
  push_token: string | null;
  kami_id: string | null;
  active_space: 'personal' | 'couple' | null;
  current_mood_label: string | null;
  current_mood_emoji: string | null;
  last_seen_at: string | null;
  hero_bg_url: string | null;
};

type UpdateInput = {
  nickname?: string;
  avatarUrl?: string;
  theme?: string;
  textSize?: string;
  dailyReminder?: boolean;
  weeklyDigest?: boolean;
  streakAlerts?: boolean;
  pushToken?: string;
  activeSpace?: 'personal' | 'couple';
  currentMoodLabel?: string;
  currentMoodEmoji?: string;
  lastSeenAt?: string;
  heroBgUrl?: string;
};

function clean(v: string | undefined | null): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

export async function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  try {
    const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600); // 1 hour signed URL
    return data?.signedUrl ?? null;
  } catch (error) {
    console.error('resolveAvatarUrl error:', error);
    return null;
  }
}

export function rowToAuthUser(row: ProfileRow, base: AuthUser, resolvedAvatarUrl?: string | null): AuthUser {
  return {
    ...base,
    nickname: clean(row.nickname) ?? base.nickname,
    avatarUrl: resolvedAvatarUrl ?? clean(row.avatar_url) ?? base.avatarUrl,
    theme: row.theme ?? base.theme,
    textSize: row.text_size ?? base.textSize,
    dailyReminder: row.daily_reminder_enabled ?? base.dailyReminder,
    weeklyDigest: row.weekly_digest_enabled ?? base.weeklyDigest,
    streakAlerts: row.streak_alerts_enabled ?? base.streakAlerts,
    pushToken: row.push_token ?? base.pushToken,
    kamiId: row.kami_id ?? base.kamiId,
    activeSpace: (row.active_space as any) ?? base.activeSpace,
    currentMoodLabel: row.current_mood_label ?? base.currentMoodLabel,
    currentMoodEmoji: row.current_mood_emoji ?? base.currentMoodEmoji,
    lastSeenAt: row.last_seen_at ?? base.lastSeenAt,
    heroBgUrl: row.hero_bg_url ?? base.heroBgUrl,
  };
}

export function supabaseUserToAuthUser(user: User): AuthUser {
  const m = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? '',
    emailVerified: Boolean(user.email_confirmed_at),
    nickname: clean(typeof m.full_name === 'string' ? m.full_name : undefined),
    avatarUrl: clean(
      typeof m.avatar_url === 'string' ? m.avatar_url :
        typeof m.picture === 'string' ? m.picture : undefined
    ),
  };
}

export async function fetchOrCreateProfile(user: User): Promise<Result<AuthUser>> {
  const base = supabaseUserToAuthUser(user);

  // 1. Try to fetch the existing profile first (avoids blind upsert overwrites of nickname/avatar)
  let { data, error } = await supabase
    .from('profiles')
    .select('id,email,nickname,avatar_url,theme,text_size,daily_reminder_enabled,weekly_digest_enabled,streak_alerts_enabled,push_token,kami_id,active_space,current_mood_label,current_mood_emoji,last_seen_at,hero_bg_url')
    .eq('id', user.id)
    .maybeSingle();

  // 2. If profile is not found, upsert/create it
  if (!data && !error) {
    const { data: upsertedData, error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, email: base.email, nickname: base.nickname ?? null, avatar_url: base.avatarUrl ?? null },
        { onConflict: 'id' }
      )
      .select('id,email,nickname,avatar_url,theme,text_size,daily_reminder_enabled,weekly_digest_enabled,streak_alerts_enabled,push_token,kami_id,active_space,current_mood_label,current_mood_emoji,last_seen_at,hero_bg_url')
      .single();

    if (upsertError) {
      console.error('[profileRepository] fetchOrCreateProfile upsert failed:', upsertError);
      return { success: false, error: 'Could not create your profile. Please try again.' };
    }
    data = upsertedData;
  } else if (error) {
    console.error('[profileRepository] fetchOrCreateProfile select failed:', error);
    return { success: false, error: 'Could not load your profile. Please try again.' };
  }

  if (!data) {
    return { success: false, error: 'Profile data is unavailable. Please try again.' };
  }

  // 3. Self-heal null KAMI IDs
  if (!data.kami_id) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newId = 'KAMI-';
    for (let i = 0; i < 6; i++) {
      newId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const { data: updatedData, error: updateError } = await supabase
      .from('profiles')
      .update({ kami_id: newId })
      .eq('id', user.id)
      .select('id,email,nickname,avatar_url,theme,text_size,daily_reminder_enabled,weekly_digest_enabled,streak_alerts_enabled,push_token,kami_id,active_space,current_mood_label,current_mood_emoji,last_seen_at,hero_bg_url')
      .single();

    if (updateError) {
      console.error('[profileRepository] fetchOrCreateProfile self-healing update failed:', updateError);
    }
    if (updatedData) {
      data = updatedData;
    }
  }

  const resolvedAvatar = await resolveAvatarUrl(data.avatar_url);
  return { success: true, data: rowToAuthUser(data as ProfileRow, base, resolvedAvatar) };
}

export async function updateProfile(userId: string, input: UpdateInput): Promise<Result<AuthUser>> {
  const patch: Record<string, any> = {};
  if ('nickname' in input) patch.nickname = clean(input.nickname) ?? null;
  if ('avatarUrl' in input) patch.avatar_url = clean(input.avatarUrl) ?? null;
  if ('theme' in input) patch.theme = input.theme;
  if ('textSize' in input) patch.text_size = input.textSize;
  if ('dailyReminder' in input) patch.daily_reminder_enabled = input.dailyReminder;
  if ('weeklyDigest' in input) patch.weekly_digest_enabled = input.weeklyDigest;
  if ('streakAlerts' in input) patch.streak_alerts_enabled = input.streakAlerts;

  if ('pushToken' in input) patch.push_token = clean(input.pushToken) ?? null;
  if ('activeSpace' in input) patch.active_space = input.activeSpace;
  if ('currentMoodLabel' in input) patch.current_mood_label = input.currentMoodLabel;
  if ('currentMoodEmoji' in input) patch.current_mood_emoji = input.currentMoodEmoji;
  if ('lastSeenAt' in input) patch.last_seen_at = input.lastSeenAt;
  if ('heroBgUrl' in input) patch.hero_bg_url = clean(input.heroBgUrl) ?? null;

  if (Object.keys(patch).length === 0) {
    return { success: false, error: 'Nothing to update.' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id,email,nickname,avatar_url,theme,text_size,daily_reminder_enabled,weekly_digest_enabled,streak_alerts_enabled,push_token,kami_id,active_space,current_mood_label,current_mood_emoji,last_seen_at,hero_bg_url')
    .single();

  if (error || !data) {
    return { success: false, error: 'Could not save your profile. Please try again.' };
  }

  const base = supabaseUserToAuthUser({ id: userId, email: data.email } as User);
  const resolvedAvatar = await resolveAvatarUrl(data.avatar_url);
  return { success: true, data: rowToAuthUser(data as ProfileRow, base, resolvedAvatar) };
}

export async function exportUserData(): Promise<Result<Record<string, any>>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };
    const userId = userRes.user.id;

    const [
      profile,
      moods,
      journals,
      goals,
      memories,
      letters,
      responses,
      streaks
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('mood_logs').select('*').eq('user_id', userId),
      supabase.from('journal_entries').select('*').eq('user_id', userId),
      supabase.from('goals').select('*').eq('user_id', userId),
      supabase.from('memories').select('*').eq('user_id', userId),
      supabase.from('future_letters').select('*').eq('user_id', userId),
      supabase.from('prompt_responses').select('*').eq('user_id', userId),
      supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle()
    ]);

    if (profile.error) throw profile.error;

    return {
      success: true,
      data: {
        profile: profile.data,
        moodLogs: moods.data ?? [],
        journalEntries: journals.data ?? [],
        goals: goals.data ?? [],
        memories: memories.data ?? [],
        futureLetters: letters.data ?? [],
        promptResponses: responses.data ?? [],
        streak: streaks.data ?? null
      }
    };
  } catch (e) {
    console.error('exportUserData error:', e);
    return { success: false, error: 'Could not fetch all of your data.' };
  }
}
