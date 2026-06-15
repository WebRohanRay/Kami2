export const Palette = {
  cream: '#FFF8F8', creamDeep: '#FFF0F2', creamMid: '#FDE8EC',
  rose100: '#FFD6DE', rose300: '#F4A0B5', rose500: '#C96882',
  rose700: '#953F56', rose900: '#2D141B',
  mauve400: '#B591C8', ink: '#1C1917', slate: 'rgba(28, 25, 23, 0.55)',
  mist: 'rgba(28, 25, 23, 0.35)', fog: '#D9C1C4', white: '#FFFFFF',
  success: '#6DB88C', warning: '#E8A84A', error: '#D95555',
} as const;

/** Standardized opacity hex suffixes — append to any hex color for consistent transparency */
export const Opacity = {
  /** 3% — barely visible tint for backgrounds */
  ghost:   '08',
  /** 7% — subtle emphasis on cards/badges */
  subtle:  '12',
  /** 10% — light backgrounds, hover states */
  light:   '1A',
  /** 15% — tag backgrounds, badge fills */
  muted:   '26',
  /** 20% — medium emphasis, borders */
  medium:  '33',
  /** 33% — strong emphasis */
  strong:  '55',
  /** 50% — heavy overlays, disabled states */
  heavy:   '80',
  /** 80% — nearly opaque overlays */
  solid:   'CC',
} as const;

export interface ThemePalette {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  pageBg: string;
  creamDeep: string;
  creamMid: string;
  accent: string;
  isDark?: boolean;
  cardBg?: string;
  inputBg?: string;
  shadowTint?: string;
  surfaceMuted?: string;
  divider?: string;
  overlay?: string;
  gradientStart?: string;
  gradientEnd?: string;
}

