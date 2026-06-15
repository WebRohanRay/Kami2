import React, { useRef, useEffect, useState } from 'react';
import { Animated, StyleSheet, View, Easing } from 'react-native';

interface RollingDigitProps {
  /** Current digit value (0-9) */
  value: number;
  /** Font size for the digit */
  fontSize?: number;
  /** Color of the digit */
  color?: string;
  /** Font family */
  fontFamily?: string;
  /** Font weight */
  fontWeight?: '400' | '500' | '600' | '700';
  /** Animation duration in ms */
  duration?: number;
}

/**
 * A single digit that animates with a rolling/sliding effect when it changes.
 *
 * Usage:
 * ```tsx
 * <View style={{ flexDirection: 'row' }}>
 *   <RollingDigit value={Math.floor(hours / 10)} fontSize={12} color="#333" />
 *   <RollingDigit value={hours % 10} fontSize={12} color="#333" />
 * </View>
 * ```
 */
export const RollingDigit: React.FC<RollingDigitProps> = ({
  value,
  fontSize = 14,
  color = '#000',
  fontFamily = 'PlusJakartaSans-Regular',
  fontWeight = '500',
  duration = 280,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [nextValue, setNextValue] = useState(value);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  const containerHeight = Math.ceil(fontSize * 1.4);

  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayValue(value);
      setNextValue(value);
      return;
    }

    if (value === displayValue) return;

    // Set up the incoming value
    setNextValue(value);
    slideAnim.setValue(0);

    // Animate: current digit slides up and out, new digit slides up and in
    Animated.timing(slideAnim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setDisplayValue(value);
        slideAnim.setValue(0);
      }
    });
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Current digit: slides from center (0) to top (-containerHeight)
  const currentTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -containerHeight],
  });
  const currentOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.3, 0],
  });

  // Next digit: slides from bottom (containerHeight) to center (0)
  const nextTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [containerHeight, 0],
  });
  const nextOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.3, 1],
  });

  const textStyle = {
    fontSize,
    color,
    fontFamily,
    fontWeight,
    lineHeight: containerHeight,
    textAlign: 'center' as const,
  };

  return (
    <View style={[styles.container, { height: containerHeight, minWidth: fontSize * 0.65 }]}>
      {/* Current (outgoing) digit */}
      <Animated.Text
        style={[
          textStyle,
          styles.digit,
          {
            transform: [{ translateY: currentTranslateY }],
            opacity: currentOpacity,
          },
        ]}
      >
        {displayValue}
      </Animated.Text>

      {/* Next (incoming) digit — only render during transition */}
      {nextValue !== displayValue && (
        <Animated.Text
          style={[
            textStyle,
            styles.digit,
            {
              transform: [{ translateY: nextTranslateY }],
              opacity: nextOpacity,
            },
          ]}
        >
          {nextValue}
        </Animated.Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    position: 'absolute',
  },
});
