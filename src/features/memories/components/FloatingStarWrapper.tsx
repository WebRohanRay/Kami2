import React, { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

interface FloatingStarWrapperProps {
  children: React.ReactNode;
  style?: any;
}

export const FloatingStarWrapper: React.FC<FloatingStarWrapperProps> = ({ children, style }) => {
  const floatAnimY = useRef(new Animated.Value(0)).current;
  const floatAnimX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Gentle sway Y loop with random parameters for organic drift
    const startY = () => {
      Animated.sequence([
        Animated.timing(floatAnimY, {
          toValue: Math.random() * 6 + 3,
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnimY, {
          toValue: -(Math.random() * 6 + 3),
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnimY, {
          toValue: 0,
          duration: 2500 + Math.random() * 1500,
          useNativeDriver: true,
        })
      ]).start(() => startY());
    };

    // Gentle sway X loop
    const startX = () => {
      Animated.sequence([
        Animated.timing(floatAnimX, {
          toValue: Math.random() * 4 + 2,
          duration: 3500 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnimX, {
          toValue: -(Math.random() * 4 + 2),
          duration: 3500 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnimX, {
          toValue: 0,
          duration: 3000 + Math.random() * 1500,
          useNativeDriver: true,
        })
      ]).start(() => startX());
    };

    startY();
    startX();

    return () => {
      floatAnimY.stopAnimation();
      floatAnimX.stopAnimation();
    };
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            ...(style?.transform || []),
            { translateX: floatAnimX },
            { translateY: floatAnimY },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};
