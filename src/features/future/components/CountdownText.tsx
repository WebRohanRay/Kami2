import React, { useState, useEffect } from 'react';
import { Animated } from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { useTheme } from '@shared/hooks';
import { formatCountdown } from './utils';

interface CountdownTextProps {
  deliverAt: string;
  color?: string;
  style?: any;
  variant?: any;
}

export const CountdownText: React.FC<CountdownTextProps> = ({
  deliverAt,
  color,
  style = { fontSize: 9 },
  variant = 'caption',
}) => {
  const [text, setText] = useState(() => formatCountdown(deliverAt));
  const { colors } = useTheme();
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const [isImminent, setIsImminent] = useState(false);

  useEffect(() => {
    let timerId: any = null;

    const tick = () => {
      const diffMs = new Date(deliverAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setText('Unlocked');
        setIsImminent(false);
        return;
      }
      setText(formatCountdown(deliverAt));

      // Track urgency level
      setIsImminent(diffMs < 3600000);

      // Tick every second if < 5 mins, else tick every 60 seconds
      const nextInterval = diffMs < 300000 ? 1000 : 60000;
      timerId = setTimeout(tick, nextInterval);
    };

    tick();
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [deliverAt]);

  // Pulse animation for imminent unlocks (< 1 hour)
  useEffect(() => {
    if (!isImminent) {
      pulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isImminent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamic color based on remaining time
  const getCountdownColor = () => {
    if (color) return color; // respect override

    const diffMs = new Date(deliverAt).getTime() - Date.now();
    if (diffMs <= 0) return colors.success;
    if (diffMs < 3600000) return colors.error;         // < 1h: red
    if (diffMs < 86400000) return colors.warning;      // < 24h: amber
    if (diffMs < 604800000) return colors.primary;     // < 7d: primary
    return colors.textSecondary;                       // default: muted
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <KamiText variant={variant} color={getCountdownColor()} style={style} bold={isImminent}>
        {text}
      </KamiText>
    </Animated.View>
  );
};
