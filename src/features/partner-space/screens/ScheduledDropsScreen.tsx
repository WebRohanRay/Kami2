import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Space, Radii, Shadows, FontFamily } from '@shared/constants';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';
import type { PartnerSpaceItem } from '../types';

/**
 * Screen 7 — Scheduled Drops Manager (Partner Only)
 * List of pending scheduled drops. Owner never sees this screen.
 */
const ScheduledDropsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const space = usePartnerSpaceStore((s) => s.space);
  const scheduledDrops = usePartnerSpaceStore((s) => s.scheduledDrops);
  const setScheduledDrops = usePartnerSpaceStore((s) => s.setScheduledDrops);

  useEffect(() => {
    if (space?.id) {
      SpaceService.fetchScheduledDrops(space.id).then((res) => {
        if (res.success) setScheduledDrops(res.data);
      });
    }
  }, [space?.id]);

  const handleCancel = useCallback(async (item: PartnerSpaceItem) => {
    Alert.alert(
      'Cancel this drop? 🕐',
      'It won\'t appear on their widget.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel drop',
          style: 'destructive',
          onPress: async () => {
            const res = await SpaceService.cancelScheduledDrop(item.id);
            if (res.success) {
              setScheduledDrops(scheduledDrops.filter((d) => d.id !== item.id));
            }
          },
        },
      ]
    );
  }, [scheduledDrops, setScheduledDrops]);

  const formatScheduledTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) return 'Overdue — publishing soon...';
    if (diffHours < 1) return 'Less than an hour away ✨';
    if (diffHours < 24) return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    return `In ${diffDays} day${diffDays > 1 ? 's' : ''} — ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const contentTypeLabel = (type: string) => {
    switch (type) {
      case 'photo': return '📸 Photo';
      case 'note': return '💌 Note';
      case 'sticker': return '😊 Sticker';
      case 'drawing': return '✍️ Drawing';
      case 'gift': return '🎁 Gift';
      default: return '📦 Item';
    }
  };

  const renderDrop = ({ item, index }: { item: PartnerSpaceItem; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(300)}>
      <View style={[styles.dropCard, { backgroundColor: colors.cardBg, ...Shadows.sm }]}>
        <View style={styles.dropInfo}>
          <Text style={[styles.dropType, { color: colors.primary }]}>
            {contentTypeLabel(item.type)}
          </Text>
          <Text style={[styles.dropTime, { color: colors.textSecondary }]}>
            {item.scheduledAt ? formatScheduledTime(item.scheduledAt) : 'Unknown time'}
          </Text>
          {item.disappearCondition && (
            <Text style={[styles.dropDisappear, { color: colors.textMuted }]}>
              🫧 Will disappear: {item.disappearCondition.replace('_', ' ')}
            </Text>
          )}
        </View>
        <View style={styles.dropActions}>
          <TouchableOpacity
            onPress={() => handleCancel(item)}
            style={[styles.cancelBtn, { borderColor: colors.error }]}
          >
            <Text style={[styles.cancelBtnText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Scheduled Drops ⏰</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={scheduledDrops}
        renderItem={renderDrop}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🕐</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No surprises planned yet 🕐{'\n'}
              Schedule something from the canvas!
            </Text>
          </Animated.View>
        }
      />
    </View>
  );
};

export default ScheduledDropsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Space[12], paddingBottom: Space[3], paddingHorizontal: Space[4], borderBottomWidth: 1,
  },
  backButton: { padding: Space[2] },
  backText: { fontSize: FontSize.base },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  listContent: { padding: Space[4], gap: Space[3] },
  dropCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: Radii.card, padding: Space[4],
  },
  dropInfo: { flex: 1 },
  dropType: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, marginBottom: 4 },
  dropTime: { fontSize: FontSize.sm, marginBottom: 2 },
  dropDisappear: { fontSize: FontSize.xs, fontStyle: 'italic' },
  dropActions: { marginLeft: Space[3] },
  cancelBtn: { borderWidth: 1, borderRadius: Radii.button, paddingHorizontal: Space[3], paddingVertical: Space[2] },
  cancelBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  emptyState: { alignItems: 'center', paddingTop: Space[16] },
  emptyEmoji: { fontSize: 48, marginBottom: Space[4] },
  emptyText: { fontSize: FontSize.base, fontFamily: FontFamily.handwriting, textAlign: 'center', lineHeight: 24 },
});
