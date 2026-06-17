import React, { useRef } from 'react';
import { Animated, TouchableOpacity } from 'react-native';

interface TapProps {
  onPress?: () => void;
  style?: object;
  children: React.ReactNode;
}

export const Tap: React.FC<TapProps> = ({ onPress, style, children }) => {
  const sc = useRef(new Animated.Value(1)).current;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      disabled={!onPress}
      delayPressIn={0}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale: sc }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};
