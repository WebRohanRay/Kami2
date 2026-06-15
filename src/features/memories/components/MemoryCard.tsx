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
import { Radii, Space, Shadows } from '@shared/constants';
import { useAuthStore } from '@features/auth';
import { useTheme } from '@shared/hooks';
import type { Memory } from '@features/home/types';
import { getRotationAngle } from './utils';

interface MemoryCardProps {
  memory: Memory;
  onPressCard: () => void;
  onDelete: () => void;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({ memory, onPressCard, onDelete }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const sc = useRef(new Animated.Value(1)).current;
  const user = useAuthStore(s => s.user);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPressCard}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[styles.card, { transform: [{ scale: sc }, { rotate: getRotationAngle(memory.id) }] }]}>
        <View style={{ flexDirection: 'row', gap: Space[3] }}>
          <View style={styles.cardLeft}>
            <Text style={{ fontSize: 32 }}>{memory.emoji}</Text>
            {memory.mood && <Text style={{ fontSize: 18, marginTop: 4 }}>{memory.mood}</Text>}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.cardTop}>
              <KamiText variant="label" numberOfLines={1} style={{ flex: 1 }}>{memory.title}</KamiText>
              <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.delBtn}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            {memory.body ? (
              <KamiText variant="body" color={colors.textSecondary} numberOfLines={3} style={{ lineHeight: 20 }}>
                {memory.body}
              </KamiText>
            ) : null}
            <KamiText variant="caption" color={colors.textMuted}>
              {new Date(memory.memoryDate).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: user?.timezone ?? 'UTC',
              })}
            </KamiText>
          </View>
        </View>

        {memory.imageUrls && memory.imageUrls.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            <View style={styles.imageRow}>
              {memory.imageUrls.map((url, i) => {
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
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  card: {
    flexDirection: 'column',
    gap: Space[3],
    backgroundColor: colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    borderWidth: 1,
    borderColor: colors.border + '44',
    ...Shadows.sm,
  },
  cardLeft: { alignItems: 'center', width: 44 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  delBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border + '33',
  },
  imageScroll: { marginHorizontal: -Space[4], paddingHorizontal: Space[4], marginTop: Space[1] },
  imageRow: { flexDirection: 'row', gap: Space[2] },
  photo: { width: 200, height: 130, borderRadius: Radii.sm, resizeMode: 'contain', backgroundColor: 'rgba(0,0,0,0.03)' },
});
