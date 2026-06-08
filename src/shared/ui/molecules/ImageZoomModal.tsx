import React from 'react';
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
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import KamiText from '../atoms/KamiText';

const { width, height } = Dimensions.get('window');

interface ImageZoomModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

const ZoomableImage: React.FC<{ uri: string }> = ({ uri }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      } else if (scale.value > 5) {
        scale.value = withTiming(5);
        savedScale.value = 5;
      } else {
        savedScale.value = scale.value;
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
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
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
  onClose,
}) => {
  if (!imageUri) return null;

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
            Photo Preview
          </KamiText>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Zoomable Image Container */}
        <ZoomableImage uri={imageUri} />

        {/* Footer instruction */}
        <View style={styles.footer}>
          <KamiText variant="caption" color="rgba(255, 255, 255, 0.6)" align="center">
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height * 0.75,
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
});
