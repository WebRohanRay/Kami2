import { NativeModules, Platform } from 'react-native';
import type { PartnerSpace, PartnerSpaceItem, TimeMood } from '../types';
import { TIME_MOOD_CONFIG } from '../types';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';

type NativePartnerSpaceWidget = {
  updateWidget?: (stateJson: string) => Promise<boolean>;
};

type WidgetItem = Pick<
  PartnerSpaceItem,
  'id' | 'type' | 'content' | 'isGiftOpened' | 'createdAt' | 'updatedAt'
>;

type WidgetState = {
  nickname: string;
  mood: TimeMood;
  goodnightActive: boolean;
  goodnightMessage: string | null;
  hasNewUpdate: boolean;
  presence: string | null;
  updatedAt: string;
  items: WidgetItem[];
};

const MAX_WIDGET_ITEMS = 5;

function getCurrentMood(): TimeMood {
  const hour = new Date().getHours();
  const moods = Object.entries(TIME_MOOD_CONFIG) as Array<
    [TimeMood, (typeof TIME_MOOD_CONFIG)[TimeMood]]
  >;

  const match = moods.find(([, config]) => {
    if (config.startHour < config.endHour) {
      return hour >= config.startHour && hour < config.endHour;
    }
    return hour >= config.startHour || hour < config.endHour;
  });

  return match?.[0] ?? 'afternoon';
}

function getActiveItems(items: PartnerSpaceItem[]): PartnerSpaceItem[] {
  return items
    .filter(
      (item) =>
        !item.isDeleted &&
        !item.disappeared &&
        !item.isHidden &&
        item.isScheduledPublished
    )
    .sort((a, b) => a.zIndex - b.zIndex || a.createdAt.localeCompare(b.createdAt));
}

function toWidgetItem(item: PartnerSpaceItem): WidgetItem {
  return {
    id: item.id,
    type: item.type,
    content: item.content,
    isGiftOpened: item.isGiftOpened,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function buildPartnerSpaceWidgetState(
  space: PartnerSpace | null,
  items: PartnerSpaceItem[],
  options?: {
    presence?: string | null;
    hasNewUpdate?: boolean;
  }
): WidgetState {
  return {
    nickname: space?.nickname || 'Our Wall',
    mood: getCurrentMood(),
    goodnightActive: space?.goodnightActive ?? false,
    goodnightMessage: space?.goodnightMessage ?? null,
    hasNewUpdate: options?.hasNewUpdate ?? false,
    presence: options?.presence ?? null,
    updatedAt: new Date().toISOString(),
    items: getActiveItems(items).slice(0, MAX_WIDGET_ITEMS).map(toWidgetItem),
  };
}

export async function syncPartnerSpaceWidget(
  space: PartnerSpace | null,
  items: PartnerSpaceItem[],
  options?: {
    presence?: string | null;
    hasNewUpdate?: boolean;
  }
): Promise<void> {
  if (Platform.OS !== 'android') return;

  const widgetModule = NativeModules.PartnerSpaceWidget as NativePartnerSpaceWidget | undefined;
  if (!widgetModule?.updateWidget) return;

  const state = buildPartnerSpaceWidgetState(space, items, options);
  await widgetModule.updateWidget(JSON.stringify(state));
}

export function syncPartnerSpaceWidgetFromStore(): void {
  const store = usePartnerSpaceStore.getState();
  syncPartnerSpaceWidget(store.space, store.items, {
    hasNewUpdate: store.newUpdateDot,
    presence: store.partnerPresenceText,
  }).catch((error) => {
    if (__DEV__) {
      console.warn('[PartnerSpaceWidget] Failed to sync widget state', error);
    }
  });
}
