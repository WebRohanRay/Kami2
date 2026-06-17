import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import { FontSize, Radii, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';
import { useAuthStore } from '@features/auth';

import type { Memory } from '@features/home/types';
import type { CoupleMemory } from '@features/couple/types';

interface MemoryNetflixCardProps {
  memory: Memory | CoupleMemory;
  onPressCard: () => void;
  onDelete: () => void;
}

export const MemoryNetflixCard: React.FC<MemoryNetflixCardProps> = ({
  memory,
  onPressCard,
  onDelete,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const user = useAuthStore(s => s.user);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Ken Burns slow zoom animation
  const kenBurnsAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(kenBurnsAnim, {
          toValue: 1.08,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(kenBurnsAnim, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const desc = 'description' in memory ? memory.description : memory.body;
  const mood = memory.mood;
  const location = 'location' in memory ? memory.location : null;
  const time = 'memoryTime' in memory ? memory.memoryTime : null;
  const lastEdited = 'lastEditedNickname' in memory ? memory.lastEditedNickname : null;

  return (
    <View style={[styles.netflixCard, { backgroundColor: colors.cardBg, borderColor: colors.border + '44' }]}>
      {/* Photo carousel */}
      {memory.imageUrls && memory.imageUrls.length > 0 ? (
        <View style={styles.cardImageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / 260);
              if (slide !== activeImageIndex) {
                setActiveImageIndex(slide);
              }
            }}
            scrollEventThrottle={16}
          >
            {memory.imageUrls.map((url: string, i: number) => {
              const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
              return (
                <Animated.View key={i} style={{ width: 260, height: 140, overflow: 'hidden', transform: [{ scale: kenBurnsAnim }] }}>
                  <KamiImage
                    src={url}
                    thumbnailSrc={thumbUrl}
                    bucket={'coupleId' in memory ? 'couple_memory_images' : 'memory_images'}
                    style={styles.netflixCardPhoto}
                  />
                </Animated.View>
              );
            })}
          </ScrollView>
          {memory.imageUrls.length > 1 && (
            <View style={styles.dotsContainer}>
              {memory.imageUrls.map((_, i: number) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === activeImageIndex ? colors.primary : 'rgba(255,255,255,0.5)' },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.netflixCardNoPhoto, { backgroundColor: colors.primary + '08' }]}>
          <Text style={{ fontSize: 32 }}>📸</Text>
        </View>
      )}

      {/* Info Content */}
      <TouchableOpacity style={styles.netflixCardInfo} onPress={onPressCard} activeOpacity={0.9}>
        <View style={styles.cardHeaderRow}>
          <KamiText variant="label" bold numberOfLines={1} style={{ flex: 1 }}>
            {memory.title}
          </KamiText>
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={[styles.netflixCardDelete, { backgroundColor: colors.border + '44' }]}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {desc ? (
          <KamiText variant="body" color={colors.textSecondary} numberOfLines={2} style={styles.netflixCardDesc}>
            {desc}
          </KamiText>
        ) : null}

        {/* Metadata Details Grid */}
        <View style={styles.netflixMetaGrid}>
          {/* Row 1: Date & Time */}
          <View style={styles.netflixMetaItem}>
            <Text style={styles.netflixMetaIcon}>📅</Text>
            <KamiText variant="caption" color={colors.textMuted} numberOfLines={1}>
              {new Date(memory.memoryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: user?.timezone ?? 'UTC' })}
              {time ? ` · ${time}` : ''}
            </KamiText>
          </View>

          {/* Row 2: Location & Mood */}
          {(location || mood) && (
            <View style={styles.netflixMetaSubRow}>
              {location ? (
                <View style={styles.netflixMetaItem}>
                  <Text style={styles.netflixMetaIcon}>📍</Text>
                  <KamiText variant="caption" color={colors.textMuted} numberOfLines={1} style={{ maxWidth: 120 }}>
                    {location}
                  </KamiText>
                </View>
              ) : null}
              {mood ? (
                <View style={styles.netflixMetaItem}>
                  <KamiText variant="caption" color={colors.textMuted} numberOfLines={1}>
                    Mood: {mood}
                  </KamiText>
                </View>
              ) : null}
            </View>
          )}

          {/* Row 3: Last Edited By */}
          {lastEdited ? (
            <View style={[styles.netflixMetaItem, { marginTop: 2 }]}>
              <Text style={styles.netflixMetaIcon}>✏️</Text>
              <KamiText variant="caption" color={colors.primary} numberOfLines={1} style={{ fontSize: 10 }}>
                Last edited by {lastEdited}
              </KamiText>
            </View>
          ) : null}
        </View>

        {/* Tags badges */}
        {'tags' in memory && memory.tags && memory.tags.length > 0 && (
          <View style={[styles.tagRow, { marginTop: 4 }]}>
            {memory.tags.map((tag: string) => (
              <View key={tag} style={[styles.tagBadge, { backgroundColor: colors.primary + '11' }]}>
                <KamiText variant="caption" color={colors.primary} style={{ fontSize: 9 }}>#{tag}</KamiText>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  tagRow: { flexDirection: 'row', gap: Space[1] },
  tagBadge: { paddingHorizontal: Space[2], paddingVertical: 2, borderRadius: Radii.full },
  netflixCard: {
    width: 260,
    borderRadius: Radii.card,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: Space[4],
  },
  cardImageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  netflixCardPhoto: {
    width: 260,
    height: 140,
    resizeMode: 'contain',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  netflixCardNoPhoto: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netflixCardInfo: {
    padding: Space[3],
    gap: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netflixCardDelete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netflixCardDesc: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  netflixMetaGrid: {
    marginTop: Space[1],
    gap: 2,
  },
  netflixMetaSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  netflixMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  netflixMetaIcon: {
    fontSize: 10,
  },
});
