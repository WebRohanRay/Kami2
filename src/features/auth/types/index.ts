export type AuthStatus =
  | 'loading'
  | 'restoring'
  | 'authenticated_online'
  | 'authenticated_offline'
  | 'unverified'
  | 'expired_requires_reauth'
  | 'unauthenticated'
  | 'error';

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  nickname?: string;
  avatarUrl?: string;
  theme?: string;
  textSize?: string;
  timezone?: string;
  dailyReminder?: boolean;
  weeklyDigest?: boolean;
  streakAlerts?: boolean;
  pushToken?: string;
  kamiId?: string;
  activeSpace?: 'personal' | 'couple';
  currentMoodLabel?: string;
  currentMoodEmoji?: string;
  lastSeenAt?: string;
  heroBgUrl?: string;
};

export type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
};

export type { Result } from '@shared/types/result';
