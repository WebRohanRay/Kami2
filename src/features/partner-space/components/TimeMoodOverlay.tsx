import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface TimeMoodOverlayProps {
  tintColor: string;
  tintOpacity: number;
}

/**
 * Transparent overlay that shifts canvas tones based on time of day.
 * Transitions happen gradually with smooth easing.
 */
const TimeMoodOverlay: React.FC<TimeMoodOverlayProps> = ({ tintColor, tintOpacity }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: tintColor,
    opacity: withTiming(tintOpacity, {
      duration: 2000,
      easing: Easing.inOut(Easing.ease),
    }),
  }));

  if (tintOpacity === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, animatedStyle]}
    />
  );
};

export default React.memo(TimeMoodOverlay);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    borderRadius: 20,
  },
});
