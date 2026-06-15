import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';

interface StaggeredEntranceOptions {
  /** Delay between each item's animation start (ms) */
  delay?: number;
  /** Initial Y offset items slide up from (px) */
  offsetY?: number;
  /** Duration of each item's animation (ms) */
  duration?: number;
  /** Whether to run the animation (set false to skip) */
  enabled?: boolean;
}

interface EntranceAnim {
  opacity: Animated.Value;
  translateY: Animated.Value;
  style: {
    opacity: Animated.Value;
    transform: { translateY: Animated.Value }[];
  };
}

/**
 * Returns an array of animated style objects for staggered card entrance.
 *
 * Usage:
 * ```tsx
 * const entranceAnims = useStaggeredEntrance(5, { delay: 80, offsetY: 25 });
 *
 * <Animated.View style={entranceAnims[0].style}>
 *   <Card />
 * </Animated.View>
 * ```
 */
export function useStaggeredEntrance(
  count: number,
  options: StaggeredEntranceOptions = {},
): EntranceAnim[] {
  const { delay = 80, offsetY = 25, duration = 400, enabled = true } = options;

  const animsRef = useRef<EntranceAnim[]>([]);

  // Initialize refs only once (or when count changes)
  if (animsRef.current.length !== count) {
    animsRef.current = Array.from({ length: count }, () => {
      const opacity = new Animated.Value(enabled ? 0 : 1);
      const translateY = new Animated.Value(enabled ? offsetY : 0);
      return {
        opacity,
        translateY,
        style: {
          opacity,
          transform: [{ translateY }],
        },
      };
    });
  }

  useEffect(() => {
    if (!enabled) return;

    const anims = animsRef.current;

    // Reset all values
    anims.forEach(a => {
      a.opacity.setValue(0);
      a.translateY.setValue(offsetY);
    });

    // Build parallel animation array for each item
    const animations = anims.map(a =>
      Animated.parallel([
        Animated.timing(a.opacity, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(a.translateY, {
          toValue: 0,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    // Stagger them
    Animated.stagger(delay, animations).start();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return animsRef.current;
}
