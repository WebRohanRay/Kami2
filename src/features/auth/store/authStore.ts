import { create } from 'zustand';
import type { AuthUser, AuthStatus } from '../types';

type AuthStore = {
  user:   AuthUser | null;
  status: AuthStatus;
  error:  string | null;
  // Setters — only called from useAuth
  setUser:   (u: AuthUser | null) => void;
  setStatus: (s: AuthStatus) => void;
  setError:  (e: string | null) => void;
  reset:     () => void;
};

const initial = { user: null, status: 'loading' as AuthStatus, error: null };

export const useAuthStore = create<AuthStore>((set) => ({
  ...initial,
  setUser:   (user)   => set({ user }),
  setStatus: (status) => set({ status }),
  setError:  (error)  => set({ error }),
  reset:     ()       => set(initial),
}));
