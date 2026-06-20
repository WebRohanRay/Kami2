import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  ZoomIn,
  FadeIn,
} from 'react-native-reanimated';

interface GiftBoxProps {
  isOpened: boolean;
  width: number;
  height: number;
}

const GiftBox: React.FC<GiftBoxProps> = ({ isOpened, width, height }) => {
  const shakeX = useSharedValue(0);
  const bounceScale = useSharedValue(1);

  const handlePress = () => {
    // Wiggle animation when tapped (before opening)
    if (!isOpened) {
      shakeX.value = withSequence(
        withTiming(-4, { duration: 80 }),
        withTiming(4, { duration: 80 }),
        withTiming(-3, { duration: 60 }),
        withTiming(3, { duration: 60 }),
        withTiming(0, { duration: 40 })
      );
      bounceScale.value = withSequence(
        withSpring(1.15, { damping: 4 }),
        withSpring(1, { damping: 8 })
      );
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { scale: bounceScale.value },
    ],
  }));

  if (isOpened) {
    return (
      <Animated.View
        entering={ZoomIn.springify().damping(12)}
        style={[styles.openedBox, { width, height }]}
      >
        <Text style={styles.openedEmoji}>🎉</Text>
        <Text style={styles.openedLabel}>Opened!</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[animatedStyle, { width, height }]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.giftBox, { width, height }]}
      >
        {/* Box */}
        <View style={styles.boxBody}>
          <Text style={styles.giftEmoji}>🎁</Text>
        </View>

        {/* Ribbon */}
        <View style={styles.ribbonVertical} />
        <View style={styles.ribbonHorizontal} />

        {/* Sparkle accents */}
        <Animated.Text
          entering={FadeIn.delay(200).duration(400)}
          style={[styles.sparkle, { top: -4, right: -2 }]}
        >
          ✨
        </Animated.Text>
        <Animated.Text
          entering={FadeIn.delay(400).duration(400)}
          style={[styles.sparkle, { bottom: -2, left: -4 }]}
        >
          ✨
        </Animated.Text>

        {/* Label */}
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>Tap to open 💝</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default React.memo(GiftBox);

const styles = StyleSheet.create({
  giftBox: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  boxBody: {
    width: '80%',
    height: '70%',
    backgroundColor: '#FF6B8A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  giftEmoji: {
    fontSize: 36,
  },
  ribbonVertical: {
    position: 'absolute',
    width: 8,
    height: '70%',
    top: '15%',
    backgroundColor: '#FFD700',
    borderRadius: 2,
    opacity: 0.8,
  },
  ribbonHorizontal: {
    position: 'absolute',
    width: '80%',
    height: 8,
    top: '42%',
    backgroundColor: '#FFD700',
    borderRadius: 2,
    opacity: 0.8,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 14,
  },
  labelContainer: {
    position: 'absolute',
    bottom: 0,
  },
  labelText: {
    fontSize: 10,
    fontFamily: 'Caveat-Regular',
    color: '#FF6B8A',
    opacity: 0.8,
  },
  openedBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  openedEmoji: {
    fontSize: 36,
  },
  openedLabel: {
    fontSize: 12,
    fontFamily: 'Caveat-Regular',
    color: '#888',
    marginTop: 4,
  },
});
