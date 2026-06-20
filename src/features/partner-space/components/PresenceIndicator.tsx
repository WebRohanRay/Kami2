import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

interface PresenceIndicatorProps {
  text: string | null;
  /** Primary color for the pulsing dot */
  dotColor?: string;
}

/**
 * Shows romantic presence text like "Left you a note 5m ago"
 * with a soft pulsing dot indicator.
 */
const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  text,
  dotColor = '#FF8FAB',
}) => {
  if (!text) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(500)}
      style={styles.container}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
};

export default React.memo(PresenceIndicator);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    opacity: 0.85,
  },
  text: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#999',
    fontFamily: 'Caveat-Regular',
  },
});
