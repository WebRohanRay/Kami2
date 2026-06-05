/**
 * useAuth — single public API for auth.
 * Connects infrastructure (authService, profileRepository) to the auth store.
 * No UI component should import from infrastructure directly.
 */
import { useEffect, useRef } from 'react';
import * as authService  from '@infrastructure/auth';
import * as profileRepo  from '@infrastructure/profile';
import { useAuthStore }  from '../store';
import type { AuthUser, AuthStatus, Result } from '../types';

function statusFor(user: AuthUser): AuthStatus {
  return user.emailVerified ? 'authenticated' : 'unverified';
}

async function hydrateUser(
  supabaseUser: Awaited<ReturnType<typeof authService.getSession>>['data']['session'] extends null
    ? never
    : NonNullable<Awaited<ReturnType<typeof authService.getSession>>['data']['session']>['user'],
  setUser: (u: AuthUser) => void,
  setStatus: (s: AuthStatus) => void,
) {
  const result = await profileRepo.fetchOrCreateProfile(supabaseUser);
  const authUser = result.success ? result.data : profileRepo.supabaseUserToAuthUser(supabaseUser);
  setUser(authUser);
  setStatus(statusFor(authUser));
}

export function useAuth() {
  // Stable references from getState — avoids infinite effect loops
  const store = useAuthStore.getState;

  // Keep infra refs stable across renders
  const hydrateRef = useRef(hydrateUser);

  useEffect(() => {
    let mounted = true;
    const { setUser, setStatus, setError, reset } = store();

    // 0. Configure Google Sign-In once on mount
    authService.configureGoogleSignIn(
      // webClientId is read from the native strings.xml resource at runtime;
      // the value below must match strings.xml server_client_id exactly.
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    );

    // 1. Restore session on mount
    authService.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session?.user) { setStatus('unauthenticated'); return; }
      await hydrateRef.current(session.user as any, setUser, setStatus);
    }).catch(() => {
      if (!mounted) return;
      setError('Could not restore your session.');
      setStatus('error');
    });

    // 2. React to Supabase auth events (email verified, token refresh, sign out)
    const { data: { subscription } } = authService.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (!session?.user) { reset(); setStatus('unauthenticated'); return; }
        await hydrateRef.current(session.user as any, setUser, setStatus);
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function signUp(name: string, email: string, password: string): Promise<Result<void>> {
    const { setUser, setStatus, setError } = store();
    setError(null);
    const r = await authService.signUp(name, email, password);
    if (!r.success) { setError(r.error); return r; }
    await hydrateRef.current(r.data as any, setUser, setStatus);
    return { success: true, data: undefined };
  }

  async function login(email: string, password: string): Promise<Result<void>> {
    const { setUser, setStatus, setError } = store();
    setError(null);
    const r = await authService.signInWithPassword(email, password);
    if (!r.success) { setError(r.error); return r; }
    await hydrateRef.current(r.data as any, setUser, setStatus);
    return { success: true, data: undefined };
  }

  async function loginWithGoogle(): Promise<Result<void>> {
    const { setUser, setStatus, setError } = store();
    setError(null);
    const r = await authService.signInWithGoogle();
    if (!r.success) { setError(r.error); return r; }
    await hydrateRef.current(r.data as any, setUser, setStatus);
    return { success: true, data: undefined };
  }

  async function resendVerificationEmail(email: string): Promise<Result<void>> {
    return authService.resendVerification(email);
  }

  async function refreshUser(): Promise<Result<void>> {
    const { setUser, setStatus } = store();
    const { data: { user }, error } = await authService.getUser();
    if (error || !user) return { success: false, error: 'Could not refresh your session.' };
    await hydrateRef.current(user as any, setUser, setStatus);
    return { success: true, data: undefined };
  }

  async function forgotPassword(email: string): Promise<Result<void>> {
    return authService.sendPasswordReset(email);
  }

  async function resetPassword(newPassword: string): Promise<Result<void>> {
    return authService.updatePassword(newPassword);
  }

  async function signOut(): Promise<Result<void>> {
    const { reset, setStatus } = store();
    const r = await authService.signOut();
    if (!r.success) return r;
    reset();
    setStatus('unauthenticated');
    return { success: true, data: undefined };
  }

  async function updateProfile(
    userId: string,
    input: { nickname?: string; avatarUrl?: string }
  ): Promise<Result<void>> {
    const { setUser } = store();
    const r = await profileRepo.updateProfile(userId, input);
    if (!r.success) return r;
    setUser(r.data);
    return { success: true, data: undefined };
  }

  return {
    signUp, login, loginWithGoogle,
    resendVerificationEmail, refreshUser,
    forgotPassword, resetPassword, signOut,
    updateProfile,
  };
}
