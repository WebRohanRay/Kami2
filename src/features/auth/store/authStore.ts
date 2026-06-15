import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser, AuthStatus } from '../types';
import { applyTheme } from '../../../shared/constants/tokens';

type AuthStore = {
  user:   AuthUser | null;
  status: AuthStatus;
  error:  string | null;
  gradientBg: boolean;
  // Setters — only called from useAuth
  setUser:   (u: AuthUser | null) => void;
  setStatus: (s: AuthStatus) => void;
  setError:  (e: string | null) => void;
  setGradientBg: (enabled: boolean) => void;
  reset:     () => void;
};

const initial = { user: null, status: 'loading' as AuthStatus, error: null, gradientBg: true };

export const useAuthStore = create<AuthStore>((set) => ({
  ...initial,
  setUser: (user) => {
    set({ user });
    if (user?.id) {
      AsyncStorage.getItem(`kami_gradient_bg_${user.id}`)
        .then((val) => {
          const isEnabled = val !== null ? val === 'true' : true;
          set({ gradientBg: isEnabled });
        })
        .catch((err) => {
          console.error('[authStore] Failed to load gradientBg preference:', err);
        });
    } else {
      set({ gradientBg: true });
    }
  },
  setStatus: (status) => set({ status }),
  setError:  (error)  => set({ error }),
  setGradientBg: (gradientBg) => {
    set({ gradientBg });
    const user = useAuthStore.getState().user;
    if (user?.id) {
      AsyncStorage.setItem(`kami_gradient_bg_${user.id}`, gradientBg ? 'true' : 'false').catch((err) => {
        console.error('[authStore] Failed to save gradientBg preference:', err);
      });
    }
  },
  reset:     ()       => set(initial),
}));

useAuthStore.subscribe((state) => {
  if (state.user?.theme) {
    applyTheme(state.user.theme);
  }
});

