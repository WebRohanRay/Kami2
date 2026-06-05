import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

interface FallingPetalProps {
  delay: number;
}

const PETAL_COLORS = [
  '#FFD6DE',
  '#F4A0B5',
  '#C96882',
  '#FDE8EC',
];

const FallingPetal: React.FC<FallingPetalProps> = ({ delay }) => {
  const fallAnim = useRef(new Animated.Value(-20)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const driftAnim = useRef(new Animated.Value(0)).current;

  const left = useRef(Math.random() * W).current;
  const size = useRef(Math.random() * 8 + 6).current;
  const dur = useRef(Math.random() * 10000 + 8000).current;
  const drift = useRef(Math.random() * 80 - 40).current;

  const color = useRef(
    PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]
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
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    opacity: 0.72,
  },
});