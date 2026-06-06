/**
 * HomeScreen — clean solo dashboard
 * Shows previews of mood, journal, goals, prompt.
 * Each section taps through to its dedicated screen.
 */

import React, { useRef, useState, useEffect } from 'react';
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
import KamiButton          from '@shared/ui/atoms/KamiButton';
import {
  Colors, FontFamily, FontSize, FontWeight, Radii, Shadows, Sizing, Space,
} from '@shared/constants';
import type { MainTabScreenProps } from '@core/navigation/types';
import { useTheme }      from '@shared/hooks';
import { LinearGradient } from 'expo-linear-gradient';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useCouple }      from '@features/couple/hooks/useCouple';
import { supabase }       from '@shared/lib/supabase';

function getRelationshipDuration(anniversaryDate: string | null): string {
  if (!anniversaryDate) return 'Connected';
  const ann = new Date(anniversaryDate);
  const now = new Date();
  let years = now.getFullYear() - ann.getFullYear();
  let months = now.getMonth() - ann.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  const yStr = years > 0 ? `${years} Year${years > 1 ? 's' : ''}` : '';
  const mStr = months > 0 ? `${months} Month${months > 1 ? 's' : ''}` : '';
  if (yStr && mStr) return `Together for ${yStr} ${mStr}`;
  if (yStr) return `Together for ${yStr}`;
  if (mStr) return `Together for ${mStr}`;
  return 'Connected';
}

