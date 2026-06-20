import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface GoodnightOverlayProps {
  message: string | null;
}

/**
 * Goodnight mode overlay — dims the canvas with a warm dark tone,
 * shows partner's goodnight message and a moon accent.
 */
const GoodnightOverlay: React.FC<GoodnightOverlayProps> = ({ message }) => {
  return (
    <Animated.View
      entering={FadeIn.duration(1500)}
      pointerEvents="none"
      style={styles.overlay}
    >
      {/* Dark warm overlay */}
      <View style={styles.dimLayer} />

      {/* Moon accent */}
      <Animated.Text
        entering={FadeIn.delay(600).duration(800)}
        style={styles.moon}
      >
        🌙
      </Animated.Text>

      {/* Stars */}
      {([
        { top: '15%' as const, left: '20%' as const, right: undefined, delay: 800 },
        { top: '25%' as const, left: undefined, right: '15%' as const, delay: 1000 },
        { top: '10%' as const, left: undefined, right: '35%' as const, delay: 1200 },
        { top: '35%' as const, left: '10%' as const, right: undefined, delay: 900 },
      ] as const).map((pos, i) => (
        <Animated.Text
          key={i}
          entering={FadeIn.delay(pos.delay).duration(600)}
          style={[styles.star, { top: pos.top, left: pos.left, right: pos.right }]}
        >
          ✨
        </Animated.Text>
      ))}

      {/* Goodnight message */}
      {message && (
        <Animated.View
          entering={FadeIn.delay(800).duration(1000)}
          style={styles.messageContainer}
        >
          <Text style={styles.messageText}>
            {message}
          </Text>
        </Animated.View>
      )}

      {/* Border glow — moon accent */}
      <View style={styles.borderGlow} />
    </Animated.View>
  );
};

export default React.memo(GoodnightOverlay);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    borderRadius: 20,
    overflow: 'hidden',
  },
  dimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 10, 30, 0.65)',
  },
  moon: {
    position: 'absolute',
    top: '8%',
    right: '10%',
    fontSize: 32,
  },
  star: {
    position: 'absolute',
    fontSize: 10,
    opacity: 0.7,
  },
  messageContainer: {
    position: 'absolute',
    bottom: '25%',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  messageText: {
    fontSize: 20,
    fontFamily: 'Caveat-Regular',
    color: '#F0E6FF',
    textAlign: 'center',
    lineHeight: 28,
    textShadowColor: 'rgba(150, 100, 255, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  borderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(150, 130, 255, 0.25)',
  },
});
