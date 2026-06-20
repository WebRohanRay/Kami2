// ─── Partner Space — Type Definitions ─────────────────────────────────────────

/** Content types that can be placed on the canvas */
export type SpaceItemType = 'photo' | 'note' | 'sticker' | 'drawing' | 'gift';

/** Conditions under which an item disappears */
export type DisappearCondition = 'after_24h' | 'after_seen' | 'after_reacted';

/** Visual themes for the canvas/widget */
export type SpaceTheme = 'cork_board' | 'dark_romantic' | 'minimal_white' | 'pastel_pink' | 'custom';

/** Time-of-day mood shifts */
export type TimeMood = 'morning' | 'afternoon' | 'evening' | 'night';

/** Sticky note background colors */
export type NoteColor = 'pink' | 'yellow' | 'blue' | 'white' | 'lavender';

/** Note font style */
export type NoteFontStyle = 'handwritten' | 'clean' | 'bold';

/** Snapshot types for history */
export type SnapshotType = 'auto' | 'goodnight' | 'takeover' | 'manual';

// ─── Content-Specific Data (stored in item.content JSONB) ─────────────────────

export interface PhotoContent {
  imageUrl: string;
  thumbnailUrl?: string;
  caption?: string;
}

export interface NoteContent {
  text: string;
  color: NoteColor;
  fontStyle: NoteFontStyle;
}

export interface StickerContent {
  stickerId: string;
  packId: string;
  /** URL or emoji character */
  stickerSource: string;
  /** Whether this is an emoji or an image URL */
  sourceType: 'emoji' | 'image';
}

export interface DrawingContent {
  imageUrl: string;
  thumbnailUrl?: string;
}

export interface GiftContent {
  /** What's hidden inside — a note or a photo */
  giftType: 'note' | 'photo';
  /** Hidden content, only visible after owner opens */
  hiddenContent: NoteContent | PhotoContent;
}

