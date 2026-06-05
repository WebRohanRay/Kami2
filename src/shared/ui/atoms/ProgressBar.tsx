import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Radii } from '@shared/constants';

interface ProgressBarProps {
  progress: number;       // 0–1
  height?: number;
  color?: string;
  trackColor?: string;
  animated?: boolean;
  style?: ViewStyle;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 6,
  color = Colors.primary,
  trackColor = Colors.border + '55',
  animated = true,
  style,
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.spring(anim, {
        toValue: Math.min(Math.max(progress, 0), 1),
        useNativeDriver: false,
        bounciness: 4,
      }).start();
    } else {
      anim.setValue(progress);
    }
  }, [progress]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height }, style]}>
      <Animated.View
        style={[
          styles.fill,
          { width, height, backgroundColor: color, borderRadius: height },
        ]}
      />
    </View>
  );
};

export default ProgressBar;

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
  fill:  {},
});
