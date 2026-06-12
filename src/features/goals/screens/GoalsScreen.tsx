/**
 * GoalsScreen.tsx
 *
 * Full goals management with progress increments, category filtering,
 * optional cover image uploading, and countdown target dates.
 */

import React, { useEffect, useState, useMemo } from 'react';
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
import { Colors, FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import type { Goal, GoalCategory } from '@features/home/types';
import type { CoupleGoal } from '@features/couple/types';
import { useCoupleStore, PartnerActionType } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import type { MainTabScreenProps } from '@core/navigation/types';
import { uploadImages } from '@shared/lib/storage';
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
  const user = useAuthStore(s => s.user);
  const activeSpace = user?.activeSpace ?? 'personal';
  const coupleStore = useCoupleStore();
  const coupleActions = useCouple();
  const couple = coupleStore.couple;

  const { goals, goalsLoading } = useHomeStore(useShallow(s => ({ goals: s.goals, goalsLoading: s.goalsLoading })));
  const { addGoal, editGoal, removeGoal, refresh } = useHome();

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

  const renderItem = ({ item }: { item: any }) => {
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
          style={[s.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
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
          style={[s.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
          onPress={() => setVisibleCompleted(prev => prev + 10)}
          activeOpacity={0.8}
        >
          <KamiText variant="label" color={colors.primary} bold>Load More Completed Goals</KamiText>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderHeader = () => {
    return (
      <View style={{ gap: Space[3], marginBottom: Space[2] }}>
        {/* Summary */}
        {currentGoals.length > 0 && (
          <View style={s.summary}>
            <View style={s.summaryItem}>
              <KamiText style={s.summaryNum}>{active.length}</KamiText>
              <KamiText variant="caption" color={Colors.textMuted}>active</KamiText>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <KamiText style={s.summaryNum}>{completed.length}</KamiText>
              <KamiText variant="caption" color={Colors.textMuted}>completed</KamiText>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <KamiText style={s.summaryNum}>
                {active.length > 0 ? Math.round(active.reduce((a, g) => a + g.progress, 0) / active.length) : 0}%
              </KamiText>
              <KamiText variant="caption" color={Colors.textMuted}>avg progress</KamiText>
            </View>
          </View>
        )}

        {/* Category filter */}
        {active.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Space[5] }}>
            <View style={s.filterRow}>
              {[{ id: 'all', emoji: '✦', label: 'All' }, ...CATEGORIES].map(c => (
                <TouchableOpacity key={c.id} style={[s.filterChip, filter === c.id && [s.filterChipOn, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]]} onPress={() => setFilter(c.id as any)}>
                  <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                  <KamiText variant="caption" color={filter === c.id ? colors.primary : Colors.textMuted} bold={filter === c.id}>{c.label}</KamiText>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {((goalsLoading === 'loading' && activeSpace === 'personal') ||
          (coupleStore.goalsLoading === 'loading' && activeSpace === 'couple')) && currentGoals.length === 0 && (
          <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        )}
      </View>
    );
  };

  const renderEmpty = () => {
    const isLoading = (goalsLoading === 'loading' && activeSpace === 'personal') ||
      (coupleStore.goalsLoading === 'loading' && activeSpace === 'couple');
    if (isLoading || currentGoals.length > 0) return null;
    return (
      <TouchableOpacity style={s.emptyState} onPress={() => { setEditing(null); setModalVisible(true); }} activeOpacity={0.85}>
        <Text style={{ fontSize: 48, marginBottom: Space[3] }}>{activeSpace === 'couple' ? '💑' : '🌱'}</Text>
        <KamiText variant="subtitle" align="center">{activeSpace === 'couple' ? 'No shared goals yet' : 'No goals yet'}</KamiText>
        <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
          {activeSpace === 'couple' ? 'Milestones to build a beautiful life together.' : 'Every big achievement starts with a single goal.'}
        </KamiText>
        <View style={[s.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
          <KamiText variant="label" color={colors.primary} bold>{activeSpace === 'couple' ? 'Set shared goal ›' : 'Set your first goal ›'}</KamiText>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    return <View style={{ height: Space[8] }} />;
  };

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
        let relativePath: string | null = null;
        const targetId = editing ? editing.id : uuid();

        if (coverUri && (coverUri.startsWith('file://') || coverUri.startsWith('content://'))) {
          const uploadRes = await uploadImages('goal_images', user.id, targetId, [coverUri]);
          if (!uploadRes.success) {
            Alert.alert('Kami', uploadRes.error);
            setSaving(false);
            return;
          }
          relativePath = uploadRes.paths[0];
        } else {
          relativePath = coverUri ? (editing && 'imageUrl' in editing ? (editing as any).imageUrl : null) : null;
          // Map back to relative path if it's a resolved signed URL
          if (relativePath && relativePath.startsWith('http')) {
            const match = relativePath.match(/\/goal_images\/(.+?)\?/);
            if (match) relativePath = decodeURIComponent(match[1]);
          }
        }

        const r = editing
          ? await editGoal(editing.id, { title, category: cat, emoji, description: desc, imageUrl: relativePath })
          : await addGoal({ title, category: cat, emoji, description: desc, imageUrl: relativePath });

        if (!r.success) { Alert.alert('Kami', r.error); }
        else { setModalVisible(false); setEditing(null); }
      }
    } catch (e) {
      Alert.alert('Kami', 'Error saving your goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleProgress = async (g: Goal | CoupleGoal, delta: number) => {
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
  };

  const handleDelete = (g: Goal | CoupleGoal) => Alert.alert('Remove goal?', `"${g.title}"`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      if (activeSpace === 'couple') {
        const r = await coupleActions.deleteGoal(g.id);
        if (!r.success) Alert.alert('Kami', r.error);
      } else {
        removeGoal(g.id);
      }
    }},
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeSpace === 'couple') {
      await coupleActions.loadGoals();
    } else {
      await refresh();
    }
    setRefreshing(false);
  };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.pageBg }]}>
        <View>
          <KamiText variant="overline">{activeSpace === 'couple' ? 'Together' : 'Your progress'}</KamiText>
          <KamiText variant="title">{activeSpace === 'couple' ? 'Couple Goals' : 'Goals'}</KamiText>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => { setEditing(null); setModalVisible(true); }}>
          <Text style={[s.addBtnPlus, { color: colors.primary }]}>+</Text>
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
        contentContainerStyle={s.scroll}
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

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '33', backgroundColor: Colors.pageBg },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  addBtnPlus: { fontSize: FontSize.lg, color: Colors.primary, fontWeight: FontWeight.bold, lineHeight: 22 },
  scroll: { paddingHorizontal: Space[5], paddingTop: Space[4], gap: Space[3] },

  summary: { flexDirection: 'row', backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], borderWidth: 1, borderColor: Colors.border + '44', ...Shadows.card },
  summaryItem:   { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider:{ width: 1, backgroundColor: Colors.border + '66', marginVertical: Space[1] },
  summaryNum:    { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },

  filterRow: { flexDirection: 'row', gap: Space[2], paddingHorizontal: Space[5], paddingVertical: Space[2] },
  filterChip:  { flexDirection: 'row', alignItems: 'center', gap: Space[1], paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  filterChipOn:{ borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },

  center:     { paddingVertical: Space[10], alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn:   { marginTop: Space[4], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[3],
    paddingHorizontal: Space[5],
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.border + '66',
    marginVertical: Space[2],
    ...Shadows.sm,
  },
});

export default GoalsScreen;