export type ItemContent = PhotoContent | NoteContent | StickerContent | DrawingContent | GiftContent;

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface PartnerSpace {
  id: string;
  coupleId: string;
  nickname: string;
  theme: SpaceTheme;
  widgetSize: WidgetSize;
  customColor?: string;
  timeMoodEnabled: boolean;
  goodnightActive: boolean;
  goodnightMessage: string | null;
  goodnightActivatedAt: string | null;
  takeoverActive: boolean;
  takeoverStartedAt: string | null;
  takeoverBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerSpaceItem {
  id: string;
  spaceId: string;
  addedBy: string;
  type: SpaceItemType;
  content: ItemContent;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  isHidden: boolean;
  isDeleted: boolean;
  reactionEmoji: string | null;
  reactedBy: string | null;
  disappearCondition: DisappearCondition | null;
  disappearAt: string | null;
  disappeared: boolean;
  isGiftOpened: boolean;
  scheduledAt: string | null;
  isScheduledPublished: boolean;
  seenAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Joined from profiles for display */
  addedByNickname?: string;
}

export interface PartnerSpaceSnapshot {
  id: string;
  spaceId: string;
  snapshotData: {
    items: PartnerSpaceItem[];
    nickname: string;
    theme: SpaceTheme;
  };
  thumbnailUrl: string | null;
  snapshotType: SnapshotType;
  createdAt: string;
}

export interface PartnerSpacePermissions {
  spaceId: string;
  allowPhotos: boolean;
  allowNotes: boolean;
  allowStickers: boolean;
  allowDrawings: boolean;
  allowGifts: boolean;
  allowScheduledDrops: boolean;
  allowDisappearing: boolean;
  allowTakeover: boolean;
  allowPartnerMove: boolean;
  allowPartnerDelete: boolean;
  updatedAt: string;
}

export interface Sticker {
  id: string;
  /** Emoji character or image URL */
  source: string;
  sourceType: 'emoji' | 'image';
  label: string;
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: Sticker[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

// ─── Widget Size Configuration ────────────────────────────────────────────────

export type WidgetSize = 'small' | 'medium' | 'large';

export interface WidgetSizeConfig {
  size: WidgetSize;
  label: string;
  gridWidth: number;
  gridHeight: number;
  maxVisibleItems: number;
  /** Dimensions in dp for preview rendering */
  previewWidth: number;
  previewHeight: number;
}

export const WIDGET_SIZES: Record<WidgetSize, WidgetSizeConfig> = {
  small: {
    size: 'small',
    label: '2×2',
    gridWidth: 2,
    gridHeight: 2,
    maxVisibleItems: 1,
    previewWidth: 160,
    previewHeight: 160,
  },
  medium: {
    size: 'medium',
    label: '4×2',
    gridWidth: 4,
    gridHeight: 2,
    maxVisibleItems: 4,
    previewWidth: 320,
    previewHeight: 160,
  },
  large: {
    size: 'large',
    label: '4×4',
    gridWidth: 4,
    gridHeight: 4,
    maxVisibleItems: 20,
    previewWidth: 320,
    previewHeight: 320,
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum total items on canvas */
export const MAX_CANVAS_ITEMS = 20;

/** Maximum photos on canvas */
export const MAX_PHOTOS = 5;

/** Maximum note characters */
export const MAX_NOTE_LENGTH = 100;

/** Takeover duration in seconds */
export const TAKEOVER_DURATION_SECONDS = 30;

/** Quick note presets */
export const QUICK_NOTES = [
  { text: 'Good morning ☀️', emoji: '☀️' },
  { text: 'I miss you 🥺', emoji: '🥺' },
  { text: 'Good night 🌙', emoji: '🌙' },
  { text: 'Have a great day 💗', emoji: '💗' },
] as const;

/** Reaction emoji options */
export const REACTION_EMOJIS = ['❤️', '😊', '🥺', '😘'] as const;

/** Default sticker pack (bundled) */
export const DEFAULT_STICKERS: Sticker[] = [
  { id: 'heart', source: '❤️', sourceType: 'emoji', label: 'Heart' },
  { id: 'star', source: '⭐', sourceType: 'emoji', label: 'Star' },
  { id: 'teddy', source: '🧸', sourceType: 'emoji', label: 'Teddy Bear' },
  { id: 'coffee', source: '☕', sourceType: 'emoji', label: 'Coffee' },
  { id: 'moon', source: '🌙', sourceType: 'emoji', label: 'Moon' },
  { id: 'flower', source: '🌸', sourceType: 'emoji', label: 'Flower' },
  { id: 'sparkles', source: '✨', sourceType: 'emoji', label: 'Sparkles' },
  { id: 'kiss', source: '💋', sourceType: 'emoji', label: 'Kiss' },
  { id: 'butterfly', source: '🦋', sourceType: 'emoji', label: 'Butterfly' },
  { id: 'rainbow', source: '🌈', sourceType: 'emoji', label: 'Rainbow' },
  { id: 'rose', source: '🌹', sourceType: 'emoji', label: 'Rose' },
  { id: 'sun', source: '🌞', sourceType: 'emoji', label: 'Sun' },
  { id: 'cloud', source: '☁️', sourceType: 'emoji', label: 'Cloud' },
  { id: 'fire', source: '🔥', sourceType: 'emoji', label: 'Fire' },
  { id: 'gem', source: '💎', sourceType: 'emoji', label: 'Gem' },
  { id: 'ribbon', source: '🎀', sourceType: 'emoji', label: 'Ribbon' },
  { id: 'candy', source: '🍬', sourceType: 'emoji', label: 'Candy' },
  { id: 'crown', source: '👑', sourceType: 'emoji', label: 'Crown' },
  { id: 'infinity', source: '♾️', sourceType: 'emoji', label: 'Forever' },
  { id: 'two_hearts', source: '💕', sourceType: 'emoji', label: 'Two Hearts' },
];

/** Note background color values */
export const NOTE_COLORS: Record<NoteColor, string> = {
  pink: '#FFD6DE',
  yellow: '#FFF9C4',
  blue: '#BBDEFB',
  white: '#FFFFFF',
  lavender: '#E8DAEF',
};

/** Presence message templates */
export const PRESENCE_MESSAGES: Record<string, string> = {
  photo: 'Added a photo {time}',
  note: 'Left you a note {time}',
  sticker: 'Decorated your widget {time}',
  drawing: 'Left a drawing for you {time}',
  gift: 'Left you a surprise {time}',
  scheduled: 'Scheduled something for you 🕐',
  goodnight: 'Set a goodnight for you 🌙',
  disappearing: 'Left something that won\'t last long 🫧',
  takeover: 'Someone\'s on your wall... ❤️',
  generic: 'Decorated your widget {time}',
};

/** Theme configurations */
export interface SpaceThemeConfig {
  id: SpaceTheme;
  label: string;
  background: string;
  borderColor: string;
  textColor: string;
  surfaceColor: string;
  isDark: boolean;
}

export const SPACE_THEMES: SpaceThemeConfig[] = [
  {
    id: 'cork_board',
    label: 'Cork Board',
    background: '#D4A574',
    borderColor: '#8B6914',
    textColor: '#3E2723',
    surfaceColor: '#E8C9A0',
    isDark: false,
  },
  {
    id: 'dark_romantic',
    label: 'Dark Romantic',
    background: '#1A0F1E',
    borderColor: '#4A2040',
    textColor: '#F8E8F0',
    surfaceColor: '#2D1830',
    isDark: true,
  },
  {
    id: 'minimal_white',
    label: 'Minimal White',
    background: '#FAFAFA',
    borderColor: '#E0E0E0',
    textColor: '#333333',
    surfaceColor: '#FFFFFF',
    isDark: false,
  },
  {
    id: 'pastel_pink',
    label: 'Pastel Pink',
    background: '#FFF0F5',
    borderColor: '#FFB6C1',
    textColor: '#8B4557',
    surfaceColor: '#FFF5F8',
    isDark: false,
  },
  {
    id: 'custom',
    label: 'Custom Color',
    background: '#FFF8F8',
    borderColor: '#FFD6DE',
    textColor: '#1C1917',
    surfaceColor: '#FFFFFF',
    isDark: false,
  },
];

export function getSpaceThemeConfig(
  themeId: SpaceTheme | undefined,
  colors?: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    pageBg: string;
    creamDeep: string;
    creamMid: string;
    cardBg?: string;
    textPrimary: string;
    border: string;
  }
): SpaceThemeConfig {
  if (!colors) {
    return SPACE_THEMES.find((t) => t.id === themeId) || SPACE_THEMES[0];
  }

  const themed: SpaceThemeConfig[] = [
    {
      id: 'cork_board',
      label: 'Cork Board',
      background: colors.creamMid,
      borderColor: colors.primaryDark,
      textColor: colors.textPrimary,
      surfaceColor: colors.creamDeep,
      isDark: false,
    },
    {
      id: 'dark_romantic',
      label: 'Dark Romantic',
      background: '#1A0F1E',
      borderColor: colors.primaryDark,
      textColor: '#F8E8F0',
      surfaceColor: '#2D1830',
      isDark: true,
    },
    {
      id: 'minimal_white',
      label: 'Minimal White',
      background: colors.cardBg || '#FFFFFF',
      borderColor: colors.border,
      textColor: colors.textPrimary,
      surfaceColor: colors.cardBg || '#FFFFFF',
      isDark: false,
    },
    {
      id: 'pastel_pink',
      label: 'Pastel Pink',
      background: colors.creamDeep,
      borderColor: colors.primaryLight,
      textColor: colors.primaryDark,
      surfaceColor: colors.pageBg,
      isDark: false,
    },
    {
      id: 'custom',
      label: 'App Theme',
      background: colors.pageBg,
      borderColor: colors.primary,
      textColor: colors.textPrimary,
      surfaceColor: colors.cardBg || colors.creamDeep,
      isDark: false,
    },
  ];

  return themed.find((t) => t.id === themeId) || themed[0];
}

/** Time mood configurations */
export const TIME_MOOD_CONFIG: Record<TimeMood, { startHour: number; endHour: number; tintColor: string; tintOpacity: number; label: string }> = {
  morning: { startHour: 6, endHour: 12, tintColor: '#FFD700', tintOpacity: 0.08, label: 'Morning Glow' },
  afternoon: { startHour: 12, endHour: 18, tintColor: 'transparent', tintOpacity: 0, label: 'Bright Day' },
  evening: { startHour: 18, endHour: 22, tintColor: '#FF8C00', tintOpacity: 0.1, label: 'Warm Evening' },
  night: { startHour: 22, endHour: 6, tintColor: '#1A0033', tintOpacity: 0.2, label: 'Intimate Night' },
};
