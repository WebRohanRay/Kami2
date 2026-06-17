import React, { useRef } from 'react';
import { Image, StyleSheet, TouchableOpacity, View, Animated } from 'react-native';
import KamiText from '../atoms/KamiText';
import { Colors, Radii, Shadows, Space, FontSize } from '@shared/constants';
import { useTheme } from '@shared/hooks';

export interface Memory {
  id:       string;
  title:    string;
  date:     string;        // formatted date string
  emoji?:   string;
  imageUri?: string;
  tags?:    string[];
}

interface MemoryCardProps {
  memory:   Memory;
  onPress?: () => void;
  size?:    'sm' | 'md';
}

const MemoryCard: React.FC<MemoryCardProps> = ({ memory, onPress, size = 'md' }) => {
  const { colors } = useTheme();
  const dim = size === 'sm' ? 140 : 180;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      delayPressIn={0}
      onPressIn={onPress ? handlePressIn : undefined}
      onPressOut={onPress ? handlePressOut : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={memory.title}
    >
      <Animated.View style={[styles.card, { width: dim, backgroundColor: colors.cardBg, transform: [{ scale }] }]}>
        {/* Photo / Placeholder */}
        <View style={[styles.imageWrap, { height: dim - 30, backgroundColor: colors.creamMid }]}>
          {memory.imageUri ? (
            <Image source={{ uri: memory.imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <KamiText style={{ fontSize: size === 'sm' ? FontSize.xl : FontSize['2xl'] }}>
                {memory.emoji ?? '📸'}
              </KamiText>
            </View>
          )}
        </View>

        {/* Caption strip */}
        <View style={styles.caption}>
          <KamiText variant="caption" bold color={colors.textPrimary} numberOfLines={1}>
            {memory.title}
          </KamiText>
          <KamiText variant="caption" color={colors.textMuted}>{memory.date}</KamiText>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default MemoryCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  imageWrap: {
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    padding: Space[3],
    gap: 2,
  },
});