export const ThemePalettes: Record<string, ThemePalette> = {
  // ── Light Classics ──────────────────────────────
  blush: {
    primary: '#C96882',
    primaryLight: '#F4A0B5',
    primaryDark: '#953F56',
    pageBg: '#FFF8F8',
    creamDeep: '#FFF0F2',
    creamMid: '#FDE8EC',
    accent: '#B591C8',
    shadowTint: '#C96882',
    gradientStart: '#FFF8F8',
    gradientEnd: '#FFF0F2',
  },
  cherry_blossom: {
    primary: '#E8839B',
    primaryLight: '#FFB7C9',
    primaryDark: '#C25A74',
    pageBg: '#FFF5F7',
    creamDeep: '#FFEAEF',
    creamMid: '#FFD6E0',
    accent: '#7EB8A5',
    shadowTint: '#E8839B',
    gradientStart: '#FFF5F7',
    gradientEnd: '#FFEAEF',
  },
  petal: {
    primary: '#D4769B',
    primaryLight: '#F0A8C4',
    primaryDark: '#A84D72',
    pageBg: '#FFF8FA',
    creamDeep: '#FFECF2',
    creamMid: '#FFDCE8',
    accent: '#76B8A2',
    shadowTint: '#D4769B',
    gradientStart: '#FFF8FA',
    gradientEnd: '#FFECF2',
  },
  rosewood: {
    primary: '#9E4B5E',
    primaryLight: '#D07A8E',
    primaryDark: '#6E2F3E',
    pageBg: '#FDF6F7',
    creamDeep: '#F5E6E9',
    creamMid: '#ECDADF',
    accent: '#4B9E8B',
    shadowTint: '#9E4B5E',
    gradientStart: '#FDF6F7',
    gradientEnd: '#F5E6E9',
  },
  crimson: {
    primary: '#D3455B',
    primaryLight: '#E88091',
    primaryDark: '#992638',
    pageBg: '#FFF8F9',
    creamDeep: '#FFEBF0',
    creamMid: '#FFD2DD',
    accent: '#45D3BD',
    shadowTint: '#D3455B',
    gradientStart: '#FFF8F9',
    gradientEnd: '#FFEBF0',
  },
  coral: {
    primary: '#E27E5B',
    primaryLight: '#FAAE91',
    primaryDark: '#A65133',
    pageBg: '#FFF9F6',
    creamDeep: '#FFF0EA',
    creamMid: '#FFE0D3',
    accent: '#5BE2C2',
    shadowTint: '#E27E5B',
    gradientStart: '#FFF9F6',
    gradientEnd: '#FFF0EA',
  },
  lavender: {
    primary: '#8E6BCB',
    primaryLight: '#BD9EF2',
    primaryDark: '#62429C',
    pageBg: '#FAF9FF',
    creamDeep: '#F3EFFF',
    creamMid: '#E4DCFF',
    accent: '#CBAB6B',
    shadowTint: '#8E6BCB',
    gradientStart: '#FAF9FF',
    gradientEnd: '#F3EFFF',
  },
  mocha: {
    primary: '#8B6F5E',
    primaryLight: '#B39A8A',
    primaryDark: '#5E453A',
    pageBg: '#FBF8F5',
    creamDeep: '#F3EBE3',
    creamMid: '#E8DCD0',
    accent: '#5E8B7A',
    shadowTint: '#8B6F5E',
    gradientStart: '#FBF8F5',
    gradientEnd: '#F3EBE3',
  },
  honey: {
    primary: '#D18E3F',
    primaryLight: '#E8BA82',
    primaryDark: '#966024',
    pageBg: '#FFFDF9',
    creamDeep: '#FFF7ED',
    creamMid: '#FDEBD2',
    accent: '#3FD1B1',
    shadowTint: '#D18E3F',
    gradientStart: '#FFFDF9',
    gradientEnd: '#FFF7ED',
  },
  marigold: {
    primary: '#E6A100',
    primaryLight: '#FFE8A3',
    primaryDark: '#A37200',
    pageBg: '#FFFDF2',
    creamDeep: '#FFF8D1',
    creamMid: '#FFF2B2',
    accent: '#FFC83B',
    shadowTint: '#E6A100',
    gradientStart: '#FFFDF2',
    gradientEnd: '#FFF8D1',
  },
  champagne: {
    primary: '#C9A96E',
    primaryLight: '#E3CC9A',
    primaryDark: '#967840',
    pageBg: '#FFFDF8',
    creamDeep: '#FBF5E8',
    creamMid: '#F0E6CE',
    accent: '#8B7BA8',
    shadowTint: '#C9A96E',
    gradientStart: '#FFFDF8',
    gradientEnd: '#FBF5E8',
  },
  sage: {
    primary: '#5F8265',
    primaryLight: '#91B397',
    primaryDark: '#3F5944',
    pageBg: '#F5F8F6',
    creamDeep: '#EBEFEF',
    creamMid: '#DBE5DE',
    accent: '#825F7C',
    shadowTint: '#5F8265',
    gradientStart: '#F5F8F6',
    gradientEnd: '#EBEFEF',
  },
  emerald: {
    primary: '#007A5E',
    primaryLight: '#48B298',
    primaryDark: '#004D3A',
    pageBg: '#F2FAF7',
    creamDeep: '#E3EFEA',
    creamMid: '#CCE2D8',
    accent: '#D4AF37',
    shadowTint: '#007A5E',
    gradientStart: '#F2FAF7',
    gradientEnd: '#E3EFEA',
  },
  ocean: {
    primary: '#4A9EBD',
    primaryLight: '#83C5DB',
    primaryDark: '#2E6C84',
    pageBg: '#F4FAFC',
    creamDeep: '#E7F5FA',
    creamMid: '#D2EEF7',
    accent: '#BD694A',
    shadowTint: '#4A9EBD',
    gradientStart: '#F4FAFC',
    gradientEnd: '#E7F5FA',
  },
  indigo: {
    primary: '#5F5DEC',
    primaryLight: '#9290F5',
    primaryDark: '#3B3A9C',
    pageBg: '#F6F7FF',
    creamDeep: '#EBEDFF',
    creamMid: '#DBDEFF',
    accent: '#EC5D92',
    shadowTint: '#5F5DEC',
    gradientStart: '#F6F7FF',
    gradientEnd: '#EBEDFF',
  },
  slate: {
    primary: '#5A6A85',
    primaryLight: '#8CA0BA',
    primaryDark: '#3C485C',
    pageBg: '#F5F7FA',
    creamDeep: '#EAEFF5',
    creamMid: '#DBE3EC',
    accent: '#85755A',
    shadowTint: '#5A6A85',
    gradientStart: '#F5F7FA',
    gradientEnd: '#EAEFF5',
  },
  frost: {
    primary: '#2B6CB0',
    primaryLight: '#63B3ED',
    primaryDark: '#2B4C7E',
    pageBg: '#EDF2F7',
    creamDeep: '#E2E8F0',
    creamMid: '#CBD5E0',
    accent: '#718096',
    shadowTint: '#2B6CB0',
    gradientStart: '#EDF2F7',
    gradientEnd: '#E2E8F0',
  },

  // ── Dark & Moody ────────────────────────────────
  midnight: {
    primary: '#FF2E93',
    primaryLight: '#FF79B0',
    primaryDark: '#C60065',
    pageBg: '#0B0D19',
    creamDeep: '#121629',
    creamMid: '#1B203E',
    accent: '#00F5FF',
    isDark: true,
    cardBg: '#1E2235',
    inputBg: '#121629',
    shadowTint: '#000000',
    gradientStart: '#0B0D19',
    gradientEnd: '#1A0F2E',
  },
  twilight: {
    primary: '#B68ADE',
    primaryLight: '#D4B5F0',
    primaryDark: '#8A5CC0',
    pageBg: '#0F0E17',
    creamDeep: '#1A1826',
    creamMid: '#252336',
    accent: '#FFD369',
    isDark: true,
    cardBg: '#1E1C2E',
    inputBg: '#14132A',
    shadowTint: '#000000',
    gradientStart: '#0F0E17',
    gradientEnd: '#1E0F2D',
  },
  aurora: {
    primary: '#6FDDCE',
    primaryLight: '#A3F2E4',
    primaryDark: '#3DB8A6',
    pageBg: '#0D1117',
    creamDeep: '#161B22',
    creamMid: '#21262D',
    accent: '#F778BA',
    isDark: true,
    cardBg: '#1A2332',
    inputBg: '#0D1117',
    shadowTint: '#000000',
    gradientStart: '#0D1117',
    gradientEnd: '#0A1A2A',
  },
  stargazer: {
    primary: '#E8C56D',
    primaryLight: '#FFE4A0',
    primaryDark: '#B89840',
    pageBg: '#0C1220',
    creamDeep: '#141C2E',
    creamMid: '#1E2A42',
    accent: '#A8C5E2',
    isDark: true,
    cardBg: '#182038',
    inputBg: '#101828',
    shadowTint: '#000000',
    gradientStart: '#0C1220',
    gradientEnd: '#151030',
  },
  synthwave: {
    primary: '#FC2EB9',
    primaryLight: '#FF7BE3',
    primaryDark: '#C20089',
    pageBg: '#18122B',
    creamDeep: '#2B1B54',
    creamMid: '#3F2B75',
    accent: '#FFB703',
    isDark: true,
    cardBg: '#271B47',
    inputBg: '#1E123C',
    shadowTint: '#000000',
    gradientStart: '#18122B',
    gradientEnd: '#2B0F3D',
  },
  vampire: {
    primary: '#C91A34',
    primaryLight: '#FF5E74',
    primaryDark: '#8C0018',
    pageBg: '#121212',
    creamDeep: '#1E1E1E',
    creamMid: '#2D2D2D',
    accent: '#D4AF37',
    isDark: true,
    cardBg: '#1A1A1A',
    inputBg: '#121212',
    shadowTint: '#000000',
    gradientStart: '#121212',
    gradientEnd: '#1A0A0A',
  },
};

