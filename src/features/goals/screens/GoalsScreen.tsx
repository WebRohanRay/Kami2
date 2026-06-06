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
  goal: Goal | null;
  onClose: () => void;
  onSave:  (title: string, cat: GoalCategory, emoji: string, desc: string | undefined, coverUri: string | null) => Promise<void>;
  saving:  boolean;
}> = ({ visible, goal, onClose, onSave, saving }) => {
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
      setCategory(goal?.category ?? 'personal');
      setEmoji(goal?.emoji ?? '🌱');
      setCoverUri(goal?.imageUrl ?? null);
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
  const { goals, goalsLoading } = useHomeStore(useShallow(s => ({ goals: s.goals, goalsLoading: s.goalsLoading })));
  const { addGoal, editGoal, removeGoal, refresh } = useHome();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing,      setEditing]      = useState<Goal | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filter,       setFilter]       = useState<'all' | GoalCategory>('all');

  const active    = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');
  const filtered  = filter === 'all' ? active : active.filter(g => g.category === filter);

  const handleSave = async (title: string, cat: GoalCategory, emoji: string, desc?: string, coverUri: string | null = null) => {
    if (!user?.id) return;
    setSaving(true);
    try {
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
        relativePath = coverUri ? (editing?.imageUrl === coverUri ? coverUri : null) : null;
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
    } catch (e) {
      Alert.alert('Kami', 'Error saving your goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleProgress = (g: Goal, delta: number) => {
    const next = Math.min(100, Math.max(0, g.progress + delta));
    editGoal(g.id, { progress: next });
    if (next === 100) {
      setTimeout(() => Alert.alert('🎉 Completed!', `"${g.title}"\n\nYou did it!`, [
        { text: 'Mark complete', onPress: () => editGoal(g.id, { status: 'completed' }) },
        { text: 'Keep active', style: 'cancel' },
      ]), 400);
    }
  };

  const handleDelete = (g: Goal) => Alert.alert('Remove goal?', `"${g.title}"`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => removeGoal(g.id) },
  ]);

  const handleRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.pageBg }]}>
        <View>
          <KamiText variant="overline">Your progress</KamiText>
          <KamiText variant="title">Goals</KamiText>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => { setEditing(null); setModalVisible(true); }}>
          <Text style={[s.addBtnPlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>Add goal</KamiText>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Summary */}
        {goals.length > 0 && (
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

        {goalsLoading === 'loading' && goals.length === 0 && (
          <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        )}

        {goalsLoading !== 'loading' && goals.length === 0 && (
          <TouchableOpacity style={s.emptyState} onPress={() => { setEditing(null); setModalVisible(true); }} activeOpacity={0.85}>
            <Text style={{ fontSize: 48, marginBottom: Space[3] }}>🌱</Text>
            <KamiText variant="subtitle" align="center">No goals yet</KamiText>
            <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
              Every big achievement starts with a single goal.
            </KamiText>
            <View style={[s.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
              <KamiText variant="label" color={colors.primary} bold>Set your first goal ›</KamiText>
            </View>
          </TouchableOpacity>
        )}

        {/* Active goals */}
        {filtered.length > 0 && <KamiText variant="overline">Active · {filtered.length}</KamiText>}
        {filtered.map(g => <GoalCard key={g.id} goal={g} onEdit={() => { setEditing(g); setModalVisible(true); }} onDelete={() => handleDelete(g)} onProgress={handleProgress} />)}

        {/* Completed goals */}
        {completed.length > 0 && (
          <>
            <KamiText variant="overline" style={{ marginTop: Space[2] }}>Completed · {completed.length}</KamiText>
            {completed.map(g => <GoalCard key={g.id} goal={g} onEdit={() => {}} onDelete={() => handleDelete(g)} onProgress={() => {}} completed />)}
          </>
        )}

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <GoalModal visible={modalVisible} goal={editing} onClose={() => { setModalVisible(false); setEditing(null); }} onSave={handleSave} saving={saving} />
    </SafeAreaView>
  );
}

const GoalCard: React.FC<{ goal: Goal; onEdit: () => void; onDelete: () => void; onProgress: (g: Goal, d: number) => void; completed?: boolean }> = ({ goal, onEdit, onDelete, onProgress, completed }) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;
  const cat = CATEGORIES.find(c => c.id === goal.category);
  return (
    <TouchableOpacity activeOpacity={1} onPress={onEdit}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[s.card, completed && s.cardDone, { transform: [{ scale: sc }] }]}>
        
        {/* Cover Photo */}
        {goal.imageUrl && (
          <View style={s.cardCoverWrap}>
            <Image source={{ uri: goal.imageUrl }} style={s.cardCover} />
            <View style={s.cardCoverOverlay} />
          </View>
        )}

        <View style={s.cardTop}>
          <Text style={s.emojiBadge}>{goal.emoji}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <KamiText variant="label" numberOfLines={1} style={goal.imageUrl && { color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:0,height:1}, textShadowRadius: 2 }}>
              {goal.title}
            </KamiText>
            {goal.description ? (
              <KamiText variant="caption" color={goal.imageUrl ? '#e0d5d7' : Colors.textMuted} numberOfLines={1}>
                {goal.description}
              </KamiText>
            ) : (
              <KamiText variant="caption" color={goal.imageUrl ? '#e0d5d7' : Colors.textMuted}>
                {cat?.emoji} {cat?.label}
              </KamiText>
            )}
          </View>
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.delBtn}>
            <Text style={{ fontSize: 12, color: Colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={s.progRow}>
          <View style={s.progTrack}>
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
            <Text style={{ fontSize: 14 }}>🎉</Text>
            <KamiText variant="caption" color={Colors.success} bold>Completed</KamiText>
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

  card:     { position: 'relative', backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], gap: Space[3], borderWidth: 1, borderColor: Colors.border + '44', overflow: 'hidden', ...Shadows.sm },
  cardDone: { opacity: 0.75, borderColor: Colors.success + '44' },
  
  // Cover Photo
  cardCoverWrap:{ ...StyleSheet.absoluteFillObject, height: 80, overflow: 'hidden' },
  cardCover:    { width: '100%', height: '100%' },
  cardCoverOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },

  emojiBadge:{ fontSize: 24, width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: Platform.OS === 'ios' ? 34 : 30 },
  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: Space[3], zIndex: 1 },
  delBtn:   { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, zIndex: 2 },
  progRow:  { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  progTrack:{ flex: 1, height: 6, backgroundColor: Colors.creamDeep, borderRadius: 3, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  ctrlBtnMinus: { paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.sm, backgroundColor: Colors.creamDeep, borderWidth: 1, borderColor: Colors.border },
  ctrlBtnPlus:  { paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.sm, backgroundColor: Colors.primary },
  completedBadge:{ flexDirection: 'row', alignItems: 'center', gap: Space[2], backgroundColor: Colors.success + '15', borderRadius: Radii.sm, paddingHorizontal: Space[3], paddingVertical: Space[2], alignSelf: 'flex-start' },
});
