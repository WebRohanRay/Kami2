import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as authService from '@infrastructure/auth';
import * as profileRepo from '@infrastructure/profile';
import { registerForPushNotificationsAsync } from '@infrastructure/notifications/notificationService';
import { applyTheme } from '@shared/constants';
import { useAuthStore } from '../store';
import type { AuthUser, AuthStatus } from '../types';

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
  const emailVerified = Boolean(supabaseUser.email_confirmed_at);
  if (!emailVerified) {
    const authUser = profileRepo.supabaseUserToAuthUser(supabaseUser);
    setUser(authUser);
    setStatus('unverified');
    return;
  }

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

  // Synchronize local reminders scheduling on hydration
  const {
    scheduleDailyReminderAsync, cancelDailyReminderAsync,
    scheduleWeeklyDigestAsync, cancelWeeklyDigestAsync,
    scheduleStreakAlertsAsync, cancelStreakAlertsAsync
  } = require('@infrastructure/notifications/notificationService');

  if (authUser.dailyReminder ?? true) scheduleDailyReminderAsync().catch(() => { });
  else cancelDailyReminderAsync().catch(() => { });

  if (authUser.weeklyDigest ?? true) scheduleWeeklyDigestAsync().catch(() => { });
  else cancelWeeklyDigestAsync().catch(() => { });

  if (authUser.streakAlerts ?? true) scheduleStreakAlertsAsync().catch(() => { });
  else cancelStreakAlertsAsync().catch(() => { });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

    let sessionRestored = false;

    // Timeout fallback (4 seconds) to prevent stuck loading screen if getSession hangs
    const timeoutId = setTimeout(async () => {
      if (!mounted || sessionRestored) return;
      console.warn('[useAuth] Session restoration timed out. Falling back to unauthenticated.');
      sessionRestored = true;
      setStatus('unauthenticated');
    }, 4000);

    // 1. Restore session on mount
    authService.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted || sessionRestored) return;
      sessionRestored = true;
      clearTimeout(timeoutId);
      if (error) {
        console.warn('[useAuth] Session restoration error (cleaning up local storage):', error.message);
        await authService.signOut().catch(() => { });
        setStatus('unauthenticated');
        return;
      }
      if (!session?.user) { setStatus('unauthenticated'); return; }
      await hydrateRef.current(session.user as any, setUser, setStatus);
    }).catch(async (err) => {
      if (!mounted || sessionRestored) return;
      sessionRestored = true;
      clearTimeout(timeoutId);
      console.error('[useAuth] Session restoration exception:', err);
      await authService.signOut().catch(() => { });
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

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
};
