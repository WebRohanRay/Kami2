/**
 * GoalsScreen.tsx
 *
 * Full goals management with progress increments, category filtering,
 * optional cover image uploading, and countdown target dates.
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  AppState,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FlashList } from '@shopify/flash-list';
import { useHome } from '@features/home/hooks';
import { useHomeStore } from '@features/home/store';
import { useAuthStore } from '@features/auth';
import { useShallow } from 'zustand/react/shallow';
import KamiText from '@shared/ui/atoms/KamiText';
import KamiLoading from '@shared/ui/atoms/KamiLoading';
import { FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import type { Goal, GoalCategory } from '@features/home/types';
import type { CoupleGoal } from '@features/couple/types';
import { useCoupleStore, PartnerActionType } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import type { MainTabScreenProps } from '@core/navigation/types';
import { useTheme } from '@shared/hooks';

import {
  CATEGORIES,
  GoalModal,
  GoalCard,
  GoalPreviewModal,
} from '../components';

type Props = MainTabScreenProps<'Goals'>;

import { uuid } from '@shared/lib/uuid';

export function GoalsScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const user = useAuthStore(s => s.user);
  const activeSpace = user?.activeSpace ?? 'personal';
  const coupleStore = useCoupleStore();
  const coupleActions = useCouple();
  const couple = coupleStore.couple;

  const { goals, goalsLoading, pendingSyncCount, isSyncing } = useHomeStore(
    useShallow(s => ({
      goals: s.goals,
      goalsLoading: s.goalsLoading,
      pendingSyncCount: s.pendingSyncCount,
      isSyncing: s.isSyncing,
    }))
  );
  const { addGoal, editGoal, removeGoal, refresh } = useHome();

  // Local UI status: 'idle' | 'syncing' | 'saved'
  const [uiSyncStatus, setUiSyncStatus] = useState<'idle' | 'syncing' | 'saved'>('idle');

  useEffect(() => {
    if (isSyncing) {
      setUiSyncStatus('syncing');
    } else if (pendingSyncCount === 0 && uiSyncStatus === 'syncing') {
      setUiSyncStatus('saved');
      const timer = setTimeout(() => {
        setUiSyncStatus('idle');
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setUiSyncStatus('idle');
    }
  }, [isSyncing, pendingSyncCount]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Goal | CoupleGoal | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isFocused, setIsFocused] = useState(navigation.isFocused());
  const [previewGoal, setPreviewGoal] = useState<Goal | CoupleGoal | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => setAppState(next));
    return () => sub.remove();
  }, []);

  const [filter, setFilter] = useState<'all' | GoalCategory>('all');

  const [visibleActive, setVisibleActive] = useState(10);
  const [visibleCompleted, setVisibleCompleted] = useState(10);

  useEffect(() => {
    setVisibleActive(10);
    setVisibleCompleted(10);
  }, [activeSpace]);

  // Refetch when background sync completes
  const prevIsSyncing = useRef(isSyncing);
  useEffect(() => {
    if (prevIsSyncing.current && !isSyncing) {
      if (activeSpace === 'couple') {
        coupleActions.loadGoals();
      } else {
        refresh();
      }
    }
    prevIsSyncing.current = isSyncing;
  }, [isSyncing, activeSpace, coupleActions, refresh]);

  // Focus listener to auto-refresh data when focused
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
      if (activeSpace === 'couple') {
        coupleActions.loadGoals();
      } else {
        refresh();
      }
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, activeSpace, refresh]);

  // Real-time ephemeral broadcast status when adding/editing a goal
  useEffect(() => {
    if (activeSpace !== 'couple' || !couple?.id || !user?.id) return;
    if (isFocused) {
      const action: PartnerActionType = modalVisible
        ? (editing ? 'editing_goal' : 'creating_goal')
        : 'viewing_goals';
      useCoupleStore.getState().setMyActiveAction(action);
      broadcastPartnerAction(couple.id, user.id, action);
    } else {
      const store = useCoupleStore.getState();
      const cleared1 = store.clearMyActiveAction('creating_goal');
      const cleared2 = store.clearMyActiveAction('editing_goal');
      const cleared3 = store.clearMyActiveAction('viewing_goals');
      if (cleared1 || cleared2 || cleared3) {
        broadcastPartnerAction(couple.id, user.id, 'idle');
      }
    }
  }, [isFocused, modalVisible, editing, activeSpace, couple?.id, user?.id]);

  // Dual-mode loaders
  useEffect(() => {
    if (activeSpace === 'couple') {
      if (couple?.id) {
        coupleActions.loadGoals();
      }
    } else {
      refresh();
    }
  }, [activeSpace, couple?.id]);

  const currentGoals = activeSpace === 'couple' ? coupleStore.coupleGoals : goals;

  const active = useMemo(() => {
    return currentGoals.filter(g => g.status === 'active');
  }, [currentGoals]);

  const completed = useMemo(() => {
    return currentGoals
      .filter(g => g.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
  }, [currentGoals]);

  const sortedActive = useMemo(() => {
    return [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [active]);

  const filtered = useMemo(() => {
    return filter === 'all' ? sortedActive : sortedActive.filter(g => g.category === filter);
  }, [sortedActive, filter]);

  const paginatedActive = useMemo(() => {
    return filtered.slice(0, visibleActive);
  }, [filtered, visibleActive]);

  const paginatedCompleted = useMemo(() => {
    return completed.slice(0, visibleCompleted);
  }, [completed, visibleCompleted]);

  const listData = useMemo(() => {
    const list: any[] = [];

    // Active section
    if (filtered.length > 0) {
      list.push({ type: 'section-header', title: `Active · ${filtered.length}` });
      paginatedActive.forEach(g => {
        list.push({ type: 'goal', goal: g, completed: false });
      });
      if (filtered.length > visibleActive) {
        list.push({ type: 'load-more-active' });
      }
    }

    // Completed section
    if (completed.length > 0) {
      list.push({ type: 'section-header', title: `Completed · ${completed.length}`, marginTop: Space[2] });
      paginatedCompleted.forEach(g => {
        list.push({ type: 'goal', goal: g, completed: true });
      });
      if (completed.length > visibleCompleted) {
        list.push({ type: 'load-more-completed' });
      }
    }

    return list;
  }, [filtered, paginatedActive, completed, paginatedCompleted, visibleActive, visibleCompleted]);

  const handleProgress = useCallback(async (g: Goal | CoupleGoal, delta: number) => {
    const next = Math.min(100, Math.max(0, g.progress + delta));
    if (activeSpace === 'couple') {
      await coupleActions.updateGoalProgress(g.id, next);
      if (next === 100) {
        setTimeout(() => Alert.alert('🎉 Completed!', `"${g.title}"\n\nYou did it!`, [
          { text: 'Mark complete', onPress: () => coupleActions.updateGoal(g.id, { status: 'completed' }) },
          { text: 'Keep active', style: 'cancel' },
        ]), 400);
      }
    } else {
      editGoal(g.id, { progress: next });
      if (next === 100) {
        setTimeout(() => Alert.alert('🎉 Completed!', `"${g.title}"\n\nYou did it!`, [
          { text: 'Mark complete', onPress: () => editGoal(g.id, { status: 'completed' }) },
          { text: 'Keep active', style: 'cancel' },
        ]), 400);
      }
    }
  }, [activeSpace, coupleActions, editGoal]);

  const handleDelete = useCallback((g: Goal | CoupleGoal) => Alert.alert('Remove goal?', `"${g.title}"`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Remove', style: 'destructive', onPress: async () => {
        if (activeSpace === 'couple') {
          const r = await coupleActions.deleteGoal(g.id);
          if (!r.success) Alert.alert('Kami', r.error);
        } else {
          removeGoal(g.id);
        }
      }
    },
  ]), [activeSpace, coupleActions, removeGoal]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'section-header') {
      return (
        <KamiText variant="overline" style={{ marginTop: item.marginTop || 0, marginVertical: Space[2] }}>
          {item.title}
        </KamiText>
      );
    }
    if (item.type === 'goal') {
      return (
        <GoalCard
          goal={item.goal}
          onPressCard={() => { setPreviewGoal(item.goal); setPreviewVisible(true); }}
          onDelete={() => handleDelete(item.goal)}
          onProgress={handleProgress}
          completed={item.completed}
        />
      );
    }
    if (item.type === 'load-more-active') {
      return (
        <TouchableOpacity
          style={[styles.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
          onPress={() => setVisibleActive(prev => prev + 10)}
          activeOpacity={0.8}
        >
          <KamiText variant="label" color={colors.primary} bold>Load More Active Goals</KamiText>
        </TouchableOpacity>
      );
    }
    if (item.type === 'load-more-completed') {
      return (
        <TouchableOpacity
          style={[styles.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
          onPress={() => setVisibleCompleted(prev => prev + 10)}
          activeOpacity={0.8}
        >
          <KamiText variant="label" color={colors.primary} bold>Load More Completed Goals</KamiText>
        </TouchableOpacity>
      );
    }
    return null;
  }, [handleDelete, handleProgress, colors.creamDeep, colors.primary, styles.loadMoreBtn]);

  const renderHeader = useCallback(() => {
    return (
      <View style={{ gap: Space[3], marginBottom: Space[2] }}>
        {/* Summary */}
        {currentGoals.length > 0 && (
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <KamiText style={styles.summaryNum}>{active.length}</KamiText>
              <KamiText variant="caption" color={colors.textMuted}>active</KamiText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <KamiText style={styles.summaryNum}>{completed.length}</KamiText>
              <KamiText variant="caption" color={colors.textMuted}>completed</KamiText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <KamiText style={styles.summaryNum}>
                {active.length > 0 ? Math.round(active.reduce((a, g) => a + g.progress, 0) / active.length) : 0}%
              </KamiText>
              <KamiText variant="caption" color={colors.textMuted}>avg progress</KamiText>
            </View>
          </View>
        )}

        {/* Category filter */}
        {active.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Space[5] }}>
            <View style={styles.filterRow}>
              {[{ id: 'all', emoji: '✦', label: 'All' }, ...CATEGORIES].map(c => (
                <TouchableOpacity key={c.id} style={[styles.filterChip, filter === c.id && [styles.filterChipOn, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]]} onPress={() => setFilter(c.id as any)}>
                  <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                  <KamiText variant="caption" color={filter === c.id ? colors.primary : colors.textMuted} bold={filter === c.id}>{c.label}</KamiText>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {((goalsLoading === 'loading' && activeSpace === 'personal') ||
          (coupleStore.goalsLoading === 'loading' && activeSpace === 'couple')) && currentGoals.length === 0 && (
             <View style={styles.center}>
               <KamiLoading emoji="🌱" message="Growing your goals..." />
             </View>
          )}
      </View>
    );
  }, [currentGoals, active, completed, filter, goalsLoading, activeSpace, coupleStore.goalsLoading, colors, styles]);

  const renderEmpty = useCallback(() => {
    const isLoading = (goalsLoading === 'loading' && activeSpace === 'personal') ||
      (coupleStore.goalsLoading === 'loading' && activeSpace === 'couple');
    if (isLoading || currentGoals.length > 0) return null;
    return (
      <TouchableOpacity style={styles.emptyState} onPress={() => { setEditing(null); setModalVisible(true); }} activeOpacity={0.85}>
        <Text style={{ fontSize: 48, marginBottom: Space[3] }}>{activeSpace === 'couple' ? '💑' : '🌱'}</Text>
        <KamiText variant="subtitle" align="center">{activeSpace === 'couple' ? 'No shared goals yet' : 'No goals yet'}</KamiText>
        <KamiText variant="body" color={colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
          {activeSpace === 'couple' ? 'Milestones to build a beautiful life together.' : 'Every big achievement starts with a single goal.'}
        </KamiText>
        <View style={[styles.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
          <KamiText variant="label" color={colors.primary} bold>{activeSpace === 'couple' ? 'Set shared goal ›' : 'Set your first goal ›'}</KamiText>
        </View>
      </TouchableOpacity>
    );
  }, [goalsLoading, activeSpace, coupleStore.goalsLoading, currentGoals.length, colors, styles.emptyState, styles.emptyBtn]);

  const renderFooter = useCallback(() => {
    return <View style={{ height: Space[8] }} />;
  }, []);

  const handleSave = async (title: string, cat: GoalCategory, emoji: string, desc?: string, coverUri: string | null = null) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      if (activeSpace === 'couple') {
        if (!couple?.id) {
          Alert.alert('Kami', 'No couple space connected.');
          setSaving(false);
          return;
        }
        const r = editing
          ? await coupleActions.updateGoal(editing.id, { title, category: cat, emoji, description: desc })
          : await coupleActions.addGoal(couple.id, title, desc, emoji);

        if (!r.success) { Alert.alert('Kami', r.error); }
        else { setModalVisible(false); setEditing(null); }
      } else {
        const r = editing
          ? await editGoal(editing.id, { title, category: cat, emoji, description: desc, imageUrl: coverUri })
          : await addGoal({ title, category: cat, emoji, description: desc, imageUrl: coverUri });

        if (!r.success) { Alert.alert('Kami', r.error); }
        else { setModalVisible(false); setEditing(null); }
      }
    } catch (e) {
      Alert.alert('Kami', 'Error saving your goal.');
    } finally {
      setSaving(false);
    }
  };



  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeSpace === 'couple') {
      await coupleActions.loadGoals();
    } else {
      await refresh();
    }
    setRefreshing(false);
  }, [activeSpace, coupleActions, refresh]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.pageBg }]}>
        <View style={{ flex: 1 }}>
          <KamiText variant="overline">{activeSpace === 'couple' ? 'Together' : 'Your progress'}</KamiText>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <KamiText variant="title">{activeSpace === 'couple' ? 'Couple Goals' : 'Goals'}</KamiText>
            {uiSyncStatus === 'syncing' && (
              <View style={[styles.syncStatusBadge, { backgroundColor: '#fef3c7' }]}>
                <ActivityIndicator size="small" color="#d97706" style={{ marginRight: 4, transform: [{ scale: 0.8 }] }} />
                <KamiText variant="caption" color="#d97706" bold>Syncing...</KamiText>
              </View>
            )}
            {uiSyncStatus === 'saved' && (
              <View style={[styles.syncStatusBadge, { backgroundColor: '#ecfdf5' }]}>
                <KamiText variant="caption" color="#059669" bold>✓ Saved</KamiText>
              </View>
            )}
            {uiSyncStatus === 'idle' && pendingSyncCount > 0 && (
              <View style={[styles.syncStatusBadge, { backgroundColor: '#f3f4f6' }]}>
                <KamiText variant="caption" color="#6b7280" bold>☁ {pendingSyncCount} offline</KamiText>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => { setEditing(null); setModalVisible(true); }}>
          <Text style={[styles.addBtnPlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>{activeSpace === 'couple' ? 'Add shared' : 'Add goal'}</KamiText>
        </TouchableOpacity>
      </View>

      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item, index) => {
          if (item.type === 'section-header') return `header-${item.title}`;
          if (item.type === 'goal') return `goal-${item.goal.id}`;
          if (item.type === 'load-more-active') return 'load-more-active';
          if (item.type === 'load-more-completed') return 'load-more-completed';
          return `index-${index}`;
        }}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <GoalModal visible={modalVisible} goal={editing} onClose={() => { setModalVisible(false); setEditing(null); }} onSave={handleSave} saving={saving} activeSpace={activeSpace} />

      {(() => {
        const activePreviewGoal = previewGoal ? (activeSpace === 'couple' ? coupleStore.coupleGoals : goals).find(g => g.id === previewGoal.id) || previewGoal : null;
        return (
          <GoalPreviewModal
            visible={previewVisible}
            goal={activePreviewGoal}
            onClose={() => { setPreviewVisible(false); setPreviewGoal(null); }}
            onEdit={() => { setEditing(activePreviewGoal); setModalVisible(true); }}
            onDelete={() => handleDelete(activePreviewGoal!)}
            onProgress={handleProgress}
          />
        );
      })()}
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: colors.border + '33', backgroundColor: colors.pageBg },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: colors.primary + '44' },
  addBtnPlus: { fontSize: FontSize.lg, color: colors.primary, fontWeight: FontWeight.bold, lineHeight: 22 },
  scroll: { paddingHorizontal: Space[5], paddingTop: Space[4], gap: Space[3] },

  summary: { flexDirection: 'row', backgroundColor: colors.cardBg, borderRadius: Radii.card, padding: Space[4], borderWidth: 1, borderColor: colors.border + '44', ...Shadows.card },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.border + '66', marginVertical: Space[1] },
  summaryNum: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: colors.textPrimary },

  filterRow: { flexDirection: 'row', gap: Space[2], paddingHorizontal: Space[5], paddingVertical: Space[2] },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: Space[1], paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cardBg },
  filterChipOn: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },

  center: { paddingVertical: Space[10], alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn: { marginTop: Space[4], backgroundColor: colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: colors.primary + '44' },
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[3],
    paddingHorizontal: Space[5],
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: colors.border + '66',
    marginVertical: Space[2],
    ...Shadows.sm,
  },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    marginLeft: Space[2],
  },
});

export default GoalsScreen;
