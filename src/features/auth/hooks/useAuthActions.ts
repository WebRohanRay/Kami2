import { useRef } from 'react';
import * as authService from '@infrastructure/auth';
import * as profileRepo from '@infrastructure/profile';
import { registerForPushNotificationsAsync } from '@infrastructure/notifications/notificationService';
import { applyTheme } from '@shared/constants';
import { useAuthStore } from '../store';
import type { AuthUser, AuthStatus, Result } from '../types';
import { hydrateUser } from '../providers/AuthProvider';

export function useAuthActions() {
  const user = useAuthStore(s => s.user);

  // Stable references from getState — avoids infinite effect loops
  const store = useAuthStore.getState;

  // Keep infra refs stable across renders
  const hydrateRef = useRef(hydrateUser);

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
      timezone?: string;
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
