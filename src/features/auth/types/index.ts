export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'unverified'
  | 'authenticated'
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

/** Generic result — no exceptions thrown anywhere */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
