import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Space, Radii, Shadows, FontFamily } from '@shared/constants';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';
import type { PartnerSpaceSnapshot } from '../types';

type DateFilter = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'special';

const FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'special', label: 'Special ❤️' },
];

/**
 * Screen 6 — History
 * Timeline of canvas snapshots with date filters.
 */
const HistoryScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const space = usePartnerSpaceStore((s) => s.space);
  const snapshots = usePartnerSpaceStore((s) => s.snapshots);
  const setSnapshots = usePartnerSpaceStore((s) => s.setSnapshots);
  const setSnapshotsLoading = usePartnerSpaceStore((s) => s.setSnapshotsLoading);
  const snapshotsLoading = usePartnerSpaceStore((s) => s.snapshotsLoading);

  const [activeFilter, setActiveFilter] = useState<DateFilter>('today');

  const getDateRange = useCallback((filter: DateFilter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filter) {
      case 'today':
        return { from: today.toISOString(), to: now.toISOString() };
      case 'yesterday': {
        const yd = new Date(today);
        yd.setDate(yd.getDate() - 1);
        return { from: yd.toISOString(), to: today.toISOString() };
      }
      case 'this_week': {
        const wk = new Date(today);
        wk.setDate(wk.getDate() - 7);
        return { from: wk.toISOString(), to: now.toISOString() };
      }
      case 'this_month': {
        const mo = new Date(today);
        mo.setDate(1);
        return { from: mo.toISOString(), to: now.toISOString() };
      }
      case 'special':
        return {};
    }
  }, []);

  const loadSnapshots = useCallback(async () => {
    if (!space?.id) return;
    setSnapshotsLoading('loading');

    const dateRange = getDateRange(activeFilter);
    const res = await SpaceService.fetchSnapshots(space.id, 50, 1, dateRange);
    if (res.success) {
      setSnapshots(res.data);
    }
    setSnapshotsLoading('idle');
  }, [space?.id, activeFilter, getDateRange, setSnapshots, setSnapshotsLoading]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const snapshotTypeLabel = (type: string) => {
    switch (type) {
      case 'goodnight': return '🌙 Goodnight';
      case 'takeover': return '🔥 Takeover';
      case 'manual': return '💾 Saved';
      default: return '📸 Auto';
    }
  };

  const renderSnapshot = ({ item, index }: { item: PartnerSpaceSnapshot; index: number }) => {
    const itemCount = item.snapshotData?.items?.length ?? 0;

    return (
      <Animated.View entering={FadeInDown.delay(index * 80).duration(300)}>
        <TouchableOpacity
          style={[styles.snapshotCard, { backgroundColor: colors.cardBg, ...Shadows.sm }]}
          activeOpacity={0.7}
        >
          {/* Thumbnail placeholder */}
          <View style={[styles.thumbnail, { backgroundColor: colors.creamDeep }]}>
            <Text style={styles.thumbnailEmoji}>
              {item.snapshotType === 'goodnight' ? '🌙' : item.snapshotType === 'takeover' ? '🔥' : '📋'}
            </Text>
            <Text style={[styles.thumbnailCount, { color: colors.textMuted }]}>
              {itemCount} items
            </Text>
          </View>

          {/* Info */}
          <View style={styles.snapshotInfo}>
            <Text style={[styles.snapshotType, { color: colors.primary }]}>
              {snapshotTypeLabel(item.snapshotType)}
            </Text>
            <Text style={[styles.snapshotTime, { color: colors.textSecondary }]}>
              {formatDate(item.createdAt)}
            </Text>
            <Text style={[styles.snapshotNickname, { color: colors.textMuted }]}>
              {item.snapshotData?.nickname || 'Our Wall'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>History 📅</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            style={[
              styles.filterTab,
              activeFilter === f.key
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.cardBg },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === f.key ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Snapshot list */}
      <FlatList
        data={snapshots}
        renderItem={renderSnapshot}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {activeFilter === 'special'
                ? 'Your story together starts here ❤️'
                : 'No snapshots yet for this period'}
            </Text>
          </Animated.View>
        }
      />
    </View>
  );
};

export default HistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Space[12], paddingBottom: Space[3], paddingHorizontal: Space[4], borderBottomWidth: 1,
  },
  backButton: { padding: Space[2] },
  backText: { fontSize: FontSize.base },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  filterRow: { paddingHorizontal: Space[4], paddingVertical: Space[3], gap: Space[2] },
  filterTab: { paddingHorizontal: Space[4], paddingVertical: Space[2], borderRadius: Radii.full },
  filterText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  listContent: { padding: Space[4], gap: Space[3] },
  snapshotCard: {
    flexDirection: 'row', borderRadius: Radii.card, overflow: 'hidden',
  },
  thumbnail: {
    width: 80, alignItems: 'center', justifyContent: 'center', padding: Space[2],
  },
  thumbnailEmoji: { fontSize: 28, marginBottom: 4 },
  thumbnailCount: { fontSize: FontSize.xs },
  snapshotInfo: {
    flex: 1, padding: Space[3], justifyContent: 'center',
  },
  snapshotType: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 2 },
  snapshotTime: { fontSize: FontSize.xs, marginBottom: 2 },
  snapshotNickname: { fontSize: FontSize.xs, fontFamily: FontFamily.handwriting },
  emptyState: { alignItems: 'center', paddingTop: Space[16] },
  emptyEmoji: { fontSize: 48, marginBottom: Space[4] },
  emptyText: { fontSize: FontSize.base, fontFamily: FontFamily.handwriting, textAlign: 'center' },
});
