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
};

function clean(v: string | undefined | null): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

async function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  try {
    const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 31536000); // 1 year signed URL
    return data?.signedUrl ?? null;
  } catch (error) {
    console.error('resolveAvatarUrl error:', error);
    return null;
  }
}

export function rowToAuthUser(row: ProfileRow, base: AuthUser, resolvedAvatarUrl?: string | null): AuthUser {
  return {
    ...base,
    nickname:  clean(row.nickname)   ?? base.nickname,
    avatarUrl: resolvedAvatarUrl      ?? clean(row.avatar_url) ?? base.avatarUrl,
    theme:     row.theme              ?? base.theme,
    textSize:  row.text_size          ?? base.textSize,
    dailyReminder: row.daily_reminder_enabled ?? base.dailyReminder,
    weeklyDigest:  row.weekly_digest_enabled  ?? base.weeklyDigest,
    streakAlerts:  row.streak_alerts_enabled  ?? base.streakAlerts,
    pushToken:     row.push_token         ?? base.pushToken,
  };
}

export function supabaseUserToAuthUser(user: User): AuthUser {
  const m = user.user_metadata ?? {};
  return {
    id:            user.id,
    email:         user.email ?? '',
    emailVerified: Boolean(user.email_confirmed_at),
    nickname:  clean(typeof m.full_name === 'string' ? m.full_name : undefined),
    avatarUrl: clean(
      typeof m.avatar_url === 'string' ? m.avatar_url :
      typeof m.picture    === 'string' ? m.picture : undefined
    ),
  };
}

export async function fetchOrCreateProfile(user: User): Promise<Result<AuthUser>> {
  const base = supabaseUserToAuthUser(user);

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, email: base.email, nickname: base.nickname ?? null, avatar_url: base.avatarUrl ?? null },
      { onConflict: 'id' }
    )
    .select('id,email,nickname,avatar_url,theme,text_size,daily_reminder_enabled,weekly_digest_enabled,streak_alerts_enabled,push_token')
    .single();

  if (error || !data) {
    return { success: false, error: 'Could not load your profile. Please try again.' };
  }
  
  const resolvedAvatar = await resolveAvatarUrl(data.avatar_url);
  return { success: true, data: rowToAuthUser(data as ProfileRow, base, resolvedAvatar) };
}

export async function updateProfile(userId: string, input: UpdateInput): Promise<Result<AuthUser>> {
  const patch: Record<string, any> = {};
  if ('nickname'  in input) patch.nickname   = clean(input.nickname)  ?? null;
  if ('avatarUrl' in input) patch.avatar_url = clean(input.avatarUrl) ?? null;
  if ('theme'     in input) patch.theme      = input.theme;
  if ('textSize'  in input) patch.text_size  = input.textSize;
  if ('dailyReminder' in input) patch.daily_reminder_enabled = input.dailyReminder;
  if ('weeklyDigest'   in input) patch.weekly_digest_enabled  = input.weeklyDigest;
  if ('streakAlerts'   in input) patch.streak_alerts_enabled  = input.streakAlerts;

  if ('pushToken' in input) patch.push_token = clean(input.pushToken) ?? null;

  if (Object.keys(patch).length === 0) {
    return { success: false, error: 'Nothing to update.' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id,email,nickname,avatar_url,theme,text_size,daily_reminder_enabled,weekly_digest_enabled,streak_alerts_enabled,push_token')
    .single();

  if (error || !data) {
    return { success: false, error: 'Could not save your profile. Please try again.' };
  }

  const base = supabaseUserToAuthUser({ id: userId, email: data.email } as User);
  const resolvedAvatar = await resolveAvatarUrl(data.avatar_url);
  return { success: true, data: rowToAuthUser(data as ProfileRow, base, resolvedAvatar) };
}

export async function exportUserData(userId: string): Promise<Result<Record<string, any>>> {
  try {
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
