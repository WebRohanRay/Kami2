import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import { ImageZoomModal } from '@shared/ui';
import { useTheme } from '@shared/hooks';
import { useAuthStore } from '@features/auth';
import { FontSize, Radii, Space, Shadows, Opacity } from '@shared/constants';
import { getRotationAngle } from './utils';
import { LinearGradient } from 'expo-linear-gradient';
import type { Memory } from '@features/home/types';
import type { CoupleMemory } from '@features/couple/types';

interface MemoryTimelineCardProps {
  memory: Memory | CoupleMemory;
  index: number;
  total: number;
  isLast: boolean;
  onPressCard: () => void;
  onDelete: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const cardImageWidth = screenWidth - 84; // Screen width minus guides and paddings

export const MemoryTimelineCard: React.FC<MemoryTimelineCardProps> = ({
  memory,
  index,
  total,
  isLast,
  onPressCard,
  onDelete,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const user = useAuthStore(s => s.user);
  const sc = useRef(new Animated.Value(1)).current;
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const desc = 'description' in memory ? memory.description : ('body' in memory ? memory.body : null);
  const mood = 'mood' in memory ? memory.mood : null;
  const location = 'location' in memory ? memory.location : null;
  const time = 'memoryTime' in memory ? memory.memoryTime : null;
  const lastEdited = 'lastEditedNickname' in memory ? memory.lastEditedNickname : null;
  const emoji = 'emoji' in memory ? memory.emoji : '📸';

  // Reverse chronological index
  const displayIndex = total - index;

  return (
    <View style={styles.timelineRow}>
      {/* Left Timeline Guide */}
      <View style={styles.timelineLeft}>
        <View style={[styles.premiumTimelineDot, { borderColor: colors.primaryLight, backgroundColor: colors.cardBg }]}>
          <View style={[styles.premiumTimelineDotInner, { backgroundColor: colors.primary }]} />
        </View>
        {!isLast && <View style={[styles.premiumTimelineLine, { borderColor: colors.primaryLight + Opacity.strong }]} />}
      </View>

      {/* Card Content */}
      <View style={{ flex: 1, paddingBottom: Space[4] }}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onPressCard}
          delayPressIn={0}
          onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
          onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        >
          <Animated.View style={[
            styles.card,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
              transform: [{ scale: sc }, { rotate: getRotationAngle(memory.id) }]
            }
          ]}>
            {/* 1. Polaroid Photo Area */}
            {memory.imageUrls && memory.imageUrls.length > 0 ? (
              <View style={styles.photoStackContainer}>
                {memory.imageUrls.length > 1 && (
                  <>
                    {/* Background Stack Card 2 */}
                    <View style={[styles.photoStackBg, styles.photoStackBgSecond, { backgroundColor: colors.cardBg, borderColor: colors.border + Opacity.muted }]} />
                    {/* Background Stack Card 1 */}
                    <View style={[styles.photoStackBg, styles.photoStackBgFirst, { backgroundColor: colors.cardBg, borderColor: colors.border + Opacity.muted }]} />
                  </>
                )}
                {/* Main Image Frame */}
                <View style={[styles.mainPhotoFrame, { borderColor: colors.border + Opacity.medium }]}>
                  <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                    <View style={styles.imageRow}>
                      {memory.imageUrls.map((url: string, i: number) => {
                        const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
                        return (
                          <TouchableOpacity
                            key={i}
                            activeOpacity={0.9}
                            onPress={() => {
                              setLightboxIndex(i);
                              setLightboxVisible(true);
                            }}
                          >
                            <KamiImage
                              src={url}
                              thumbnailSrc={thumbUrl}
                              bucket={'coupleId' in memory ? 'couple_memory_images' : 'memory_images'}
                              style={styles.photo}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  {memory.imageUrls.length > 1 && (
                    <View style={[styles.photoCountBadge, { backgroundColor: colors.primary }]}>
                      <KamiText variant="caption" color="#fff" bold style={{ fontSize: 9 }}>
                        +{memory.imageUrls.length - 1} photos
                      </KamiText>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              /* No Photo placeholder gradient */
              <View style={[styles.placeholderFrame, { borderColor: colors.border + Opacity.medium }]}>
                <LinearGradient
                  colors={[colors.creamDeep + '66', colors.creamMid + 'aa']}
                  style={styles.placeholderGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={{ fontSize: 40, marginBottom: 4 }}>{emoji}</Text>
                  <KamiText variant="caption" color={colors.primary} style={{ opacity: 0.7, letterSpacing: 0.5 }}>
                    Captured moment
                  </KamiText>
                </LinearGradient>
              </View>
            )}

            {/* 2. Text / Scrapbook area below the photo */}
            <View style={styles.scrapbookContent}>
              <View style={styles.cardTop}>
                <View style={[styles.indexBadge, { backgroundColor: colors.primary + Opacity.subtle }]}>
                  <KamiText variant="caption" color={colors.primary} bold style={{ fontSize: 9 }}>
                    #{displayIndex}
                  </KamiText>
                </View>
                <KamiText variant="label" bold numberOfLines={1} style={[styles.polaroidTitle, { color: colors.textPrimary }]}>
                  {memory.title}
                </KamiText>
                <TouchableOpacity onPress={onDelete} hitSlop={8} style={[styles.delBtn, { backgroundColor: colors.creamDeep, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Description */}
              {desc ? (
                <KamiText variant="body" color={colors.textSecondary} style={styles.polaroidDesc}>
                  {desc}
                </KamiText>
              ) : null}

              {/* Metadata area (Location, Mood, Time) */}
              <View style={styles.metaContainer}>
                <View style={styles.metaRow}>
                  <Text style={{ fontSize: 10 }}>📅</Text>
                  <KamiText variant="caption" color={colors.textMuted} style={styles.metaText}>
                    {new Date(memory.memoryDate).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: user?.timezone ?? 'UTC',
                    })}
                    {time ? ` · ${time}` : ''}
                  </KamiText>
                </View>

                {location ? (
                  <View style={[styles.metaPill, { backgroundColor: colors.creamDeep + '66' }]}>
                    <Text style={{ fontSize: 10 }}>📍</Text>
                    <KamiText variant="caption" color={colors.textSecondary} numberOfLines={1} style={[styles.metaText, { maxWidth: 180 }]}>
                      {location}
                    </KamiText>
                  </View>
                ) : null}

                {mood ? (
                  <View style={[styles.metaPill, { backgroundColor: colors.creamDeep + '66' }]}>
                    <KamiText variant="caption" color={colors.textSecondary} style={styles.metaText}>
                      Feelings: {mood}
                    </KamiText>
                  </View>
                ) : null}

                {lastEdited ? (
                  <View style={styles.metaRow}>
                    <Text style={{ fontSize: 10 }}>✏️</Text>
                    <KamiText variant="caption" color={colors.primary} style={[styles.metaText, { fontSize: 10 }]}>
                      Edited by {lastEdited}
                    </KamiText>
                  </View>
                ) : null}
              </View>

              {/* Tags */}
              {'tags' in memory && memory.tags && memory.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {memory.tags.map((tag: string) => (
                    <View key={tag} style={[styles.tagBadge, { backgroundColor: colors.primary + '0c' }]}>
                      <KamiText variant="caption" color={colors.primary} style={{ fontSize: 9 }}>#{tag}</KamiText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </View>
      <ImageZoomModal
        visible={lightboxVisible}
        imageUris={memory.imageUrls}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxVisible(false)}
      />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  timelineRow: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', width: 24, marginRight: Space[2] },
  premiumTimelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    zIndex: 2,
    elevation: 2,
  },
  premiumTimelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  premiumTimelineLine: {
    width: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    flex: 1,
    marginTop: 4,
    marginBottom: -22,
    alignSelf: 'center',
    zIndex: 1,
  },
  card: {
    flexDirection: 'column',
    borderRadius: 14,
    padding: 10,
    paddingBottom: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...Shadows.md,
  },
  photoStackContainer: {
    position: 'relative',
    height: 180,
    width: '100%',
    zIndex: 1,
  },
  photoStackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
    borderWidth: 1.5,
    ...Shadows.sm,
  },
  photoStackBgFirst: {
    transform: [{ rotate: '-3.5deg' }, { scale: 0.97 }],
    opacity: 0.85,
  },
  photoStackBgSecond: {
    transform: [{ rotate: '3.5deg' }, { scale: 0.97 }],
    opacity: 0.65,
  },
  mainPhotoFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: colors.inputBg,
    ...Shadows.sm,
  },
  imageScroll: {
    flex: 1,
  },
  imageRow: {
    flexDirection: 'row',
  },
  photo: {
    width: cardImageWidth,
    height: 180,
    resizeMode: 'cover',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    opacity: 0.9,
    ...Shadows.sm,
  },
  placeholderFrame: {
    height: 180,
    width: '100%',
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: colors.inputBg,
    ...Shadows.sm,
  },
  placeholderGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrapbookContent: {
    marginTop: Space[3],
    paddingHorizontal: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space[2],
  },
  indexBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  polaroidTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  delBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  polaroidDesc: {
    fontSize: FontSize.sm,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: Space[2],
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Space[3],
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  metaText: {
    fontSize: FontSize.xs,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Space[3],
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
});