export const Colors: {
  pageBg: string;
  cardBg: string;
  inputBg: string;
  creamDeep: string;
  creamMid: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  rose100: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  shadowTint: string;
  surfaceMuted: string;
  divider: string;
  overlay: string;
} = {
  pageBg: Palette.cream,
  cardBg: Palette.white,
  inputBg: Palette.creamDeep,
  creamDeep: Palette.creamDeep,
  creamMid: Palette.creamMid,
  primary: Palette.rose500,
  primaryDark: Palette.rose700,
  primaryLight: Palette.rose300,
  rose100: Palette.rose100,
  accent: Palette.mauve400,
  textPrimary: Palette.ink,
  textSecondary: Palette.slate,
  textMuted: Palette.mist,
  textOnPrimary: Palette.white,
  border: Palette.fog,
  success: Palette.success,
  warning: Palette.warning,
  error: Palette.error,
  shadowTint: Palette.rose500,
  surfaceMuted: Palette.rose500 + Opacity.ghost,
  divider: Palette.fog + Opacity.medium,
  overlay: 'rgba(0,0,0,0.3)',
};

export function applyTheme(themeName: string) {
  const t = ThemePalettes[themeName] || ThemePalettes.blush;
  Colors.primary = t.primary;
  Colors.primaryLight = t.primaryLight;
  Colors.primaryDark = t.primaryDark;
  Colors.pageBg = t.pageBg;
  Colors.creamDeep = t.creamDeep;
  Colors.creamMid = t.creamMid;
  Colors.accent = t.accent;
  Colors.rose100 = t.creamDeep;

  // Semantic tokens
  Colors.shadowTint = t.shadowTint || (t.isDark ? '#000000' : t.primary);
  Colors.surfaceMuted = t.surfaceMuted || (t.primary + Opacity.ghost);
  Colors.divider = t.divider || (t.isDark ? 'rgba(255,255,255,0.08)' : Palette.fog + Opacity.medium);
  Colors.overlay = t.overlay || (t.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)');

  if (t.isDark) {
    Colors.cardBg = t.cardBg || '#1A1A1A';
    Colors.inputBg = t.inputBg || t.creamDeep;
    Colors.textPrimary = '#FFFFFF';
    Colors.textSecondary = 'rgba(255, 255, 255, 0.7)';
    Colors.textMuted = 'rgba(255, 255, 255, 0.45)';
    Colors.border = 'rgba(255, 255, 255, 0.15)';
  } else {
    Colors.cardBg = t.cardBg || '#FFFFFF';
    Colors.inputBg = t.inputBg || t.creamDeep;
    Colors.textPrimary = '#1C1917'; // ink
    Colors.textSecondary = 'rgba(28, 25, 23, 0.55)'; // slate
    Colors.textMuted = 'rgba(28, 25, 23, 0.35)'; // mist
    Colors.border = '#D9C1C4'; // fog
  }

  // Update shadows with theme tint
  const tint = Colors.shadowTint;
  Shadows.sm = { shadowColor: tint, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 };
  Shadows.md = { shadowColor: tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 };
  Shadows.card = { shadowColor: tint, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8 };
}

