/**
 * useAuth — single public API for auth.
 * Connects infrastructure (authService, profileRepository) to the auth store.
 * No UI component should import from infrastructure directly.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as authService from '@infrastructure/auth';
import * as profileRepo from '@infrastructure/profile';
import { registerForPushNotificationsAsync } from '@infrastructure/notifications/notificationService';
import { applyTheme } from '@shared/constants';
import { useAuthStore } from '../store';
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

  if (authUser.theme) {
    applyTheme(authUser.theme);
  }

  setUser(authUser);
  setStatus(statusFor(authUser));

  // If email is verified/authenticated, request push notification permission and sync token
  if (authUser.emailVerified) {
    registerForPushNotificationsAsync().then((token) => {
      if (token && token !== authUser.pushToken) {
        profileRepo.updateProfile(authUser.id, { pushToken: token }).then((updateResult) => {
          if (updateResult.success) {
            setUser(updateResult.data);
          }
        }).catch(err => console.error('Failed to update push token in profiles:', err));
      }
    }).catch(err => console.error('Push token registration failed:', err));
  }
}

export function useAuth() {
  const user = useAuthStore(s => s.user);

  // Stable references from getState — avoids infinite effect loops
  const store = useAuthStore.getState;

  // Keep infra refs stable across renders
  const hydrateRef = useRef(hydrateUser);

  // Heartbeat to update last_seen_at when user is active
  useEffect(() => {
    if (!user?.id) return;

    const runHeartbeat = () => {
      if (AppState.currentState === 'active') {
        profileRepo.updateProfile(user.id, { lastSeenAt: new Date().toISOString() }).catch(() => { });
      }
    };

    // Run immediately on active user session
    runHeartbeat();

    // Set interval for every 60 seconds
    const interval = setInterval(runHeartbeat, 60 * 1000);

    // Also listen to AppState change
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        runHeartbeat();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [user?.id]);

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
    if (user?.id) {
      // Mark user offline immediately in the database before signing out
      await profileRepo.updateProfile(user.id, { lastSeenAt: '1970-01-01T00:00:00.000Z' }).catch(() => { });
    }
    const r = await authService.signOut();
    if (!r.success) return r;
    reset();
    setStatus('unauthenticated');
    return { success: true, data: undefined };
  }

  async function deleteAccount(): Promise<Result<void>> {
    const { reset, setStatus } = store();
    const r = await authService.deleteAccount();
    if (!r.success) return r;
    reset();
    setStatus('unauthenticated');
    return { success: true, data: undefined };
  }

  async function updateProfile(
    input: {
      nickname?: string;
      avatarUrl?: string;
      theme?: string;
      textSize?: string;
      dailyReminder?: boolean;
      weeklyDigest?: boolean;
      streakAlerts?: boolean;
      activeSpace?: 'personal' | 'couple';
      currentMoodLabel?: string;
      currentMoodEmoji?: string;
      heroBgUrl?: string;
    }
  ): Promise<Result<void>> {
    const { setUser, user } = store();
    if (!user?.id) return { success: false, error: 'Not authenticated.' };
    const r = await profileRepo.updateProfile(user.id, input);
    if (!r.success) return r;
    setUser(r.data);
    return { success: true, data: undefined };
  }

  async function exportData(): Promise<Result<Record<string, any>>> {
    const { user } = store();
    if (!user?.id) return { success: false, error: 'Not authenticated.' };
    return profileRepo.exportUserData();
  }

  return {
    signUp, login, loginWithGoogle,
    resendVerificationEmail, refreshUser,
    forgotPassword, resetPassword, signOut,
    deleteAccount, updateProfile, exportData,
  };
}
