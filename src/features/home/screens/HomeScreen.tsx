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
  ImageBackground,
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
import { useAuthStore, useAuth }  from '@features/auth';
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
import { broadcastPartnerAction } from '@features/couple/components/CoupleRealtimeListener';

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
function checkUnlocked(l: { deliverAt: string }) {
  return Date.now() >= new Date(l.deliverAt).getTime();
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

  const { updateProfile } = useAuth();

  // Couple Space Hooks & State
  const { 
    couple, partner, todayQuestion, dailyAnswers, coupleJournals, coupleGoals, relationshipEvents, coupleMemories, setPartner,
    homeAlerts, removeHomeAlert, partnerAction, coupleLetters
  } = useCoupleStore();
  const { loadAll: loadCoupleAll, submitAnswer } = useCouple();

  const [answerInput, setAnswerInput] = useState('');
  const [submittingAnswerState, setSubmittingAnswerState] = useState(false);
  const [loveSending, setLoveSending] = useState(false);

  // Trigger periodic tick to refresh online status calculations locally
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (user?.activeSpace !== 'couple') return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // tick every 30s
    return () => clearInterval(interval);
  }, [user?.activeSpace]);

  // Focus listener to refresh data automatically when user comes to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user?.activeSpace === 'couple') {
        loadCoupleAll();
      } else {
        refresh();
      }
    });
    return unsubscribe;
  }, [navigation, user?.activeSpace, loadCoupleAll, refresh]);

  // Initial load
  useEffect(() => {
    if (user?.activeSpace === 'couple') {
      loadCoupleAll();
    }
  }, [user?.activeSpace, user?.id, loadCoupleAll]);

  // Canvas floating animations
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;
  const floatAnim4 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (user?.activeSpace !== 'couple') return;
    const createFloatLoop = (anim: Animated.Value, duration: number, delay = 0) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const float1 = createFloatLoop(floatAnim1, 2500, 0);
    const float2 = createFloatLoop(floatAnim2, 2800, 300);
    const float3 = createFloatLoop(floatAnim3, 3100, 150);
    const float4 = createFloatLoop(floatAnim4, 2600, 450);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    float1.start();
    float2.start();
    float3.start();
    float4.start();
    pulse.start();

    return () => {
      float1.stop();
      float2.stop();
      float3.stop();
      float4.stop();
      pulse.stop();
    };
  }, [user?.activeSpace]);

  const y1 = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] });
  const y2 = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [5, -5] });
  const y3 = floatAnim3.interpolate({ inputRange: [0, 1], outputRange: [-4, 8] });
  const y4 = floatAnim4.interpolate({ inputRange: [0, 1], outputRange: [7, -4] });

  // Partner Action presence indicator pulse
  const partnerActionPulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    if (partnerAction !== 'idle') {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(partnerActionPulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(partnerActionPulse, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      partnerActionPulse.setValue(0.4);
    }
    return () => {
      if (animLoop) animLoop.stop();
    };
  }, [partnerAction]);

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
      return diffMs >= -5 * 60 * 1000 && diffMs < 5 * 60 * 1000;
    })();
    const myAnswer = dailyAnswers.find(a => a.userId === user?.id);
    const partnerAnswer = dailyAnswers.find(a => a.userId === partner?.id);
    const bothAnswered = myAnswer && partnerAnswer;

    const relationshipDays = couple.anniversaryDate 
      ? Math.max(1, Math.ceil((Date.now() - new Date(couple.anniversaryDate).getTime()) / 86400000))
      : 1;

    const daysUntilAnniversary = getDaysUntilAnniversary(couple.anniversaryDate);

    const getGoalPlantEmoji = (progress: number) => {
      if (progress < 30) return '🌱';
      if (progress < 100) return '🌿';
      return '🌸';
    };

    // Calculate unread letters count
    const unreadLettersCount = coupleLetters.filter(l => l.senderId !== user.id && !l.isRead && l.isUnlocked).length;

    // Helper for relative time ago
    const getTimeAgo = (date: Date | string): string => {
      const ms = Date.now() - new Date(date).getTime();
      const sec = Math.floor(ms / 1000);
      const min = Math.floor(sec / 60);
      const hr = Math.floor(min / 60);
      const day = Math.floor(hr / 24);
      if (day > 0) return `${day}d ago`;
      if (hr > 0) return `${hr}h ago`;
      if (min > 0) return `${min}m ago`;
      return 'Just now';
    };

    // Extract dynamic timeline events based on actual data
    interface TimelineEvent {
      id: string;
      title: string;
      time: string;
      icon: string;
      date: Date;
    }
    const dynamicTimeline: TimelineEvent[] = [];

    // Let's add couple letters
    coupleLetters.forEach(l => {
      const isLocked = !checkUnlocked(l);
      dynamicTimeline.push({
        id: `letter-${l.id}`,
        title: isLocked 
          ? (l.senderId === user?.id ? 'Letter Sealed 🔒' : 'Letter Scheduled 🔒')
          : (l.senderId === user?.id ? 'Letter Opened' : 'Letter Opened ✉️'),
        time: getTimeAgo(l.createdAt),
        icon: isLocked ? '🔒' : '✉️',
        date: new Date(l.createdAt)
      });
    });

    // Add couple memories
    coupleMemories.forEach(m => {
      dynamicTimeline.push({
        id: `memory-${m.id}`,
        title: m.title,
        time: getTimeAgo(m.memoryDate || m.createdAt),
        icon: '📸',
        date: new Date(m.memoryDate || m.createdAt)
      });
    });

    // Add completed couple goals
    coupleGoals.filter(g => g.status === 'completed').forEach(g => {
      dynamicTimeline.push({
        id: `goal-${g.id}`,
        title: `Goal Completed`,
        time: g.completedAt ? getTimeAgo(g.completedAt) : 'Recent',
        icon: '🎯',
        date: new Date(g.completedAt || g.createdAt)
      });
    });

    // Sort chronologically (newest first)
    dynamicTimeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Dynamic Latest Letter Excerpt
    const latestLetterFromPartner = coupleLetters
      .filter(l => l.senderId !== user?.id && l.isUnlocked && !l.isDraft && !l.isArchived)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const letterExcerpt = latestLetterFromPartner && latestLetterFromPartner.body
      ? (latestLetterFromPartner.body.length > 55 ? `“${latestLetterFromPartner.body.substring(0, 52)}...”` : `“${latestLetterFromPartner.body}”`)
      : null;
    const letterTimeAgo = latestLetterFromPartner
      ? `Written ${getTimeAgo(latestLetterFromPartner.createdAt)}`
      : null;

    // Dynamic Latest Active Goal details
    const activeCoupleGoalsList = coupleGoals.filter(g => g.status === 'active');
    const latestCoupleGoal = activeCoupleGoalsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const goalTitle = latestCoupleGoal ? latestCoupleGoal.title : null;
    const goalProgress = latestCoupleGoal ? latestCoupleGoal.progress : 0;
    const goalTimeRemainingText = latestCoupleGoal && latestCoupleGoal.targetDate
      ? `${Math.max(1, Math.ceil((new Date(latestCoupleGoal.targetDate).getTime() - Date.now()) / 86400000))} days left ❤️`
      : null;

    // Dynamic Flashback Memory details
    const flashbackMemory = coupleMemories.length > 0
      ? coupleMemories[Math.floor(Math.random() * coupleMemories.length)]
      : null;
    const flashbackTitle = flashbackMemory ? flashbackMemory.title : '';
    const flashbackDesc = flashbackMemory && flashbackMemory.description
      ? (flashbackMemory.description.length > 70 ? `${flashbackMemory.description.substring(0, 67)}...` : flashbackMemory.description)
      : '';
    const flashbackImage = flashbackMemory && flashbackMemory.imageUrls && flashbackMemory.imageUrls.length > 0
      ? flashbackMemory.imageUrls[0]
      : 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600&auto=format&fit=crop';

    // Presence mapping description
    const getPresenceDescription = () => {
      switch (partnerAction) {
        case 'writing_letter': return `${partnerName} is writing a letter... ✍️`;
        case 'reading_memories': return `${partnerName} is viewing memories... 📸`;
        case 'creating_goal': return `${partnerName} is composing a goal... 🎯`;
        case 'reading_letter': return `${partnerName} is reading your letter... ❤️`;
        case 'writing_journal': return `${partnerName} is writing journal... 📓`;
        case 'sending_love': return `${partnerName} sent you love! ❤️`;
        case 'writing_memory': return `${partnerName} is sharing a memory... 📸`;
        case 'viewing_memory': return `${partnerName} is viewing a memory... 📸`;
        case 'reading_journal': return `${partnerName} is reading journal... 📓`;
        case 'viewing_goals': return `${partnerName} is viewing goals... 🎯`;
        case 'viewing_letters': return `${partnerName} is viewing letters... ✉️`;
        default: return isPartnerOnline ? `${partnerName} is online` : '';
      }
    };

    const getHeroContent = () => {
      // 1. Unlocked & Unread letters from partner
      const unreadLetter = coupleLetters
        .filter(l => l.senderId !== user?.id && l.isUnlocked && !l.isRead && !l.isDraft && !l.isArchived)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (unreadLetter) {
        return {
          title: 'A new letter',
          script: 'arrived ❤️',
          time: `Written ${getTimeAgo(unreadLetter.createdAt)}`,
          cta: 'Open Letter →',
        };
      }

      // 2. Unlocked & Read letters from partner
      const readLetter = coupleLetters
        .filter(l => l.senderId !== user?.id && l.isUnlocked && l.isRead && !l.isDraft && !l.isArchived)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (readLetter) {
        return {
          title: 'Latest Letter',
          script: 'opened ✉️',
          time: `Opened ${getTimeAgo(readLetter.createdAt)}`,
          cta: 'Read Letters →',
        };
      }

      // 3. Locked letters from partner
      const lockedLetter = coupleLetters
        .filter(l => l.senderId !== user?.id && !l.isUnlocked && !l.isDraft && !l.isArchived)
        .sort((a, b) => new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime())[0];
      if (lockedLetter) {
        return {
          title: 'Future Letter',
          script: 'is locked 🔒',
          time: `Unlocks on ${new Date(lockedLetter.deliverAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
          cta: 'View Scheduled →',
        };
      }

      // 4. Any letter by current user (drafts, scheduled, unlocked)
      const myLetter = coupleLetters
        .filter(l => l.senderId === user?.id && !l.isArchived)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (myLetter) {
        if (myLetter.isDraft) {
          return {
            title: 'Your Draft',
            script: 'in progress 📝',
            time: `Last saved ${getTimeAgo(myLetter.createdAt)}`,
            cta: 'Edit Draft →',
          };
        } else if (myLetter.isUnlocked) {
          return {
            title: 'Your letter',
            script: 'is unlocked ✉️',
            time: `Written ${getTimeAgo(myLetter.createdAt)}`,
            cta: 'Read Letters →',
          };
        } else {
          return {
            title: 'Letter Sealed',
            script: 'scheduled 🔒',
            time: `Unlocks on ${new Date(myLetter.deliverAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
            cta: 'View Scheduled →',
          };
        }
      }

      // 5. Default empty state
      return {
        title: 'Seal a memory',
        script: 'for the future ✨',
        time: 'No letters written yet',
        cta: 'Write Letter →',
      };
    };

    const heroContent = getHeroContent();

    const handleSendLove = async () => {
      if (user?.id && couple?.id) {
        setLoveSending(true);
        await broadcastPartnerAction(couple.id, user.id, 'sending_love');
        Alert.alert('Kami ❤️', `Love sent to ${partnerName}!`);
        setTimeout(async () => {
          await broadcastPartnerAction(couple.id, user.id, 'idle');
          setLoveSending(false);
        }, 3000);
      }
    };

    return (
      <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
        <StatusBar style="dark" />

        {/* ── 1. FLOATING ISLAND HEADER ──────────────── */}
        <View style={hsStyles.floatingHeader}>
          <TouchableOpacity 
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Settings')}
            style={hsStyles.headerAvatarGroup}
          >
            {/* User Avatar */}
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={hsStyles.headerUserAvatar} />
            ) : (
              <View style={[hsStyles.headerUserAvatarPlaceholder, { backgroundColor: colors.creamDeep }]}>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: 'bold' }}>{initial(name)}</Text>
              </View>
            )}

            {/* Partner Avatar overlapping */}
            {partner?.avatarUrl ? (
              <Image source={{ uri: partner.avatarUrl }} style={hsStyles.headerPartnerAvatar} />
            ) : (
              <View style={[hsStyles.headerPartnerAvatarPlaceholder, { backgroundColor: colors.creamDeep }]}>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: 'bold' }}>{initial(partnerName)}</Text>
              </View>
            )}
            
            {/* Status dot on the partner avatar */}
            <View style={[hsStyles.headerOnlineBadge, { backgroundColor: isPartnerOnline ? '#22c55e' : '#94a3b8' }]} />
          </TouchableOpacity>

          <View style={hsStyles.headerBrand}>
            <KamiText style={[hsStyles.headerBrandLogo, { color: colors.primary }]} bold>Kami</KamiText>
            <View style={hsStyles.headerMetaRow}>
              <Text style={[hsStyles.headerMetaText, { color: colors.primaryDark }]}>{relationshipDays} days together</Text>
              <Text style={{ fontSize: 10 }}>❤️</Text>
            </View>
          </View>

          <View style={hsStyles.headerActionsRow}>
            <TouchableOpacity 
              style={hsStyles.headerActionCircle}
              onPress={() => Alert.alert('Search', 'Search couple space...')}
            >
              <Text style={{ fontSize: 15 }}>🔍</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={hsStyles.headerActionCircle}
              onPress={() => {
                if (homeAlerts.length > 0) {
                  Alert.alert('Notifications', homeAlerts.map(a => `${a.title}: ${a.message}`).join('\n'));
                } else {
                  Alert.alert('Notifications', 'No new alerts today.');
                }
              }}
            >
              <Text style={{ fontSize: 15 }}>🔔</Text>
              {homeAlerts.length > 0 && (
                <View style={[hsStyles.headerActionBadgeDot, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Alerts Stack Overlay */}
        <View style={hsStyles.alertsContainer} pointerEvents="box-none">
          {homeAlerts.map(alert => (
            <AlertPopup
              key={alert.id}
              alert={alert}
              onDismiss={removeHomeAlert}
              navigation={navigation}
            />
          ))}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {/* ── 2. LIVE PRESENCE CARD ──────────────────── */}
          {isPartnerOnline && (
            <View style={hsStyles.livePresenceCard}>
              <View style={hsStyles.livePresenceLeft}>
                <View style={hsStyles.liveGreenDot} />
                <View style={{ flex: 1 }}>
                  <KamiText bold style={hsStyles.presenceTitle}>{getPresenceDescription()}</KamiText>
                  <KamiText style={hsStyles.presenceSub}>{partnerAction !== 'idle' ? 'Active now' : 'Online'}</KamiText>
                </View>
              </View>
              <TouchableOpacity 
                style={[hsStyles.presenceViewBtn, { backgroundColor: colors.primary + '11' }]}
                onPress={() => {
                  if (partnerAction === 'writing_letter' || partnerAction === 'reading_letter' || partnerAction === 'viewing_letters') {
                    navigation.navigate('Future');
                  } else if (partnerAction === 'reading_memories' || partnerAction === 'viewing_memory' || partnerAction === 'writing_memory') {
                    navigation.navigate('Memories');
                  } else if (partnerAction === 'creating_goal' || partnerAction === 'viewing_goals') {
                    navigation.navigate('Goals');
                  } else if (partnerAction === 'writing_journal' || partnerAction === 'reading_journal') {
                    navigation.navigate('Journal');
                  }
                }}
              >
                <KamiText variant="caption" color={colors.primary} bold>View →</KamiText>
              </TouchableOpacity>
            </View>
          )}

          {/* ── 3. TODAY'S MOMENT CARD (HERO) ─────────── */}
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop' }}
            style={hsStyles.heroCardImage}
            imageStyle={{ borderRadius: 24 }}
          >
            <LinearGradient
              colors={['transparent', 'rgba(109, 17, 41, 0.95)']}
              style={hsStyles.heroOverlay}
            >
              <View style={hsStyles.heroTopRow}>
                <View style={hsStyles.heroBadge}>
                  <KamiText style={hsStyles.heroBadgeText} bold>Today's Moment ✨</KamiText>
                </View>
                <View style={hsStyles.heroMailBadge}>
                  <Text style={{ fontSize: 18 }}>✉️</Text>
                  {unreadLettersCount > 0 && (
                    <View style={[hsStyles.heroUnreadBadge, { backgroundColor: colors.primary }]}>
                      <KamiText style={hsStyles.heroUnreadText} bold>{unreadLettersCount}</KamiText>
                    </View>
                  )}
                </View>
              </View>

              <View style={hsStyles.heroContentBottom}>
                <KamiText style={hsStyles.heroTitleText}>{heroContent.title}</KamiText>
                <KamiText style={[hsStyles.heroTitleScript, { color: colors.primaryLight }]}>{heroContent.script}</KamiText>
                <KamiText style={hsStyles.heroTimeText}>{heroContent.time}</KamiText>
                <TouchableOpacity 
                  style={hsStyles.heroCtaBtn}
                  onPress={() => navigation.navigate('Future')}
                >
                  <KamiText bold style={{ color: colors.primary }}>{heroContent.cta}</KamiText>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </ImageBackground>

          {/* ── 4. QUICK ACTIONS SECTION ────────────────── */}
          <View style={hsStyles.quickActionsRow}>
            <TouchableOpacity 
              style={hsStyles.quickCardCol}
              onPress={() => navigation.navigate('Future')}
            >
              <View style={[hsStyles.quickIconBg, { backgroundColor: '#fdeae9' }]}>
                <Text style={{ fontSize: 26, color: colors.primary }}>✍️</Text>
              </View>
              <KamiText style={hsStyles.quickCardLabel} bold>Write Letter</KamiText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={hsStyles.quickCardCol}
              onPress={() => navigation.navigate('Memories')}
            >
              <View style={[hsStyles.quickIconBg, { backgroundColor: '#fdf2e9' }]}>
                <Text style={{ fontSize: 26, color: '#935a26' }}>📸</Text>
              </View>
              <KamiText style={hsStyles.quickCardLabel} bold>Add Memory</KamiText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={hsStyles.quickCardCol}
              onPress={() => navigation.navigate('Goals')}
            >
              <View style={[hsStyles.quickIconBg, { backgroundColor: '#eef7ed' }]}>
                <Text style={{ fontSize: 26, color: '#2d5a27' }}>🎯</Text>
              </View>
              <KamiText style={hsStyles.quickCardLabel} bold>New Goal</KamiText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={hsStyles.quickCardCol}
              onPress={handleSendLove}
              disabled={loveSending}
            >
              <View style={[hsStyles.quickIconBg, { backgroundColor: '#f4effa' }]}>
                <Text style={{ fontSize: 26, color: '#5c2d91' }}>❤️</Text>
              </View>
              <KamiText style={hsStyles.quickCardLabel} bold>Send Love</KamiText>
            </TouchableOpacity>
          </View>

          {/* ── 5. OUR JOURNEY TIMELINE ─────────────────── */}
          <View style={hsStyles.journeySection}>
            <View style={hsStyles.journeyHeader}>
              <KamiText variant="subtitle" bold style={hsStyles.journeyTitle}>Our Journey ❤️</KamiText>
              <TouchableOpacity onPress={() => navigation.navigate('Memories')}>
                <KamiText variant="caption" color={colors.primary} bold>See All ›</KamiText>
              </TouchableOpacity>
            </View>

            {dynamicTimeline.length > 0 ? (
              <View style={hsStyles.journeyScrollWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hsStyles.journeyScroll}>
                  <View style={hsStyles.journeyDashedLine} />

                  {dynamicTimeline.map((item) => (
                    <View key={item.id} style={hsStyles.journeyNodeCol}>
                      <View style={hsStyles.journeyNodeCircle}>
                        <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                        <View style={[hsStyles.journeyNodeSmallIndicator, { backgroundColor: colors.primary }]} />
                      </View>
                      <KamiText bold style={hsStyles.journeyNodeText} align="center" numberOfLines={2}>{item.title}</KamiText>
                      <KamiText style={hsStyles.journeyNodeTime} align="center">{item.time}</KamiText>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={hsStyles.emptyJourneyBox}>
                <KamiText variant="caption" color={Colors.textMuted} align="center">
                  Your journey timeline is empty. Seal a letter or share a memory to start compiling milestones! ✨
                </KamiText>
              </View>
            )}
          </View>

          {/* ── 6. MEMORY FLASHBACK CARD ────────────────── */}
          {flashbackMemory && (
            <ImageBackground
              source={{ uri: flashbackImage }}
              style={hsStyles.flashbackCardBg}
              imageStyle={{ borderRadius: 24 }}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.85)']}
                style={hsStyles.flashbackOverlay}
              >
                <View style={hsStyles.flashbackBadge}>
                  <Text style={{ fontSize: 10, marginRight: 4 }}>📅</Text>
                  <KamiText style={hsStyles.flashbackBadgeText} bold>Flashback Moment</KamiText>
                </View>

                <View style={hsStyles.flashbackContentBottom}>
                  <KamiText style={hsStyles.flashbackTitleText}>{flashbackTitle} ❤️</KamiText>
                  <KamiText style={hsStyles.flashbackDescText}>{flashbackDesc}</KamiText>
                  <TouchableOpacity 
                    style={hsStyles.flashbackCta}
                    onPress={() => navigation.navigate('Memories')}
                  >
                    <KamiText bold style={{ color: colors.primary, fontSize: 12 }}>Relive this memory →</KamiText>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </ImageBackground>
          )}

          {/* ── 7 & 8. WIDGETS ROW SPLIT ────────────────── */}
          <View style={hsStyles.widgetsSplitRow}>
            {/* Latest Letter Excerpt Widget */}
            <View style={hsStyles.tornPaperWidget}>
              <View style={hsStyles.widgetTopRow}>
                <KamiText style={hsStyles.widgetHeader} bold>Latest Letter</KamiText>
                <Text style={{ fontSize: 13 }}>✉️</Text>
              </View>
              {letterExcerpt ? (
                <View style={{ gap: Space[2], flex: 1 }}>
                  <View style={hsStyles.toLabelRow}>
                    <Text style={{ fontSize: 10 }}>❤️</Text>
                    <KamiText style={hsStyles.toLabelText} bold>To: My Love</KamiText>
                  </View>
                  <KamiText style={hsStyles.letterExcerptText}>
                    {letterExcerpt}
                  </KamiText>
                  <KamiText style={hsStyles.letterWrittenText}>
                    {letterTimeAgo}
                  </KamiText>
                </View>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', paddingVertical: Space[2] }}>
                  <KamiText style={{ fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 16 }}>
                    No letters opened yet. Write a time capsule to surprise your partner!
                  </KamiText>
                </View>
              )}
              <TouchableOpacity 
                style={hsStyles.widgetFooterCta}
                onPress={() => navigation.navigate('Future')}
              >
                <KamiText style={[hsStyles.widgetCtaText, { color: colors.primary }]} bold>
                  {letterExcerpt ? 'Read Letter →' : 'Write Letter →'}
                </KamiText>
              </TouchableOpacity>
            </View>

            {/* Our Goal Widget Card */}
            <View style={hsStyles.goalWidgetCard}>
              <View style={hsStyles.widgetTopRow}>
                <KamiText style={hsStyles.widgetHeader} bold>Our Goal</KamiText>
                <Text style={{ fontSize: 13 }}>🏔</Text>
              </View>
              {goalTitle ? (
                <>
                  <View style={{ gap: 2 }}>
                    <KamiText style={hsStyles.goalWidgetTitle} bold>{goalTitle}</KamiText>
                    <KamiText style={hsStyles.goalWidgetDaysLeft}>{goalTimeRemainingText}</KamiText>
                  </View>
                  
                  <View style={hsStyles.goalWidgetMiddle}>
                    <View style={hsStyles.avatarOverlapRow}>
                      {user?.avatarUrl ? (
                        <Image source={{ uri: user.avatarUrl }} style={hsStyles.widgetOverlapAvatar} />
                      ) : (
                        <View style={[hsStyles.widgetOverlapAvatar, { backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 9, color: colors.primary, fontWeight: 'bold' }}>{initial(name)}</Text>
                        </View>
                      )}
                      {partner?.avatarUrl ? (
                        <Image source={{ uri: partner.avatarUrl }} style={[hsStyles.widgetOverlapAvatar, { marginLeft: -12 }]} />
                      ) : (
                        <View style={[hsStyles.widgetOverlapAvatar, { marginLeft: -12, backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 9, color: colors.primary, fontWeight: 'bold' }}>{initial(partnerName)}</Text>
                        </View>
                      )}
                    </View>
                    {latestCoupleGoal && (latestCoupleGoal as any).imageUrl ? (
                      <Image source={{ uri: (latestCoupleGoal as any).imageUrl }} style={hsStyles.widgetGoalImage} />
                    ) : (
                      <View style={[hsStyles.widgetGoalImagePlaceholder, { backgroundColor: colors.creamDeep, width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 16 }}>{getGoalPlantEmoji(goalProgress)}</Text>
                      </View>
                    )}
                  </View>

                  <View style={hsStyles.goalWidgetProgressRow}>
                    <KamiText style={hsStyles.progressPercentText} bold>{goalProgress}% Complete</KamiText>
                    <View style={hsStyles.progressBarTrack}>
                      <View style={[hsStyles.progressBarFill, { width: `${goalProgress}%` as any, backgroundColor: colors.primary }]} />
                    </View>
                  </View>
                </>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', paddingVertical: Space[2] }}>
                  <KamiText style={{ fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 16 }}>
                    No active shared goals. Create one to track milestones together!
                  </KamiText>
                </View>
              )}

              <TouchableOpacity 
                style={hsStyles.widgetFooterCta}
                onPress={() => navigation.navigate('Goals')}
              >
                <KamiText style={[hsStyles.widgetCtaText, { color: colors.primary }]} bold>
                  {goalTitle ? 'View Goal →' : 'Add Goal →'}
                </KamiText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Today's Daily Question (Retained functionality, styled nicely) */}
          {todayQuestion && (
            <View style={[s.card, { borderColor: colors.primary + '33', marginTop: Space[4] }]}>
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

          <View style={{ height: Space[10] }} />
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

const hsStyles = StyleSheet.create({
  // Alerts stack
  alertsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    right: 20,
    left: 20,
    zIndex: 9999,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Radii.card,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    borderWidth: 1.5,
    borderColor: 'rgba(201, 104, 130, 0.25)', // primary light Rose
    ...Shadows.md,
    gap: Space[3],
  },
  alertEmoji: {
    fontSize: 24,
  },
  alertTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  alertMsg: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  alertClose: {
    padding: Space[1],
  },

  // 1. Floating Island Header Styles
  floatingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Space[5],
    marginTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[3],
    marginBottom: Space[3],
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(201, 104, 130, 0.12)',
    ...Shadows.md,
    elevation: 3,
  },
  headerAvatarGroup: {
    flexDirection: 'row',
    position: 'relative',
    width: 58,
    height: 38,
    alignItems: 'center',
  },
  headerUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  headerUserAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  headerPartnerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    position: 'absolute',
    left: 18,
    zIndex: 2,
  },
  headerPartnerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 18,
    zIndex: 2,
  },
  headerOnlineBadge: {
    position: 'absolute',
    bottom: 1,
    right: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 3,
  },
  headerBrand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandLogo: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FontFamily.display,
    letterSpacing: 1,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  headerMetaText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  headerActionsRow: {
    flexDirection: 'row',
    gap: Space[2],
  },
  headerActionCircle: {
    position: 'relative',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(201, 104, 130, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    elevation: 2,
  },
  headerActionBadgeDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },

  // 2. Live Presence Card Styles
  livePresenceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: Radii.full,
    paddingVertical: Space[2],
    paddingHorizontal: Space[4],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...Shadows.sm,
    elevation: 2,
    marginHorizontal: Space[5],
    marginBottom: Space[2],
  },
  livePresenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    flex: 1,
  },
  liveGreenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  presenceTitle: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  presenceSub: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 1,
  },
  presenceViewBtn: {
    paddingVertical: Space[1] + 2,
    paddingHorizontal: Space[4],
    borderRadius: Radii.full,
  },

  // 3. Today's Moment (Hero Card)
  heroCardImage: {
    height: 290,
    marginHorizontal: Space[5],
    borderRadius: 24,
    overflow: 'hidden',
    ...Shadows.md,
    elevation: 6,
    marginBottom: Space[4],
  },
  heroOverlay: {
    flex: 1,
    padding: Space[5],
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
  },
  heroBadgeText: {
    fontSize: 9,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroMailBadge: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroUnreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  heroUnreadText: {
    fontSize: 9,
    color: '#fff',
  },
  heroContentBottom: {
    gap: 1,
  },
  heroTitleText: {
    fontSize: 22,
    color: '#fff',
    fontFamily: FontFamily.display,
  },
  heroTitleScript: {
    fontSize: 34,
    fontFamily: FontFamily.display,
    fontStyle: 'italic',
    marginTop: -4,
  },
  heroTimeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginVertical: Space[2],
  },
  heroCtaBtn: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Radii.full,
    alignSelf: 'flex-start',
    ...Shadows.sm,
    elevation: 3,
  },

  // 4. Quick Actions Grid Styles
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: Space[5],
    marginBottom: Space[5],
    paddingVertical: Space[1],
  },
  quickCardCol: {
    alignItems: 'center',
    gap: 6,
  },
  quickIconBg: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    elevation: 2,
  },
  quickCardLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },

  // 5. Our Journey Timeline
  journeySection: {
    marginBottom: Space[5],
  },
  journeyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Space[5],
    marginBottom: Space[3],
  },
  journeyTitle: {
    fontFamily: FontFamily.display,
  },
  journeyScrollWrap: {
    position: 'relative',
    height: 120,
  },
  journeyScroll: {
    paddingHorizontal: Space[5],
    alignItems: 'center',
    gap: Space[6],
  },
  journeyDashedLine: {
    position: 'absolute',
    top: 28,
    left: Space[10],
    right: Space[10],
    height: 2,
    borderWidth: 1,
    borderColor: 'rgba(201, 104, 130, 0.25)',
    borderStyle: 'dashed',
    zIndex: -1,
  },
  journeyNodeCol: {
    alignItems: 'center',
    width: 80,
    gap: 4,
  },
  journeyNodeCircle: {
    position: 'relative',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: 'rgba(201, 104, 130, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    elevation: 2,
  },
  journeyNodeSmallIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  journeyNodeText: {
    fontSize: 9,
    color: Colors.textPrimary,
    lineHeight: 11,
  },
  journeyNodeTime: {
    fontSize: 8,
    color: Colors.textMuted,
  },

  // 6. Memory Flashback Card Styles
  flashbackCardBg: {
    height: 310,
    marginHorizontal: Space[5],
    borderRadius: 24,
    overflow: 'hidden',
    ...Shadows.md,
    elevation: 5,
    marginBottom: Space[5],
  },
  flashbackOverlay: {
    flex: 1,
    padding: Space[5],
    justifyContent: 'space-between',
  },
  flashbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: Radii.full,
    alignSelf: 'flex-start',
  },
  flashbackBadgeText: {
    fontSize: 10,
    color: '#fff',
  },
  flashbackContentBottom: {
    gap: 2,
  },
  flashbackTitleText: {
    fontSize: 22,
    color: '#fff',
    fontFamily: FontFamily.display,
    lineHeight: 28,
  },
  flashbackDescText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: Space[3],
  },
  flashbackCta: {
    backgroundColor: '#fff',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radii.full,
    alignSelf: 'flex-start',
    ...Shadows.sm,
    elevation: 2,
  },

  // 7 & 8. Widgets Split Row Styles
  widgetsSplitRow: {
    flexDirection: 'row',
    gap: Space[4],
    marginHorizontal: Space[5],
    marginBottom: Space[5],
  },
  tornPaperWidget: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: Space[4],
    borderWidth: 1.5,
    borderColor: 'rgba(201, 104, 130, 0.15)',
    borderStyle: 'dashed',
    ...Shadows.sm,
    elevation: 2,
    justifyContent: 'space-between',
    minHeight: 180,
  },
  widgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  widgetHeader: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  toLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  toLabelText: {
    fontSize: 9,
    textTransform: 'uppercase',
    color: 'rgba(201, 104, 130, 0.75)',
    letterSpacing: 0.5,
  },
  letterExcerptText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  letterWrittenText: {
    fontSize: 8,
    color: Colors.textMuted,
    marginTop: 2,
  },
  widgetFooterCta: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: 8,
    marginTop: 6,
  },
  widgetCtaText: {
    fontSize: 11,
  },
  goalWidgetCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: Space[4],
    borderWidth: 1,
    borderColor: Colors.border + '55',
    ...Shadows.sm,
    elevation: 2,
    justifyContent: 'space-between',
    minHeight: 180,
  },
  goalWidgetTitle: {
    fontSize: 14,
    fontFamily: FontFamily.display,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  goalWidgetDaysLeft: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  goalWidgetMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Space[1],
  },
  avatarOverlapRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetOverlapAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: '#eee',
  },
  widgetGoalImage: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  goalWidgetProgressRow: {
    gap: 4,
    marginVertical: 4,
  },
  progressPercentText: {
    fontSize: 9,
    color: Colors.textSecondary,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  couplePhotoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineStatusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 2,
  },
  emptyJourneyBox: {
    padding: Space[5],
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(201, 104, 130, 0.15)',
    borderStyle: 'dashed',
    marginHorizontal: Space[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetGoalImagePlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const AlertPopup: React.FC<{
  alert: { id: string; type: string; title: string; message: string; targetScreen: string };
  onDismiss: (id: string) => void;
  navigation: any;
}> = ({ alert, onDismiss, navigation }) => {
  const transX = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(transX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();

    const timer = setTimeout(() => {
      dismiss();
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(transX, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      onDismiss(alert.id);
    });
  };

  const handlePress = () => {
    if (alert.targetScreen) {
      navigation.navigate(alert.targetScreen);
    }
    dismiss();
  };

  const getEmoji = (type: string) => {
    switch (type) {
      case 'letter': return '💌';
      case 'goal': return '🎯';
      case 'memory': return '📝';
      case 'reaction': return '❤️';
      case 'completed_goal': return '🎉';
      default: return '✨';
    }
  };

  return (
    <Animated.View style={{ transform: [{ translateX: transX }], opacity, marginBottom: 8 }}>
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={hsStyles.alertCard}>
        <Text style={hsStyles.alertEmoji}>{getEmoji(alert.type)}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={hsStyles.alertTitle}>{alert.title}</Text>
          <Text style={hsStyles.alertMsg} numberOfLines={2}>{alert.message}</Text>
        </View>
        <TouchableOpacity onPress={dismiss} style={hsStyles.alertClose}>
          <Text style={{ color: Colors.textMuted, fontSize: 14 }}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};
