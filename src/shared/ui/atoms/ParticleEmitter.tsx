import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface Particle {
  id: number;
  emoji: string;
  anim: Animated.Value;
  angle: number;    // radians
  velocity: number; // distance
  rotation: number; // degrees
  scale: number;
  duration: number;
}

interface ParticleEmitterProps {
  /** Increment to trigger a new burst */
  trigger: number;
  /** Array of emoji strings to randomly pick from */
  particles?: string[];
  /** Number of particles per burst */
  count?: number;
  /** Direction pattern */
  direction?: 'up' | 'radial' | 'down';
  /** Max distance particles travel */
  distance?: number;
}

/**
 * Emits a burst of emoji particles on trigger.
 *
 * Usage:
 * ```tsx
 * <ParticleEmitter
 *   trigger={celebrationCount}
 *   particles={['🍃', '🌿', '✨']}
 *   count={12}
 *   direction="up"
 * />
 * ```
 */
export const ParticleEmitter: React.FC<ParticleEmitterProps> = ({
  trigger,
  particles: particleEmojis = ['✨', '💫', '⭐'],
  count = 10,
  direction = 'radial',
  distance = 120,
}) => {
  const [activeParticles, setActiveParticles] = useState<Particle[]>([]);
  const idCounter = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (trigger <= 0) return;

    const newParticles: Particle[] = Array.from({ length: count }, () => {
      const id = idCounter.current++;
      let angle: number;

      switch (direction) {
        case 'up':
          // Upward cone: -30deg to -150deg (top half)
          angle = -(Math.PI / 6) - Math.random() * (2 * Math.PI / 3);
          break;
        case 'down':
          // Downward cone
          angle = (Math.PI / 6) + Math.random() * (2 * Math.PI / 3);
          break;
        case 'radial':
        default:
          // Full 360 degrees
          angle = Math.random() * Math.PI * 2;
          break;
      }

      return {
        id,
        emoji: particleEmojis[Math.floor(Math.random() * particleEmojis.length)],
        anim: new Animated.Value(0),
        angle,
        velocity: 0.4 + Math.random() * 0.6, // 40-100% of distance
        rotation: (Math.random() - 0.5) * 360,
        scale: 0.5 + Math.random() * 0.7,
        duration: 800 + Math.random() * 700,
      };
    });

    setActiveParticles(prev => [...prev, ...newParticles]);

    newParticles.forEach(p => {
      Animated.timing(p.anim, {
        toValue: 1,
        duration: p.duration,
        useNativeDriver: true,
      }).start(() => {
        setActiveParticles(prev => prev.filter(x => x.id !== p.id));
      });
    });
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  if (activeParticles.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {activeParticles.map(p => {
        const dist = distance * p.velocity;
        const translateX = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * dist],
        });
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * dist],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.15, 0.6, 1],
          outputRange: [0, 1, 0.7, 0],
        });
        const scale = p.anim.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0.2, p.scale, p.scale * 0.3],
        });
        const rotate = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rotation}deg`],
        });

        return (
          <Animated.Text
            key={p.id}
            style={[
              styles.particle,
              {
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                  { rotate },
                ],
                opacity,
              },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    overflow: 'visible',
    zIndex: 9999,
  },
  particle: {
    position: 'absolute',
    fontSize: 18,
  },
});
