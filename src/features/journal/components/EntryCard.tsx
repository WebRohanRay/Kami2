import React, { useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import KamiText from '@shared/ui/atoms/KamiText';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import { Colors, Radii, Space, Shadows } from '@shared/constants';
import SyncStatusBadge from '@shared/ui/atoms/SyncStatusBadge';
import type { JournalEntry } from '@features/home/types';
import type { CoupleJournal } from '@features/couple/types';

interface EntryCardProps {
  entry: JournalEntry | CoupleJournal;
  onPressCard: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  activeSpace?: 'personal' | 'couple';
  user?: { id: string } | null;
  onReact?: (entryId: string, emoji: string) => void;
  onOpenComments?: (entry: CoupleJournal) => void;
  onPressConflict?: (entityId: string) => void;
}

export const EntryCard: React.FC<EntryCardProps> = ({
  entry,
  onPressCard,
  onDelete,
  onTogglePin,
  activeSpace,
  user,
  onReact,
  onOpenComments,
  onPressConflict,
}) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;
  const syncStatus = 'syncStatus' in entry ? entry.syncStatus : undefined;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPressCard}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View
        style={[
          styles.entryCard,
          entry.isPinned && [styles.entryCardPinned, { borderColor: colors.primary + '55', backgroundColor: colors.creamMid + '22' }],
          { transform: [{ scale: sc }] },
        ]}
      >
        <View style={styles.entryHeader}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
            {entry.isPinned && <Text style={{ fontSize: 13 }}>📌</Text>}
            <KamiText variant="label" numberOfLines={1} style={{ flex: 1 }}>
              {entry.title || 'Untitled entry'}
            </KamiText>
          </View>
          <View style={styles.entryActions}>
            <TouchableOpacity onPress={onTogglePin} hitSlop={8} style={styles.cardBtn}>
              <Text style={{ fontSize: 13, color: entry.isPinned ? colors.primary : Colors.textMuted }}>📌</Text>
            </TouchableOpacity>
            {(!activeSpace || activeSpace === 'personal' || entry.userId === user?.id) && (
              <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.cardBtn}>
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {syncStatus && syncStatus !== 'synced' && (
          <SyncStatusBadge
            status={syncStatus as 'conflict' | 'synced' | 'pending_update' | 'pending_insert'}
            onPressConflict={() => onPressConflict?.(entry.id)}
            style={{ marginTop: -Space[1], marginBottom: Space[1] }}
          />
        )}

        <KamiText variant="body" numberOfLines={4} style={styles.entryBody}>
          {entry.body}
        </KamiText>

        {/* Horizontal Photo Preview */}
        {entry.imageUrls && entry.imageUrls.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRowScroll}>
            <View style={styles.imageRow}>
              {entry.imageUrls.map((url: string, i: number) => {
                const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
                return (
                  <KamiImage
                    key={i}
                    src={url}
                    thumbnailSrc={thumbUrl}
                    style={styles.cardImage}
                  />
                );
              })}
            </View>
          </ScrollView>
        )}

        {entry.tags && entry.tags.length > 0 && (
          <View style={styles.tagRow}>
            {entry.tags.map((t: string) => (
              <View key={t} style={[styles.tag, { backgroundColor: colors.primary + '15' }]}>
                <KamiText variant="caption" color={colors.primary}>#{t}</KamiText>
              </View>
            ))}
          </View>
        )}

        {activeSpace === 'couple' && (() => {
          const coupleEntry = entry as CoupleJournal;
          return (
            <View style={[styles.coupleActionsRow, { borderTopColor: Colors.border + '22' }]}>
              <KamiText variant="caption" color={Colors.textMuted} style={{ flex: 1 }} bold>
                By {coupleEntry.userNickname || 'Partner'}
              </KamiText>

              <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'center' }}>
                {['❤️', '😊', '🥰'].map(emoji => {
                  const count = (coupleEntry.reactions ?? []).filter((r) => r.emoji === emoji).length;
                  const active = (coupleEntry.reactions ?? []).some((r) => r.emoji === emoji && r.userId === user?.id);
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.premiumReactionBtn,
                        active && [styles.premiumReactionBtnActive, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]
                      ]}
                      onPress={() => onReact?.(coupleEntry.id, emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 14 }}>{emoji}</Text>
                      {count > 0 && (
                        <KamiText variant="caption" color={active ? colors.primary : Colors.textSecondary} bold style={{ fontSize: 10 }}>
                          {count}
                        </KamiText>
                      )}
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity style={[styles.premiumReactionBtn, { paddingHorizontal: Space[3] }]} onPress={() => onOpenComments?.(coupleEntry)}>
                  <Text style={{ fontSize: 14 }}>💬</Text>
                  {(coupleEntry.comments ?? []).length > 0 && (
                    <KamiText variant="caption" color={Colors.textSecondary} bold style={{ fontSize: 10 }}>
                      {(coupleEntry.comments ?? []).length}
                    </KamiText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  entryCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    gap: Space[3],
    borderWidth: 1.5,
    borderColor: 'rgba(201, 104, 130, 0.12)',
    ...Shadows.md,
    elevation: 2,
  },
  entryCardPinned: {
    borderColor: Colors.primary + '77',
    backgroundColor: '#FFFDFD',
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  entryActions: { flexDirection: 'row', gap: Space[2] },
  entryBody: { lineHeight: 26, fontSize: 16, color: 'rgba(28, 25, 23, 0.85)' },
  cardBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageRowScroll: { marginHorizontal: -Space[4], paddingHorizontal: Space[4], marginVertical: Space[1] },
  imageRow: { flexDirection: 'row', gap: Space[2] },
  cardImage: { width: 80, height: 80, borderRadius: Radii.sm, resizeMode: 'contain', backgroundColor: 'rgba(0,0,0,0.03)' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[1] },
  tag: { backgroundColor: Colors.primary + '15', borderRadius: Radii.full, paddingHorizontal: Space[2], paddingVertical: 2 },
  coupleActionsRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Space[3], borderTopWidth: 1, marginTop: Space[2] },
  premiumReactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: '#FAF9F6',
  },
  premiumReactionBtnActive: {
    borderColor: Colors.primary,
  },
});
