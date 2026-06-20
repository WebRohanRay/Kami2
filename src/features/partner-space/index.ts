// ─── Partner Space — Feature Module Index ─────────────────────────────────────
//
// Barrel export for the Partner Space feature.
// Import everything from '@features/partner-space'.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  SpaceItemType,
  DisappearCondition,
  SpaceTheme,
  TimeMood,
  NoteColor,
  NoteFontStyle,
  SnapshotType,
  PhotoContent,
  NoteContent,
  StickerContent,
  DrawingContent,
  GiftContent,
  ItemContent,
  PartnerSpace,
  PartnerSpaceItem,
  PartnerSpaceSnapshot,
  PartnerSpacePermissions,
  Sticker,
  StickerPack,
  WidgetSize,
  WidgetSizeConfig,
  SpaceThemeConfig,
} from './types';

export {
  WIDGET_SIZES,
  MAX_CANVAS_ITEMS,
  MAX_PHOTOS,
  MAX_NOTE_LENGTH,
  TAKEOVER_DURATION_SECONDS,
  QUICK_NOTES,
  REACTION_EMOJIS,
  DEFAULT_STICKERS,
  NOTE_COLORS,
  PRESENCE_MESSAGES,
  SPACE_THEMES,
  TIME_MOOD_CONFIG,
} from './types';

// ── Store ─────────────────────────────────────────────────────────────────────
export { usePartnerSpaceStore } from './store/partnerSpaceStore';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export {
  usePartnerSpace,
  useTimeMood,
  usePresence,
  useDisappearingItemsProcessor,
} from './hooks';

// ── Components ────────────────────────────────────────────────────────────────
export { default as Canvas } from './components/Canvas';
export { default as CanvasItem } from './components/CanvasItem';
export { default as PolaroidFrame } from './components/PolaroidFrame';
export { default as StickyNote } from './components/StickyNote';
export { default as GiftBox } from './components/GiftBox';
export { default as ReactionBar } from './components/ReactionBar';
export { default as TimeMoodOverlay } from './components/TimeMoodOverlay';
export { default as GoodnightOverlay } from './components/GoodnightOverlay';
export { default as FloatingAddButton } from './components/FloatingAddButton';
export { default as QuickComposeSheet } from './components/QuickComposeSheet';
export { default as PresenceIndicator } from './components/PresenceIndicator';
export { PartnerSpaceRealtimeListener } from './components/PartnerSpaceRealtimeListener';

// ── Screens ───────────────────────────────────────────────────────────────────
export { default as SpaceHomeScreen } from './screens/SpaceHomeScreen';
export { default as PartnerCanvasScreen } from './screens/PartnerCanvasScreen';
export { default as WidgetPreviewScreen } from './screens/WidgetPreviewScreen';
export { default as PermissionsScreen } from './screens/PermissionsScreen';
export { default as HistoryScreen } from './screens/HistoryScreen';
export { default as ScheduledDropsScreen } from './screens/ScheduledDropsScreen';
export { default as SpaceSettingsScreen } from './screens/SpaceSettingsScreen';
