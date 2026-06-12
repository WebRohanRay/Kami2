import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';

export const AnimatedStarPulse = () => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.starGlow,
        {
          opacity: pulse,
          transform: [{ scale: pulse.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.4] }) }],
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  starGlow: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(234, 179, 8, 0.45)',
    zIndex: 1,
  },
});
