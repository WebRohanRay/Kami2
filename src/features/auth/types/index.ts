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
