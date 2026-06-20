import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  ZoomIn,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { PartnerSpaceItem } from '../types';
import PolaroidFrame from './PolaroidFrame';
import StickyNote from './StickyNote';
import GiftBox from './GiftBox';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import type { PhotoContent, NoteContent, StickerContent, DrawingContent, GiftContent } from '../types';

interface CanvasItemProps {
  item: PartnerSpaceItem;
  editable: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onUpdate?: (item: PartnerSpaceItem) => void;
  onLongPress?: (item: PartnerSpaceItem) => void;
  onTap?: (item: PartnerSpaceItem) => void;
}

const CanvasItem: React.FC<CanvasItemProps> = ({
  item,
  editable,
  canvasWidth,
  canvasHeight,
  onUpdate,
  onLongPress,
  onTap,
}) => {
  // Shared values for gestures
  const translateX = useSharedValue(item.positionX);
  const translateY = useSharedValue(item.positionY);
  const scale = useSharedValue(1);
  const savedTranslateX = useSharedValue(item.positionX);
  const savedTranslateY = useSharedValue(item.positionY);

  useEffect(() => {
    translateX.value = item.positionX;
    translateY.value = item.positionY;
    savedTranslateX.value = item.positionX;
    savedTranslateY.value = item.positionY;
  }, [item.positionX, item.positionY, savedTranslateX, savedTranslateY, translateX, translateY]);

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .enabled(editable)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      // Clamp to canvas bounds
      const minX = 0;
      const minY = 0;
      const maxX = Math.max(0, canvasWidth - item.width);
      const maxY = Math.max(0, canvasHeight - item.height);
      const nextX = Math.max(minX, Math.min(maxX, translateX.value));
      const nextY = Math.max(minY, Math.min(maxY, translateY.value));

      translateX.value = withSpring(
        nextX,
        { damping: 20, stiffness: 200 }
      );
      translateY.value = withSpring(
        nextY,
        { damping: 20, stiffness: 200 }
      );

      // Notify parent of position change
      if (onUpdate) {
        runOnJS(onUpdate)({
          ...item,
          positionX: nextX,
          positionY: nextY,
        });
      }
    });

  // Pinch gesture for resizing
  const pinchGesture = Gesture.Pinch()
    .enabled(editable)
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(2.5, e.scale));
    })
    .onEnd(() => {
      const newWidth = Math.max(60, Math.min(300, item.width * scale.value));
      const newHeight = Math.max(60, Math.min(300, item.height * scale.value));
      scale.value = withSpring(1);

      if (onUpdate) {
        runOnJS(onUpdate)({ ...item, width: newWidth, height: newHeight });
      }
    });

  // Long press for context menu
  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onEnd(() => {
      if (onLongPress) runOnJS(onLongPress)(item);
    });

  // Tap for gifts and interactions
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (onTap) runOnJS(onTap)(item);
    });

  const composed = Gesture.Simultaneous(
    panGesture,
    Gesture.Simultaneous(pinchGesture, Gesture.Exclusive(longPressGesture, tapGesture))
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${item.rotation}deg` },
      { scale: scale.value },
    ],
  }));

  // Render content based on type
  const renderContent = useCallback(() => {
    switch (item.type) {
      case 'photo': {
        const content = item.content as PhotoContent;
        return (
          <PolaroidFrame
            imageUrl={content.imageUrl}
            caption={content.caption}
            width={item.width}
            height={item.height}
          />
        );
      }
      case 'note': {
        const content = item.content as NoteContent;
        return (
          <StickyNote
            text={content.text}
            color={content.color}
            fontStyle={content.fontStyle}
            width={item.width}
            height={item.height}
          />
        );
      }
      case 'sticker': {
        const content = item.content as StickerContent;
        return (
          <View style={[styles.stickerContainer, { width: item.width, height: item.height }]}>
            {content.sourceType === 'emoji' ? (
              <Text style={[styles.stickerEmoji, { fontSize: item.width * 0.6 }]}>
                {content.stickerSource}
              </Text>
            ) : (
              <Animated.Image
                source={{ uri: content.stickerSource }}
                style={{ width: item.width, height: item.height }}
                resizeMode="contain"
              />
            )}
          </View>
        );
      }
      case 'drawing': {
        const content = item.content as DrawingContent;
        return (
          <View style={[styles.drawingContainer, { width: item.width, height: item.height }]}>
            <KamiImage
              src={content.imageUrl}
              bucket="partner-space"
              style={{ width: item.width, height: item.height, borderRadius: 8 }}
              resizeMode="contain"
            />
          </View>
        );
      }
      case 'gift': {
        return (
          <GiftBox
            isOpened={item.isGiftOpened}
            width={item.width}
            height={item.height}
          />
        );
      }
      default:
        return null;
    }
  }, [item]);

  // Reaction badge
  const renderReactionBadge = () => {
    if (!item.reactionEmoji) return null;
    return (
      <Animated.View
        entering={ZoomIn.duration(300)}
        style={styles.reactionBadge}
      >
        <Text style={styles.reactionEmoji}>{item.reactionEmoji}</Text>
      </Animated.View>
    );
  };

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        entering={FadeIn.duration(400).delay(100)}
        style={[
          styles.itemWrapper,
          { zIndex: item.zIndex, width: item.width, height: item.height },
          animatedStyle,
        ]}
      >
        {renderContent()}
        {renderReactionBadge()}
      </Animated.View>
    </GestureDetector>
  );
};

export default React.memo(CanvasItem);

const styles = StyleSheet.create({
  itemWrapper: {
    position: 'absolute',
  },
  stickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerEmoji: {
    textAlign: 'center',
  },
  drawingContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  reactionBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reactionEmoji: {
    fontSize: 16,
  },
});
