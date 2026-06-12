import React, { useRef } from 'react';
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
import { useTheme } from '@shared/hooks';
import { useAuthStore } from '@features/auth';
import { Colors, Radii, Space, Shadows } from '@shared/constants';
import { getRotationAngle } from './utils';
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

export const MemoryTimelineCard: React.FC<MemoryTimelineCardProps> = ({
  memory,
  index,
  total,
  isLast,
  onPressCard,
  onDelete,
}) => {
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);
  const sc = useRef(new Animated.Value(1)).current;

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
        <View style={[styles.premiumTimelineDot, { borderColor: colors.primaryLight, backgroundColor: '#fff' }]}>
          <View style={[styles.premiumTimelineDotInner, { backgroundColor: colors.primary }]} />
        </View>
        {!isLast && <View style={[styles.premiumTimelineLine, { borderColor: colors.primaryLight + '55' }]} />}
      </View>

      {/* Card Content */}
      <View style={{ flex: 1, paddingBottom: Space[4] }}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onPressCard}
          onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
          onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        >
          <Animated.View style={[styles.card, { transform: [{ scale: sc }, { rotate: getRotationAngle(memory.id) }] }]}>
            <View style={{ flex: 1, gap: 6 }}>
              {/* Header with index, emoji, title and delete button */}
              <View style={styles.cardTop}>
                <View style={[styles.tagBadge, { backgroundColor: colors.primary + '15', marginRight: 4 }]}>
                  <KamiText variant="caption" color={colors.primary} bold style={{ fontSize: 10 }}>
                    #{displayIndex}
                  </KamiText>
                </View>
                <Text style={{ fontSize: 20, marginRight: 4 }}>{emoji}</Text>
                <KamiText variant="label" numberOfLines={1} style={{ flex: 1 }}>{memory.title}</KamiText>
                <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.delBtn}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Description */}
              {desc ? (
                <KamiText variant="body" color={Colors.textSecondary} style={{ lineHeight: 20 }}>
                  {desc}
                </KamiText>
              ) : null}

              {/* Details grid: location, time, mood, last edited */}
              <View style={{ gap: 4, marginTop: 2 }}>
                {/* Date & Time */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 10 }}>📅</Text>
                  <KamiText variant="caption" color={Colors.textMuted}>
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

                {/* Location & Mood */}
                {(location || mood) && (
                  <View style={{ flexDirection: 'row', gap: Space[3], alignItems: 'center' }}>
                    {location ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 10 }}>📍</Text>
                        <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1} style={{ maxWidth: 150 }}>
                          {location}
                        </KamiText>
                      </View>
                    ) : null}
                    {mood ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <KamiText variant="caption" color={Colors.textMuted}>Mood: {mood}</KamiText>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Last edited */}
                {lastEdited ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 10 }}>✏️</Text>
                    <KamiText variant="caption" color={colors.primary} style={{ fontSize: 10 }}>
                      Last edited by {lastEdited}
                    </KamiText>
                  </View>
                ) : null}
              </View>

              {/* Tags and photos */}
              {'tags' in memory && memory.tags && memory.tags.length > 0 && (
                <View style={[styles.tagRow, { marginTop: Space[1] }]}>
                  {memory.tags.map((tag: string) => (
                    <View key={tag} style={[styles.tagBadge, { backgroundColor: colors.primary + '11' }]}>
                      <KamiText variant="caption" color={colors.primary} style={{ fontSize: 9 }}>#{tag}</KamiText>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {memory.imageUrls && memory.imageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                <View style={styles.imageRow}>
                  {memory.imageUrls.map((url: string, i: number) => {
                    const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
                    return (
                      <KamiImage
                        key={i}
                        src={url}
                        thumbnailSrc={thumbUrl}
                        style={styles.photo}
                      />
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'column',
    gap: Space[3],
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    borderWidth: 1,
    borderColor: Colors.border + '44',
    ...Shadows.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  delBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border + '33',
  },
  imageScroll: { marginHorizontal: -Space[4], paddingHorizontal: Space[4], marginTop: Space[1] },
  imageRow: { flexDirection: 'row', gap: Space[2] },
  photo: { width: 200, height: 130, borderRadius: Radii.sm, resizeMode: 'contain', backgroundColor: 'rgba(0,0,0,0.03)' },
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
  tagRow: { flexDirection: 'row', gap: Space[1] },
  tagBadge: { paddingHorizontal: Space[2], paddingVertical: 2, borderRadius: Radii.full },
});
