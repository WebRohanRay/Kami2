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
import { Colors, Radii, Space, Shadows, Opacity } from '@shared/constants';
import SyncStatusBadge from '@shared/ui/atoms/SyncStatusBadge';
import type { JournalEntry } from '@features/home/types';
import type { CoupleJournal } from '@features/couple/types';

/** Maps mood emoji to a representative color for the left border strip */
const getMoodColor = (moodId: string | null | undefined): string | null => {
  if (!moodId) return null;
  const map: Record<string, string> = {
    '😊': '#F59E0B', '😃': '#F59E0B', '😁': '#FBBF24',
    '😢': '#6366F1', '😞': '#818CF8', '😔': '#6366F1',
    '😡': '#EF4444', '😤': '#DC2626',
    '🥰': '#EC4899', '😍': '#F472B6', '💕': '#EC4899',
    '😌': '#10B981', '😇': '#34D399', '🧘': '#10B981',
    '😰': '#F97316', '😨': '#FB923C', '😟': '#F97316',
    '🤔': '#8B5CF6', '💭': '#A78BFA',
    '😴': '#64748B', '😪': '#94A3B8',
    '🥳': '#F43F5E', '🎉': '#E11D48',
    '😐': '#9CA3AF', '🫤': '#9CA3AF',
  };
  return map[moodId] || null;
};

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
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const sc = useRef(new Animated.Value(1)).current;
  const syncStatus = 'syncStatus' in entry ? entry.syncStatus : undefined;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPressCard}
      delayPressIn={0}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View
        style={[
          styles.entryCard,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border + Opacity.subtle,
            transform: [{ scale: sc }],
          },
          entry.isPinned && [styles.entryCardPinned, { borderColor: colors.primary + '55', backgroundColor: colors.creamMid + '22' }],
        ]}
      >
        {/* Mood-colored left border strip */}
        {getMoodColor(entry.moodId) && (
          <View style={[styles.moodLeftStrip, { backgroundColor: getMoodColor(entry.moodId)! }]} />
        )}

        <View style={styles.entryHeader}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
            {entry.isPinned && <Text style={{ fontSize: 13 }}>📌</Text>}
            {entry.moodId && (
              <View style={[styles.moodBadge, { backgroundColor: colors.primary + '15' }]}>
                <KamiText style={{ fontSize: 13, color: colors.primary }}>{entry.moodId}</KamiText>
              </View>
            )}
            <KamiText variant="label" color={colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>
              {entry.title || 'Untitled entry'}
            </KamiText>
          </View>
          <View style={styles.entryActions}>
            <TouchableOpacity onPress={onTogglePin} hitSlop={8} style={[styles.cardBtn, { backgroundColor: colors.creamDeep, borderColor: colors.border }]}>
              <Text style={{ fontSize: 13, color: entry.isPinned ? colors.primary : colors.textMuted }}>📌</Text>
            </TouchableOpacity>
            {(!activeSpace || activeSpace === 'personal' || entry.userId === user?.id) && (
              <TouchableOpacity onPress={onDelete} hitSlop={8} style={[styles.cardBtn, { backgroundColor: colors.creamDeep, borderColor: colors.border }]}>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>✕</Text>
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

        <KamiText variant="body" color={colors.textPrimary} numberOfLines={4} style={styles.entryBody}>
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
                    bucket={activeSpace === 'couple' ? 'couple_journal_images' : 'journal_images'}
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
            <View style={[styles.coupleActionsRow, { borderTopColor: colors.border + '22' }]}>
              <KamiText variant="caption" color={colors.textMuted} style={{ flex: 1 }} bold>
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
                        { borderColor: colors.border + Opacity.ghost, backgroundColor: colors.inputBg },
                        active && [styles.premiumReactionBtnActive, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]
                      ]}
                      onPress={() => onReact?.(coupleEntry.id, emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 14 }}>{emoji}</Text>
                      {count > 0 && (
                        <KamiText variant="caption" color={active ? colors.primary : colors.textSecondary} bold style={{ fontSize: 10 }}>
                          {count}
                        </KamiText>
                      )}
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity style={[styles.premiumReactionBtn, { borderColor: colors.border + Opacity.ghost, backgroundColor: colors.inputBg, paddingHorizontal: Space[3] }]} onPress={() => onOpenComments?.(coupleEntry)}>
                  <Text style={{ fontSize: 14 }}>💬</Text>
                  {(coupleEntry.comments ?? []).length > 0 && (
                    <KamiText variant="caption" color={colors.textSecondary} bold style={{ fontSize: 10 }}>
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

const getStyles = (colors: any) => StyleSheet.create({
  moodBadge: {
    paddingHorizontal: Space[2],
    paddingVertical: 2,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    paddingLeft: Space[5],
    gap: Space[3],
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.subtle,
    ...Shadows.md,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  moodLeftStrip: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderRadius: 2,
  },
  entryCardPinned: {
    borderColor: colors.primary + Opacity.strong,
    backgroundColor: colors.cardBg,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  entryActions: { flexDirection: 'row', gap: Space[2] },
  entryBody: { lineHeight: 26, fontSize: 16, color: colors.textPrimary },
  cardBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageRowScroll: { marginHorizontal: -Space[4], paddingHorizontal: Space[4], marginVertical: Space[1] },
  imageRow: { flexDirection: 'row', gap: Space[2] },
  cardImage: { width: 80, height: 80, borderRadius: Radii.sm, resizeMode: 'contain', backgroundColor: 'rgba(0,0,0,0.03)' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[1] },
  tag: { backgroundColor: colors.primary + '15', borderRadius: Radii.full, paddingHorizontal: Space[2], paddingVertical: 2 },
  coupleActionsRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Space[3], borderTopWidth: 1, marginTop: Space[2] },
  premiumReactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.ghost,
    backgroundColor: colors.inputBg,
  },
  premiumReactionBtnActive: {
    borderColor: colors.primary,
  },
});
