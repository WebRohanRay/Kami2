/**
 * HomeScreen — clean solo dashboard
 * Shows previews of mood, journal, goals, prompt.
 * Each section taps through to its dedicated screen.
 */

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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
  Keyboard,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore }  from '@features/auth';
import { useHome }       from '../hooks';
import { useHomeStore }  from '../store';
import { useShallow }    from 'zustand/react/shallow';
import KamiText          from '@shared/ui/atoms/KamiText';
import {
  Colors, FontFamily, FontSize, FontWeight, Radii, Shadows, Sizing, Space,
} from '@shared/constants';
import type { MainTabScreenProps } from '@core/navigation/types';
import { useTheme }      from '@shared/hooks';

type Props = MainTabScreenProps<'Home'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOODS = [
  { id: 'joyful',     emoji: '✨', label: 'Joyful'     },
  { id: 'calm',       emoji: '🌸', label: 'Calm'       },
  { id: 'hopeful',    emoji: '🌅', label: 'Hopeful'    },
  { id: 'grateful',   emoji: '🌺', label: 'Grateful'   },
  { id: 'reflective', emoji: '🌙', label: 'Reflective' },
  { id: 'tired',      emoji: '☁️', label: 'Tired'      },
  { id: 'anxious',    emoji: '🌊', label: 'Anxious'    },
  { id: 'sad',        emoji: '🍂', label: 'Sad'        },
];

function greetingTime() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function firstName(nickname?: string, email?: string) {
  if (nickname?.trim()) return nickname.trim().split(' ')[0];
  if (email?.includes('@')) return email.split('@')[0];
  return 'there';
}
function initial(name: string) { return name.slice(0, 1).toUpperCase() || 'K'; }
function daysSince(iso?: string) {
  if (!iso) return 1;
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

// ─── Animated card ───────────────────────────────────────────────────────────

const Tap: React.FC<{ onPress?: () => void; style?: object; children: React.ReactNode }> = ({
  onPress, style, children,
}) => {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1} onPress={onPress} disabled={!onPress}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1,    useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale: sc }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

// ─── Mood note modal ─────────────────────────────────────────────────────────

const MoodModal: React.FC<{
  visible: boolean; mood: typeof MOODS[0] | null;
  onClose: () => void; onSave: (note: string) => Promise<void>; saving: boolean;
}> = ({ visible, mood, onClose, onSave, saving }) => {
  const { colors } = useTheme();
  const [note, setNote] = useState('');
  if (!mood) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={[mm.root, { backgroundColor: colors.pageBg }]}>
        <View style={mm.handle} />
        <View style={mm.top}>
          <Text style={mm.emoji}>{mood.emoji}</Text>
          <KamiText variant="title">{mood.label}</KamiText>
          <KamiText variant="caption" color={Colors.textMuted} align="center" style={{ marginTop: 4 }}>
            Want to add a note about how you're feeling?
          </KamiText>
        </View>
        <TextInput
          style={mm.input} placeholder="What's on your mind…"
          placeholderTextColor={Colors.textMuted} value={note}
          onChangeText={setNote} multiline autoFocus textAlignVertical="top" maxLength={400}
        />
        <View style={mm.btns}>
          <TouchableOpacity style={mm.skip} onPress={() => { setNote(''); onClose(); }}>
            <KamiText variant="label" color={Colors.textMuted}>Skip</KamiText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[mm.save, { backgroundColor: colors.primary }]} disabled={saving}
            onPress={() => { Keyboard.dismiss(); onSave(note.trim()).then(() => setNote('')); }}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <KamiText variant="label" color="#fff">Save mood</KamiText>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
