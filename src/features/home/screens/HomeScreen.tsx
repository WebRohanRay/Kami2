/**
 * HomeScreen.tsx — Solo experience
 *
 * Sections:
 *  1. Header       — greeting, avatar, streak, days in Kami
 *  2. Mood         — daily mood check-in with note
 *  3. Prompt       — daily reflection prompt + response
 *  4. Journal      — recent entries + add new
 *  5. Goals        — active goals with progress + add new
 *
 * Data: all via useHome hook → homeService → Supabase (RLS enforced)
 * Realtime: live updates via Supabase Realtime channel
 * Theme: Kami design tokens (cream/rose palette)
 */

import React, {
  useCallback,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import KamiText  from '@shared/ui/atoms/KamiText';
import KamiButton from '@shared/ui/atoms/KamiButton';
import {
  Colors, FontSize, FontWeight, Radii, Shadows, Sizing, Space,
} from '@shared/constants';
import { useAuthStore } from '@features/auth';
import { useHome }      from '../hooks';
import { useHomeStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import type { Goal, JournalEntry, GoalCategory } from '../types';
import type { MainTabScreenProps } from '@core/navigation/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const MOODS = [
  { id: 'joyful',     emoji: '✨', label: 'Joyful',     color: '#F5C842' },
  { id: 'calm',       emoji: '🌸', label: 'Calm',       color: Colors.primaryLight },
  { id: 'hopeful',    emoji: '🌅', label: 'Hopeful',    color: '#F4A460' },
  { id: 'grateful',   emoji: '🌺', label: 'Grateful',   color: Colors.primary },
  { id: 'reflective', emoji: '🌙', label: 'Reflective', color: Colors.accent },
  { id: 'tired',      emoji: '☁️', label: 'Tired',      color: '#9BB0C8' },
  { id: 'anxious',    emoji: '🌊', label: 'Anxious',    color: '#7DB8C4' },
  { id: 'sad',        emoji: '🍂', label: 'Sad',        color: '#B0916A' },
];

const GOAL_CATEGORIES: { id: GoalCategory; emoji: string; label: string }[] = [
  { id: 'personal',     emoji: '🌱', label: 'Personal'     },
  { id: 'health',       emoji: '💪', label: 'Health'       },
  { id: 'career',       emoji: '🚀', label: 'Career'       },
  { id: 'learning',     emoji: '📚', label: 'Learning'     },
  { id: 'creative',     emoji: '🎨', label: 'Creative'     },
  { id: 'relationship', emoji: '💛', label: 'Relationship' },
  { id: 'other',        emoji: '⭐', label: 'Other'        },
];

const GOAL_EMOJIS = ['🌱','🎯','💪','📚','🚀','🎨','💛','⭐','🏃','✍️','🧘','🌟'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greetingTime(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function greetingName(nickname?: string, email?: string): string {
  if (nickname?.trim()) return nickname.trim().split(' ')[0];
  if (email?.includes('@')) return email.split('@')[0];
  return 'there';
}

function initialFor(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'K';
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysSinceJoin(createdAt?: string): number {
  if (!createdAt) return 1;
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.max(1, Math.floor(diff / 86400000));
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Section wrapper with title + optional action */
const Section: React.FC<{
  title: string;
  marker: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}> = ({ title, marker, actionLabel, onAction, children }) => (
  <View style={sec.wrap}>
    <View style={sec.header}>
      <View style={sec.titleRow}>
        <Text style={sec.marker}>{marker}</Text>
        <KamiText variant="subtitle">{title}</KamiText>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <KamiText variant="caption" color={Colors.primary} bold>{actionLabel}</KamiText>
        </TouchableOpacity>
      ) : null}
    </View>
    {children}
  </View>
);

const sec = StyleSheet.create({
  wrap:     { gap: Space[3] },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  marker:   { fontSize: FontSize.md, color: Colors.primary },
});

/** Animated press wrapper */
const PressCard: React.FC<{
  onPress?: () => void;
  style?: object;
  children: React.ReactNode;
}> = ({ onPress, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start()}
      disabled={!onPress}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

/** Progress bar */
const ProgressBar: React.FC<{ value: number; color?: string }> = ({
  value,
  color = Colors.primary,
}) => (
  <View style={pb.track}>
    <View style={[pb.fill, { width: `${Math.min(100, value)}%` as any, backgroundColor: color }]} />
  </View>
);
const pb = StyleSheet.create({
  track: { height: 6, backgroundColor: Colors.creamDeep, borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 3 },
});

// ─── Modal: Add/Edit Journal ─────────────────────────────────────────────────

const JournalModal: React.FC<{
  visible:  boolean;
  entry?:   JournalEntry | null;
  onClose:  () => void;
  onSave:   (body: string, title?: string) => Promise<void>;
  saving:   boolean;
}> = ({ visible, entry, onClose, onSave, saving }) => {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [body,  setBody]  = useState(entry?.body  ?? '');

  React.useEffect(() => {
    if (visible) { setTitle(entry?.title ?? ''); setBody(entry?.body ?? ''); }
  }, [visible, entry]);

  const handleSave = async () => {
    if (!body.trim()) { Alert.alert('Kami', 'Please write something first.'); return; }
    Keyboard.dismiss();
    await onSave(body.trim(), title.trim() || undefined);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={jm.root}>
        <View style={jm.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="subtitle">{entry ? 'Edit Entry' : 'New Entry'}</KamiText>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <KamiText variant="label" color={Colors.primary} bold>Save</KamiText>
            }
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={jm.body}>
          <TextInput
            style={jm.titleInput}
            placeholder="Title (optional)"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <View style={jm.divider} />
          <TextInput
            style={jm.bodyInput}
            placeholder="What's on your mind…"
            placeholderTextColor={Colors.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={5000}
          />
        </ScrollView>
        <View style={jm.footer}>
          <KamiText variant="caption" color={Colors.textMuted}>{body.length}/5000</KamiText>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
const jm = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.pageBg },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Space[5], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  body:       { padding: Space[5], gap: Space[3] },
  titleInput: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, paddingVertical: Space[2] },
  divider:    { height: 1, backgroundColor: Colors.border + '44' },
  bodyInput:  { fontSize: FontSize.base, color: Colors.textPrimary, minHeight: 300, lineHeight: 24 },
  footer:     { padding: Space[5], alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: Colors.border + '33' },
});

// ─── Modal: Add Goal ─────────────────────────────────────────────────────────

const GoalModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave:  (title: string, category: GoalCategory, emoji: string, description?: string) => Promise<void>;
  saving:  boolean;
}> = ({ visible, onClose, onSave, saving }) => {
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [category, setCategory] = useState<GoalCategory>('personal');
  const [emoji,    setEmoji]    = useState('🌱');

  const reset = () => { setTitle(''); setDesc(''); setCategory('personal'); setEmoji('🌱'); };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Kami', 'Please enter a goal title.'); return; }
    Keyboard.dismiss();
    await onSave(title.trim(), category, emoji, desc.trim() || undefined);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={gm.root}>
        <View style={gm.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="subtitle">New Goal</KamiText>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <KamiText variant="label" color={Colors.primary} bold>Add</KamiText>
            }
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={gm.body}>
          {/* Emoji picker */}
          <KamiText variant="overline" style={{ marginBottom: Space[2] }}>Choose icon</KamiText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Space[4] }}>
            <View style={gm.emojiRow}>
              {GOAL_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[gm.emojiBtn, emoji === e && gm.emojiBtnActive]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={{ fontSize: FontSize.xl }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Title */}
          <KamiText variant="overline" style={{ marginBottom: Space[2] }}>Goal title *</KamiText>
          <TextInput
            style={gm.input}
            placeholder="e.g. Run 5km every week"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            autoFocus
          />

          {/* Description */}
          <KamiText variant="overline" style={{ marginTop: Space[4], marginBottom: Space[2] }}>Description (optional)</KamiText>
          <TextInput
            style={[gm.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Why does this goal matter to you?"
            placeholderTextColor={Colors.textMuted}
            value={desc}
            onChangeText={setDesc}
            multiline
            maxLength={300}
          />

          {/* Category */}
          <KamiText variant="overline" style={{ marginTop: Space[4], marginBottom: Space[2] }}>Category</KamiText>
          <View style={gm.catGrid}>
            {GOAL_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[gm.catChip, category === c.id && gm.catChipActive]}
                onPress={() => setCategory(c.id)}
              >
                <Text style={{ fontSize: FontSize.base }}>{c.emoji}</Text>
                <KamiText
                  variant="caption"
                  color={category === c.id ? Colors.primary : Colors.textMuted}
                  bold={category === c.id}
                >
                  {c.label}
                </KamiText>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
const gm = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.pageBg },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Space[5], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  body:          { padding: Space[5] },
  emojiRow:      { flexDirection: 'row', gap: Space[2] },
  emojiBtn:      { width: 44, height: 44, borderRadius: Radii.sm, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  emojiBtnActive:{ borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  input:         { backgroundColor: Colors.creamDeep, borderRadius: Radii.input, padding: Space[4], fontSize: FontSize.base, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border },
  catGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  catChip:       { flexDirection: 'row', alignItems: 'center', gap: Space[1], paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.creamDeep },
  catChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
});

// ─── Modal: Mood note ────────────────────────────────────────────────────────

const MoodNoteModal: React.FC<{
  visible:   boolean;
  moodEmoji: string;
  moodLabel: string;
  onClose:   () => void;
  onSave:    (note: string) => Promise<void>;
  saving:    boolean;
}> = ({ visible, moodEmoji, moodLabel, onClose, onSave, saving }) => {
  const [note, setNote] = useState('');
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={mm.root}>
        <View style={mm.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Skip</KamiText>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 36 }}>{moodEmoji}</Text>
            <KamiText variant="subtitle">{moodLabel}</KamiText>
          </View>
          <TouchableOpacity onPress={() => onSave(note.trim())} disabled={saving} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <KamiText variant="label" color={Colors.primary} bold>Save</KamiText>
            }
          </TouchableOpacity>
        </View>
        <View style={mm.body}>
          <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginBottom: Space[4] }}>
            Want to add a note about how you're feeling?
          </KamiText>
          <TextInput
            style={mm.input}
            placeholder="What's on your mind…"
            placeholderTextColor={Colors.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={500}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};
