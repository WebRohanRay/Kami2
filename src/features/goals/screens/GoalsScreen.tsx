/**
 * GoalsScreen.tsx
 *
 * Full goals management with progress increments, category filtering,
 * optional cover image uploading, and countdown target dates.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Keyboard, Modal,
  Platform, RefreshControl, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  Image, StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useHome }      from '@features/home/hooks';
import { useHomeStore } from '@features/home/store';
import { useAuthStore } from '@features/auth';
import { useShallow }   from 'zustand/react/shallow';
import KamiText         from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, FontWeight, Radii, Shadows, Space, FontFamily } from '@shared/constants';
import type { Goal, GoalCategory } from '@features/home/types';
import type { CoupleGoal } from '@features/couple/types';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import { broadcastPartnerAction } from '@features/couple/components/CoupleRealtimeListener';
import type { MainTabScreenProps } from '@core/navigation/types';
import { pickImages, uploadImages } from '@shared/lib/storage';
import { useTheme }     from '@shared/hooks';

type Props = MainTabScreenProps<'Goals'>;

const CATEGORIES: { id: GoalCategory; emoji: string; label: string }[] = [
  { id: 'personal',     emoji: '🌱', label: 'Personal'     },
  { id: 'health',       emoji: '💪', label: 'Health'       },
  { id: 'career',       emoji: '🚀', label: 'Career'       },
  { id: 'learning',     emoji: '📚', label: 'Learning'     },
  { id: 'creative',     emoji: '🎨', label: 'Creative'     },
  { id: 'relationship', emoji: '💛', label: 'Relationship' },
  { id: 'other',        emoji: '⭐', label: 'Other'        },
];

const EMOJIS = ['🌱','🎯','💪','📚','🚀','🎨','💛','⭐','🏃','✍️','🧘','🌟','🎵','🌍','🏋️','💡'];

const STATUS_LABELS: Record<Goal['status'], string> = {
  active: 'Active', completed: 'Completed', paused: 'Paused', abandoned: 'Abandoned',
};

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0;
  const v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const d = Math.ceil(diff / 86400000);
  if (d < 0)  return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Due today';
  return `${d}d left`;
}

// ─── Add/Edit goal modal ──────────────────────────────────────────────────────
const GoalModal: React.FC<{
  visible: boolean;
  goal: Goal | CoupleGoal | null;
  onClose: () => void;
  onSave:  (title: string, cat: GoalCategory, emoji: string, desc: string | undefined, coverUri: string | null) => Promise<void>;
  saving:  boolean;
  activeSpace: 'personal' | 'couple';
}> = ({ visible, goal, onClose, onSave, saving, activeSpace }) => {
  const { colors } = useTheme();
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [category, setCategory] = useState<GoalCategory>('personal');
  const [emoji,    setEmoji]    = useState('🌱');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [picking,  setPicking]  = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(goal?.title ?? '');
      setDesc(goal?.description ?? '');
      setCategory((goal?.category as GoalCategory) ?? 'personal');
      setEmoji(goal?.emoji ?? '🌱');
      setCoverUri(goal && 'imageUrl' in goal ? (goal as any).imageUrl : null);
    }
  }, [visible, goal]);

  const handlePickCover = async () => {
    setPicking(true);
    const r = await pickImages(false);
    setPicking(false);
    if (r.success) {
      setCoverUri(r.uris[0]);
    } else if (!r.cancelled) {
      Alert.alert('Kami', r.error);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[gm.root, { backgroundColor: colors.pageBg }]}>
        <View style={gm.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">{goal ? 'Edit goal' : 'New goal'}</KamiText>
          <TouchableOpacity onPress={() => { if (!title.trim()) return; Keyboard.dismiss(); onSave(title.trim(), category, emoji, desc.trim() || undefined, coverUri); }} disabled={saving || !title.trim()} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <KamiText variant="label" color={title.trim() ? colors.primary : Colors.textMuted} bold>Save</KamiText>
            }
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={gm.content}>
          {/* Emoji */}
          <KamiText variant="overline" style={gm.sectionLabel}>Icon</KamiText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={gm.emojiRow}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} style={[gm.emojiBtn, emoji === e && [gm.emojiBtnOn, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]]} onPress={() => setEmoji(e)}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Title */}
          <KamiText variant="overline" style={gm.sectionLabel}>Goal *</KamiText>
          <TextInput style={gm.input} placeholder="e.g. Read 12 books this year" placeholderTextColor={Colors.textMuted} value={title} onChangeText={setTitle} maxLength={100} autoFocus={!goal} />

          {/* Description */}
          <KamiText variant="overline" style={gm.sectionLabel}>Why it matters (optional)</KamiText>
          <TextInput style={[gm.input, { height: 75, textAlignVertical: 'top' }]} placeholder="Your reason keeps you motivated…" placeholderTextColor={Colors.textMuted} value={desc} onChangeText={setDesc} multiline maxLength={300} />

          {/* Category */}
          <KamiText variant="overline" style={gm.sectionLabel}>Category</KamiText>
          <View style={gm.catGrid}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c.id} style={[gm.catChip, category === c.id && [gm.catChipOn, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]]} onPress={() => setCategory(c.id)}>
                <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                <KamiText variant="caption" color={category === c.id ? colors.primary : Colors.textMuted} bold={category === c.id}>{c.label}</KamiText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cover Image */}
          {activeSpace === 'personal' && (
            <>
              <View style={gm.coverHeader}>
                <KamiText variant="overline">Cover Photo (optional)</KamiText>
                <TouchableOpacity onPress={handlePickCover} style={gm.addCoverBtn} disabled={picking}>
                  {picking ? <ActivityIndicator size="small" color={colors.primary} /> : <KamiText variant="caption" color={colors.primary} bold>{coverUri ? 'Change Photo' : '+ Choose Cover'}</KamiText>}
                </TouchableOpacity>
              </View>

              {coverUri && (
                <View style={gm.coverPreviewWrap}>
                  <Image source={{ uri: coverUri }} style={gm.coverPreview} />
                  <TouchableOpacity style={gm.removeCoverBadge} onPress={() => setCoverUri(null)}>
                    <Text style={{ color: '#fff', fontSize: 11 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
const gm = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.pageBg },
  toolbar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  content:     { padding: Space[5], gap: Space[3], paddingBottom: Space[10] },
  sectionLabel:{ marginBottom: Space[1] },
  emojiRow:    { flexDirection: 'row', gap: Space[2], paddingVertical: Space[2] },
  emojiBtn:    { width: 48, height: 48, borderRadius: Radii.sm, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  emojiBtnOn:  { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  input:       { backgroundColor: Colors.creamDeep, borderRadius: Radii.input, paddingHorizontal: Space[4], paddingVertical: Space[3], fontSize: FontSize.base, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border },
  catGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  catChip:     { flexDirection: 'row', alignItems: 'center', gap: Space[1], paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.creamDeep },
  catChipOn:   { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  coverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space[3], borderTopWidth: 1, borderTopColor: Colors.border + '22', paddingTop: Space[3] },
  addCoverBtn: { paddingVertical: Space[1], paddingHorizontal: Space[2] },
  coverPreviewWrap:{ position: 'relative', marginTop: Space[2], borderRadius: Radii.card, overflow: 'hidden', height: 160 },
  coverPreview:{ width: '100%', height: '100%' },
  removeCoverBadge:{ position: 'absolute', top: Space[2], right: Space[2], width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export function GoalsScreen({ navigation }: Props) {
  const user = useAuthStore(s => s.user);
  const activeSpace = user?.activeSpace ?? 'personal';
  const coupleStore = useCoupleStore();
  const coupleActions = useCouple();
  const couple = coupleStore.couple;

  const { goals, goalsLoading } = useHomeStore(useShallow(s => ({ goals: s.goals, goalsLoading: s.goalsLoading })));
  const { addGoal, editGoal, removeGoal, refresh } = useHome();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing,      setEditing]      = useState<Goal | CoupleGoal | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [isFocused,    setIsFocused]    = useState(navigation.isFocused());
  const [filter,       setFilter]       = useState<'all' | GoalCategory>('all');

  const [visibleActive,    setVisibleActive]    = useState(10);
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
    if (activeSpace === 'couple' && couple?.id && user?.id) {
      if (isFocused) {
        const action = modalVisible ? 'creating_goal' : 'viewing_goals';
        useCoupleStore.getState().setMyActiveAction(action);
        broadcastPartnerAction(couple.id, user.id, action);
      } else {
        const store = useCoupleStore.getState();
        const cleared1 = store.clearMyActiveAction('creating_goal');
        const cleared2 = store.clearMyActiveAction('viewing_goals');
        if (cleared1 || cleared2) {
          broadcastPartnerAction(couple.id, user.id, 'idle');
        }
      }
    }
  }, [isFocused, modalVisible, activeSpace, couple?.id, user?.id]);

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

  const active = currentGoals.filter(g => g.status === 'active');
  const completed = currentGoals
    .filter(g => g.status === 'completed')
    .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());

  const sortedActive = [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = filter === 'all' ? sortedActive : sortedActive.filter(g => g.category === filter);

  const paginatedActive = filtered.slice(0, visibleActive);
  const paginatedCompleted = completed.slice(0, visibleCompleted);

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
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

        {((goalsLoading !== 'loading' && activeSpace === 'personal') ||
          (coupleStore.goalsLoading !== 'loading' && activeSpace === 'couple')) && currentGoals.length === 0 && (
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
        )}

        {/* Active goals */}
        {filtered.length > 0 && <KamiText variant="overline">Active · {filtered.length}</KamiText>}
        {paginatedActive.map(g => (
          <GoalCard key={g.id} goal={g} onEdit={() => { setEditing(g); setModalVisible(true); }} onDelete={() => handleDelete(g)} onProgress={handleProgress} />
        ))}
        {filtered.length > visibleActive && (
          <TouchableOpacity
            style={[s.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
            onPress={() => setVisibleActive(prev => prev + 10)}
            activeOpacity={0.8}
          >
            <KamiText variant="label" color={colors.primary} bold>Load More Active Goals</KamiText>
          </TouchableOpacity>
        )}

        {/* Completed goals */}
        {completed.length > 0 && (
          <>
            <KamiText variant="overline" style={{ marginTop: Space[2] }}>Completed · {completed.length}</KamiText>
            {paginatedCompleted.map(g => (
              <GoalCard key={g.id} goal={g} onEdit={() => {}} onDelete={() => handleDelete(g)} onProgress={() => {}} completed />
            ))}
            {completed.length > visibleCompleted && (
              <TouchableOpacity
                style={[s.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
                onPress={() => setVisibleCompleted(prev => prev + 10)}
                activeOpacity={0.8}
              >
                <KamiText variant="label" color={colors.primary} bold>Load More Completed Goals</KamiText>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <GoalModal visible={modalVisible} goal={editing} onClose={() => { setModalVisible(false); setEditing(null); }} onSave={handleSave} saving={saving} activeSpace={activeSpace} />
    </SafeAreaView>
  );
}

const GoalCard: React.FC<{ goal: Goal | CoupleGoal; onEdit: () => void; onDelete: () => void; onProgress: (g: Goal | CoupleGoal, d: number) => void; completed?: boolean }> = ({ goal, onEdit, onDelete, onProgress, completed }) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;
  const cat = CATEGORIES.find(c => c.id === goal.category);
  const imageUrl = 'imageUrl' in goal ? (goal as any).imageUrl : null;

  // Plant growth stage representation: Sprout Seed 🌱 (<30%), Growing Vine 🌿 (30-99%), Blooming Flower 🌸 (100%)
  const getPlantEmoji = () => {
    if (goal.progress < 30) return '🌱';
    if (goal.progress < 100) return '🌿';
    return '🌸';
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={onEdit}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[
        s.card, 
        completed ? s.cardDone : s.cardActive,
        { transform: [{ scale: sc }] }
      ]}>
        
        {/* Cover Photo */}
        {imageUrl && (
          <View style={s.cardCoverWrap}>
            <Image source={{ uri: imageUrl }} style={s.cardCover} />
            <View style={s.cardCoverOverlay} />
          </View>
        )}

        <View style={s.cardTop}>
          <View style={s.gardenBadge}>
            <Text style={{ fontSize: 22 }}>{getPlantEmoji()}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <KamiText variant="label" numberOfLines={1} style={[imageUrl && { color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:0,height:1}, textShadowRadius: 2 }, { color: Colors.textPrimary }]}>
              {goal.title} {goal.emoji}
            </KamiText>
            {goal.description ? (
              <KamiText variant="caption" color={imageUrl ? '#e0d5d7' : Colors.textMuted} numberOfLines={1}>
                {goal.description}
              </KamiText>
            ) : (
              <KamiText variant="caption" color={imageUrl ? '#e0d5d7' : Colors.textMuted}>
                {cat?.emoji} {cat?.label}
              </KamiText>
            )}
          </View>
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.delBtn}>
            <Text style={{ fontSize: 12, color: Colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={s.progRow}>
          <View style={[s.progTrack, { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.primary + '18' }]}>
            <View style={[s.progFill, { width: `${goal.progress}%` as any, backgroundColor: completed ? Colors.success : colors.primary }]} />
          </View>
          <KamiText variant="caption" color={completed ? Colors.success : colors.primary} bold style={{ minWidth: 36, ...Platform.select({ web: { textAlign: 'right' } }) }}>
            {goal.progress}%
          </KamiText>
        </View>

        {!completed && (
          <View style={s.controls}>
            <TouchableOpacity style={s.ctrlBtnMinus} onPress={() => onProgress(goal, -10)} disabled={goal.progress === 0}>
              <KamiText variant="caption" color={Colors.textSecondary} bold>−10%</KamiText>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {goal.targetDate
                ? <KamiText variant="caption" color={Colors.textMuted}>🗓 {daysLeft(goal.targetDate)}</KamiText>
                : <KamiText variant="caption" color={Colors.textMuted}>{STATUS_LABELS[goal.status]}</KamiText>
              }
            </View>
            <TouchableOpacity style={[s.ctrlBtnPlus, { backgroundColor: colors.primary }]} onPress={() => onProgress(goal, 10)} disabled={goal.progress === 100}>
              <KamiText variant="caption" color="#fff" bold>+10%</KamiText>
            </TouchableOpacity>
          </View>
        )}

        {completed && (
          <View style={s.completedBadge}>
            <Text style={{ fontSize: 14 }}>🌸</Text>
            <KamiText variant="caption" color={Colors.success} bold>Bloomed & Completed</KamiText>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default GoalsScreen;

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '33', backgroundColor: Colors.pageBg },
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

  card:     { position: 'relative', borderRadius: Radii.card, padding: Space[4], gap: Space[3], borderWidth: 1.5, overflow: 'hidden', ...Shadows.sm },
  cardActive: { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }, // Soft organic light green
  cardDone: { opacity: 0.85, backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }, // Soft completion mint green
  
  // Cover Photo
  cardCoverWrap:{ ...StyleSheet.absoluteFillObject, height: 80, overflow: 'hidden' },
  cardCover:    { width: '100%', height: '100%' },
  cardCoverOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },

  gardenBadge:{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dcfce7', ...Shadows.sm },
  emojiBadge:{ fontSize: 24, width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: Platform.OS === 'ios' ? 34 : 30 },
  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: Space[3], zIndex: 1 },
  delBtn:   { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border + '33', zIndex: 2 },
  progRow:  { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  progTrack:{ flex: 1, height: 8, backgroundColor: Colors.creamDeep, borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  ctrlBtnMinus: { paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.sm, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border + '33' },
  ctrlBtnPlus:  { paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.sm, backgroundColor: Colors.primary },
  completedBadge:{ flexDirection: 'row', alignItems: 'center', gap: Space[2], backgroundColor: '#d1fae5', borderRadius: Radii.sm, paddingHorizontal: Space[3], paddingVertical: Space[2], alignSelf: 'flex-start', borderWidth: 1, borderColor: '#6ee7b7' },
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
