/**
 * profileRepository.ts
 * Only place in the app that reads/writes the `profiles` table.
 * Returns typed Result<T> — never throws.
 */
import NetInfo from '@react-native-community/netinfo';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@shared/lib/supabase';
import type { AuthUser, Result } from '@features/auth/types';
import { signedUrlCache } from '@shared/lib/storage/signedUrlCache';
import { profileRepo } from '@shared/db/repo';
import { enqueueMutation, processSyncQueue } from '@shared/db/sync';

type ProfileRow = {
  id: string;
  email: string | null;
  nickname: string | null;
  avatar_url: string | null;
  theme: string;
  text_size: string;
  timezone: string;
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
  timezone?: string;
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

function err(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export async function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  try {
    const cached = signedUrlCache.get('avatars', path);
    if (cached) return cached;

    const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600); // 1 hour signed URL
    if (data?.signedUrl) {
      signedUrlCache.set('avatars', path, data.signedUrl, Date.now() + 3600 * 1000);
      return data.signedUrl;
    }
    return null;
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
    timezone: row.timezone ?? base.timezone,
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

function isNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return msg.includes('network') || msg.includes('fetch') || msg.includes('connection') || msg.includes('failed to fetch');
}

export async function fetchOrCreateProfile(user: User): Promise<Result<AuthUser>> {
  const base = supabaseUserToAuthUser(user);

  try {
    // 1. Try to fetch from SQLite first (offline-first)
    const localProfile = await profileRepo.fetchProfile(user.id);
    if (localProfile) {
      const resolvedAvatar = await resolveAvatarUrl(localProfile.avatarUrl);
      const authUser = {
        id: localProfile.id,
        email: localProfile.email || base.email,
        emailVerified: base.emailVerified,
        nickname: localProfile.nickname || base.nickname || '',
        avatarUrl: resolvedAvatar || localProfile.avatarUrl || base.avatarUrl || '',
        theme: localProfile.theme,
        textSize: localProfile.textSize,
        dailyReminder: localProfile.dailyReminderEnabled,
        weeklyDigest: localProfile.weeklyDigestEnabled,
        streakAlerts: localProfile.streakAlertsEnabled,
        pushToken: localProfile.pushToken || '',
        kamiId: localProfile.kamiId || '',
        activeSpace: (localProfile.activeSpace || base.activeSpace || undefined) as 'personal' | 'couple' | undefined,
        currentMoodLabel: localProfile.currentMoodLabel || undefined,
        currentMoodEmoji: localProfile.currentMoodEmoji || undefined,
        lastSeenAt: localProfile.lastSeenAt || undefined,
        heroBgUrl: localProfile.heroBgUrl || undefined,
      };

      // Asynchronously sync in background if online to keep local profile up to date
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data && data.id === user.id) {
            profileRepo.upsertProfile({
              id: data.id,
              email: data.email,
              nickname: data.nickname,
              avatarUrl: data.avatar_url,
              theme: data.theme,
              textSize: data.text_size,
              dailyReminderEnabled: data.daily_reminder_enabled,
              weeklyDigestEnabled: data.weekly_digest_enabled,
              streakAlertsEnabled: data.streak_alerts_enabled,
              pushToken: data.push_token,
              kamiId: data.kami_id,
              activeSpace: data.active_space,
              currentMoodLabel: data.current_mood_label,
              currentMoodEmoji: data.current_mood_emoji,
              lastSeenAt: data.last_seen_at,
              heroBgUrl: data.hero_bg_url,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            }).catch(e => console.error('Failed to sync server profile to local DB:', e));
          }
        });

      return { success: true, data: authUser };
    }

    // 2. Fetch from Supabase if not found locally
    let { data, error } = await supabase
      .from('profiles')
      .select('id,email,nickname,avatar_url,theme,text_size,timezone,daily_reminder_enabled,weekly_digest_enabled,streak_alerts_enabled,push_token,kami_id,active_space,current_mood_label,current_mood_emoji,last_seen_at,hero_bg_url')
      .eq('id', user.id)
      .maybeSingle();

    if (!data && !error) {
      // Create new profile
      const { data: upsertedData, error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          { id: user.id, email: base.email, nickname: base.nickname ?? null, avatar_url: base.avatarUrl ?? null },
          { onConflict: 'id' }
        )
        .select('id,email,nickname,avatar_url,theme,text_size,timezone,daily_reminder_enabled,weekly_digest_enabled,streak_alerts_enabled,push_token,kami_id,active_space,current_mood_label,current_mood_emoji,last_seen_at,hero_bg_url')
        .single();

      if (upsertError) {
        console.error('[profileRepository] fetchOrCreateProfile upsert failed:', upsertError);
        const isNet = isNetworkError(upsertError);
        return { success: false, error: isNet ? 'network_error' : 'Could not create your profile. Please try again.' };
      }
      data = upsertedData;
    } else if (error) {
      console.error('[profileRepository] fetchOrCreateProfile select failed:', error);
      const isNet = isNetworkError(error);
      return { success: false, error: isNet ? 'network_error' : 'Could not load your profile. Please try again.' };
    }

    if (!data) {
      return { success: false, error: 'Profile data is unavailable. Please try again.' };
    }

    // Self-heal KAMI ID
    if (!data.kami_id) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let newId = 'KAMI-';
      const randomValues = new Uint32Array(6);
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < 6; i++) {
          newId += chars.charAt(randomValues[i] % chars.length);
        }
      } else {
        for (let i = 0; i < 6; i++) {
          newId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
      }
      const { data: updatedData, error: updateError } = await supabase
        .from('profiles')
        .update({ kami_id: newId })
        .eq('id', user.id)
        .select('id,email,nickname,avatar_url,theme,text_size,timezone,daily_reminder_enabled,weekly_digest_enabled,streak_alerts_enabled,push_token,kami_id,active_space,current_mood_label,current_mood_emoji,last_seen_at,hero_bg_url')
        .single();

      if (updatedData) {
        data = updatedData;
      }
    }

    // Save to SQLite
    await profileRepo.upsertProfile({
      id: data.id,
      email: data.email,
      nickname: data.nickname,
      avatarUrl: data.avatar_url,
      theme: data.theme,
      textSize: data.text_size,
      dailyReminderEnabled: data.daily_reminder_enabled,
      weeklyDigestEnabled: data.weekly_digest_enabled,
      streakAlertsEnabled: data.streak_alerts_enabled,
      pushToken: data.push_token,
      kamiId: data.kami_id,
      activeSpace: data.active_space,
      currentMoodLabel: data.current_mood_label,
      currentMoodEmoji: data.current_mood_emoji,
      lastSeenAt: data.last_seen_at,
      heroBgUrl: data.hero_bg_url,
    });

    const resolvedAvatar = await resolveAvatarUrl(data.avatar_url);
    return { success: true, data: rowToAuthUser(data as ProfileRow, base, resolvedAvatar) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

export async function updateProfile(userId: string, input: UpdateInput): Promise<Result<AuthUser>> {
  try {
    const localProfile = await profileRepo.fetchProfile(userId);
    if (!localProfile) return { success: false, error: 'Profile not found locally.' };

    const now = new Date().toISOString();

    const patch: Record<string, any> = {};
    if ('nickname' in input) patch.nickname = clean(input.nickname) ?? null;
    if ('avatarUrl' in input) patch.avatarUrl = clean(input.avatarUrl) ?? null;
    if ('theme' in input) patch.theme = input.theme;
    if ('textSize' in input) patch.textSize = input.textSize;
    if ('timezone' in input) patch.timezone = input.timezone;
    if ('dailyReminder' in input) patch.dailyReminderEnabled = input.dailyReminder;
    if ('weeklyDigest' in input) patch.weeklyDigestEnabled = input.weeklyDigest;
    if ('streakAlerts' in input) patch.streakAlertsEnabled = input.streakAlerts;
    if ('pushToken' in input) patch.pushToken = clean(input.pushToken) ?? null;
    if ('activeSpace' in input) patch.activeSpace = input.activeSpace;
    if ('currentMoodLabel' in input) patch.currentMoodLabel = input.currentMoodLabel;
    if ('currentMoodEmoji' in input) patch.currentMoodEmoji = input.currentMoodEmoji;
    if ('lastSeenAt' in input) patch.lastSeenAt = input.lastSeenAt;
    if ('heroBgUrl' in input) patch.heroBgUrl = clean(input.heroBgUrl) ?? null;

    patch.updatedAt = now;

    // Save locally
    await profileRepo.updateProfile(userId, patch);

    const isHeartbeatOnly = Object.keys(input).length === 1 && 'lastSeenAt' in input;

    if (isHeartbeatOnly) {
      // Bypass outbox, write directly to Supabase if online
      NetInfo.fetch().then((netState) => {
        if (netState.isConnected) {
          supabase
            .from('profiles')
            .update({ last_seen_at: input.lastSeenAt })
            .eq('id', userId)
            .then(({ error }) => {
              if (error) {
                console.warn('[ProfileRepository] Direct heartbeat sync failed:', error);
              }
            });
        }
      });
    } else {
      // Enqueue background sync mutation
      await enqueueMutation('profiles', userId, 'update', { ...patch, id: userId });
      // Attempt sync
      processSyncQueue().catch(err => console.error('[Sync] Queue processing error:', err));
    }

    const updated = {
      id: userId,
      email: localProfile.email || '',
      emailVerified: true,
      nickname: patch.nickname !== undefined ? patch.nickname : (localProfile.nickname || ''),
      avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : (localProfile.avatarUrl || ''),
      theme: patch.theme !== undefined ? patch.theme : localProfile.theme,
      textSize: patch.textSize !== undefined ? patch.textSize : localProfile.textSize,
      dailyReminder: patch.dailyReminderEnabled !== undefined ? patch.dailyReminderEnabled : localProfile.dailyReminderEnabled,
      weeklyDigest: patch.weeklyDigestEnabled !== undefined ? patch.weeklyDigestEnabled : localProfile.weeklyDigestEnabled,
      streakAlerts: patch.streakAlertsEnabled !== undefined ? patch.streakAlertsEnabled : localProfile.streakAlertsEnabled,
      pushToken: patch.pushToken !== undefined ? patch.pushToken : (localProfile.pushToken || ''),
      kamiId: localProfile.kamiId || '',
      activeSpace: patch.activeSpace !== undefined ? patch.activeSpace : ((localProfile.activeSpace || undefined) as 'personal' | 'couple' | undefined),
      currentMoodLabel: patch.currentMoodLabel !== undefined ? patch.currentMoodLabel : (localProfile.currentMoodLabel || undefined),
      currentMoodEmoji: patch.currentMoodEmoji !== undefined ? patch.currentMoodEmoji : (localProfile.currentMoodEmoji || undefined),
      lastSeenAt: patch.lastSeenAt !== undefined ? patch.lastSeenAt : (localProfile.lastSeenAt || undefined),
      heroBgUrl: patch.heroBgUrl !== undefined ? patch.heroBgUrl : (localProfile.heroBgUrl || undefined),
    };

    const resolvedAvatar = await resolveAvatarUrl(updated.avatarUrl);
    return { success: true, data: { ...updated, avatarUrl: resolvedAvatar || updated.avatarUrl } };
  } catch (e) {
    return { success: false, error: err(e) };
  }
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

export async function fetchProfileNickname(profileId: string): Promise<string> {
  try {
    const local = await profileRepo.fetchProfile(profileId);
    if (local?.nickname) {
      return local.nickname;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', profileId)
      .maybeSingle();

    if (error) {
      console.error('[profileRepository] fetchProfileNickname failed:', error);
    }

    if (data?.nickname) {
      profileRepo.upsertProfile({
        id: profileId,
        nickname: data.nickname,
      }).catch((e: any) => console.error('Failed to cache partner nickname:', e));

      return data.nickname;
    }
  } catch (e) {
    console.error('fetchProfileNickname error:', e);
  }
  return 'Someone';
}