const mm = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.pageBg },
  header:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Space[5] },
  body:  { padding: Space[5] },
  input: { backgroundColor: Colors.creamDeep, borderRadius: Radii.card, padding: Space[4], fontSize: FontSize.base, color: Colors.textPrimary, height: 160, borderWidth: 1.5, borderColor: Colors.border },
});

// ─── Modal: Prompt response ──────────────────────────────────────────────────

const PromptModal: React.FC<{
  visible:   boolean;
  prompt:    string;
  existing?: string;
  onClose:   () => void;
  onSave:    (response: string) => Promise<void>;
  saving:    boolean;
}> = ({ visible, prompt, existing, onClose, onSave, saving }) => {
  const [response, setResponse] = useState(existing ?? '');
  React.useEffect(() => { if (visible) setResponse(existing ?? ''); }, [visible, existing]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={pm.root}>
        <View style={pm.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="subtitle">Today's Prompt</KamiText>
          <TouchableOpacity onPress={() => { if (response.trim()) onSave(response.trim()); }} disabled={saving || !response.trim()} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <KamiText variant="label" color={response.trim() ? Colors.primary : Colors.textMuted} bold>Save</KamiText>
            }
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={pm.body}>
          <View style={pm.promptCard}>
            <Text style={pm.quoteMark}>"</Text>
            <KamiText variant="body" style={{ fontStyle: 'italic', lineHeight: 26 }}>{prompt}</KamiText>
          </View>
          <TextInput
            style={pm.input}
            placeholder="Write your thoughts here…"
            placeholderTextColor={Colors.textMuted}
            value={response}
            onChangeText={setResponse}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={2000}
          />
          <KamiText variant="caption" color={Colors.textMuted} align="right">{response.length}/2000</KamiText>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
const pm = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.pageBg },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Space[5], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  body:       { padding: Space[5], gap: Space[4] },
  promptCard: { backgroundColor: Colors.rose100, borderRadius: Radii.card, padding: Space[5], borderLeftWidth: 3, borderLeftColor: Colors.primary },
  quoteMark:  { fontSize: 40, color: Colors.primary, lineHeight: 40, fontFamily: 'Georgia' },
  input:      { backgroundColor: Colors.creamDeep, borderRadius: Radii.card, padding: Space[4], fontSize: FontSize.base, color: Colors.textPrimary, minHeight: 200, borderWidth: 1.5, borderColor: Colors.border },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

type Props = MainTabScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props) {
  const user    = useAuthStore((s) => s.user);
  const {
    todayMood, recentMoods, moodLoading,
    journalEntries, journalLoading,
    goals, goalsLoading,
    todayPrompt, promptResponse, promptLoading,
    streak,
  } = useHomeStore(
    useShallow((s) => ({
      todayMood:      s.todayMood,
      recentMoods:    s.recentMoods,
      moodLoading:    s.moodLoading,
      journalEntries: s.journalEntries,
      journalLoading: s.journalLoading,
      goals:          s.goals,
      goalsLoading:   s.goalsLoading,
      todayPrompt:    s.todayPrompt,
      promptResponse: s.promptResponse,
      promptLoading:  s.promptLoading,
      streak:         s.streak,
    })),
  );

  const {
    logMood,
    addJournalEntry, editJournalEntry, removeJournalEntry,
    addGoal, editGoal, removeGoal,
    respondToPrompt,
    refresh,
  } = useHome();

  const name     = greetingName(user?.nickname, user?.email);
  const daysIn   = daysSinceJoin((user as any)?.createdAt);
  const greeting = greetingTime();

  // ── Modal state ─────────────────────────────────────────────────────────
  const [moodNoteVisible,   setMoodNoteVisible]   = useState(false);
  const [pendingMood,       setPendingMood]        = useState<typeof MOODS[0] | null>(null);
  const [moodSaving,        setMoodSaving]         = useState(false);

  const [journalVisible,    setJournalVisible]     = useState(false);
  const [editingEntry,      setEditingEntry]       = useState<JournalEntry | null>(null);
  const [journalSaving,     setJournalSaving]      = useState(false);

  const [goalVisible,       setGoalVisible]        = useState(false);
  const [goalSaving,        setGoalSaving]         = useState(false);

  const [promptVisible,     setPromptVisible]      = useState(false);
  const [promptSaving,      setPromptSaving]       = useState(false);

  const [refreshing,        setRefreshing]         = useState(false);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // ── Mood flow ────────────────────────────────────────────────────────────
  const handleMoodTap = (mood: typeof MOODS[0]) => {
    setPendingMood(mood);
    setMoodNoteVisible(true);
  };

  const handleMoodSave = async (note: string) => {
    if (!pendingMood) return;
    setMoodSaving(true);
    const result = await logMood({
      moodId:    pendingMood.id,
      moodEmoji: pendingMood.emoji,
      moodLabel: pendingMood.label,
      note:      note || undefined,
    });
    setMoodSaving(false);
    setMoodNoteVisible(false);
    if (!result.success) Alert.alert('Kami', result.error);
  };

  // ── Journal flow ─────────────────────────────────────────────────────────
  const handleJournalSave = async (body: string, title?: string) => {
    setJournalSaving(true);
    const result = editingEntry
      ? await editJournalEntry(editingEntry.id, { body, title })
      : await addJournalEntry({ body, title });
    setJournalSaving(false);
    if (!result.success) { Alert.alert('Kami', result.error); return; }
    setJournalVisible(false);
    setEditingEntry(null);
  };

  const handleJournalDelete = (entry: JournalEntry) => {
    Alert.alert('Delete Entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await removeJournalEntry(entry.id);
          if (!r.success) Alert.alert('Kami', r.error);
        },
      },
    ]);
  };

  // ── Goal flow ─────────────────────────────────────────────────────────────
  const handleGoalSave = async (
    title: string,
    category: GoalCategory,
    emoji: string,
    description?: string,
  ) => {
    setGoalSaving(true);
    const result = await addGoal({ title, category, emoji, description });
    setGoalSaving(false);
    if (!result.success) { Alert.alert('Kami', result.error); return; }
    setGoalVisible(false);
  };

  const handleProgressUpdate = (goal: Goal, delta: number) => {
    const next = Math.min(100, Math.max(0, goal.progress + delta));
    editGoal(goal.id, { progress: next });
    if (next === 100) {
      setTimeout(() =>
        Alert.alert('🎉 Goal Complete!', `"${goal.title}" — Amazing work!`, [
          { text: 'Keep going!', onPress: () => editGoal(goal.id, { status: 'completed' }) },
          { text: 'Not yet', style: 'cancel' },
        ]),
      300);
    }
  };

  const handleGoalDelete = (goal: Goal) => {
    Alert.alert('Remove Goal', `Remove "${goal.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeGoal(goal.id),
      },
    ]);
  };

  // ── Prompt flow ──────────────────────────────────────────────────────────
  const handlePromptSave = async (response: string) => {
    if (!todayPrompt) return;
    setPromptSaving(true);
    const result = await respondToPrompt(todayPrompt.id, response);
    setPromptSaving(false);
    if (!result.success) { Alert.alert('Kami', result.error); return; }
    setPromptVisible(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* ═══════════════════════════════════════════════════════
            1. HEADER
        ═══════════════════════════════════════════════════════ */}
        <View style={s.header}>
          <View style={s.identityRow}>
            {/* Avatar */}
            <View style={s.avatarWrap}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={s.avatarImg} />
              ) : (
                <Text style={s.avatarInitial}>{initialFor(name)}</Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <KamiText variant="overline">Day {daysIn} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</KamiText>
              <KamiText variant="display" style={s.greeting}>
                {greeting},{'\n'}{name} 🌸
              </KamiText>
            </View>
          </View>

          {/* Settings */}
          <TouchableOpacity
            style={s.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Text style={{ fontSize: FontSize.md, color: Colors.textSecondary }}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Streak + stats row */}
        <View style={s.statsRow}>
          <View style={s.statPill}>
            <Text style={s.statEmoji}>🔥</Text>
            <View>
              <KamiText style={s.statNum}>{streak?.currentStreak ?? 0}</KamiText>
              <KamiText variant="caption" color={Colors.textMuted}>day streak</KamiText>
            </View>
          </View>
          <View style={s.statPill}>
            <Text style={s.statEmoji}>✅</Text>
            <View>
              <KamiText style={s.statNum}>{streak?.totalCheckins ?? 0}</KamiText>
              <KamiText variant="caption" color={Colors.textMuted}>check-ins</KamiText>
            </View>
          </View>
          <View style={s.statPill}>
            <Text style={s.statEmoji}>🏆</Text>
            <View>
              <KamiText style={s.statNum}>{streak?.longestStreak ?? 0}</KamiText>
              <KamiText variant="caption" color={Colors.textMuted}>best streak</KamiText>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════
            2. MOOD CHECK-IN
        ═══════════════════════════════════════════════════════ */}
        <Section title="How are you feeling?" marker="✦">
          {todayMood ? (
            /* Already checked in */
            <PressCard onPress={() => handleMoodTap(MOODS.find(m => m.id === todayMood.moodId) ?? MOODS[0])} style={s.moodDoneCard}>
              <View style={s.moodDoneRow}>
                <Text style={{ fontSize: 32 }}>{todayMood.moodEmoji}</Text>
                <View style={{ flex: 1 }}>
                  <KamiText variant="subtitle" color={Colors.primary}>{todayMood.moodLabel}</KamiText>
                  {todayMood.note ? (
                    <KamiText variant="caption" color={Colors.textMuted} numberOfLines={2}>{todayMood.note}</KamiText>
                  ) : (
                    <KamiText variant="caption" color={Colors.textMuted}>Tap to update</KamiText>
                  )}
                </View>
                <View style={s.moodDoneBadge}>
                  <Text style={{ fontSize: 11 }}>✓</Text>
                </View>
              </View>
            </PressCard>
          ) : (
            /* Pick a mood */
            <View style={s.moodGrid}>
              {MOODS.map((mood) => (
                <PressCard key={mood.id} onPress={() => handleMoodTap(mood)} style={s.moodChip}>
                  <Text style={{ fontSize: FontSize.xl }}>{mood.emoji}</Text>
                  <KamiText variant="caption" color={Colors.textSecondary}>{mood.label}</KamiText>
                </PressCard>
              ))}
            </View>
          )}

          {/* 7-day mood mini-graph */}
          {recentMoods.length > 1 && (
            <View style={s.moodGraph}>
              <KamiText variant="overline" style={{ marginBottom: Space[2] }}>This week</KamiText>
              <View style={s.moodDots}>
                {recentMoods.slice(-7).map((m, i) => (
                  <View key={m.id} style={s.moodDotWrap}>
                    <Text style={{ fontSize: FontSize.md }}>{m.moodEmoji}</Text>
                    <KamiText variant="caption" color={Colors.textMuted} style={{ fontSize: 9 }}>
                      {new Date(m.loggedDate).toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </KamiText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Section>

        {/* ═══════════════════════════════════════════════════════
            3. DAILY PROMPT
        ═══════════════════════════════════════════════════════ */}
        <Section title="Today's Prompt" marker="✎">
          {promptLoading === 'loading' && !todayPrompt ? (
            <ActivityIndicator color={Colors.primary} />
          ) : todayPrompt ? (
            <PressCard onPress={() => setPromptVisible(true)} style={s.promptCard}>
              <View style={s.promptInner}>
                <Text style={s.promptQuote}>"</Text>
                <KamiText variant="body" style={s.promptText}>{todayPrompt.content}</KamiText>
              </View>
              {promptResponse ? (
                <View style={s.promptResponseRow}>
                  <Text style={{ fontSize: 13 }}>✓</Text>
                  <KamiText variant="caption" color={Colors.primary} bold>Answered today</KamiText>
                  <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                    — {promptResponse.response}
                  </KamiText>
                </View>
              ) : (
                <View style={s.promptCta}>
                  <KamiText variant="caption" color={Colors.primary} bold>Tap to reflect ›</KamiText>
                </View>
              )}
            </PressCard>
          ) : null}
        </Section>

        {/* ═══════════════════════════════════════════════════════
            4. JOURNAL
        ═══════════════════════════════════════════════════════ */}
        <Section
          title="Journal"
          marker="📓"
          actionLabel="+ New"
          onAction={() => { setEditingEntry(null); setJournalVisible(true); }}
        >
          {journalLoading === 'loading' && journalEntries.length === 0 ? (
            <ActivityIndicator color={Colors.primary} />
          ) : journalEntries.length === 0 ? (
            <PressCard
              onPress={() => { setEditingEntry(null); setJournalVisible(true); }}
              style={s.emptyCard}
            >
              <Text style={{ fontSize: 32, marginBottom: Space[2] }}>📓</Text>
              <KamiText variant="body" color={Colors.textMuted} align="center">
                Your journal is empty.{'\n'}Write your first entry.
              </KamiText>
              <KamiText variant="caption" color={Colors.primary} bold style={{ marginTop: Space[2] }}>
                Start writing ›
              </KamiText>
            </PressCard>
          ) : (
            journalEntries.map((entry) => (
              <PressCard
                key={entry.id}
                onPress={() => { setEditingEntry(entry); setJournalVisible(true); }}
                style={s.journalCard}
              >
                <View style={s.journalCardHeader}>
                  <View style={{ flex: 1 }}>
                    {entry.title ? (
                      <KamiText variant="label" numberOfLines={1}>{entry.title}</KamiText>
                    ) : (
                      <KamiText variant="caption" color={Colors.textMuted} style={{ fontStyle: 'italic' }}>Untitled</KamiText>
                    )}
                    <KamiText variant="caption" color={Colors.textMuted}>{formatDate(entry.entryDate)}</KamiText>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleJournalDelete(entry)}
                    hitSlop={8}
                    style={s.deleteBtn}
                  >
                    <Text style={{ fontSize: 13, color: Colors.textMuted }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <KamiText variant="body" color={Colors.textSecondary} numberOfLines={3} style={s.journalBody}>
                  {entry.body}
                </KamiText>
              </PressCard>
            ))
          )}
        </Section>

        {/* ═══════════════════════════════════════════════════════
            5. GOALS
        ═══════════════════════════════════════════════════════ */}
        <Section
          title="My Goals"
          marker="🌱"
          actionLabel="+ Add"
          onAction={() => setGoalVisible(true)}
        >
          {goalsLoading === 'loading' && goals.length === 0 ? (
            <ActivityIndicator color={Colors.primary} />
          ) : goals.length === 0 ? (
            <PressCard onPress={() => setGoalVisible(true)} style={s.emptyCard}>
              <Text style={{ fontSize: 32, marginBottom: Space[2] }}>🌱</Text>
              <KamiText variant="body" color={Colors.textMuted} align="center">
                No goals yet.{'\n'}What do you want to achieve?
              </KamiText>
              <KamiText variant="caption" color={Colors.primary} bold style={{ marginTop: Space[2] }}>
                Set your first goal ›
              </KamiText>
            </PressCard>
          ) : (
            goals.map((goal) => (
              <View key={goal.id} style={s.goalCard}>
                <View style={s.goalHeader}>
                  <Text style={{ fontSize: FontSize.xl }}>{goal.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <KamiText variant="label" numberOfLines={1}>{goal.title}</KamiText>
                    {goal.description ? (
                      <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1}>{goal.description}</KamiText>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => handleGoalDelete(goal)} hitSlop={8} style={s.deleteBtn}>
                    <Text style={{ fontSize: 13, color: Colors.textMuted }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.goalProgressRow}>
                  <ProgressBar value={goal.progress} />
                  <KamiText variant="caption" color={Colors.primary} bold style={{ minWidth: 36, textAlign: 'right' }}>
                    {goal.progress}%
                  </KamiText>
                </View>

                <View style={s.goalControls}>
                  <TouchableOpacity
                    style={[s.progressBtn, s.progressBtnMinus]}
                    onPress={() => handleProgressUpdate(goal, -10)}
                    disabled={goal.progress === 0}
                  >
                    <Text style={s.progressBtnText}>−10%</Text>
                  </TouchableOpacity>
                  <View style={s.goalMeta}>
                    {goal.targetDate ? (
                      <KamiText variant="caption" color={Colors.textMuted}>
                        🗓 {formatDate(goal.targetDate)}
                      </KamiText>
                    ) : (
                      <KamiText variant="caption" color={Colors.textMuted}>
                        {GOAL_CATEGORIES.find(c => c.id === goal.category)?.emoji} {goal.category}
                      </KamiText>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[s.progressBtn, s.progressBtnPlus]}
                    onPress={() => handleProgressUpdate(goal, 10)}
                    disabled={goal.progress === 100}
                  >
                    <Text style={[s.progressBtnText, { color: '#fff' }]}>+10%</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </Section>

        {/* Bottom padding */}
        <View style={{ height: Space[8] }} />
      </ScrollView>

      {/* ── Modals ── */}
      {pendingMood && (
        <MoodNoteModal
          visible={moodNoteVisible}
          moodEmoji={pendingMood.emoji}
          moodLabel={pendingMood.label}
          onClose={() => setMoodNoteVisible(false)}
          onSave={handleMoodSave}
          saving={moodSaving}
        />
      )}

      <JournalModal
        visible={journalVisible}
        entry={editingEntry}
        onClose={() => { setJournalVisible(false); setEditingEntry(null); }}
        onSave={handleJournalSave}
        saving={journalSaving}
      />

      <GoalModal
        visible={goalVisible}
        onClose={() => setGoalVisible(false)}
        onSave={handleGoalSave}
        saving={goalSaving}
      />

      {todayPrompt && (
        <PromptModal
          visible={promptVisible}
          prompt={todayPrompt.content}
          existing={promptResponse?.response}
          onClose={() => setPromptVisible(false)}
          onSave={handlePromptSave}
          saving={promptSaving}
        />
      )}
    </SafeAreaView>
  );
}

export default HomeScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.pageBg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Space[5], paddingTop: Space[6], paddingBottom: Space[12], gap: Space[6] },

  // Header
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  identityRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Space[3] },
  avatarWrap: {
    width: Sizing.avatarMd, height: Sizing.avatarMd,
    borderRadius: Sizing.avatarMd / 2,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.primaryLight,
  },
  avatarImg:     { width: '100%', height: '100%' },
  avatarInitial: { color: Colors.primary, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold },
  greeting:      { marginTop: Space[1], lineHeight: 34 },
  settingsBtn: {
    width: Sizing.avatarSm, height: Sizing.avatarSm,
    borderRadius: Sizing.avatarSm / 2,
    backgroundColor: Colors.cardBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.sm,
  },

  // Stats row
  statsRow:  { flexDirection: 'row', gap: Space[3] },
  statPill: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: Space[2],
    backgroundColor: Colors.cardBg, borderRadius: Radii.lg,
    padding: Space[3], borderWidth: 1, borderColor: Colors.border + '55',
    ...Shadows.sm,
  },
  statEmoji: { fontSize: FontSize.lg },
  statNum:   { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, lineHeight: 22 },

  // Mood grid
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  moodChip: {
    alignItems: 'center', gap: Space[1],
    paddingHorizontal: Space[3], paddingVertical: Space[2],
    backgroundColor: Colors.cardBg, borderRadius: Radii.lg,
    borderWidth: 1.5, borderColor: Colors.border,
    minWidth: 72,
    ...Shadows.sm,
  },
  moodDoneCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.card,
    padding: Space[4], borderWidth: 1.5, borderColor: Colors.primaryLight,
    ...Shadows.card,
  },
  moodDoneRow:  { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  moodDoneBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  moodGraph: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.card,
    padding: Space[4], borderWidth: 1, borderColor: Colors.border + '44',
  },
  moodDots:    { flexDirection: 'row', justifyContent: 'space-around' },
  moodDotWrap: { alignItems: 'center', gap: 4 },

  // Prompt
  promptCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.card,
    borderWidth: 1, borderColor: Colors.border + '55',
    overflow: 'hidden', ...Shadows.card,
  },
  promptInner:      { padding: Space[5], paddingBottom: Space[3] },
  promptQuote:      { fontSize: 36, color: Colors.primary + '55', lineHeight: 36, fontFamily: 'Georgia' },
  promptText:       { fontStyle: 'italic', lineHeight: 24, marginTop: -Space[1] },
  promptResponseRow:{ flexDirection: 'row', alignItems: 'center', gap: Space[2], padding: Space[4], backgroundColor: Colors.rose100, borderTopWidth: 1, borderTopColor: Colors.border + '33' },
  promptCta:        { padding: Space[4], backgroundColor: Colors.creamDeep, borderTopWidth: 1, borderTopColor: Colors.border + '33', alignItems: 'flex-end' },

  // Journal
  journalCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.card,
    padding: Space[4], borderWidth: 1, borderColor: Colors.border + '55',
    gap: Space[2], ...Shadows.sm,
  },
  journalCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Space[2] },
  journalBody:       { color: Colors.textSecondary, lineHeight: 22 },

  // Goals
  goalCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.card,
    padding: Space[4], gap: Space[3], borderWidth: 1, borderColor: Colors.border + '55',
    ...Shadows.sm,
  },
  goalHeader:      { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  goalProgressRow: { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  goalControls:    { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  goalMeta:        { flex: 1, alignItems: 'center' },
  progressBtn: {
    paddingHorizontal: Space[3], paddingVertical: Space[2],
    borderRadius: Radii.sm,
  },
  progressBtnMinus: { backgroundColor: Colors.creamDeep, borderWidth: 1, borderColor: Colors.border },
  progressBtnPlus:  { backgroundColor: Colors.primary },
  progressBtnText:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },

  // Shared
  emptyCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.card,
    padding: Space[8], alignItems: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border,
  },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
});
