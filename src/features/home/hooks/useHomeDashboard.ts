import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Animated, AppState, Keyboard, Platform } from 'react-native';
import { useAuthStore, useAuthActions } from '@features/auth';
import { useHome } from './useHome';
import { useHomeStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { resolveImageUri } from '@shared/lib/storage/imageResolver';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import * as futureService from '@infrastructure/home/futureService';
import type { Letter } from '@features/home/types';

export interface DurationData {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const MOODS = [
  { id: 'joyful', emoji: '✨', label: 'Joyful' },
  { id: 'calm', emoji: '🌸', label: 'Calm' },
  { id: 'hopeful', emoji: '🌅', label: 'Hopeful' },
  { id: 'grateful', emoji: '🌺', label: 'Grateful' },
  { id: 'reflective', emoji: '🌙', label: 'Reflective' },
  { id: 'tired', emoji: '☁️', label: 'Tired' },
  { id: 'anxious', emoji: '🌊', label: 'Anxious' },
  { id: 'sad', emoji: '🍂', label: 'Sad' },
];

export function getRelationshipDuration(anniversaryDate: string | null): string {
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

export function getDaysUntilAnniversary(anniversaryDate: string | null): number | null {
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

export function getDetailedDurationObj(anniversaryDate: string | null, fallbackDate: string): DurationData {
  const start = new Date(anniversaryDate || fallbackDate);
  const now = new Date();
  let diffMs = now.getTime() - start.getTime();
  if (diffMs < 0) {
    return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonth;
    months--;
  }
  if (months < 0) {
    months += 12;
    years--;
  }

  let hours = now.getHours() - start.getHours();
  let minutes = now.getMinutes() - start.getMinutes();
  let seconds = now.getSeconds() - start.getSeconds();

  if (seconds < 0) {
    seconds += 60;
    minutes--;
  }
  if (minutes < 0) {
    minutes += 60;
    hours--;
  }
  if (hours < 0) {
    hours += 24;
    days--;
    if (days < 0) {
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days += prevMonth;
      months--;
      if (months < 0) {
        months += 12;
        years--;
      }
    }
  }

  return { years, months, days, hours, minutes, seconds };
}

export function getDetailedDuration(anniversaryDate: string | null, fallbackDate: string): string {
  const start = new Date(anniversaryDate || fallbackDate);
  const now = new Date();
  let diffMs = now.getTime() - start.getTime();
  if (diffMs < 0) return 'Connected';

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonth;
    months--;
  }
  if (months < 0) {
    months += 12;
    years--;
  }

  let hours = now.getHours() - start.getHours();
  let minutes = now.getMinutes() - start.getMinutes();
  let seconds = now.getSeconds() - start.getSeconds();

  if (seconds < 0) {
    seconds += 60;
    minutes--;
  }
  if (minutes < 0) {
    minutes += 60;
    hours--;
  }
  if (hours < 0) {
    hours += 24;
    days--;
    if (days < 0) {
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days += prevMonth;
      months--;
      if (months < 0) {
        months += 12;
        years--;
      }
    }
  }

  const parts = [];
  if (years > 0) parts.push(`${years} Year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
  parts.push(`${hours} Hour${hours > 1 ? 's' : ''}`);
  parts.push(`${minutes} Minute${minutes > 1 ? 's' : ''}`);
  parts.push(`${seconds} Second${seconds > 1 ? 's' : ''}`);

  return parts.join(' • ');
}

export function getNextEventCountdown(couple: any, coupleLetters: any[]): string {
  const now = new Date();

  // Find next locked letter
  const lockedLetters = coupleLetters
    .filter(l => !l.isDraft && !l.isArchived && new Date(l.deliverAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime());

  if (lockedLetters.length > 0) {
    const nextLetter = lockedLetters[0];
    const diffMs = new Date(nextLetter.deliverAt).getTime() - now.getTime();

    const sec = Math.floor(diffMs / 1000) % 60;
    const min = Math.floor(diffMs / (1000 * 60)) % 60;
    const hr = Math.floor(diffMs / (1000 * 60 * 60)) % 24;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hr > 0) parts.push(`${hr}h`);
    if (min > 0) parts.push(`${min}m`);
    parts.push(`${sec}s`);

    return `Next letter unlocks in ${parts.join(' ')} 🔒`;
  }

  // Fallback: next anniversary
  if (couple.anniversaryDate) {
    const ann = new Date(couple.anniversaryDate);
    let nextAnn = new Date(now.getFullYear(), ann.getMonth(), ann.getDate());
    if (nextAnn.getTime() < now.getTime()) {
      nextAnn.setFullYear(now.getFullYear() + 1);
    }
    const diffMs = nextAnn.getTime() - now.getTime();
    const days = Math.ceil(diffMs / 86400000);
    return `Anniversary in ${days} day${days > 1 ? 's' : ''} ❤️`;
  }

  return '';
}

export function greetingTime(timezone?: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: 'numeric',
      hour12: false
    });
    const h = parseInt(formatter.format(new Date()), 10);
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  } catch (e) {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
}

export function firstName(nickname?: string, email?: string) {
  if (nickname?.trim()) return nickname.trim().split(' ')[0];
  if (email?.includes('@')) return email.split('@')[0];
  return 'there';
}

export function initial(name: string) {
  return name.slice(0, 1).toUpperCase() || 'K';
}

export function daysSince(iso?: string) {
  if (!iso) return 1;
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function checkUnlocked(l: { deliverAt: string }) {
  return Date.now() >= new Date(l.deliverAt).getTime();
}

export function useHomeDashboard(navigation: any) {
  const user = useAuthStore((s) => s.user);
  const { todayMood, recentMoods, streak, journalEntries, goals, todayPrompt, promptResponse } =
    useHomeStore(useShallow((s) => ({
      todayMood: s.todayMood,
      recentMoods: s.recentMoods,
      streak: s.streak,
      journalEntries: s.journalEntries,
      goals: s.goals,
      todayPrompt: s.todayPrompt,
      promptResponse: s.promptResponse,
    })));
  const { logMood, refresh } = useHome();

  const name = firstName(user?.nickname, user?.email);
  const daysIn = daysSince((user as any)?.createdAt);

  const [pending, setPending] = useState<typeof MOODS[0] | null>(null);
  const [moodModal, setMoodModal] = useState(false);
  const [moodSaving, setMoodSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [durationText, setDurationText] = useState('');
  const [durationObj, setDurationObj] = useState<DurationData | null>(null);
  const [nextEventText, setNextEventText] = useState('');
  const [customMoodModalVisible, setCustomMoodModalVisible] = useState(false);
  const [customMoodSaving, setCustomMoodSaving] = useState(false);
  const [resolvedHeroBg, setResolvedHeroBg] = useState<string | null>(null);
  const [resolvedFlashbackImage, setResolvedFlashbackImage] = useState<string>('https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600&auto=format&fit=crop');

  const { updateProfile } = useAuthActions();

  // Couple Space Hooks & State
  const {
    couple, partner, todayQuestion, dailyAnswers, coupleJournals, coupleGoals, relationshipEvents, coupleMemories,
    homeAlerts, removeHomeAlert, partnerAction, coupleLetters
  } = useCoupleStore();
  const { loadAll: loadCoupleAll, submitAnswer } = useCouple();

  useEffect(() => {
    const rawBgUrl = user?.activeSpace === 'couple' ? couple?.heroBgUrl : user?.heroBgUrl;
    if (rawBgUrl) {
      resolveImageUri(rawBgUrl, 'avatars')
        .then((result) => {
          if (result.uri) {
            setResolvedHeroBg(result.uri);
          }
        })
        .catch((err) => console.error('Failed to resolve hero background URL:', err));
    } else {
      setResolvedHeroBg(null);
    }
  }, [user?.activeSpace, user?.heroBgUrl, couple?.heroBgUrl]);

  const [answerInput, setAnswerInput] = useState('');
  const [submittingAnswerState, setSubmittingAnswerState] = useState(false);
  const [loveSending, setLoveSending] = useState(false);
  const [isFocused, setIsFocused] = useState(navigation.isFocused());
  const [questionAnswering, setQuestionAnswering] = useState(false);

  const [carouselWidth, setCarouselWidth] = useState(0);
  const [activeLetterSlide, setActiveLetterSlide] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);

  const [personalLetters, setPersonalLetters] = useState<Letter[]>([]);
  const [personalLettersLoading, setPersonalLettersLoading] = useState(false);
  const [activePersonalLetterSlide, setActivePersonalLetterSlide] = useState(0);
  const [personalCarouselWidth, setPersonalCarouselWidth] = useState(0);

  const loadPersonalLetters = useCallback(async () => {
    setPersonalLettersLoading(true);
    const r = await futureService.fetchLetters();
    setPersonalLettersLoading(false);
    if (r.success) {
      setPersonalLetters(r.data);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => setAppState(status));
    return () => sub.remove();
  }, []);

  const handleLetterScroll = (event: any) => {
    const slideWidth = event.nativeEvent.layoutMeasurement.width;
    if (slideWidth > 0) {
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.round(offset / slideWidth);
      setActiveLetterSlide(index);
    }
  };

  const handlePersonalLetterScroll = (event: any) => {
    const slideWidth = event.nativeEvent.layoutMeasurement.width;
    if (slideWidth > 0) {
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.round(offset / slideWidth);
      setActivePersonalLetterSlide(index);
    }
  };

  // Trigger periodic tick to refresh online status calculations locally
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (user?.activeSpace !== 'couple' || !isFocused) return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // tick every 30s
    return () => clearInterval(interval);
  }, [user?.activeSpace, isFocused]);

  useEffect(() => {
    if (user?.activeSpace !== 'couple' || !couple || !isFocused) return;

    const updateTimer = () => {
      setDurationObj(getDetailedDurationObj(couple.anniversaryDate, couple.createdAt));
      setDurationText(getDetailedDuration(couple.anniversaryDate, couple.createdAt));
      setNextEventText(getNextEventCountdown(couple, coupleLetters));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [user?.activeSpace, couple, coupleLetters, isFocused]);

  // Focus listener to refresh data automatically when user comes to this screen
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
      if (user?.activeSpace === 'couple') {
        loadCoupleAll();
      } else {
        refresh();
        loadPersonalLetters();
      }
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, user?.activeSpace, loadCoupleAll, refresh, loadPersonalLetters]);

  // Real-time ephemeral broadcast status when answering today's daily question
  useEffect(() => {
    if (user?.activeSpace !== 'couple' || !couple?.id || !user?.id) return;
    if (isFocused) {
      if (questionAnswering) {
        useCoupleStore.getState().setMyActiveAction('answering_question');
        broadcastPartnerAction(couple.id, user.id, 'answering_question');
      } else {
        const store = useCoupleStore.getState();
        const cleared = store.clearMyActiveAction('answering_question');
        if (cleared) {
          broadcastPartnerAction(couple.id, user.id, 'idle');
        }
      }
    } else {
      const store = useCoupleStore.getState();
      const cleared = store.clearMyActiveAction('answering_question');
      if (cleared) {
        broadcastPartnerAction(couple.id, user.id, 'idle');
      }
    }
  }, [isFocused, questionAnswering, user?.activeSpace, couple?.id, user?.id]);

  // Initial load
  useEffect(() => {
    if (user?.activeSpace === 'couple') {
      loadCoupleAll();
    } else {
      loadPersonalLetters();
    }
  }, [user?.activeSpace, user?.id, loadCoupleAll, loadPersonalLetters]);

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

  const handleMoodPick = (m: typeof MOODS[0]) => {
    setPending(m);
    setMoodModal(true);
  };

  const handleMoodSave = async (note: string) => {
    if (!pending) return;
    setMoodSaving(true);
    const r = await logMood({ moodId: pending.id, moodEmoji: pending.emoji, moodLabel: pending.label, note: note || undefined });
    setMoodSaving(false);
    setMoodModal(false);
    if (!r.success) Alert.alert('Kami', r.error);
  };

  const handleCustomMoodSave = async (emoji: string, text: string) => {
    setCustomMoodSaving(true);
    try {
      await updateProfile({ currentMoodEmoji: emoji, currentMoodLabel: text || 'Custom Status' });
      Alert.alert('Status Updated 🔮', `Your partner will see your status: ${emoji} ${text || 'Custom Status'}`);
      setCustomMoodModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update custom status');
    } finally {
      setCustomMoodSaving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (user?.activeSpace === 'couple') {
      await loadCoupleAll();
    } else {
      await Promise.all([
        refresh(),
        loadPersonalLetters(),
      ]);
    }
    setRefreshing(false);
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedToday = goals.filter(g => g.progress === 100).length;

  const activeCoupleGoals = coupleGoals.filter(g => g.status === 'active');

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
  const bothAnswered = !!(myAnswer && partnerAnswer);

  const relationshipDays = couple?.anniversaryDate
    ? Math.max(1, Math.ceil((Date.now() - new Date(couple.anniversaryDate).getTime()) / 86400000))
    : 1;

  const daysUntilAnniversary = getDaysUntilAnniversary(couple?.anniversaryDate ?? null);

  const getGoalPlantEmoji = (progress: number) => {
    if (progress < 30) return '🌱';
    if (progress < 100) return '🌿';
    return '🌸';
  };

  // Calculate unread letters count
  const unreadLettersCount = useMemo(() => {
    if (!user?.id) return 0;
    return coupleLetters.filter(l => l.senderId !== user.id && !l.isRead && l.isUnlocked).length;
  }, [coupleLetters, user?.id]);

  // Helper for relative time ago
  const getTimeAgo = useCallback((date: Date | string): string => {
    const ms = Date.now() - new Date(date).getTime();
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (day > 0) return `${day}d ago`;
    if (hr > 0) return `${hr}h ago`;
    if (min > 0) return `${min}m ago`;
    return 'Just now';
  }, []);

  // Extract dynamic timeline events based on actual data
  interface TimelineEvent {
    id: string;
    type: string;
    title: string;
    description?: string;
    time: string;
    icon: string;
    date: Date;
  }

  const dynamicTimeline = useMemo(() => {
    const list: TimelineEvent[] = [];
    if (!user?.id) return list;

    const getMemberName = (id: string) => {
      if (id === user.id) return 'You';
      if (id === partner?.id) return partnerName;
      return 'Someone';
    };

    // Add couple letters
    coupleLetters.forEach(l => {
      if (l.isDraft) return; // ignore drafts
      const senderName = getMemberName(l.senderId);
      const isLocked = !checkUnlocked(l);
      list.push({
        id: `letter-${l.id}`,
        type: 'letter',
        title: isLocked
          ? `${senderName} sent a sealed letter 🔒`
          : `${senderName} sent a letter: "${l.subject || 'No Subject'}"`,
        description: isLocked
          ? `Unlocks in the future`
          : (l.body ? (l.body.length > 60 ? `${l.body.substring(0, 57)}...` : l.body) : undefined),
        time: getTimeAgo(l.createdAt),
        icon: isLocked ? '🔒' : '✉️',
        date: new Date(l.createdAt),
      });

      // Reactions on this letter
      if (l.reactions && Array.isArray(l.reactions)) {
        l.reactions.forEach((rx, idx) => {
          const rxName = getMemberName(rx.userId);
          list.push({
            id: `letter-rx-${l.id}-${rx.userId}-${idx}`,
            type: 'reaction',
            title: `${rxName} reacted ${rx.emoji} to a letter`,
            description: isLocked ? 'Reacted to a locked letter' : `"${l.subject || 'No Subject'}"`,
            time: getTimeAgo(l.createdAt),
            icon: rx.emoji,
            date: new Date(l.createdAt),
          });
        });
      }
    });

    // Add couple memories
    coupleMemories.forEach(m => {
      list.push({
        id: `memory-${m.id}`,
        type: 'memory',
        title: `New memory shared: "${m.title}"`,
        description: m.description || undefined,
        time: getTimeAgo(m.memoryDate || m.createdAt),
        icon: '📸',
        date: new Date(m.memoryDate || m.createdAt),
      });
    });

    // Add couple goals
    coupleGoals.forEach(g => {
      list.push({
        id: `goal-${g.id}`,
        type: 'goal',
        title: g.status === 'completed' ? `Shared goal completed! 🎉` : `New shared goal set`,
        description: `"${g.title}" — ${g.progress}% complete`,
        time: getTimeAgo(g.completedAt || g.createdAt),
        icon: g.status === 'completed' ? '🎉' : g.emoji || '🎯',
        date: new Date(g.completedAt || g.createdAt),
      });
    });

    // Add couple journals
    coupleJournals.forEach(j => {
      const jAuthor = getMemberName(j.userId);
      list.push({
        id: `journal-${j.id}`,
        type: 'journal',
        title: `${jAuthor} wrote a journal entry: "${j.title || 'Untitled'}"`,
        description: j.body ? (j.body.length > 60 ? `${j.body.substring(0, 57)}...` : j.body) : undefined,
        time: getTimeAgo(j.entryDate || j.createdAt),
        icon: '📓',
        date: new Date(j.entryDate || j.createdAt),
      });

      // Reactions on journal
      if (j.reactions && Array.isArray(j.reactions)) {
        j.reactions.forEach((rx, idx) => {
          const rxName = getMemberName(rx.userId);
          list.push({
            id: `journal-rx-${j.id}-${rx.userId}-${idx}`,
            type: 'reaction',
            title: `${rxName} reacted ${rx.emoji} to a journal entry`,
            description: `"${j.title || 'Untitled'}"`,
            time: getTimeAgo(j.createdAt),
            icon: rx.emoji,
            date: new Date(j.createdAt),
          });
        });
      }

      // Comments on journal
      if (j.comments && Array.isArray(j.comments)) {
        j.comments.forEach((c) => {
          const cName = getMemberName(c.userId);
          list.push({
            id: `journal-comment-${c.id}`,
            type: 'comment',
            title: `${cName} commented on a journal entry`,
            description: `"${c.body}"`,
            time: getTimeAgo(c.createdAt),
            icon: '💬',
            date: new Date(c.createdAt),
          });
        });
      }
    });

    // Add daily answers
    const bothAnsweredLocal = dailyAnswers.find(a => a.userId === user?.id) && dailyAnswers.find(a => a.userId === partner?.id);
    dailyAnswers.forEach(a => {
      const aName = getMemberName(a.userId);
      list.push({
        id: `answer-${a.id}`,
        type: 'answer',
        title: `${aName} answered today's Daily Reflection`,
        description: bothAnsweredLocal ? `"${a.response}"` : `Answer is hidden until you both respond`,
        time: getTimeAgo(a.createdAt),
        icon: '💭',
        date: new Date(a.createdAt),
      });
    });

    // Sort chronologically (newest first)
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [coupleLetters, coupleMemories, coupleGoals, coupleJournals, dailyAnswers, user?.id, partner?.id, partnerName, tick, getTimeAgo]);

  // Filter and sort letters for carousel (unlocked or sealed, non-draft, non-archived)
  const lettersForSlide = useMemo(() => {
    return coupleLetters
      .filter(l => !l.isDraft && !l.isArchived)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [coupleLetters]);

  const friendlyDaysUntil = (iso: string) => {
    const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
    if (d <= 0) return 'Unlocked ✨';
    if (d === 1) return 'Tomorrow';
    return `${d} days left`;
  };

  // Dynamic Latest Active Goal details
  const latestCoupleGoal = useMemo(() => {
    const activeCoupleGoalsList = coupleGoals.filter(g => g.status === 'active');
    return activeCoupleGoalsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }, [coupleGoals]);

  const goalTitle = latestCoupleGoal ? latestCoupleGoal.title : null;
  const goalProgress = latestCoupleGoal ? latestCoupleGoal.progress : 0;
  const goalTimeRemainingText = useMemo(() => {
    return latestCoupleGoal && latestCoupleGoal.targetDate
      ? `${Math.max(1, Math.ceil((new Date(latestCoupleGoal.targetDate).getTime() - Date.now()) / 86400000))} days left ❤️`
      : null;
  }, [latestCoupleGoal]);

  // Dynamic Flashback Memory details
  const flashbackMemory = useMemo(() => {
    if (coupleMemories.length === 0) return null;
    const dayIndex = Math.floor(Date.now() / 86400000);
    const index = dayIndex % coupleMemories.length;
    return coupleMemories[index];
  }, [coupleMemories]);

  const flashbackTitle = flashbackMemory ? flashbackMemory.title : '';
  const flashbackDesc = useMemo(() => {
    if (!flashbackMemory || !flashbackMemory.description) return '';
    return flashbackMemory.description.length > 70
      ? `${flashbackMemory.description.substring(0, 67)}...`
      : flashbackMemory.description;
  }, [flashbackMemory]);

  useEffect(() => {
    const rawImage = flashbackMemory && flashbackMemory.imageUrls && flashbackMemory.imageUrls.length > 0
      ? flashbackMemory.imageUrls[0]
      : null;

    if (rawImage) {
      if (rawImage.startsWith('http') || rawImage.startsWith('file://') || rawImage.startsWith('content://')) {
        setResolvedFlashbackImage(rawImage);
      } else {
        resolveImageUri(rawImage, 'couple_memory_images')
          .then((result) => {
            if (result.uri) {
              setResolvedFlashbackImage(result.uri);
            } else {
              setResolvedFlashbackImage('https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600&auto=format&fit=crop');
            }
          })
          .catch((err) => {
            console.error('Failed to resolve flashback memory URL:', err);
            setResolvedFlashbackImage('https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600&auto=format&fit=crop');
          });
      }
    } else {
      setResolvedFlashbackImage('https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600&auto=format&fit=crop');
    }
  }, [flashbackMemory]);

  // Presence mapping description
  const getPresenceDescription = () => {
    switch (partnerAction) {
      case 'writing_letter': return `${partnerName} is writing a letter... ✍️`;
      case 'editing_draft': return `${partnerName} is editing a draft... ✍️`;
      case 'reading_memories': return `${partnerName} is viewing memories... 📸`;
      case 'creating_goal': return `${partnerName} is composing a goal... 🎯`;
      case 'editing_goal': return `${partnerName} is updating a goal... 🎯`;
      case 'reading_letter': return `${partnerName} is reading your letter... ❤️`;
      case 'writing_journal': return `${partnerName} is writing journal... 📓`;
      case 'answering_prompt': return `${partnerName} is answering a prompt... 💭`;
      case 'commenting_journal': return `${partnerName} is leaving a comment... 💬`;
      case 'sending_love': return `${partnerName} sent you love! ❤️`;
      case 'writing_memory': return `${partnerName} is sharing a memory... 📸`;
      case 'viewing_memory': return `${partnerName} is viewing a memory... 📸`;
      case 'reading_journal': return `${partnerName} is reading journal... 📓`;
      case 'viewing_goals': return `${partnerName} is viewing goals... 🎯`;
      case 'viewing_letters': return `${partnerName} is viewing letters... ✉️`;
      case 'answering_question': return `${partnerName} is answering today's question... 💕`;
      default: return isPartnerOnline ? `${partnerName} is online` : '';
    }
  };

  const heroContent = useMemo(() => {
    if (!user?.id) return { title: 'Seal a memory', script: 'for the future ✨', time: 'No letters written yet', cta: 'Write Letter →' };

    // 1. Unlocked & Unread letters from partner
    const unreadLetter = coupleLetters
      .filter(l => l.senderId !== user.id && l.isUnlocked && !l.isRead && !l.isDraft && !l.isArchived)
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
      .filter(l => l.senderId !== user.id && l.isUnlocked && l.isRead && !l.isDraft && !l.isArchived)
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
      .filter(l => l.senderId !== user.id && !l.isUnlocked && !l.isDraft && !l.isArchived)
      .sort((a, b) => new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime())[0];
    if (lockedLetter) {
      return {
        title: 'Future Letter',
        script: 'is locked 🔒',
        time: `Unlocks on ${new Date(lockedLetter.deliverAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: user.timezone ?? 'UTC' })}`,
        cta: 'View Scheduled →',
      };
    }

    // 4. Any letter by current user (drafts, scheduled, unlocked)
    const myLetter = coupleLetters
      .filter(l => l.senderId === user.id && !l.isArchived)
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
          time: `Unlocks on ${new Date(myLetter.deliverAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: user.timezone ?? 'UTC' })}`,
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
  }, [coupleLetters, user?.id, user?.timezone, getTimeAgo]);

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

  const { shownTimelineEvents, isTimelineScrollable } = useMemo(() => {
    const todayEvents = dynamicTimeline.filter((item: any) => {
      try {
        const itemDate = new Date(item.date);
        const today = new Date();
        return itemDate.getFullYear() === today.getFullYear() &&
          itemDate.getMonth() === today.getMonth() &&
          itemDate.getDate() === today.getDate();
      } catch {
        return false;
      }
    });

    const shown = [
      ...todayEvents,
      ...dynamicTimeline.filter((e: any) => !todayEvents.some((te: any) => te.id === e.id)).slice(0, 3)
    ];
    return {
      shownTimelineEvents: shown,
      isTimelineScrollable: shown.length > 3
    };
  }, [dynamicTimeline]);

  const personalLettersForSlide = useMemo(() => {
    return personalLetters
      .filter(l => !l.isDraft && !l.isArchived)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [personalLetters]);

  return {
    user,
    todayMood,
    recentMoods,
    streak,
    journalEntries,
    goals,
    todayPrompt,
    promptResponse,
    name,
    daysIn,
    pending,
    setPending,
    moodModal,
    setMoodModal,
    moodSaving,
    refreshing,
    durationText,
    durationObj,
    nextEventText,
    customMoodModalVisible,
    setCustomMoodModalVisible,
    customMoodSaving,
    resolvedHeroBg,
    answerInput,
    setAnswerInput,
    submittingAnswerState,
    loveSending,
    isFocused,
    questionAnswering,
    setQuestionAnswering,
    carouselWidth,
    setCarouselWidth,
    activeLetterSlide,
    setActiveLetterSlide,
    personalLetters,
    personalLettersLoading,
    activePersonalLetterSlide,
    setActivePersonalLetterSlide,
    personalCarouselWidth,
    setPersonalCarouselWidth,
    partnerName,
    isPartnerOnline,
    myAnswer,
    partnerAnswer,
    bothAnswered,
    relationshipDays,
    daysUntilAnniversary,
    unreadLettersCount,
    dynamicTimeline,
    lettersForSlide,
    latestCoupleGoal,
    goalTitle,
    goalProgress,
    goalTimeRemainingText,
    flashbackMemory,
    flashbackTitle,
    flashbackDesc,
    flashbackImage: resolvedFlashbackImage,
    personalLettersForSlide,
    activeGoals,
    completedToday,
    activeCoupleGoals,
    shownTimelineEvents,
    isTimelineScrollable,
    y1,
    y2,
    y3,
    y4,
    pulseAnim,
    partnerActionPulse,
    handleLetterScroll,
    handlePersonalLetterScroll,
    handleMoodPick,
    handleMoodSave,
    handleCustomMoodSave,
    handleRefresh,
    handleSendLove,
    couple,
    partner,
    todayQuestion,
    dailyAnswers,
    coupleJournals,
    coupleGoals,
    relationshipEvents,
    coupleMemories,
    homeAlerts,
    removeHomeAlert,
    partnerAction,
    coupleLetters,
    submitAnswer: async (questionId: string, coupleId: string, response: string) => {
      setSubmittingAnswerState(true);
      await submitAnswer(questionId, coupleId, response);
      setAnswerInput('');
      setSubmittingAnswerState(false);
      setQuestionAnswering(false);
    },
    updateProfile,
    friendlyDaysUntil,
    getTimeAgo,
    getPresenceDescription,
    heroContent,
    getGoalPlantEmoji,
  };
}
