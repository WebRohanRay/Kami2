import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  FlatList,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import KamiText from '../atoms/KamiText';

const { width, height } = Dimensions.get('window');

interface ImageZoomModalProps {
  visible: boolean;
  imageUri?: string | null;  // For backward compatibility (single photo)
  imageUris?: string[];      // For multi-photo gallery lightbox
  initialIndex?: number;     // Starting photo index
  onClose: () => void;
}

const ZoomableImage: React.FC<{ uri: string; onZoomStateChange: (zoomed: boolean) => void }> = ({ uri, onZoomStateChange }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);

  const handleZoomChange = (isZoomed: boolean) => {
    onZoomStateChange(isZoomed);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
        runOnJS(handleZoomChange)(false);
      } else if (scale.value > 5) {
        scale.value = withTiming(5);
        savedScale.value = 5;
        runOnJS(handleZoomChange)(true);
      } else {
        savedScale.value = scale.value;
        runOnJS(handleZoomChange)(true);
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translationX.value = savedTranslationX.value + event.translationX;
        translationY.value = savedTranslationY.value + event.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value > 1) {
        const maxTx = Math.max(0, (width * (scale.value - 1)) / 2);
        const maxTy = Math.max(0, (height * 0.8 * (scale.value - 1)) / 2);

        if (translationX.value > maxTx) {
          translationX.value = withTiming(maxTx);
        } else if (translationX.value < -maxTx) {
          translationX.value = withTiming(-maxTx);
        }

        if (translationY.value > maxTy) {
          translationY.value = withTiming(maxTy);
        } else if (translationY.value < -maxTy) {
          translationY.value = withTiming(-maxTy);
        }

        savedTranslationX.value = Math.max(-maxTx, Math.min(maxTx, translationX.value));
        savedTranslationY.value = Math.max(-maxTy, Math.min(maxTy, translationY.value));
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
        runOnJS(handleZoomChange)(false);
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
        runOnJS(handleZoomChange)(true);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translationX.value },
        { translateY: translationY.value },
        { scale: scale.value },
      ],
    };
  });

  const composed = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  return (
    <View style={styles.imageContainer}>
      <GestureDetector gesture={composed}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, animatedStyle]}
          resizeMode="contain"
        />
      </GestureDetector>
    </View>
  );
};

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  visible,
  imageUri,
  imageUris,
  initialIndex = 0,
  onClose,
}) => {
  const uris = imageUris && imageUris.length > 0
    ? imageUris
    : (imageUri ? [imageUri] : []);

  if (uris.length === 0) return null;

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const flatListRef = useRef<FlatList<string>>(null);

  // Reset index when modal becomes visible
  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
      setZoomed(false);
      // Wait for layout to mount before scrolling
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / width);
    if (index >= 0 && index < uris.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const handleNext = () => {
    if (activeIndex < uris.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
      setActiveIndex(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: activeIndex - 1, animated: true });
      setActiveIndex(activeIndex - 1);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalBg}>
        <StatusBar barStyle="light-content" />
        
        {/* Header toolbar */}
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <KamiText variant="overline" color="#fff" bold>
            {uris.length > 1 ? `Memory Gallery (${activeIndex + 1}/${uris.length})` : 'Photo Preview'}
          </KamiText>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* FlatList Gallery Container */}
        <View style={{ flex: 1, position: 'relative' }}>
          <FlatList
            ref={flatListRef}
            data={uris}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item}_${index}`}
            renderItem={({ item }) => (
              <ZoomableImage uri={item} onZoomStateChange={setZoomed} />
            )}
            onMomentumScrollEnd={handleScroll}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            initialScrollIndex={initialIndex}
          />

          {/* Chevron Overlays */}
          {uris.length > 1 && !zoomed && (
            <>
              {activeIndex > 0 && (
                <TouchableOpacity
                  style={[styles.chevronBtn, styles.leftChevron]}
                  onPress={handlePrev}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chevronText}>‹</Text>
                </TouchableOpacity>
              )}
              {activeIndex < uris.length - 1 && (
                <TouchableOpacity
                  style={[styles.chevronBtn, styles.rightChevron]}
                  onPress={handleNext}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chevronText}>›</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Footer instruction */}
        <View style={styles.footer}>
          <KamiText variant="caption" color="rgba(255, 255, 255, 0.6)" align="center">
            {uris.length > 1 && !zoomed ? 'Swipe or tap arrows to navigate\n' : ''}
            Pinch to zoom • Drag to pan • Double tap to reset
          </KamiText>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    height: 60,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageContainer: {
    width: width,
    height: height * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height * 0.75,
  },
  chevronBtn: {
    position: 'absolute',
    top: '45%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  leftChevron: {
    left: 16,
  },
  rightChevron: {
    right: 16,
  },
  chevronText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: Platform.OS === 'ios' ? 36 : 40,
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
});
