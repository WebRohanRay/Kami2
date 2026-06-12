export const Palette = {
  cream: '#FFF8F8', creamDeep: '#FFF0F2', creamMid: '#FDE8EC',
  rose100: '#FFD6DE', rose300: '#F4A0B5', rose500: '#C96882',
  rose700: '#953F56', rose900: '#2D141B',
  mauve400: '#B591C8', ink: '#1C1917', slate: 'rgba(28, 25, 23, 0.55)',
  mist: 'rgba(28, 25, 23, 0.35)', fog: '#D9C1C4', white: '#FFFFFF',
  success: '#6DB88C', warning: '#E8A84A', error: '#D95555',
} as const;

export const ThemePalettes: Record<string, {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  pageBg: string;
  creamDeep: string;
  creamMid: string;
  accent: string;
}> = {
  blush: {
    primary: '#C96882',
    primaryLight: '#F4A0B5',
    primaryDark: '#953F56',
    pageBg: '#FFF8F8',
    creamDeep: '#FFF0F2',
    creamMid: '#FDE8EC',
    accent: '#B591C8',
  },
  indigo: {
    primary: '#5F5DEC',
    primaryLight: '#9290F5',
    primaryDark: '#3B3A9C',
    pageBg: '#F6F7FF',
    creamDeep: '#EBEDFF',
    creamMid: '#DBDEFF',
    accent: '#EC5D92',
  },
  slate: {
    primary: '#5A6A85',
    primaryLight: '#8CA0BA',
    primaryDark: '#3C485C',
    pageBg: '#F5F7FA',
    creamDeep: '#EAEFF5',
    creamMid: '#DBE3EC',
    accent: '#85755A',
  },
  sage: {
    primary: '#5F8265',
    primaryLight: '#91B397',
    primaryDark: '#3F5944',
    pageBg: '#F5F8F6',
    creamDeep: '#EBEFEF',
    creamMid: '#DBE5DE',
    accent: '#825F7C',
  },
  honey: {
    primary: '#D18E3F',
    primaryLight: '#E8BA82',
    primaryDark: '#966024',
    pageBg: '#FFFDF9',
    creamDeep: '#FFF7ED',
    creamMid: '#FDEBD2',
    accent: '#3FD1B1',
  },
  lavender: {
    primary: '#8E6BCB',
    primaryLight: '#BD9EF2',
    primaryDark: '#62429C',
    pageBg: '#FAF9FF',
    creamDeep: '#F3EFFF',
    creamMid: '#E4DCFF',
    accent: '#CBAB6B',
  },
  coral: {
    primary: '#E27E5B',
    primaryLight: '#FAAE91',
    primaryDark: '#A65133',
    pageBg: '#FFF9F6',
    creamDeep: '#FFF0EA',
    creamMid: '#FFE0D3',
    accent: '#5BE2C2',
  },
  ocean: {
    primary: '#4A9EBD',
    primaryLight: '#83C5DB',
    primaryDark: '#2E6C84',
    pageBg: '#F4FAFC',
    creamDeep: '#E7F5FA',
    creamMid: '#D2EEF7',
    accent: '#BD694A',
  },
  crimson: {
    primary: '#D3455B',
    primaryLight: '#E88091',
    primaryDark: '#992638',
    pageBg: '#FFF8F9',
    creamDeep: '#FFEBF0',
    creamMid: '#FFD2DD',
    accent: '#45D3BD',
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

export const Shadows = {
  sm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  md: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8 },
} as const;

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