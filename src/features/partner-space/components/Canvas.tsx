import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import { useTimeMood } from '../hooks/useTimeMood';
import { useTheme } from '@shared/hooks';
import CanvasItem from './CanvasItem';
import TimeMoodOverlay from './TimeMoodOverlay';
import GoodnightOverlay from './GoodnightOverlay';
import { getSpaceThemeConfig } from '../types';
import type { PartnerSpaceItem, SpaceThemeConfig } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_HEIGHT = SCREEN_WIDTH * 1.2;

interface CanvasProps {
  /** If true, user can drag/resize/reorder items */
  editable: boolean;
  /** Canvas width override */
  canvasWidth?: number;
  /** Canvas height override */
  canvasHeight?: number;
  /** Scale item positions/sizes into this canvas for compact widget previews */
  fitItemsToCanvas?: boolean;
  /** Called when an item is updated (position, size, z-index) */
  onItemUpdate?: (item: PartnerSpaceItem) => void;
  /** Called when an item should be deleted */
  onItemDelete?: (item: PartnerSpaceItem) => void;
  /** Called when an item is long-pressed (for reactions or delete) */
  onItemLongPress?: (item: PartnerSpaceItem) => void;
  /** Called when an item is tapped (for gifts) */
  onItemTap?: (item: PartnerSpaceItem) => void;
}

const Canvas: React.FC<CanvasProps> = ({
  editable,
  canvasWidth = SCREEN_WIDTH - 32,
  canvasHeight = CANVAS_HEIGHT,
  fitItemsToCanvas = false,
  onItemUpdate,
  onItemDelete,
  onItemLongPress,
  onItemTap,
}) => {
  const { colors } = useTheme();
  const space = usePartnerSpaceStore((s) => s.space);
  const items = usePartnerSpaceStore((s) => s.items);
  const { config: moodConfig } = useTimeMood();

  // Derive active items with stable reference
  const activeItems = useMemo(
    () => items.filter((i) => !i.isDeleted && !i.disappeared && !i.isHidden && i.isScheduledPublished),
    [items]
  );

  // Get theme config
  const themeConfig = useMemo<SpaceThemeConfig>(() => {
    return getSpaceThemeConfig(space?.theme, colors);
  }, [space?.theme, colors]);

  // Sort items by z-index for proper layering
  const sortedItems = useMemo(
    () => [...activeItems].sort((a, b) => a.zIndex - b.zIndex),
    [activeItems]
  );

  const displayItems = useMemo(() => {
    if (!fitItemsToCanvas) return sortedItems;

    const baseWidth = SCREEN_WIDTH - 32;
    const baseHeight = CANVAS_HEIGHT;
    const scaleX = canvasWidth / baseWidth;
    const scaleY = canvasHeight / baseHeight;
    const itemScale = Math.max(0.45, Math.min(scaleX, scaleY));

    return sortedItems.map((item) => {
      const width = Math.max(42, item.width * itemScale);
      const height = Math.max(42, item.height * itemScale);
      return {
        ...item,
        positionX: Math.max(0, Math.min(canvasWidth - width, item.positionX * scaleX)),
        positionY: Math.max(0, Math.min(canvasHeight - height, item.positionY * scaleY)),
        width,
        height,
      };
    });
  }, [canvasHeight, canvasWidth, fitItemsToCanvas, sortedItems]);

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[
        styles.canvas,
        {
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor: themeConfig.background,
          borderColor: themeConfig.borderColor,
        },
      ]}
    >
      {/* Cork board texture dots */}
      {themeConfig.id === 'cork_board' && (
        <View style={styles.corkTexture}>
          {Array.from({ length: 20 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.corkDot,
                {
                  left: `${(i * 17 + 5) % 90}%`,
                  top: `${(i * 23 + 8) % 85}%`,
                  opacity: 0.08 + (i % 3) * 0.04,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Canvas items */}
      {displayItems.map((item) => (
        <CanvasItem
          key={item.id}
          item={item}
          editable={editable}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onUpdate={onItemUpdate}
          onDelete={onItemDelete}
          onLongPress={onItemLongPress}
          onTap={onItemTap}
        />
      ))}

      {/* Time mood overlay */}
      {space?.timeMoodEnabled && (
        <TimeMoodOverlay
          tintColor={moodConfig.tintColor}
          tintOpacity={moodConfig.tintOpacity}
        />
      )}

      {/* Goodnight overlay */}
      {space?.goodnightActive && (
        <GoodnightOverlay message={space.goodnightMessage} />
      )}

      {/* Empty state */}
      {displayItems.length === 0 && (
        <View style={styles.emptyState}>
          <Animated.Text
            entering={FadeIn.delay(300).duration(600)}
            style={[styles.emptyEmoji]}
          >
            💌
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.delay(500).duration(600)}
            style={[styles.emptyText, { color: themeConfig.textColor }]}
          >
            Your partner hasn't left anything yet...{'\n'}maybe send them a hint? 💌
          </Animated.Text>
        </View>
      )}
    </Animated.View>
  );
};

export default React.memo(Canvas);

const styles = StyleSheet.create({
  canvas: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  corkTexture: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  corkDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8B6914',
  },
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 1,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Caveat-Regular',
    opacity: 0.7,
  },
});
