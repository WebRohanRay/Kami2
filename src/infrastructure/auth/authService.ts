/**
 * authService.ts
 * All Supabase auth calls in one place. Returns Result<T>.
 * Never imported by UI — only by useAuth hook.
 */
import * as Linking from 'expo-linking';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '@shared/lib/supabase';
import type { Result } from '@features/auth/types';

function friendly(raw: string): string {
  const map: [string, string][] = [
    ['Invalid login credentials',   'Incorrect email or password.'],
    ['Email not confirmed',          'Please verify your email first.'],
    ['User already registered',      'An account with this email already exists.'],
    ['Password should be at least',  'Password must be at least 8 characters.'],
    ['invalid format',               'Please enter a valid email address.'],
    ['Email rate limit',             'Too many attempts. Please wait and try again.'],
    ['Token has expired',            'This link has expired. Request a new one.'],
  ];
  for (const [k, v] of map) if (raw.includes(k)) return v;
  return 'Something went wrong. Please try again.';
}

function normalise(email: string) { return email.trim().toLowerCase(); }

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: normalise(email), password,
    options: {
      emailRedirectTo: Linking.createURL('auth/verify'),
      data: { full_name: name.trim() },
    },
  });
  if (error || !data.user) return { success: false as const, error: friendly(error?.message ?? '') };
  return { success: true as const, data: data.user };
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalise(email), password,
  });
  if (error || !data.user) return { success: false as const, error: friendly(error?.message ?? '') };
  return { success: true as const, data: data.user };
}

export async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') return { success: false as const, error: 'Cancelled.' };
    if (result.type !== 'success' || !result.data.idToken)
      return { success: false as const, error: 'Could not get a Google token.' };

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google', token: result.data.idToken,
    });
    if (error || !data.user) return { success: false as const, error: friendly(error?.message ?? '') };
    return { success: true as const, data: data.user };
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e) {
      if ((e as any).code === statusCodes.IN_PROGRESS)
        return { success: false as const, error: 'Sign-in already in progress.' };
      if ((e as any).code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
        return { success: false as const, error: 'Google Play Services unavailable.' };
    }
    return { success: false as const, error: 'Google sign-in failed.' };
  }
}

export async function resendVerification(email: string): Promise<Result<void>> {
  const { error } = await supabase.auth.resend({
    type: 'signup', email: normalise(email),
    options: { emailRedirectTo: Linking.createURL('auth/verify') },
  });
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true, data: undefined };
}

export async function sendPasswordReset(email: string): Promise<Result<void>> {
  const { error } = await supabase.auth.resetPasswordForEmail(normalise(email), {
    redirectTo: Linking.createURL('auth/reset-password'),
  });
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true, data: undefined };
}

export async function updatePassword(newPassword: string): Promise<Result<void>> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true, data: undefined };
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function getUser() {
  return supabase.auth.getUser();
}

export function onAuthStateChange(cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(cb);
}

export async function signOut(): Promise<Result<void>> {
  try { await GoogleSignin.signOut(); } catch { /* email users — fine */ }
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true, data: undefined };
}
