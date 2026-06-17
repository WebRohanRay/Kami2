import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import KamiText from '@shared/ui/atoms/KamiText';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import { FontSize, Radii, Shadows, Space } from '@shared/constants';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import { useAuthStore } from '@features/auth';
import { useTheme } from '@shared/hooks';
import { useHomeStore } from '@features/home/store';
import { useShallow } from 'zustand/react/shallow';
import { LinearGradient } from 'expo-linear-gradient';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import type { CoupleLetter, CoupleJournal, CoupleMemory, CoupleGoal, CoupleAnswer, CoupleReaction } from '@features/couple/types';

type TimelineEvent =
  | { id: string; type: 'letter'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleLetter }
  | { id: string; type: 'journal'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleJournal }
  | { id: string; type: 'memory'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleMemory }
  | { id: string; type: 'goal'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleGoal }
  | { id: string; type: 'answer'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleAnswer };

const { width: screenWidth } = Dimensions.get('window');
const timelineCardWidth = screenWidth - 82; // Adjust for guidelines and padding

export default function TimelineScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const user = useAuthStore(s => s.user);

  const {
    couple, partner, todayQuestion, dailyAnswers, coupleJournals, coupleGoals, coupleMemories, partnerAction, coupleLetters
  } = useCoupleStore();
  const { loadAll: loadCoupleAll } = useCouple();

  // Sync state from Zustand
  const { pendingSyncCount, isSyncing } = useHomeStore(
    useShallow((s) => ({
      pendingSyncCount: s.pendingSyncCount,
      isSyncing: s.isSyncing,
    }))
  );

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

  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'letter' | 'journal' | 'memory' | 'goal' | 'answer'>('all');
  const [limit, setLimit] = useState(10);

  const partnerName = partner?.nickname || partner?.email?.split('@')[0] || 'Partner';

  useEffect(() => {
    // Ephemeral action broadcast: user is viewing timeline (reading_memories)
    if (user?.activeSpace === 'couple' && couple?.id && user?.id) {
      useCoupleStore.getState().setMyActiveAction('reading_memories');
      broadcastPartnerAction(couple.id, user.id, 'reading_memories');
    }
    return () => {
      if (user?.activeSpace === 'couple' && couple?.id && user?.id) {
        const store = useCoupleStore.getState();
        const cleared = store.clearMyActiveAction('reading_memories');
        if (cleared) {
          broadcastPartnerAction(couple.id, user.id, 'idle');
        }
      }
    };
  }, [couple?.id, user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCoupleAll();
    setRefreshing(false);
  };

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

  const checkUnlocked = (deliverAtStr: string) => {
    return Date.now() >= new Date(deliverAtStr).getTime();
  };

  const getMemberName = (id: string) => {
    if (id === user?.id) return 'You';
    if (id === partner?.id) return partnerName;
    return 'Someone';
  };

  // Extract all timeline events and memoize them
  const events = useMemo(() => {
    const list: TimelineEvent[] = [];

    // Letters
    coupleLetters.forEach(l => {
      if (l.isDraft) return;
      const isMe = l.senderId === user?.id;
      const senderName = isMe ? 'You' : partnerName;
      const isLocked = !checkUnlocked(l.deliverAt);
      list.push({
        id: `letter-${l.id}`,
        type: 'letter',
        title: isLocked 
          ? `${senderName} sent a sealed capsule letter 🔒`
          : `${senderName} wrote: "${l.subject || 'Love Letter'}"`,
        description: isLocked 
          ? 'Unlocks in the future' 
          : (l.body ? (l.body.length > 100 ? `${l.body.substring(0, 97)}...` : l.body) : undefined),
        time: getTimeAgo(l.createdAt),
        icon: isLocked ? '🔒' : '✉️',
        date: new Date(l.createdAt),
        raw: l,
      });
    });

    // Journals
    coupleJournals.forEach(j => {
      const author = getMemberName(j.userId);
      list.push({
        id: `journal-${j.id}`,
        type: 'journal',
        title: `${author} wrote a journal: "${j.title || 'Untitled'}"`,
        description: j.body ? (j.body.length > 120 ? `${j.body.substring(0, 117)}...` : j.body) : undefined,
        time: getTimeAgo(j.entryDate || j.createdAt),
        icon: '📓',
        date: new Date(j.entryDate || j.createdAt),
        raw: j,
      });
    });

    // Memories
    coupleMemories.forEach(m => {
      list.push({
        id: `memory-${m.id}`,
        type: 'memory',
        title: `Shared memory: "${m.title}"`,
        description: m.description || undefined,
        time: getTimeAgo(m.memoryDate || m.createdAt),
        icon: m.mood || '📸',
        date: new Date(m.memoryDate || m.createdAt),
        raw: m,
      });
    });

    // Goals
    coupleGoals.forEach(g => {
      list.push({
        id: `goal-${g.id}`,
        type: 'goal',
        title: g.status === 'completed' ? `Shared Goal Completed! 🎉` : `New shared goal set`,
        description: `"${g.title}" — progress: ${g.progress}%`,
        time: getTimeAgo(g.completedAt || g.createdAt),
        icon: g.status === 'completed' ? '🎉' : g.emoji || '🎯',
        date: new Date(g.completedAt || g.createdAt),
        raw: g,
      });
    });

    // Question Answers
    dailyAnswers.forEach(a => {
      const responderName = getMemberName(a.userId);
      const bothAnswered = dailyAnswers.find(ans => ans.userId === user?.id) && 
                          dailyAnswers.find(ans => ans.userId === partner?.id);
      list.push({
        id: `answer-${a.id}`,
        type: 'answer',
        title: `${responderName} responded to today's prompt`,
        description: bothAnswered ? `"${a.response}"` : 'Answer is hidden until you both respond',
        time: getTimeAgo(a.createdAt),
        icon: '💭',
        date: new Date(a.createdAt),
        raw: a,
      });
    });

    // Sort newest first
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [coupleLetters, coupleJournals, coupleMemories, coupleGoals, dailyAnswers, partnerName, user?.id]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => filterTab === 'all' || e.type === filterTab);
  }, [events, filterTab]);

  const paginatedEvents = useMemo(() => {
    return filteredEvents.slice(0, limit);
  }, [filteredEvents, limit]);

  // Group events by date/month headers (Indexing & Grouping details)
  const getGroupHeader = useCallback((date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, []);

  const isPartnerOnline = (() => {
    if (!partner?.lastSeenAt) return false;
    const parsedTime = new Date(partner.lastSeenAt).getTime();
    if (isNaN(parsedTime)) return false;
    const diffMs = Date.now() - parsedTime;
    return diffMs >= -5 * 60 * 1000 && diffMs < 5 * 60 * 1000;
  })();

  const presenceDescription = useMemo(() => {
    switch (partnerAction) {
      case 'writing_letter': return `${partnerName} is writing a letter... ✍️`;
      case 'editing_draft': return `${partnerName} is editing a draft... ✍️`;
      case 'reading_memories': return `${partnerName} is viewing timeline... 📸`;
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
  }, [partnerAction, partnerName, isPartnerOnline]);

  const renderCard = useCallback((event: TimelineEvent, displayIndex: number) => {
    switch (event.type) {
      case 'letter': {
        const isLocked = !checkUnlocked(event.raw.deliverAt);
        return (
          <View key={event.id} style={[styles.cardContainer, styles.cardLetter, { borderColor: colors.primaryLight + '55' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <KamiText variant="caption" color={colors.primary} bold style={{ fontSize: 9 }}>
                  LETTER #{displayIndex}
                </KamiText>
              </View>
              <KamiText variant="caption" color={colors.textMuted}>{event.time}</KamiText>
            </View>
            <KamiText variant="label" bold style={[styles.cardTitle, { color: colors.primaryDark }]}>
              {event.title}
            </KamiText>
            {event.description ? (
              <KamiText variant="body" color={colors.textSecondary} style={styles.cardDesc}>
                {event.description}
              </KamiText>
            ) : null}
            {!isLocked && event.raw.imageUrls && event.raw.imageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
                {event.raw.imageUrls.map((url: string, idx: number) => {
                  const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
                  return (
                    <KamiImage
                      key={idx}
                      src={url}
                      thumbnailSrc={thumbUrl}
                      bucket="couple_letter_images"
                      style={styles.photoThumb}
                    />
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity 
              style={[styles.ctaButton, { backgroundColor: colors.primary + '11' }]} 
              onPress={() => navigation.navigate('Future')}
            >
              <KamiText variant="caption" color={colors.primary} bold>
                {isLocked ? 'View Scheduled Lock 🔒' : 'Read Full Letter ›'}
              </KamiText>
            </TouchableOpacity>
          </View>
        );
      }

      case 'journal': {
        return (
          <View key={event.id} style={[styles.cardContainer, styles.cardJournal, { borderLeftColor: colors.accent || '#B591C8', backgroundColor: '#fcfbf9' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: (colors.accent || '#B591C8') + '15' }]}>
                <KamiText variant="caption" color={colors.accent || '#B591C8'} bold style={{ fontSize: 9 }}>
                  JOURNAL #{displayIndex}
                </KamiText>
              </View>
              <KamiText variant="caption" color={colors.textMuted}>{event.time}</KamiText>
            </View>
            <KamiText variant="label" bold style={styles.cardTitle}>
              {event.title}
            </KamiText>
            {event.description ? (
              <View style={styles.journalQuoteContainer}>
                <KamiText variant="body" color={colors.textSecondary} style={styles.journalQuoteText}>
                  "{event.description}"
                </KamiText>
              </View>
            ) : null}
            {event.raw.imageUrls && event.raw.imageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
                {event.raw.imageUrls.map((url: string, idx: number) => {
                  const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
                  return (
                    <KamiImage
                      key={idx}
                      src={url}
                      thumbnailSrc={thumbUrl}
                      bucket="couple_journal_images"
                      style={styles.photoThumb}
                    />
                  );
                })}
              </ScrollView>
            )}
            <View style={styles.metadataRow}>
              {event.raw.reactions && event.raw.reactions.length > 0 && (
                <View style={styles.reactionsGrid}>
                  {event.raw.reactions.map((rx: CoupleReaction, idx: number) => (
                    <Text key={idx} style={{ fontSize: 12 }}>{rx.emoji}</Text>
                  ))}
                </View>
              )}
              {event.raw.comments && event.raw.comments.length > 0 && (
                <KamiText variant="caption" color={colors.textMuted}>
                  💬 {event.raw.comments.length} comments
                </KamiText>
              )}
            </View>
            <TouchableOpacity 
              style={[styles.ctaButton, { backgroundColor: (colors.accent || '#B591C8') + '11' }]} 
              onPress={() => navigation.navigate('Journal')}
            >
              <KamiText variant="caption" color={colors.accent || '#B591C8'} bold>
                Open Journal Feed ›
              </KamiText>
            </TouchableOpacity>
          </View>
        );
      }

      case 'memory': {
        const hasImages = event.raw.imageUrls && event.raw.imageUrls.length > 0;
        return (
          <View key={event.id} style={[styles.cardContainer, styles.cardMemory, { backgroundColor: '#ffffff' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: '#f1f5f9' }]}>
                <KamiText variant="caption" color={colors.textSecondary} bold style={{ fontSize: 9 }}>
                  MEMORY #{displayIndex}
                </KamiText>
              </View>
              <KamiText variant="caption" color={colors.textMuted}>{event.time}</KamiText>
            </View>
            
            <KamiText variant="label" bold style={styles.cardTitle}>
              {event.title}
            </KamiText>
            {event.description ? (
              <KamiText variant="body" color={colors.textSecondary} style={styles.cardDesc}>
                {event.description}
              </KamiText>
            ) : null}
            {event.raw.location ? (
              <View style={styles.metaRowInline}>
                <Text style={{ fontSize: 10 }}>📍</Text>
                <KamiText variant="caption" color={colors.textMuted}>{event.raw.location}</KamiText>
              </View>
            ) : null}

            {/* Polaroid image stack effect in timeline card */}
            {hasImages && (
              <View style={styles.timelinePhotoStackContainer}>
                {event.raw.imageUrls.length > 1 && (
                  <>
                    <View style={[styles.timelinePhotoStackBg, styles.timelinePhotoStackBgSecond, { borderColor: colors.border + '11' }]} />
                    <View style={[styles.timelinePhotoStackBg, styles.timelinePhotoStackBgFirst, { borderColor: colors.border + '11' }]} />
                  </>
                )}
                <View style={[styles.timelinePhotoMainFrame, { borderColor: colors.border + '22' }]}>
                  <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row' }}>
                      {event.raw.imageUrls.map((url: string, idx: number) => {
                        const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
                        return (
                          <KamiImage
                            key={idx}
                            src={url}
                            thumbnailSrc={thumbUrl}
                            bucket="couple_memory_images"
                            style={styles.timelineCardPhoto}
                          />
                        );
                      })}
                    </View>
                  </ScrollView>
                  {event.raw.imageUrls.length > 1 && (
                    <View style={[styles.photoCountBadgeMini, { backgroundColor: colors.primary }]}>
                      <KamiText variant="caption" color="#fff" bold style={{ fontSize: 8 }}>
                        +{event.raw.imageUrls.length - 1}
                      </KamiText>
                    </View>
                  )}
                </View>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.ctaButton, { backgroundColor: '#f1f5f9' }]} 
              onPress={() => navigation.navigate('Memories')}
            >
              <KamiText variant="caption" color={colors.textSecondary} bold>
                View Memory Vault ›
              </KamiText>
            </TouchableOpacity>
          </View>
        );
      }

      case 'goal': {
        const isCompleted = event.raw.status === 'completed';
        const cardBorderColor = isCompleted ? '#6DB88C' : (colors.primaryLight + '44');
        return (
          <View key={event.id} style={[styles.cardContainer, styles.cardGoal, { borderColor: cardBorderColor }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: isCompleted ? '#eefdf4' : '#fff7ed' }]}>
                <KamiText variant="caption" color={isCompleted ? '#16a34a' : '#ea580c'} bold style={{ fontSize: 9 }}>
                  {isCompleted ? 'GOAL COMPLETED 🎉' : `GOAL #${displayIndex}`}
                </KamiText>
              </View>
              <KamiText variant="caption" color={colors.textMuted}>{event.time}</KamiText>
            </View>
            <KamiText variant="label" bold style={[styles.cardTitle, isCompleted && { color: '#15803d' }]}>
              {event.title}
            </KamiText>
            
            <View style={styles.progressSection}>
              <View style={styles.progressMeta}>
                <KamiText variant="caption" color={colors.textSecondary} bold>Milestone progress</KamiText>
                <KamiText variant="caption" color={isCompleted ? '#16a34a' : colors.primary} bold>
                  {event.raw.progress}%
                </KamiText>
              </View>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressFill, 
                  { 
                    width: `${event.raw.progress}%`, 
                    backgroundColor: isCompleted ? '#6DB88C' : colors.primary 
                  }
                ]} />
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.ctaButton, { backgroundColor: isCompleted ? '#eefdf4' : (colors.primary + '11') }]} 
              onPress={() => navigation.navigate('Goals')}
            >
              <KamiText variant="caption" color={isCompleted ? '#15803d' : colors.primary} bold>
                View Shared Goals ›
              </KamiText>
            </TouchableOpacity>
          </View>
        );
      }

      case 'answer': {
        const bothAnswered = dailyAnswers.find(ans => ans.userId === user?.id) && 
                            dailyAnswers.find(ans => ans.userId === partner?.id);
        return (
          <View key={event.id} style={[styles.cardContainer, styles.cardAnswer, { borderColor: '#e0e7ff' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: '#e0e7ff' }]}>
                <KamiText variant="caption" color="#4f46e5" bold style={{ fontSize: 9 }}>
                  CHECK-IN #{displayIndex}
                </KamiText>
              </View>
              <KamiText variant="caption" color={colors.textMuted}>{event.time}</KamiText>
            </View>
            <KamiText variant="label" bold style={styles.cardTitle}>
              {event.title}
            </KamiText>
            
            {bothAnswered ? (
              <View style={[styles.answerBox, { backgroundColor: '#f5f6ff', borderColor: '#e0e7ff' }]}>
                <Text style={styles.quoteMark}>“</Text>
                <KamiText variant="body" style={styles.answerText}>{event.raw.response}</KamiText>
                <Text style={[styles.quoteMark, { alignSelf: 'flex-end', marginTop: -8 }]}>”</Text>
              </View>
            ) : (
              <View style={[styles.answerBoxLocked, { backgroundColor: '#f8fafc' }]}>
                <Text style={{ fontSize: 22, marginBottom: 4 }}>🔒</Text>
                <KamiText variant="caption" color={colors.textMuted} align="center">
                  Answer is hidden until you both check-in today.
                </KamiText>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.ctaButton, { backgroundColor: '#e0e7ff' }]} 
              onPress={() => navigation.navigate('Home')}
            >
              <KamiText variant="caption" color="#4f46e5" bold>
                Go to Daily Question ›
              </KamiText>
            </TouchableOpacity>
          </View>
        );
      }

      default:
        return null;
    }
  }, [colors, styles, navigation, dailyAnswers, user?.id, partner?.id, partnerName]);

  const renderHeader = useCallback(() => {
    if (!couple) return null;
    return (
      <View>
        {/* Love Clock / Duration Header Stats */}
        <LinearGradient
          colors={[colors.primary + '12', colors.primary + '03']}
          style={styles.statsPanel}
        >
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <KamiText variant="caption" color={colors.textMuted} bold>CONNECTED FOR</KamiText>
              <KamiText variant="body" bold style={{ color: colors.primaryDark, fontSize: 16 }}>
                {couple.anniversaryDate 
                  ? `${Math.max(1, Math.ceil((Date.now() - new Date(couple.anniversaryDate).getTime()) / 86400000))} Days`
                  : '1 Day'}
              </KamiText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <KamiText variant="caption" color={colors.textMuted} bold>TIMELINE EVENTS</KamiText>
              <KamiText variant="body" bold style={{ color: colors.primaryDark, fontSize: 16 }}>
                {events.length} Moments
              </KamiText>
            </View>
          </View>
        </LinearGradient>

        {/* Live Partner Activity Presence Dot */}
        {isPartnerOnline && (
          <View style={styles.presenceBox}>
            <View style={styles.greenDot} />
            <KamiText variant="caption" bold color={colors.primary}>
              {presenceDescription}
            </KamiText>
          </View>
        )}

        {/* Categories / Filter ScrollView */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsRow}>
            {([
              { id: 'all', emoji: '✦', label: 'All' },
              { id: 'letter', emoji: '💌', label: 'Letters' },
              { id: 'journal', emoji: '📓', label: 'Journals' },
              { id: 'memory', emoji: '📸', label: 'Memories' },
              { id: 'goal', emoji: '🎯', label: 'Goals' },
              { id: 'answer', emoji: '💭', label: 'Answers' },
            ] as const).map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.filterTab,
                  filterTab === tab.id && [styles.filterTabActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
                ]}
                onPress={() => {
                  setFilterTab(tab.id);
                  setLimit(10);
                }}
              >
                <Text style={{ fontSize: 14 }}>{tab.emoji}</Text>
                <KamiText variant="caption" color={filterTab === tab.id ? '#fff' : colors.textSecondary} bold={filterTab === tab.id}>
                  {tab.label}
                </KamiText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }, [couple, colors, styles, events.length, isPartnerOnline, presenceDescription, filterTab]);

  const renderItem = useCallback(({ item, index }: { item: TimelineEvent; index: number }) => {
    const displayIndex = filteredEvents.length - index;
    const showHeader = index === 0 || getGroupHeader(item.date) !== getGroupHeader(paginatedEvents[index - 1].date);
    
    return (
      <View style={styles.timelineNodeRow}>
        {showHeader && (
          <View style={styles.dateGroupHeader}>
            <View style={[styles.dateGroupBadge, { backgroundColor: colors.primary + '12' }]}>
              <KamiText variant="caption" color={colors.primary} bold style={styles.dateGroupText}>
                {getGroupHeader(item.date)}
              </KamiText>
            </View>
          </View>
        )}
        
        <View style={styles.timelineInnerRow}>
          {/* Visual Line Anchor */}
          <View style={styles.lineCol}>
            <View style={[styles.timelineDot, { borderColor: colors.primaryLight + '88', backgroundColor: '#fff' }]}>
              <View style={[styles.timelineDotInner, { backgroundColor: colors.primary }]} />
            </View>
            {index < paginatedEvents.length - 1 && (
              <View style={[styles.timelineLine, { borderColor: colors.primaryLight + '33' }]} />
            )}
          </View>
 
           {/* Styled timeline card */}
          <View style={{ flex: 1 }}>
            {renderCard(item, displayIndex)}
          </View>
        </View>
      </View>
    );
  }, [filteredEvents.length, getGroupHeader, paginatedEvents, styles, colors, renderCard]);

  const renderEmpty = useCallback(() => {
    return (
      <View style={styles.emptyState}>
        <Text style={{ fontSize: 56, marginBottom: Space[4] }}>⏳</Text>
        <KamiText variant="subtitle" align="center">No moments found</KamiText>
        <KamiText variant="caption" color={colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
          There are no couple events matching this category filter.
        </KamiText>
      </View>
    );
  }, [colors.textMuted, styles.emptyState]);

  const renderFooter = useCallback(() => {
    if (filteredEvents.length <= limit) {
      return <View style={{ height: Space[10] }} />;
    }
    return (
      <View style={{ paddingBottom: Space[10] }}>
        <TouchableOpacity
          style={[styles.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
          onPress={() => setLimit(prev => prev + 10)}
          activeOpacity={0.8}
        >
          <KamiText variant="label" color={colors.primary} bold>Load More Moments</KamiText>
        </TouchableOpacity>
      </View>
    );
  }, [filteredEvents.length, limit, colors.creamDeep, colors.primary, styles.loadMoreBtn]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <KamiText variant="title" color={colors.primary} style={{ fontSize: 24 }}>←</KamiText>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <KamiText variant="overline" color={colors.primary} bold>OUR SHARED CAPSULE</KamiText>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <KamiText variant="title" style={styles.headerTitleText}>Shared Timeline</KamiText>
            {uiSyncStatus === 'syncing' && (
              <View style={[styles.syncStatusBadge, { backgroundColor: '#fef3c7', marginLeft: 8 }]}>
                <ActivityIndicator size="small" color="#d97706" style={{ marginRight: 4, transform: [{ scale: 0.8 }] }} />
                <KamiText variant="caption" color="#d97706" bold>Syncing...</KamiText>
              </View>
            )}
            {uiSyncStatus === 'saved' && (
              <View style={[styles.syncStatusBadge, { backgroundColor: '#ecfdf5', marginLeft: 8 }]}>
                <KamiText variant="caption" color="#059669" bold>✓ Saved</KamiText>
              </View>
            )}
            {uiSyncStatus === 'idle' && pendingSyncCount > 0 && (
              <View style={[styles.syncStatusBadge, { backgroundColor: '#f3f4f6', marginLeft: 8 }]}>
                <KamiText variant="caption" color="#6b7280" bold>☁ {pendingSyncCount} offline</KamiText>
              </View>
            )}
          </View>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <FlashList
        data={paginatedEvents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
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
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space[5],
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[2],
    paddingBottom: Space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '33',
  },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitleText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: Space[5],
    paddingTop: Space[4],
  },
  statsPanel: {
    borderRadius: 20,
    padding: Space[4],
    borderWidth: 1,
    borderColor: 'rgba(201, 104, 130, 0.12)',
    marginBottom: Space[4],
    ...Shadows.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(201, 104, 130, 0.2)',
  },
  presenceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: Radii.full,
    paddingVertical: Space[2],
    paddingHorizontal: Space[4],
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...Shadows.sm,
    marginBottom: Space[4],
    alignSelf: 'center',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  filterSection: {
    marginBottom: Space[4],
    marginHorizontal: -Space[5],
  },
  filterTabsRow: {
    paddingHorizontal: Space[5],
    gap: Space[2],
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Space[4],
    paddingVertical: Space[2] - 2,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: colors.border + '55',
    backgroundColor: '#fff',
    ...Shadows.sm,
  },
  filterTabActive: {
    borderWidth: 1.5,
  },
  timelineNodeRow: {
    width: '100%',
  },
  dateGroupHeader: {
    marginBottom: Space[2],
    paddingLeft: 38,
  },
  dateGroupBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dateGroupText: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineInnerRow: {
    flexDirection: 'row',
    gap: Space[3],
  },
  lineCol: {
    alignItems: 'center',
    width: 26,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 18,
    zIndex: 2,
    ...Shadows.sm,
  },
  timelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineLine: {
    width: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    flex: 1,
    marginTop: 4,
    marginBottom: -22,
    alignSelf: 'center',
    zIndex: 1,
  },
  cardContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    borderWidth: 1.5,
    borderColor: colors.border + '44',
    ...Shadows.sm,
    gap: Space[2],
  },
  cardLetter: {
    borderWidth: 1.5,
  },
  cardJournal: {
    borderLeftWidth: 4,
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  cardMemory: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  cardGoal: {
    borderWidth: 1.5,
  },
  cardAnswer: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Space[2],
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  cardTitle: {
    fontSize: FontSize.sm + 1,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardDesc: {
    fontSize: FontSize.xs + 1,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  journalQuoteContainer: {
    backgroundColor: '#faf8f5',
    padding: Space[3],
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#eee',
  },
  journalQuoteText: {
    fontSize: FontSize.sm,
    lineHeight: 22,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  metaRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  reactionsGrid: {
    flexDirection: 'row',
    gap: 4,
  },
  photosRow: {
    flexDirection: 'row',
    gap: Space[2],
    marginVertical: Space[1],
  },
  photoThumb: {
    width: 100,
    height: 70,
    borderRadius: Radii.sm,
    resizeMode: 'cover',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  timelinePhotoStackContainer: {
    position: 'relative',
    height: 150,
    width: timelineCardWidth,
    zIndex: 1,
    marginVertical: Space[2],
  },
  timelinePhotoStackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    ...Shadows.sm,
  },
  timelinePhotoStackBgFirst: {
    transform: [{ rotate: '-3deg' }, { scale: 0.97 }],
    opacity: 0.85,
  },
  timelinePhotoStackBgSecond: {
    transform: [{ rotate: '3deg' }, { scale: 0.97 }],
    opacity: 0.65,
  },
  timelinePhotoMainFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#fbfbfb',
    ...Shadows.sm,
  },
  timelineCardPhoto: {
    width: timelineCardWidth,
    height: 150,
    resizeMode: 'cover',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  photoCountBadgeMini: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    opacity: 0.85,
    ...Shadows.sm,
  },
  ctaButton: {
    paddingVertical: Space[2] - 2,
    paddingHorizontal: Space[3],
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space[2],
  },
  progressSection: {
    gap: 4,
    marginVertical: Space[1],
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  answerBox: {
    padding: Space[3],
    borderRadius: Radii.card,
    borderWidth: 1,
    marginVertical: 2,
  },
  quoteMark: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#cbd5e1',
    lineHeight: 20,
  },
  answerText: {
    fontSize: FontSize.xs + 1,
    lineHeight: 20,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingHorizontal: Space[2],
  },
  answerBoxLocked: {
    padding: Space[4],
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginVertical: 2,
  },
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[3],
    paddingHorizontal: Space[5],
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: colors.border + '66',
    marginVertical: Space[3],
    ...Shadows.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Space[10],
  },
});
