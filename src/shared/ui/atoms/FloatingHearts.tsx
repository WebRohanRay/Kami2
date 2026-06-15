import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const HEART_EMOJIS = ['❤️', '💕', '💗', '💖', '💓'];

interface FloatingHeart {
  id: number;
  emoji: string;
  x: number;
  driftX: number;
  anim: Animated.Value;
  scale: number;
  rotation: number;
  duration: number;
}

interface FloatingHeartsProps {
  /** Increment this to trigger a new burst */
  trigger: number;
  /** Number of hearts per burst */
  count?: number;
  /** Spread width in pixels */
  spread?: number;
}

/**
 * Renders a burst of floating hearts that drift upward and fade out.
 *
 * Usage:
 * ```tsx
 * const [loveCount, setLoveCount] = useState(0);
 * <FloatingHearts trigger={loveCount} count={8} />
 * <Button onPress={() => setLoveCount(c => c + 1)} />
 * ```
 */
export const FloatingHearts: React.FC<FloatingHeartsProps> = ({
  trigger,
  count = 8,
  spread = 120,
}) => {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const idCounter = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the initial render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (trigger <= 0) return;

    const newHearts: FloatingHeart[] = Array.from({ length: count }, () => {
      const id = idCounter.current++;
      return {
        id,
        emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
        x: (Math.random() - 0.5) * spread,
        driftX: (Math.random() - 0.5) * 60,
        anim: new Animated.Value(0),
        scale: 0.6 + Math.random() * 0.6,
        rotation: (Math.random() - 0.5) * 40,
        duration: 1200 + Math.random() * 800,
      };
    });

    setHearts(prev => [...prev, ...newHearts]);

    // Animate each heart
    newHearts.forEach(heart => {
      Animated.timing(heart.anim, {
        toValue: 1,
        duration: heart.duration,
        useNativeDriver: true,
      }).start(() => {
        // Remove heart after animation completes
        setHearts(prev => prev.filter(h => h.id !== heart.id));
      });
    });
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  if (hearts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {hearts.map(heart => {
        const translateY = heart.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -160],
        });
        const translateX = heart.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, heart.driftX],
        });
        const opacity = heart.anim.interpolate({
          inputRange: [0, 0.2, 0.7, 1],
          outputRange: [0, 1, 0.8, 0],
        });
        const scale = heart.anim.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.3, heart.scale, heart.scale * 0.6],
        });

        return (
          <Animated.Text
            key={heart.id}
            style={[
              styles.heart,
              {
                left: heart.x,
                transform: [
                  { translateY },
                  { translateX },
                  { scale },
                  { rotate: `${heart.rotation}deg` },
                ],
                opacity,
              },
            ]}
          >
            {heart.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    width: 0,
    height: 0,
    overflow: 'visible',
    zIndex: 9999,
  },
  heart: {
    position: 'absolute',
    fontSize: 22,
  },
});
