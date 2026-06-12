import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, Animated, RefreshControl, Dimensions,
  Platform, StatusBar as RNStatusBar
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FlashList } from '@shopify/flash-list';
import { useAuthStore } from '@features/auth';
import { useCoupleStore, PartnerActionType } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import KamiText from '@shared/ui/atoms/KamiText';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import { Colors, FontFamily, FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';
import { LinearGradient } from 'expo-linear-gradient';
import type { MainTabScreenProps } from '@core/navigation/types';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import type { CoupleLetter, CoupleJournal, CoupleMemory, CoupleGoal, CoupleAnswer, CoupleReaction } from '@features/couple/types';

type Props = MainTabScreenProps<'Timeline'>;

type TimelineEvent =
  | { id: string; type: 'letter'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleLetter }
  | { id: string; type: 'journal'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleJournal }
  | { id: string; type: 'memory'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleMemory }
  | { id: string; type: 'goal'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleGoal }
  | { id: string; type: 'answer'; title: string; description?: string; time: string; icon: string; date: Date; raw: CoupleAnswer }
  | { id: string; type: 'comment' | 'reaction'; title: string; description?: string; time: string; icon: string; date: Date; raw: any };

export function TimelineScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);
  const {
    couple, partner, todayQuestion, dailyAnswers, coupleJournals, coupleGoals, coupleMemories, partnerAction, coupleLetters
  } = useCoupleStore();
  const { loadAll: loadCoupleAll } = useCouple();

  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'letter' | 'journal' | 'memory' | 'goal' | 'answer'>('all');
  const [limit, setLimit] = useState(10);

  const partnerName = partner?.nickname || partner?.email?.split('@')[0] || 'Partner';
  const name = user?.nickname || user?.email?.split('@')[0] || 'You';

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
  const getGroupHeader = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const isPartnerOnline = (() => {
    if (!partner?.lastSeenAt) return false;
    const parsedTime = new Date(partner.lastSeenAt).getTime();
    if (isNaN(parsedTime)) return false;
    const diffMs = Date.now() - parsedTime;
    return diffMs >= -5 * 60 * 1000 && diffMs < 5 * 60 * 1000;
  })();

  const getPresenceDescription = () => {
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
  };

  const renderCard = (event: TimelineEvent, displayIndex: number) => {
    switch (event.type) {
      case 'letter':
        const isLocked = !checkUnlocked(event.raw.deliverAt);
        return (
          <View key={event.id} style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <KamiText variant="caption" color={colors.primary} bold>#{displayIndex}</KamiText>
              </View>
              <KamiText variant="caption" color={Colors.textMuted}>{event.time}</KamiText>
            </View>
            <KamiText variant="label" bold style={styles.cardTitle}>{event.title}</KamiText>
            {event.description ? <KamiText variant="body" color={Colors.textSecondary} style={styles.cardDesc}>{event.description}</KamiText> : null}
            {!isLocked && event.raw.imageUrls && event.raw.imageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
                {event.raw.imageUrls.map((url: string, idx: number) => {
                  const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
                  return (
                    <KamiImage
                      key={idx}
                      src={url}
                      thumbnailSrc={thumbUrl}
                      style={styles.photoThumb}
                    />
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.primary + '11' }]} onPress={() => navigation.navigate('Future')}>
              <KamiText variant="caption" color={colors.primary} bold>{isLocked ? 'View Scheduled Lock 🔒' : 'Read Full Letter ›'}</KamiText>
            </TouchableOpacity>
          </View>
        );

      case 'journal':
        return (
          <View key={event.id} style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <KamiText variant="caption" color={colors.primary} bold>#{displayIndex}</KamiText>
              </View>
              <KamiText variant="caption" color={Colors.textMuted}>{event.time}</KamiText>
            </View>
            <KamiText variant="label" bold style={styles.cardTitle}>{event.title}</KamiText>
            {event.description ? <KamiText variant="body" color={Colors.textSecondary} style={styles.cardDesc}>{event.description}</KamiText> : null}
            {event.raw.imageUrls && event.raw.imageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
                {event.raw.imageUrls.map((url: string, idx: number) => {
                  const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
                  return (
                    <KamiImage
                      key={idx}
                      src={url}
                      thumbnailSrc={thumbUrl}
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
                <KamiText variant="caption" color={Colors.textMuted}>💬 {event.raw.comments.length} comments</KamiText>
              )}
            </View>
            <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.primary + '11' }]} onPress={() => navigation.navigate('Journal')}>
              <KamiText variant="caption" color={colors.primary} bold>Open Journal Feed ›</KamiText>
            </TouchableOpacity>
          </View>
        );

      case 'memory':
        return (
          <View key={event.id} style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <KamiText variant="caption" color={colors.primary} bold>#{displayIndex}</KamiText>
              </View>
              <KamiText variant="caption" color={Colors.textMuted}>{event.time}</KamiText>
            </View>
            <KamiText variant="label" bold style={styles.cardTitle}>{event.title}</KamiText>
            {event.description ? <KamiText variant="body" color={Colors.textSecondary} style={styles.cardDesc}>{event.description}</KamiText> : null}
            {event.raw.location ? (
              <View style={styles.metaRowInline}>
                <Text style={{ fontSize: 10 }}>📍</Text>
                <KamiText variant="caption" color={Colors.textMuted}>{event.raw.location}</KamiText>
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
                      style={styles.photoThumb}
                    />
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.primary + '11' }]} onPress={() => navigation.navigate('Memories')}>
              <KamiText variant="caption" color={colors.primary} bold>View Memory Vault ›</KamiText>
            </TouchableOpacity>
          </View>
        );

      case 'goal':
        return (
          <View key={event.id} style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <KamiText variant="caption" color={colors.primary} bold>#{displayIndex}</KamiText>
              </View>
              <KamiText variant="caption" color={Colors.textMuted}>{event.time}</KamiText>
            </View>
            <KamiText variant="label" bold style={styles.cardTitle}>{event.title}</KamiText>
            
            <View style={styles.progressSection}>
              <View style={styles.progressMeta}>
                <KamiText variant="caption" color={Colors.textSecondary} bold>Milestone progress</KamiText>
                <KamiText variant="caption" color={colors.primary} bold>{event.raw.progress}%</KamiText>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${event.raw.progress}%`, backgroundColor: colors.primary }]} />
              </View>
            </View>
            
            <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.primary + '11' }]} onPress={() => navigation.navigate('Goals')}>
              <KamiText variant="caption" color={colors.primary} bold>View Shared Goals ›</KamiText>
            </TouchableOpacity>
          </View>
        );

      case 'answer':
        const bothAnswered = dailyAnswers.find(ans => ans.userId === user?.id) && 
                            dailyAnswers.find(ans => ans.userId === partner?.id);
        return (
          <View key={event.id} style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <KamiText variant="caption" color={colors.primary} bold>#{displayIndex}</KamiText>
              </View>
              <KamiText variant="caption" color={Colors.textMuted}>{event.time}</KamiText>
            </View>
            <KamiText variant="label" bold style={styles.cardTitle}>{event.title}</KamiText>
            
            {bothAnswered ? (
              <View style={[styles.answerBox, { backgroundColor: colors.creamDeep + '44' }]}>
                <KamiText variant="body" style={styles.answerText}>{event.raw.response}</KamiText>
              </View>
            ) : (
              <View style={[styles.answerBoxLocked, { backgroundColor: Colors.border + '33' }]}>
                <Text style={{ fontSize: 24, marginBottom: 4 }}>🔒</Text>
                <KamiText variant="caption" color={Colors.textMuted} align="center">
                  Answer is hidden until you both check-in today.
                </KamiText>
              </View>
            )}
            
            <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.primary + '11' }]} onPress={() => navigation.navigate('Home')}>
              <KamiText variant="caption" color={colors.primary} bold>Go to Daily Question ›</KamiText>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };



  const renderHeader = () => {
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
              <KamiText variant="caption" color={Colors.textMuted} bold>CONNECTED FOR</KamiText>
              <KamiText variant="body" bold style={{ color: colors.primaryDark, fontSize: 16 }}>
                {couple.anniversaryDate 
                  ? `${Math.max(1, Math.ceil((Date.now() - new Date(couple.anniversaryDate).getTime()) / 86400000))} Days`
                  : '1 Day'}
              </KamiText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <KamiText variant="caption" color={Colors.textMuted} bold>TIMELINE EVENTS</KamiText>
              <KamiText variant="body" bold style={{ color: colors.primaryDark, fontSize: 16 }}>{events.length} Moments</KamiText>
            </View>
          </View>
        </LinearGradient>

        {/* Live Partner Activity Presence Dot */}
        {isPartnerOnline && (
          <View style={styles.presenceBox}>
            <View style={styles.greenDot} />
            <KamiText variant="caption" bold color={colors.primary}>
              {getPresenceDescription()}
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
                <KamiText variant="caption" color={filterTab === tab.id ? '#fff' : Colors.textSecondary} bold={filterTab === tab.id}>
                  {tab.label}
                </KamiText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: TimelineEvent; index: number }) => {
    const displayIndex = filteredEvents.length - index;
    const showHeader = index === 0 || getGroupHeader(item.date) !== getGroupHeader(paginatedEvents[index - 1].date);
    
    return (
      <View style={styles.timelineNodeRow}>
        {showHeader && (
          <View style={styles.dateGroupHeader}>
            <KamiText variant="caption" color={colors.primary} bold style={styles.dateGroupText}>
              {getGroupHeader(item.date)}
            </KamiText>
          </View>
        )}
        
        <View style={styles.timelineInnerRow}>
          {/* Visual Line Anchor */}
          <View style={styles.lineCol}>
            <View style={[styles.timelineDot, { borderColor: colors.primaryLight, backgroundColor: '#fff' }]}>
              <View style={[styles.timelineDotInner, { backgroundColor: colors.primary }]} />
            </View>
            {index < paginatedEvents.length - 1 && (
              <View style={[styles.timelineLine, { borderColor: colors.primaryLight + '44' }]} />
            )}
          </View>

          {/* Styled timeline card */}
          <View style={{ flex: 1 }}>
            {renderCard(item, displayIndex)}
          </View>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    return (
      <View style={styles.emptyState}>
        <Text style={{ fontSize: 56, marginBottom: Space[4] }}>⏳</Text>
        <KamiText variant="subtitle" align="center">No moments found</KamiText>
        <KamiText variant="caption" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
          There are no couple events matching this category filter.
        </KamiText>
      </View>
    );
  };

  const renderFooter = () => {
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
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <KamiText variant="title" color={colors.primary} style={{ fontSize: 24 }}>←</KamiText>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <KamiText variant="overline" color={colors.primary} bold>OUR SHARED CAPSULE</KamiText>
          <KamiText variant="title" style={styles.headerTitleText}>Time Timeline</KamiText>
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

const styles = StyleSheet.create({
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
    borderBottomColor: Colors.border + '33',
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
    fontWeight: FontWeight.bold,
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
    borderWidth: 1,
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
    borderColor: Colors.border + '55',
    backgroundColor: '#fff',
    ...Shadows.sm,
  },
  filterTabActive: {
    borderWidth: 1.5,
  },
  timelineList: {
    gap: Space[4],
  },
  timelineNodeRow: {
    width: '100%',
  },
  dateGroupHeader: {
    marginBottom: Space[2],
    paddingLeft: 42,
  },
  dateGroupText: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineInnerRow: {
    flexDirection: 'row',
    gap: Space[3],
  },
  lineCol: {
    alignItems: 'center',
    width: 30,
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
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    borderWidth: 1.5,
    borderColor: Colors.border + '44',
    ...Shadows.sm,
    gap: Space[2],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Space[2],
    paddingVertical: 1,
    borderRadius: Radii.sm,
  },
  cardTitle: {
    fontSize: FontSize.sm + 1,
    color: Colors.textPrimary,
  },
  cardDesc: {
    fontSize: FontSize.xs,
    lineHeight: 18,
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
    resizeMode: 'contain',
    backgroundColor: 'rgba(0,0,0,0.03)',
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
    borderColor: Colors.border + '33',
    marginVertical: 2,
  },
  answerText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  answerBoxLocked: {
    padding: Space[4],
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    marginVertical: 2,
  },
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[3],
    paddingHorizontal: Space[5],
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.border + '66',
    marginVertical: Space[3],
    ...Shadows.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Space[10],
  },
});
