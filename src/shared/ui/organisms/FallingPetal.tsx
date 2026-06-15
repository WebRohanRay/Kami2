import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

interface FallingPetalProps {
  delay: number;
  themeColors?: { primaryLight?: string; creamMid?: string };
}

/**
 * Returns seasonal configuration based on the current month.
 * 🌸 Spring (Mar-May): Cherry blossom petals
 * ☀️ Summer (Jun-Aug): Golden firefly circles
 * 🍂 Autumn (Sep-Nov): Amber & russet leaves
 * ❄️ Winter (Dec-Feb): Soft snowflakes
 *
 * When themeColors are provided, 2 of the 4 particle colors are
 * replaced with primaryLight and creamMid so petals feel native
 * to the active theme.
 */
const getSeasonalConfig = (themeColors?: { primaryLight?: string; creamMid?: string }) => {
  const month = new Date().getMonth(); // 0-11
  const tL = themeColors?.primaryLight;
  const tM = themeColors?.creamMid;

  if (month >= 2 && month <= 4) {
    // Spring: cherry blossoms (original)
    return {
      colors: [tL || '#FFD6DE', '#F4A0B5', tM || '#C96882', '#FDE8EC'],
      borderTopLeft: 12,
      borderBottomRight: 12,
      borderTopRight: 4,
      borderBottomLeft: 4,
      opacity: 0.72,
      sizeMultiplier: 1,
      speedMultiplier: 1,
    };
  } else if (month >= 5 && month <= 7) {
    // Summer: golden fireflies / dandelion seeds
    return {
      colors: [tL || '#FEF3C7', '#FDE68A', tM || '#F59E0B', '#FFFBEB'],
      borderTopLeft: 50, // circle
      borderBottomRight: 50,
      borderTopRight: 50,
      borderBottomLeft: 50,
      opacity: 0.85,
      sizeMultiplier: 0.7,
      speedMultiplier: 0.8,
    };
  } else if (month >= 8 && month <= 10) {
    // Autumn: amber & russet leaves
    return {
      colors: [tL || '#F97316', '#DC2626', tM || '#B45309', '#FBBF24'],
      borderTopLeft: 14,
      borderBottomRight: 14,
      borderTopRight: 4,
      borderBottomLeft: 4,
      opacity: 0.72,
      sizeMultiplier: 1.3,
      speedMultiplier: 1.2,
    };
  } else {
    // Winter: snowflakes
    return {
      colors: [tL || '#E0F2FE', '#BAE6FD', tM || '#DBEAFE', '#F0F9FF'],
      borderTopLeft: 50,
      borderBottomRight: 50,
      borderTopRight: 50,
      borderBottomLeft: 50,
      opacity: 0.85,
      sizeMultiplier: 0.8,
      speedMultiplier: 1.4, // slower, dreamy fall
    };
  }
};

const FallingPetal: React.FC<FallingPetalProps> = ({ delay, themeColors }) => {
  const config = useRef(getSeasonalConfig(themeColors)).current;

  const fallAnim = useRef(new Animated.Value(-20)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const driftAnim = useRef(new Animated.Value(0)).current;

  const left = useRef(Math.random() * W).current;
  const baseSize = Math.random() * 8 + 6;
  const size = useRef(baseSize * config.sizeMultiplier).current;
  const dur = useRef((Math.random() * 10000 + 8000) * config.speedMultiplier).current;
  const drift = useRef(Math.random() * 80 - 40).current;

  const color = useRef(
    config.colors[Math.floor(Math.random() * config.colors.length)]
  ).current;

  useEffect(() => {
    const loop = () => {
      fallAnim.setValue(-20);
      rotateAnim.setValue(0);
      driftAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fallAnim, {
          toValue: H + 20,
          duration: dur,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: dur,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(driftAnim, {
          toValue: drift,
          duration: dur,
          delay,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          loop();
        }
      });
    };

    loop();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.petal,
        {
          left,
          width: size,
          height: size * 1.4,
          backgroundColor: color,
          opacity: config.opacity,
          borderTopLeftRadius: config.borderTopLeft,
          borderBottomRightRadius: config.borderBottomRight,
          borderTopRightRadius: config.borderTopRight,
          borderBottomLeftRadius: config.borderBottomLeft,
          transform: [
            { translateY: fallAnim },
            { rotate: spin },
            { translateX: driftAnim },
          ],
        },
      ]}
    />
  );
};

export default FallingPetal;

const styles = StyleSheet.create({
  petal: {
    position: 'absolute',
  },
});