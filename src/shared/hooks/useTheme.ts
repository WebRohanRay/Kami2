import { useAuthStore } from '@features/auth/store';
import { ThemePalettes, applyTheme } from '../constants/tokens';

export function useTheme() {
  const theme = useAuthStore((s) => s.user?.theme) ?? 'blush';
  const colors = ThemePalettes[theme] || ThemePalettes.blush;

  // Sync the global Colors object for any static or fallback access
  applyTheme(theme);

  return {
    theme,
    colors,
  };
}
