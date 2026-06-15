import React, { useRef, useEffect, useState } from 'react';
import { Animated, StyleSheet, View, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ShimmerTextProps {
  children: React.ReactNode;
  /** Color of the shimmer highlight */
  shimmerColor?: string;
  /** Animation speed in ms */
  speed?: number;
  /** Whether shimmer is active */
  active?: boolean;
}

/**
 * Wraps text content with a sliding shimmer overlay effect.
 *
 * Usage:
 * ```tsx
 * <ShimmerText shimmerColor={colors.primary}>
 *   <KamiText variant="caption" color={colors.primary} bold>
 *     Write your first entry ›
 *   </KamiText>
 * </ShimmerText>
 * ```
 */
export const ShimmerText: React.FC<ShimmerTextProps> = ({
  children,
  shimmerColor = '#C96882',
  speed = 2500,
  active = true,
}) => {
  const translateX = useRef(new Animated.Value(-1)).current;
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!active || containerWidth <= 0) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 1,
          duration: speed,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
        Animated.timing(translateX, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [active, containerWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const shimmerWidth = containerWidth * 0.6;
  const shimmerTranslateX = translateX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-shimmerWidth, containerWidth + shimmerWidth],
  });

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {children}
      {active && containerWidth > 0 && (
        <Animated.View
          style={[
            styles.shimmerOverlay,
            {
              width: shimmerWidth,
              transform: [{ translateX: shimmerTranslateX }],
            },
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[
              'transparent',
              shimmerColor + '20',
              shimmerColor + '35',
              shimmerColor + '20',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});