const mm = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.pageBg, paddingHorizontal: Space[5] },
  handle:{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: Space[3], marginBottom: Space[4] },
  top:   { alignItems: 'center', gap: Space[2], marginBottom: Space[5] },
  emoji: { fontSize: 56 },
  input: { backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], fontSize: FontSize.base, color: Colors.textPrimary, height: 140, borderWidth: 1.5, borderColor: Colors.border, textAlignVertical: 'top' },
  btns:  { flexDirection: 'row', gap: Space[3], marginTop: Space[5] },
  skip:  { flex: 1, height: 52, borderRadius: Radii.button, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  save:  { flex: 2, height: 52, borderRadius: Radii.button, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const { todayMood, recentMoods, streak, journalEntries, goals, todayPrompt, promptResponse } =
    useHomeStore(useShallow((s) => ({
      todayMood:      s.todayMood,
      recentMoods:    s.recentMoods,
      streak:         s.streak,
      journalEntries: s.journalEntries,
      goals:          s.goals,
      todayPrompt:    s.todayPrompt,
      promptResponse: s.promptResponse,
    })));
  const { logMood, refresh } = useHome();

  const name    = firstName(user?.nickname, user?.email);
  const daysIn  = daysSince((user as any)?.createdAt);

  const [pending,    setPending]    = useState<typeof MOODS[0] | null>(null);
  const [moodModal,  setMoodModal]  = useState(false);
  const [moodSaving, setMoodSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleMoodPick = (m: typeof MOODS[0]) => { setPending(m); setMoodModal(true); };
  const handleMoodSave = async (note: string) => {
    if (!pending) return;
    setMoodSaving(true);
    const r = await logMood({ moodId: pending.id, moodEmoji: pending.emoji, moodLabel: pending.label, note: note || undefined });
    setMoodSaving(false);
    setMoodModal(false);
    if (!r.success) Alert.alert('Kami', r.error);
  };
  const handleRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const activeGoals    = goals.filter(g => g.status === 'active');
  const completedToday = goals.filter(g => g.progress === 100).length;

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* ── TOP HEADER ───────────────────────────────────── */}
      <View style={[s.topBar, { backgroundColor: colors.pageBg }]}>
        <View style={{ flex: 1 }}>
          <KamiText style={[s.kamiLogo, { color: colors.primary }]}>Kami</KamiText>
          <KamiText variant="caption" color={Colors.textMuted} style={s.greeting}>
            {greetingTime()}, {name} 🌸
          </KamiText>
        </View>
        <View style={s.topBarRight}>
          <TouchableOpacity style={[s.avatarWrap, { borderColor: colors.primary, backgroundColor: colors.creamDeep }]} onPress={() => navigation.navigate('Settings')}>
            {user?.avatarUrl
              ? <Image source={{ uri: user.avatarUrl }} style={s.avatarImg} />
              : <Text style={[s.avatarLetter, { color: colors.primary }]}>{initial(name)}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >

        {/* ── STREAK BANNER ────────────────────────────── */}
        <View style={s.streakBanner}>
          <View style={s.streakItem}>
            <View style={[s.streakIconContainer, { backgroundColor: colors.creamDeep }]}>
              <Text style={s.streakEmoji}>🔥</Text>
            </View>
            <View>
              <KamiText style={s.streakNum}>{streak?.currentStreak ?? 0}</KamiText>
              <KamiText variant="caption" color={Colors.textMuted} style={s.streakLabel}>days streak</KamiText>
            </View>
          </View>
          <View style={s.streakDivider} />
          <View style={s.streakItem}>
            <View style={[s.streakIconContainer, { backgroundColor: colors.creamDeep }]}>
              <Text style={s.streakEmoji}>🌸</Text>
            </View>
            <View>
              <KamiText style={s.streakNum}>{streak?.totalCheckins ?? 0}</KamiText>
              <KamiText variant="caption" color={Colors.textMuted} style={s.streakLabel}>total check-ins</KamiText>
            </View>
          </View>
        </View>

        {/* ── MOOD CHECK-IN ────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardTitleRow}>
              <Text style={[s.cardIcon, { color: colors.primary }]}>✦</Text>
              <KamiText variant="subtitle" bold>How are you feeling today?</KamiText>
            </View>
            {todayMood && (
              <View style={[s.donePill, { backgroundColor: colors.primary + '18' }]}>
                <Text style={{ fontSize: 11, color: colors.primary }}>✓</Text>
                <KamiText variant="caption" color={colors.primary} bold>Done</KamiText>
              </View>
            )}
          </View>

          {todayMood ? (
            <Tap onPress={() => handleMoodPick(MOODS.find(m => m.id === todayMood.moodId) ?? MOODS[0])} style={[s.moodDone, { borderColor: colors.primary + '33', backgroundColor: colors.creamDeep + '22' }]}>
              <View style={[s.moodDoneEmojiWrap, { borderColor: colors.primary + '18' }]}>
                <Text style={{ fontSize: 36 }}>{todayMood.moodEmoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={s.moodBadgeRow}>
                  <View style={[s.moodBadge, { backgroundColor: colors.primary + '15' }]}>
                    <KamiText variant="caption" color={colors.primary} bold>{todayMood.moodLabel}</KamiText>
                  </View>
                  <KamiText variant="caption" color={Colors.textMuted}>Logged today</KamiText>
                </View>
                <KamiText variant="body" style={s.moodNote}>
                  {todayMood.note ? `“${todayMood.note}”` : 'Tap to add some thoughts or reflection...'}
                </KamiText>
              </View>
            </Tap>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Space[4] }}>
              <View style={s.moodRow}>
                {MOODS.map(m => (
                  <Tap key={m.id} onPress={() => handleMoodPick(m)} style={s.moodCircle}>
                    <View style={[s.moodCircleEmojiWrap, { backgroundColor: colors.creamDeep }]}>
                      <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                    </View>
                    <KamiText variant="caption" color={Colors.textSecondary} bold>{m.label}</KamiText>
                  </Tap>
                ))}
              </View>
            </ScrollView>
          )}

          {recentMoods.length > 1 && (
            <View style={s.weekRow}>
              {recentMoods.slice(-7).map(m => (
                <View key={m.id} style={s.weekDot}>
                  <Text style={{ fontSize: 16 }}>{m.moodEmoji}</Text>
                  <KamiText variant="caption" style={{ fontSize: 9 }} color={Colors.textMuted}>
                    {new Date(m.loggedDate).toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </KamiText>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── TODAY'S PROMPT ───────────────────────────── */}
        {todayPrompt && (
          <Tap
            onPress={() => navigation.navigate('Journal')}
            style={[s.promptCard, { borderColor: colors.primary + '33', backgroundColor: Colors.cardBg }]}
          >
            <View style={[s.promptIconWrap, { backgroundColor: colors.primary + '15' }]}>
              <Text style={{ fontSize: 20, color: colors.primary }}>✍️</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <KamiText variant="overline" color={colors.primary} bold>Daily Reflection</KamiText>
              <KamiText variant="body" style={s.promptText} numberOfLines={3}>"{todayPrompt.content}"</KamiText>
              <KamiText variant="caption" color={promptResponse ? Colors.success : colors.primary} bold>
                {promptResponse ? '✓ Answered — Tap to edit' : 'Tap to reflect ›'}
              </KamiText>
            </View>
          </Tap>
        )}

        {/* ── JOURNAL PREVIEW ──────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardTitleRow}>
              <Text style={[s.cardIcon, { color: colors.primary }]}>📓</Text>
              <KamiText variant="subtitle" bold>Journal</KamiText>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Journal')} hitSlop={8}>
              <KamiText variant="caption" color={colors.primary} bold>View all ›</KamiText>
            </TouchableOpacity>
          </View>
          {journalEntries.length === 0 ? (
            <Tap onPress={() => navigation.navigate('Journal')} style={s.emptyInner}>
              <KamiText variant="caption" color={Colors.textMuted} align="center">
                No entries yet.{'\n'}Your first thought matters.
              </KamiText>
              <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[2] }}>Start writing ›</KamiText>
            </Tap>
          ) : (
            <View style={{ gap: Space[2] }}>
              {journalEntries.slice(0, 1).map(e => (
                <Tap key={e.id} onPress={() => navigation.navigate('Journal')} style={[s.journalPreview, { backgroundColor: colors.creamDeep + '15' }]}>
                  <View style={[s.journalPreviewDot, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <KamiText variant="label" numberOfLines={1} bold>
                      {e.title || 'Untitled entry'}
                    </KamiText>
                    <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1}>{e.body}</KamiText>
                  </View>
                  <KamiText variant="caption" color={Colors.textMuted}>
                    {new Date(e.entryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </KamiText>
                </Tap>
              ))}
            </View>
          )}
        </View>

        {/* ── GOALS PREVIEW ────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardTitleRow}>
              <Text style={[s.cardIcon, { color: colors.primary }]}>🌱</Text>
              <KamiText variant="subtitle" bold>Goals</KamiText>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Goals')} hitSlop={8}>
              <KamiText variant="caption" color={colors.primary} bold>View all ›</KamiText>
            </TouchableOpacity>
          </View>
          {activeGoals.length === 0 ? (
            <Tap onPress={() => navigation.navigate('Goals')} style={s.emptyInner}>
              <KamiText variant="caption" color={Colors.textMuted} align="center">No active goals.</KamiText>
              <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[2] }}>Set your first goal ›</KamiText>
            </Tap>
          ) : (
            <View style={{ gap: Space[3] }}>
              {activeGoals.slice(0, 3).map(g => (
                <Tap key={g.id} onPress={() => navigation.navigate('Goals')} style={[s.goalPreview, { backgroundColor: colors.creamDeep + '15' }]}>
                  <Text style={{ fontSize: 20 }}>{g.emoji}</Text>
                  <View style={{ flex: 1, gap: 4 }}>
                    <KamiText variant="label" numberOfLines={1} bold>{g.title}</KamiText>
                    <View style={[s.miniBar, { backgroundColor: colors.creamDeep }]}>
                      <View style={[s.miniFill, { width: `${g.progress}%` as any, backgroundColor: colors.primary }]} />
                    </View>
                  </View>
                  <KamiText variant="caption" color={colors.primary} bold>{g.progress}%</KamiText>
                </Tap>
              ))}
              {activeGoals.length > 3 && (
                <KamiText variant="caption" color={Colors.textMuted} align="center">
                  +{activeGoals.length - 3} more goals
                </KamiText>
              )}
            </View>
          )}
        </View>

        {/* ── QUICK ACTIONS ROW ────────────────────────── */}
        <View style={s.quickRow}>
          <Tap onPress={() => navigation.navigate('Memories')} style={s.quickCard}>
            <Text style={s.quickEmoji}>📸</Text>
            <View>
              <KamiText variant="label" bold>Memories</KamiText>
              <KamiText variant="caption" color={Colors.textMuted}>Photo Vault</KamiText>
            </View>
          </Tap>
          <Tap onPress={() => navigation.navigate('Future')} style={s.quickCard}>
            <Text style={s.quickEmoji}>💌</Text>
            <View>
              <KamiText variant="label" bold>Future Letters</KamiText>
              <KamiText variant="caption" color={Colors.textMuted}>Time Capsule</KamiText>
            </View>
          </Tap>
        </View>

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <MoodModal
        visible={moodModal} mood={pending}
        onClose={() => setMoodModal(false)}
        onSave={handleMoodSave} saving={moodSaving}
      />
    </SafeAreaView>
  );
}

export default HomeScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.pageBg },
  scroll:{ paddingHorizontal: Space[5], paddingTop: Space[4], gap: Space[4] },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: Space[3],
    paddingHorizontal: Space[5],
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[2],
    paddingBottom: Space[4],
    borderBottomWidth: 1, borderBottomColor: Colors.border + '33',
    backgroundColor: Colors.pageBg,
  },
  kamiLogo: {
    fontFamily: FontFamily.display,
    fontSize: 34,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
  },
  avatarWrap: {
    width: Sizing.avatarMd, height: Sizing.avatarMd,
    borderRadius: Sizing.avatarMd / 2,
    backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 2, borderColor: Colors.primary,
    ...Shadows.sm,
  },
  avatarImg:    { width: '100%', height: '100%' },
  avatarLetter: { color: Colors.primary, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold },
  greeting:     { marginTop: 0, lineHeight: 18 },

  // Streak banner
  streakBanner: {
    flexDirection: 'row', backgroundColor: Colors.cardBg,
    borderRadius: Radii.card, padding: Space[4],
    borderWidth: 1.5, borderColor: Colors.border + '44',
    ...Shadows.card,
    gap: Space[4],
    alignItems: 'center',
  },
  streakItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  streakIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDivider:{ width: 1.5, height: 32, backgroundColor: Colors.border + '55' },
  streakEmoji:  { fontSize: 20 },
  streakNum:    { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, lineHeight: 22 },
  streakLabel:  { fontSize: 10, marginTop: -2 },

  // Generic card
  card: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.card,
    padding: Space[4], gap: Space[4],
    borderWidth: 1.5, borderColor: Colors.border + '44',
    ...Shadows.card,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  cardIcon:    { fontSize: FontSize.md, color: Colors.primary },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary + '18', borderRadius: Radii.full,
    paddingHorizontal: Space[3], paddingVertical: Space[1],
  },

  // Mood
  moodCircle: {
    alignItems: 'center', gap: 6,
    paddingVertical: Space[2],
    width: 76,
  },
  moodCircleEmojiWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border + '44',
  },
  moodDone: {
    flexDirection: 'row', alignItems: 'center', gap: Space[4],
    backgroundColor: Colors.creamDeep + '44', borderRadius: Radii.card, padding: Space[4],
    borderWidth: 1.5, borderColor: Colors.primary + '33',
  },
  moodDoneEmojiWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '18',
  },
  moodBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Space[2], marginBottom: 2 },
  moodBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Space[2],
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  moodNote: { fontStyle: 'italic', color: Colors.textSecondary, lineHeight: 20 },
  moodRow: { flexDirection: 'row', gap: Space[1], paddingHorizontal: Space[2] },
  weekRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Space[3], borderTopWidth: 1, borderTopColor: Colors.border + '33', marginTop: Space[1] },
  weekDot:    { alignItems: 'center', gap: 3 },

  // Prompt
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.card,
    padding: Space[4],
    gap: Space[4],
    borderWidth: 1.5,
    borderColor: Colors.border + '44',
    ...Shadows.card,
  },
  promptIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: {
    fontStyle: 'italic',
    fontWeight: '500',
    lineHeight: 22,
    color: Colors.textSecondary,
    fontFamily: FontFamily.display,
    fontSize: FontSize.base,
  },

  // Journal preview
  emptyInner: { alignItems: 'center', paddingVertical: Space[5] },
  journalPreview: {
    flexDirection: 'row', alignItems: 'center', gap: Space[3],
    paddingVertical: Space[3], paddingHorizontal: Space[3],
    backgroundColor: Colors.creamDeep + '33', borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border + '22',
  },
  journalPreviewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },

  // Goals preview
  goalPreview: {
    flexDirection: 'row', alignItems: 'center', gap: Space[3],
    paddingVertical: Space[3], paddingHorizontal: Space[3],
    backgroundColor: Colors.creamDeep + '33', borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border + '22',
  },
  miniBar: {
    height: 6, backgroundColor: Colors.creamDeep, borderRadius: 3, overflow: 'hidden', flex: 1,
  },
  miniFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },

  // Quick actions
  quickRow: { flexDirection: 'row', gap: Space[3] },
  quickCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space[3],
    paddingVertical: Space[4], paddingHorizontal: Space[4], backgroundColor: Colors.cardBg,
    borderRadius: Radii.card, borderWidth: 1.5, borderColor: Colors.border + '44',
    ...Shadows.sm,
  },
  quickEmoji: { fontSize: 26 },
});
