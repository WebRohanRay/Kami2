import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import KamiText from '../atoms/KamiText';
import { Colors, Radii, Shadows, Space, FontSize } from '@shared/constants';

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
  const dim = size === 'sm' ? 140 : 180;

  return (
    <TouchableOpacity
      style={[styles.card, { width: dim }]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {/* Photo / Placeholder */}
      <View style={[styles.imageWrap, { height: dim - 30 }]}>
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
        <KamiText variant="caption" bold style={styles.title} numberOfLines={1}>
          {memory.title}
        </KamiText>
        <KamiText variant="caption" style={styles.date}>{memory.date}</KamiText>
      </View>
    </TouchableOpacity>
  );
};

export default MemoryCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  imageWrap: {
    width: '100%',
    backgroundColor: Colors.creamMid,
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
  title: {
    color: Colors.textPrimary,
  },
  date: {
    color: Colors.textMuted,
  },
});
