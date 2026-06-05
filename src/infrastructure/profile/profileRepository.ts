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
};

type UpdateInput = { nickname?: string; avatarUrl?: string };

function clean(v: string | undefined | null): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

export function rowToAuthUser(row: ProfileRow, base: AuthUser): AuthUser {
  return {
    ...base,
    nickname:  clean(row.nickname)   ?? base.nickname,
    avatarUrl: clean(row.avatar_url) ?? base.avatarUrl,
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
    .select('id,email,nickname,avatar_url')
    .single();

  if (error || !data) {
    return { success: false, error: 'Could not load your profile. Please try again.' };
  }
  return { success: true, data: rowToAuthUser(data as ProfileRow, base) };
}

export async function updateProfile(userId: string, input: UpdateInput): Promise<Result<AuthUser>> {
  const patch: Record<string, string | null> = {};
  if ('nickname'  in input) patch.nickname   = clean(input.nickname)  ?? null;
  if ('avatarUrl' in input) patch.avatar_url = clean(input.avatarUrl) ?? null;

  if (Object.keys(patch).length === 0) {
    return { success: false, error: 'Nothing to update.' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id,email,nickname,avatar_url')
    .single();

  if (error || !data) {
    return { success: false, error: 'Could not save your profile. Please try again.' };
  }

  const base = supabaseUserToAuthUser({ id: userId, email: data.email } as User);
  return { success: true, data: rowToAuthUser(data as ProfileRow, base) };
}
