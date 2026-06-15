import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, TouchableOpacity, Vibration } from 'react-native';
import KamiText from '../atoms/KamiText';
import { Radii, Shadows, Space, FontSize, Opacity } from '@shared/constants';
import { useTheme } from '@shared/hooks';

interface StreakBadgeProps {
  count: number;
  label?: string;
}

const StreakBadge: React.FC<StreakBadgeProps> = ({ count, label = 'day streak' }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flameAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // scale: 1.0 -> 1.2 -> 1.0 bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 120,
        friction: 6,
        useNativeDriver: true,
      })
    ]).start();
  }, [count]);

  useEffect(() => {
    // Continuous gentle scaling flame pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(flameAnim, {
          toValue: 0.94,
          duration: 1200,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  const handlePress = () => {
    // heartbeat vibration pattern: vibrate 20ms, pause 80ms, vibrate 20ms
    Vibration.vibrate([0, 20, 80, 20]);
    
    // Tapping scale bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 5, useNativeDriver: true })
    ]).start();
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
      <Animated.View style={[styles.badge, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.Text style={[styles.flame, { transform: [{ scale: flameAnim }] }]}>🔥</Animated.Text>
        <View>
          <KamiText style={styles.count}>{count}</KamiText>
          <KamiText variant="caption">{label}</KamiText>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default StreakBadge;

const getStyles = (colors: any) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.warning + Opacity.subtle,
      borderRadius: Radii.lg,
      paddingHorizontal: Space[4],
      paddingVertical: Space[2],
      gap: Space[3],
      alignSelf: 'flex-start',
      borderWidth: 1.5,
      borderColor: colors.warning + Opacity.muted,
      ...Shadows.sm,
    },
    flame: { fontSize: 24 },
    count: {
      fontFamily: 'PlusJakartaSans-SemiBold',
      fontSize: FontSize.xl,
      fontWeight: '600',
      color: colors.warning,
      lineHeight: 32,
    },
  });
