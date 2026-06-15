import { useAuthStore } from '@features/auth/store';
import { ThemePalettes, applyTheme, Colors } from '../constants/tokens';

export function useTheme() {
  const theme = useAuthStore((s) => s.user?.theme) ?? 'blush';
  const gradientBg = useAuthStore((s) => s.gradientBg);
  const colors = ThemePalettes[theme] || ThemePalettes.blush;

  // Sync the global Colors object for any static or fallback access
  applyTheme(theme);

  return {
    theme,
    isDark: !!colors.isDark,
    gradientBg,
    colors: {
      ...colors,
      cardBg: Colors.cardBg,
      inputBg: Colors.inputBg,
      textPrimary: Colors.textPrimary,
      textSecondary: Colors.textSecondary,
      textMuted: Colors.textMuted,
      textOnPrimary: Colors.textOnPrimary,
      border: Colors.border,
      success: Colors.success,
      warning: Colors.warning,
      error: Colors.error,
      shadowTint: Colors.shadowTint,
      surfaceMuted: Colors.surfaceMuted,
      divider: Colors.divider,
      overlay: Colors.overlay,
      gradientStart: colors.gradientStart || colors.pageBg,
      gradientEnd: colors.gradientEnd || colors.creamDeep,
    },
  };
}

