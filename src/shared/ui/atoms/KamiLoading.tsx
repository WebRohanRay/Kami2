import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import KamiText from './KamiText';
import { useTheme } from '../../hooks';
import { FontSize, Space } from '../../constants';

interface KamiLoadingProps {
  emoji?: string;
  message?: string;
  subMessage?: string;
}

export const KamiLoading: React.FC<KamiLoadingProps> = ({
  emoji = '🫶',
  message = 'Just a tiny moment...',
  subMessage,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Gentle pulse animation for premium feel
    const pulseScale = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseOpacity = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseScale.start();
    pulseOpacity.start();

    return () => {
      pulseScale.stop();
      pulseOpacity.stop();
    };
  }, [scaleAnim, opacityAnim]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.emoji, { transform: [{ scale: scaleAnim }] }]}>
        {emoji}
      </Animated.Text>
      <Animated.View style={{ opacity: opacityAnim, alignItems: 'center' }}>
        <KamiText
          variant="body"
          bold
          color={colors.textSecondary}
          style={styles.message}
        >
          {message}
        </KamiText>
        {subMessage && (
          <KamiText
            variant="caption"
            color={colors.textMuted}
            style={styles.subMessage}
          >
            {subMessage}
          </KamiText>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Space[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 40,
    marginBottom: Space[3],
  },
  message: {
    fontSize: FontSize.base,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: FontSize.sm,
    marginTop: Space[1],
    textAlign: 'center',
  },
});

export default KamiLoading;