function getDaysUntilAnniversary(anniversaryDate: string | null): number | null {
  if (!anniversaryDate) return null;
  const ann = new Date(anniversaryDate);
  const now = new Date();
  const nextAnn = new Date(now.getFullYear(), ann.getMonth(), ann.getDate());
  if (nextAnn.getTime() < now.getTime()) {
    nextAnn.setFullYear(now.getFullYear() + 1);
  }
  const diff = nextAnn.getTime() - now.getTime();
  return Math.ceil(diff / 86400000);
}

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

  // Couple Space Hooks & State
  const { 
    couple, partner, todayQuestion, dailyAnswers, coupleJournals, coupleGoals, relationshipEvents, coupleMemories, setPartner 
  } = useCoupleStore();
  const { loadAll: loadCoupleAll, submitAnswer } = useCouple();

  const [answerInput, setAnswerInput] = useState('');
  const [submittingAnswerState, setSubmittingAnswerState] = useState(false);

  // Trigger periodic tick to refresh online status calculations locally
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (user?.activeSpace !== 'couple') return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // tick every 30s
    return () => clearInterval(interval);
  }, [user?.activeSpace]);

  useEffect(() => {
    if (user?.activeSpace === 'couple') {
      loadCoupleAll();
    }
  }, [user?.activeSpace, user?.id, loadCoupleAll]);

  // Realtime subscription for partner's lastSeenAt updates
  useEffect(() => {
    if (user?.activeSpace !== 'couple' || !partner?.id) return;

    const channel = supabase
      .channel(`partner_profile_realtime_${partner.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partner.id}` },
        (payload) => {
          const p = payload.new as any;
          setPartner({
            id: p.id,
            nickname: p.nickname || 'Partner',
            email: p.email || '',
            avatarUrl: p.avatar_url,
            lastSeenAt: p.last_seen_at,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.activeSpace, partner?.id]);

  const handleMoodPick = (m: typeof MOODS[0]) => { setPending(m); setMoodModal(true); };
  const handleMoodSave = async (note: string) => {
    if (!pending) return;
    setMoodSaving(true);
    const r = await logMood({ moodId: pending.id, moodEmoji: pending.emoji, moodLabel: pending.label, note: note || undefined });
    setMoodSaving(false);
    setMoodModal(false);
    if (!r.success) Alert.alert('Kami', r.error);
  };
  
  const handleRefresh = async () => { 
    setRefreshing(true); 
    if (user?.activeSpace === 'couple') {
      await loadCoupleAll();
    } else {
      await refresh(); 
    }
    setRefreshing(false); 
  };

  const activeGoals    = goals.filter(g => g.status === 'active');
  const completedToday = goals.filter(g => g.progress === 100).length;

  const activeCoupleGoals = coupleGoals.filter(g => g.status === 'active');

  const { colors } = useTheme();

  if (user?.activeSpace === 'couple' && couple) {
    const partnerName = partner?.nickname || partner?.email?.split('@')[0] || 'Partner';
    const isPartnerOnline = (() => {
      if (!partner?.lastSeenAt) return false;
      const parsedTime = new Date(partner.lastSeenAt).getTime();
      if (isNaN(parsedTime)) return false;
      const diffMs = Date.now() - parsedTime;
      // Allow minor clock skew in the future (up to 5 minutes) and up to 5 minutes in the past.
      // This protects against emulator timezone discrepancies where partner.lastSeenAt is in the future.
      return diffMs >= -5 * 60 * 1000 && diffMs < 5 * 60 * 1000;
    })();
    const myAnswer = dailyAnswers.find(a => a.userId === user?.id);
    const partnerAnswer = dailyAnswers.find(a => a.userId === partner?.id);
    const bothAnswered = myAnswer && partnerAnswer;

    const relationshipDays = couple.anniversaryDate 
      ? Math.max(1, Math.ceil((Date.now() - new Date(couple.anniversaryDate).getTime()) / 86400000))
      : 1;

    const daysUntilAnniversary = getDaysUntilAnniversary(couple.anniversaryDate);

    return (
      <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
        <StatusBar style="dark" />

        {/* ── COUPLE HEADER ───────────────────────────────────── */}
        <View style={[s.topBar, { backgroundColor: colors.pageBg }]}>
          <View style={{ flex: 1 }}>
            <KamiText style={[s.kamiLogo, { color: colors.primary }]}>Kami</KamiText>
            <View style={s.onlineContainer}>
              <KamiText variant="caption" color={Colors.textMuted} style={s.greeting}>
                {couple.name || `${name} & ${partnerName}`}
              </KamiText>
              <Text style={{ fontSize: 11, color: Colors.textMuted + '88', marginHorizontal: 2 }}>•</Text>
              <KamiText variant="caption" color={isPartnerOnline ? Colors.success : Colors.textMuted} bold={isPartnerOnline} style={{ fontSize: 11 }}>
                {isPartnerOnline ? 'online' : 'offline'}
              </KamiText>
            </View>
          </View>
          <View style={s.topBarRight}>
            <TouchableOpacity 
              style={[s.avatarWrap, { borderColor: isPartnerOnline ? Colors.success : colors.primaryLight, backgroundColor: colors.creamDeep }]} 
              onPress={() => navigation.navigate('Settings')}
            >
              {partner?.avatarUrl ? (
                <Image source={{ uri: partner.avatarUrl }} style={s.avatarImg} />
              ) : (
                <Text style={[s.avatarLetter, { color: colors.primary }]}>{initial(partnerName)}</Text>
              )}
              {/* Online/Offline status dot on partner's avatar */}
              <View 
                style={[
                  s.heroOnlineBadge, 
                  { 
                    position: 'absolute',
                    bottom: -1, 
                    right: -1, 
                    width: 14, 
                    height: 14, 
                    borderRadius: 7, 
                    borderWidth: 2.5, 
                    borderColor: colors.pageBg, 
                    backgroundColor: isPartnerOnline ? Colors.success : '#CBD5E1' 
                  }
                ]} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {/* ── RELATIONSHIP HERO BANNER (GRADIENT CARD) ─────── */}
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroGradient}
          >
            <View style={s.heroContent}>
              <View style={s.heroHeader}>
                <View style={s.dualAvatarsContainer}>
                  {/* Current User Avatar */}
                  <View style={[s.heroAvatarWrap, { borderColor: '#fff' }]}>
                    {user?.avatarUrl ? (
                      <Image source={{ uri: user.avatarUrl }} style={s.heroAvatar} />
                    ) : (
                      <Text style={[s.heroAvatarLetter, { color: colors.primary }]}>{initial(name)}</Text>
                    )}
                  </View>
                  {/* Overlapping Partner Avatar */}
                  <View style={[s.heroAvatarWrap, s.heroAvatarOverlap, { borderColor: '#fff' }]}>
                    {partner?.avatarUrl ? (
                      <Image source={{ uri: partner.avatarUrl }} style={s.heroAvatar} />
                    ) : (
                      <Text style={[s.heroAvatarLetter, { color: colors.primary }]}>{initial(partnerName)}</Text>
                    )}
                    <View style={[s.heroOnlineBadge, { backgroundColor: isPartnerOnline ? Colors.success : '#CBD5E1' }]} />
                  </View>
                </View>
                
                {/* Stats / Day Count */}
                <View style={s.dayCountBadge}>
                  <Text style={s.dayCountText}>Day {relationshipDays}</Text>
                </View>
              </View>

              <View style={s.heroTextSection}>
                <KamiText style={s.heroTitle} color="#fff" bold>
                  {couple.name || `${name} & ${partnerName}`}
                </KamiText>
                <KamiText style={s.heroDuration} color="#ffffffdd">
                  {couple.anniversaryDate ? getRelationshipDuration(couple.anniversaryDate) : 'Your shared space'}
                </KamiText>
              </View>

              <View style={s.heroFooter}>
                <Text style={s.heroFooterText}>
                  {daysUntilAnniversary !== null 
                    ? `🎉 ${daysUntilAnniversary} days until your next anniversary!` 
                    : '📅 Set your anniversary date in Settings'}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* ── PARTNER'S MOOD SPEECH BUBBLE ────────────── */}
          {partner && (partner as any).currentMoodEmoji ? (
            <View style={[s.card, { borderColor: colors.primaryLight + '55', backgroundColor: colors.creamDeep + '44', padding: Space[4], flexDirection: 'row', alignItems: 'center', gap: Space[4] }]}>
              <View style={[s.moodDoneEmojiWrap, { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', elevation: 2 }]}>
                <Text style={{ fontSize: 26 }}>{(partner as any).currentMoodEmoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <KamiText variant="caption" color={colors.primary} bold>{partnerName}'s Mood Check-in</KamiText>
                <KamiText variant="body" style={{ fontStyle: 'italic', color: Colors.textPrimary }}>
                  "{partnerName} is feeling <KamiText bold color={colors.primaryDark}>{(partner as any).currentMoodLabel}</KamiText> today."
                </KamiText>
              </View>
            </View>
          ) : null}

          {/* ── SHARED DAILY QUESTION ──────────────────────── */}
          {todayQuestion && (
            <View style={[s.card, { borderColor: colors.primary + '33' }]}>
              <View style={s.cardHeader}>
                <View style={s.cardTitleRow}>
                  <Text style={[s.cardIcon, { color: colors.primary }]}>✍️</Text>
                  <KamiText variant="subtitle" bold>Today's Daily Question</KamiText>
                </View>
              </View>

              <View style={[s.promptCard, { borderColor: colors.primaryLight + '22', backgroundColor: colors.creamDeep + '22', padding: Space[4], gap: Space[1] }]}>
                <KamiText variant="body" style={s.promptText} numberOfLines={3}>
                  “{todayQuestion.content}”
                </KamiText>
              </View>

              {bothAnswered ? (
                <View style={{ gap: Space[3], marginTop: Space[2] }}>
                  <View style={[s.bubbleMine, { backgroundColor: colors.creamDeep + '44', borderColor: colors.primaryLight + '44' }]}>
                    <KamiText variant="caption" color={colors.primaryDark} bold>You answered:</KamiText>
                    <KamiText variant="body" style={{ marginTop: 2, color: Colors.textPrimary }}>{myAnswer.response}</KamiText>
                  </View>
                  <View style={[s.bubblePartner, { backgroundColor: '#F8FAFC', borderColor: Colors.border + '44' }]}>
                    <KamiText variant="caption" color={Colors.textMuted} bold>{partnerName} answered:</KamiText>
                    <KamiText variant="body" style={{ marginTop: 2, color: Colors.textPrimary }}>{partnerAnswer.response}</KamiText>
                  </View>
                </View>
              ) : myAnswer ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: Colors.success + '15', borderRadius: Radii.full, paddingHorizontal: Space[3], paddingVertical: Space[1], alignSelf: 'flex-start', marginTop: Space[2] }}>
                  <Text style={{ fontSize: 11, color: Colors.success }}>✓</Text>
                  <KamiText variant="caption" color={Colors.success} bold>You answered — Waiting for partner</KamiText>
                </View>
              ) : (
                <View style={{ gap: Space[2], marginTop: Space[1] }}>
                  <TextInput
                    style={[s.answerInput, { borderColor: colors.primary + '22', backgroundColor: colors.creamDeep + '11' }]}
                    placeholder="Type your response to reveal..."
                    placeholderTextColor={Colors.textMuted}
                    value={answerInput}
                    onChangeText={setAnswerInput}
                    multiline
                    numberOfLines={3}
                  />
                  <KamiButton
                    label="Submit Answer"
                    loading={submittingAnswerState}
                    disabled={!answerInput.trim() || submittingAnswerState}
                    onPress={async () => {
                      setSubmittingAnswerState(true);
                      await submitAnswer(todayQuestion.id, couple.id, answerInput.trim());
                      setAnswerInput('');
                      setSubmittingAnswerState(false);
                    }}
                  />
                </View>
              )}
            </View>
          )}

          {/* ── RELATIONSHIP JOURNAL PREVIEW ────────────────── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardTitleRow}>
                <Text style={[s.cardIcon, { color: colors.primary }]}>📓</Text>
                <KamiText variant="subtitle" bold>Relationship Journal</KamiText>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Journal')} hitSlop={8}>
                <KamiText variant="caption" color={colors.primary} bold>View all ›</KamiText>
              </TouchableOpacity>
            </View>

            {coupleJournals.length === 0 ? (
              <Tap onPress={() => navigation.navigate('Journal')} style={s.emptyInner}>
                <KamiText variant="caption" color={Colors.textMuted} align="center">
                  No shared entries yet.{"\n"}Write your first joint memory.
                </KamiText>
                <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[2] }}>Write entry ›</KamiText>
              </Tap>
            ) : (
              <Tap onPress={() => navigation.navigate('Journal')} style={[s.journalPreview, { backgroundColor: colors.creamDeep + '22', borderColor: colors.primaryLight + '44' }]}>
                {coupleJournals[0].imageUrls && coupleJournals[0].imageUrls.length > 0 ? (
                  <Image source={{ uri: coupleJournals[0].imageUrls[0] }} style={s.journalPreviewThumb} />
                ) : (
                  <View style={[s.journalPreviewDot, { backgroundColor: colors.primary }]} />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <KamiText variant="label" numberOfLines={1} bold>
                    {coupleJournals[0].title || 'Untitled shared entry'}
                  </KamiText>
                  <KamiText variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                    {coupleJournals[0].body}
                  </KamiText>
                  <KamiText variant="caption" color={colors.primaryDark} style={{ fontSize: 10 }} bold>
                    Written by {coupleJournals[0].userNickname}
                  </KamiText>
                </View>
                <KamiText variant="caption" color={Colors.textMuted}>
                  {new Date(coupleJournals[0].entryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </KamiText>
              </Tap>
            )}
          </View>

          {/* ── RELATIONSHIP STATS GRID ─────────────────────── */}
          <View style={{ gap: Space[2] }}>
            <KamiText variant="overline" style={{ paddingHorizontal: Space[2] }}>Relationship Growth Stats</KamiText>
            <View style={s.statsGrid}>
              <View style={[s.statsCard, { backgroundColor: colors.creamDeep, borderColor: colors.primaryLight + '44' }]}>
                <Text style={{ fontSize: 24 }}>📅</Text>
                <KamiText style={s.statsNum} color={colors.primaryDark}>{relationshipDays}</KamiText>
                <KamiText variant="caption" color={Colors.textSecondary}>Days Connected</KamiText>
              </View>
              <View style={[s.statsCard, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '33' }]}>
                <Text style={{ fontSize: 24 }}>💬</Text>
                <KamiText style={s.statsNum} color={colors.primaryDark}>{dailyAnswers.length}</KamiText>
                <KamiText variant="caption" color={Colors.textSecondary}>Answers Shared</KamiText>
              </View>
              <View style={[s.statsCard, { backgroundColor: '#FEF9C3' + '88', borderColor: '#FDE047' + 'aa' }]}>
                <Text style={{ fontSize: 24 }}>📸</Text>
                <KamiText style={s.statsNum} color="#A16207">{coupleMemories.length}</KamiText>
                <KamiText variant="caption" color={Colors.textSecondary}>Memories Saved</KamiText>
              </View>
              <View style={[s.statsCard, { backgroundColor: '#DCFCE7' + '88', borderColor: '#86EFAC' + 'aa' }]}>
                <Text style={{ fontSize: 24 }}>🏆</Text>
                <KamiText style={s.statsNum} color="#15803D">{coupleGoals.filter(g => g.status === 'completed').length}</KamiText>
                <KamiText variant="caption" color={Colors.textSecondary}>Goals Completed</KamiText>
              </View>
            </View>
          </View>

          {/* ── COUPLE GOALS PREVIEW ────────────────────────── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardTitleRow}>
                <Text style={[s.cardIcon, { color: colors.primary }]}>🌱</Text>
                <KamiText variant="subtitle" bold>Couple Goals</KamiText>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Goals')} hitSlop={8}>
                <KamiText variant="caption" color={colors.primary} bold>View all ›</KamiText>
              </TouchableOpacity>
            </View>

            {activeCoupleGoals.length === 0 ? (
              <Tap onPress={() => navigation.navigate('Goals')} style={s.emptyInner}>
                <KamiText variant="caption" color={Colors.textMuted} align="center">No active shared goals.</KamiText>
                <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[2] }}>Add couple goal ›</KamiText>
              </Tap>
            ) : (
              <View style={{ gap: Space[3] }}>
                {activeCoupleGoals.slice(0, 3).map(g => (
                  <Tap key={g.id} onPress={() => navigation.navigate('Goals')} style={[s.goalPreview, { backgroundColor: colors.creamDeep + '22', borderColor: colors.primaryLight + '44' }]}>
                    <Text style={{ fontSize: 20 }}>{g.emoji}</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      <KamiText variant="label" numberOfLines={1} bold>{g.title}</KamiText>
                      <View style={[s.miniBar, { backgroundColor: colors.creamDeep }]}>
                        <View style={[s.miniFill, { width: `${g.progress}%` as any, backgroundColor: colors.primary }]} />
                      </View>
                    </View>
                    <KamiText variant="caption" color={colors.primaryDark} bold>{g.progress}%</KamiText>
                  </Tap>
                ))}
              </View>
            )}
          </View>

          {/* ── QUICK ACTIONS ROW ────────────────────────── */}
          <View style={s.quickRow}>
            <Tap onPress={() => navigation.navigate('Memories')} style={s.quickCard}>
              <Text style={s.quickEmoji}>📸</Text>
              <View>
                <KamiText variant="label" bold>Shared Timeline</KamiText>
                <KamiText variant="caption" color={Colors.textMuted}>Couple Memories</KamiText>
              </View>
            </Tap>
            <Tap onPress={() => navigation.navigate('Future')} style={s.quickCard}>
              <Text style={s.quickEmoji}>💌</Text>
              <View>
                <KamiText variant="label" bold>Love Letters</KamiText>
                <KamiText variant="caption" color={Colors.textMuted}>Capsules</KamiText>
              </View>
            </Tap>
          </View>

          <View style={{ height: Space[8] }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

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
  scroll:{ paddingHorizontal: Space[5], paddingTop: Space[4], gap: Space[5] },

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
    width: Sizing.avatarSm, height: Sizing.avatarSm,
    borderRadius: Sizing.avatarSm / 2,
    backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 2, borderColor: Colors.primary,
    ...Shadows.sm,
  },
  avatarImg:    { width: '100%', height: '100%' },
  avatarLetter: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  greeting:     { marginTop: 2, lineHeight: 18 },
  onlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space[1],
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Premium Hero Banner
  heroGradient: {
    borderRadius: Radii.card,
    overflow: 'hidden',
    ...Shadows.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroContent: {
    padding: Space[5],
    gap: Space[4],
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dualAvatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadows.sm,
  },
  heroAvatarOverlap: {
    marginLeft: -16,
  },
  heroAvatar: {
    width: '100%',
    height: '100%',
  },
  heroAvatarLetter: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extrabold,
    fontFamily: FontFamily.display,
  },
  heroOnlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  dayCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: Space[3],
    paddingVertical: Space[1] + 1,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dayCountText: {
    fontSize: FontSize.xs,
    color: '#fff',
    fontWeight: FontWeight.semibold,
  },
  heroTextSection: {
    gap: Space[1],
    marginVertical: Space[1],
  },
  heroTitle: {
    fontSize: FontSize.xl + 2,
    fontWeight: FontWeight.extrabold,
    fontFamily: FontFamily.display,
    letterSpacing: -0.5,
  },
  heroDuration: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  heroFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: Space[3],
    marginTop: Space[1],
  },
  heroFooterText: {
    fontSize: FontSize.sm,
    color: '#ffffffdd',
    fontWeight: FontWeight.medium,
  },

  // Generic card
  card: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.card,
    padding: Space[5], gap: Space[4],
    borderWidth: 1, borderColor: Colors.border + '55',
    ...Shadows.card,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  cardIcon:    { fontSize: FontSize.lg },
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

  // Prompt / Daily Question
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.card,
    padding: Space[4],
    gap: Space[4],
    borderWidth: 1,
    borderColor: Colors.border + '55',
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

  // Dialogue styling for answers
  bubbleMine: {
    padding: Space[4],
    borderRadius: Radii.card,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-end',
    maxWidth: '85%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bubblePartner: {
    padding: Space[4],
    borderRadius: Radii.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },

  // Journal preview
  emptyInner: { alignItems: 'center', paddingVertical: Space[5] },
  journalPreview: {
    flexDirection: 'row', alignItems: 'center', gap: Space[4],
    paddingVertical: Space[4], paddingHorizontal: Space[4],
    borderRadius: Radii.card,
    borderWidth: 1,
  },
  journalPreviewDot: { width: 8, height: 8, borderRadius: 4 },
  journalPreviewThumb: {
    width: 55,
    height: 55,
    borderRadius: Radii.sm,
    backgroundColor: '#eee',
  },

  // Goals preview
  goalPreview: {
    flexDirection: 'row', alignItems: 'center', gap: Space[4],
    paddingVertical: Space[3] + 2, paddingHorizontal: Space[4],
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  miniBar: {
    height: 8, borderRadius: 4, overflow: 'hidden', flex: 1,
  },
  miniFill: { height: '100%', borderRadius: 4 },

  // Quick actions
  quickRow: { flexDirection: 'row', gap: Space[4] },
  quickCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space[3],
    paddingVertical: Space[4], paddingHorizontal: Space[4], backgroundColor: Colors.cardBg,
    borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.border + '55',
    ...Shadows.card,
  },
  quickEmoji: { fontSize: 26 },

  // Couple specific styles
  answersRow: { gap: Space[3], marginTop: Space[2] },
  answerInput: { minHeight: 72, borderWidth: 1, borderRadius: Radii.input, padding: Space[4], color: Colors.textPrimary, textAlignVertical: 'top', fontSize: FontSize.base },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[4], justifyContent: 'space-between' },
  statsCard: { width: '47%', paddingVertical: Space[5], paddingHorizontal: Space[4], borderRadius: Radii.card, gap: Space[2], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border + '33', ...Shadows.sm },
  statsNum: { fontSize: FontSize.xl + 4, fontWeight: FontWeight.bold, color: Colors.textPrimary, fontFamily: FontFamily.display },

  // Streak styles for personal space
  streakBanner: {
    flexDirection: 'row', backgroundColor: Colors.cardBg,
    borderRadius: Radii.card, padding: Space[4],
    borderWidth: 1, borderColor: Colors.border + '55',
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
  streakDivider:{ width: 1, height: 32, backgroundColor: Colors.border + '33' },
  streakEmoji:  { fontSize: 20 },
  streakNum:    { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, lineHeight: 22 },
  streakLabel:  { fontSize: 10, marginTop: -2 },
});
