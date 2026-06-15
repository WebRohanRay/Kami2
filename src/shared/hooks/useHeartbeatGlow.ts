import { useRef, useEffect } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface HeartbeatGlowOptions {
  /** Primary color for the glow ring */
  color?: string;
  /** Size of the glow ring diameter */
  size?: number;
  /** Whether animation is active */
  active?: boolean;
}

interface HeartbeatGlowResult {
  /** Apply to the pulsing element (e.g. the heart emoji) */
  pulseStyle: { transform: { scale: Animated.Value }[] };
  /** Apply to a background View (the glow ring) */
  glowStyle: {
    opacity: Animated.AnimatedInterpolation<number>;
    transform: { scale: Animated.Value }[];
  };
  /** Static styles for the glow ring View */
  glowRingStyle: ViewStyle;
}

/**
 * Heartbeat-style double-pulse animation.
 *
 * Usage:
 * ```tsx
 * const { pulseStyle, glowStyle, glowRingStyle } = useHeartbeatGlow({ color: colors.primary });
 *
 * <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
 *   <Animated.View style={[glowRingStyle, glowStyle]} />
 *   <Animated.View style={pulseStyle}>
 *     <Text>❤️</Text>
 *   </Animated.View>
 * </View>
 * ```
 */
export function useHeartbeatGlow(options: HeartbeatGlowOptions = {}): HeartbeatGlowResult {
  const { color = '#C96882', size = 48, active = true } = options;

  const pulseScale = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacityDriver = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulseScale.setValue(1);
      glowScale.setValue(1);
      glowOpacityDriver.setValue(0);
      return;
    }

    // Heartbeat: two quick pulses followed by a pause
    const heartbeat = Animated.loop(
      Animated.sequence([
        // First beat
        Animated.timing(pulseScale, { toValue: 1.15, duration: 120, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.0, duration: 120, useNativeDriver: true }),
        // Short pause
        Animated.delay(80),
        // Second beat (slightly softer)
        Animated.timing(pulseScale, { toValue: 1.08, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.0, duration: 100, useNativeDriver: true }),
        // Rest
        Animated.delay(900),
      ]),
    );

    // Glow ring expands and fades in sync
    const glow = Animated.loop(
      Animated.sequence([
        // Expand + fade out
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.8, duration: 500, useNativeDriver: true }),
          Animated.timing(glowOpacityDriver, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        // Reset
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(glowOpacityDriver, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        // Wait for next heartbeat cycle
        Animated.delay(920),
      ]),
    );

    heartbeat.start();
    glow.start();

    return () => {
      heartbeat.stop();
      glow.stop();
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const glowOpacity = glowOpacityDriver.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.25, 0],
  });

  return {
    pulseStyle: {
      transform: [{ scale: pulseScale }],
    },
    glowStyle: {
      opacity: glowOpacity,
      transform: [{ scale: glowScale }],
    },
    glowRingStyle: {
      position: 'absolute' as const,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
    },
  };
}