export const FontSize = {
  xs: 12,     // captions, timestamps, micro labels
  sm: 14,     // secondary body, supporting text
  base: 16,   // primary body text
  md: 18,     // subheadings, card titles
  lg: 22,     // screen headings
  xl: 28,     // display, hero moments
  '2xl': 36,  // milestone numbers only
  '3xl': 48,  // display numbers / milestones
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '600' as const,      // Map bold to semibold to prevent shouting
  extrabold: '600' as const, // Map extrabold to semibold to prevent shouting
} as const;

export const Space: Record<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 12 | 14 | 16 | 20, number> = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 14: 56, 16: 64, 20: 80,
};

export const Radii = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, full: 999,
  input: 14, button: 27, card: 20, sheet: 32,
} as const;

type ShadowStyle = { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };

export const Shadows: { sm: ShadowStyle; md: ShadowStyle; card: ShadowStyle } = {
  sm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  md: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8 },
};

export const Sizing = {
  inputHeight: 54, buttonHeight: 54,
  avatarSm: 36, avatarMd: 52, avatarLg: 96,
  tabBarHeight: 80,
} as const;

export const FontFamily = {
  display: 'Lora-Regular',
  body: 'PlusJakartaSans-Regular',
} as const;

export const LineHeight = {
  tight: 1.1,     // 28px+ display
  snug: 1.3,      // 18-22px headings
  normal: 1.4,    // 12-14px text
  body: 1.6,      // 16px body text
  long: 1.8,      // Journal entries / long paragraphs
} as const;