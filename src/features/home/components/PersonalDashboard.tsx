import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import { LinearGradient } from 'expo-linear-gradient';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, Space, Radii, FontSize, FontWeight, Shadows, FontFamily } from '@shared/constants';
import { Tap } from './Tap';
import { MOODS } from '../hooks/useHomeDashboard';

interface PersonalDashboardProps {
  navigation: any;
  todayMood: any;
  recentMoods: any[];
  journalEntries: any[];
  activeGoals: any[];
  todayPrompt: any;
  promptResponse: any;
  personalLettersLoading: boolean;
  personalLettersForSlide: any[];
  activePersonalLetterSlide: number;
  setActivePersonalLetterSlide: (index: number) => void;
  personalCarouselWidth: number;
  setPersonalCarouselWidth: (width: number) => void;
  handlePersonalLetterScroll: (event: any) => void;
  handleMoodPick: (mood: typeof MOODS[0]) => void;
  friendlyDaysUntil: (iso: string) => string;
  getTimeAgo: (date: Date | string) => string;
}

const PersonalGoalItem = ({ g, colors, navigation }: { g: any; colors: any; navigation: any }) => {
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: g.progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [g.progress]);

  return (
    <Tap onPress={() => navigation.navigate('Goals')} style={styles.singlesGoalItem}>
      <View style={styles.singlesGoalEmojiCircle}>
        <Text style={{ fontSize: 18 }}>{g.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <KamiText variant="label" numberOfLines={1} bold color={Colors.textPrimary}>{g.title}</KamiText>
          <KamiText variant="caption" color={colors.primary} bold>{g.progress}%</KamiText>
        </View>
        <View style={styles.singlesProgressBar}>
          <Animated.View
            style={[
              styles.singlesProgressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>
      </View>
    </Tap>
  );
};

export const PersonalDashboard: React.FC<PersonalDashboardProps> = ({
  navigation,
  todayMood,
  recentMoods,
  journalEntries,
  activeGoals,
  todayPrompt,
  promptResponse,
  personalLettersLoading,
  personalLettersForSlide,
  activePersonalLetterSlide,
  setPersonalCarouselWidth,
  personalCarouselWidth,
  handlePersonalLetterScroll,
  handleMoodPick,
  friendlyDaysUntil,
  getTimeAgo,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* ── MOOD SANCTUARY ────────────────────────────── */}
      <View style={styles.singlesSectionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardIcon, { color: colors.primary }]}>✦</Text>
            <KamiText variant="subtitle" bold>Mood Sanctuary</KamiText>
          </View>
          {todayMood && (
            <View style={[styles.donePill, { backgroundColor: Colors.success + '18' }]}>
              <Text style={{ fontSize: 11, color: Colors.success }}>✓</Text>
              <KamiText variant="caption" color={Colors.success} bold>Logged</KamiText>
            </View>
          )}
        </View>

        {todayMood ? (
          <Tap onPress={() => handleMoodPick(MOODS.find(m => m.id === todayMood.moodId) ?? MOODS[0])} style={styles.singlesMoodLoggedBox}>
            <LinearGradient
              colors={[colors.primary + '12', colors.primary + '03']}
              style={styles.singlesMoodLoggedGradient}
            >
              <View style={styles.singlesMoodEmojiCircle}>
                <Text style={{ fontSize: 32 }}>{todayMood.moodEmoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <KamiText variant="body" bold color={colors.primaryDark}>
                  Feeling {todayMood.moodLabel}
                </KamiText>
                <KamiText variant="caption" color={Colors.textSecondary} style={{ fontStyle: 'italic', lineHeight: 18 }}>
                  {todayMood.note ? `“${todayMood.note}”` : 'Tap to add some thoughts or reflection...'}
                </KamiText>
              </View>
            </LinearGradient>
          </Tap>
        ) : (
          <View style={{ gap: Space[3] }}>
            <KamiText variant="caption" color={Colors.textMuted}>How is your inner world today? Select to check in:</KamiText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Space[5] }} contentContainerStyle={{ paddingHorizontal: Space[5] }}>
              <View style={styles.singlesMoodRow}>
                {MOODS.map(m => (
                  <Tap key={m.id} onPress={() => handleMoodPick(m)} style={styles.singlesMoodCircle}>
                    <View style={styles.singlesMoodEmojiWrap}>
                      <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                    </View>
                    <KamiText variant="caption" color={Colors.textSecondary} bold>{m.label}</KamiText>
                  </Tap>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {recentMoods.length > 1 && (
          <View style={styles.singlesWeekRow}>
            {recentMoods.slice(-7).map(m => (
              <View key={m.id} style={styles.singlesWeekDot}>
                <Text style={{ fontSize: 16 }}>{m.moodEmoji}</Text>
                <KamiText variant="caption" style={{ fontSize: 9 }} color={Colors.textMuted}>
                  {new Date(m.loggedDate).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </KamiText>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── MINDFULNESS PROMPT ───────────────────────── */}
      {todayPrompt && (
        <Tap
          onPress={() => navigation.navigate('Journal')}
          style={styles.singlesNotebookCard}
        >
          <View style={styles.notebookHeader}>
            <View style={styles.notebookSpiral} />
            <KamiText variant="overline" color={colors.primary} bold>Mindfulness Prompt</KamiText>
          </View>
          <View style={styles.notebookBody}>
            <KamiText variant="body" style={styles.notebookPromptText}>
              “{todayPrompt.content}”
            </KamiText>
            <KamiText variant="caption" color={promptResponse ? Colors.success : colors.primary} bold style={{ marginTop: 8 }}>
              {promptResponse ? '✓ Reflection written — Tap to view' : 'Write your thoughts ›'}
            </KamiText>
          </View>
        </Tap>
      )}

      {/* ── MY JOURNAL ──────────────────────────────── */}
      <View style={styles.singlesSectionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardIcon, { color: colors.primary }]}>📓</Text>
            <KamiText variant="subtitle" bold>My Journal</KamiText>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Journal')} hitSlop={8}>
            <KamiText variant="caption" color={colors.primary} bold>View All ›</KamiText>
          </TouchableOpacity>
        </View>
        {journalEntries.length === 0 ? (
          <Tap onPress={() => navigation.navigate('Journal')} style={styles.singlesEmptyInner}>
            <KamiText variant="caption" color={Colors.textMuted} align="center">
              Your journal is a blank canvas.{'\n'}Document your dreams, thoughts, and lessons.
            </KamiText>
            <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[3] }}>Write your first entry ›</KamiText>
          </Tap>
        ) : (
          <View style={{ gap: Space[2] }}>
            {journalEntries.slice(0, 2).map(e => (
              <Tap key={e.id} onPress={() => navigation.navigate('Journal')} style={styles.singlesJournalItem}>
                <View style={[styles.singlesJournalDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <KamiText variant="label" numberOfLines={1} bold color={Colors.textPrimary}>
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

      {/* ── MY GOALS ────────────────────────────────── */}
      <View style={styles.singlesSectionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardIcon, { color: colors.primary }]}>🌱</Text>
            <KamiText variant="subtitle" bold>Personal Goals</KamiText>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Goals')} hitSlop={8}>
            <KamiText variant="caption" color={colors.primary} bold>View All ›</KamiText>
          </TouchableOpacity>
        </View>
        {activeGoals.length === 0 ? (
          <Tap onPress={() => navigation.navigate('Goals')} style={styles.singlesEmptyInner}>
            <KamiText variant="caption" color={Colors.textMuted} align="center">No active goals set.</KamiText>
            <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[3] }}>Grow a new habit ›</KamiText>
          </Tap>
        ) : (
          <View style={{ gap: Space[3] }}>
            {activeGoals.slice(0, 3).map(g => (
              <PersonalGoalItem key={g.id} g={g} colors={colors} navigation={navigation} />
            ))}
          </View>
        )}
      </View>

      {/* ── ARCHIVE & CAPSULES ───────────────────────── */}
      <View style={styles.singlesQuickRow}>
        <Tap onPress={() => navigation.navigate('Memories')} style={styles.premiumHalfCard}>
          <View style={[styles.premiumHalfIconWrap, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '22' }]}>
            <Text style={{ fontSize: 22 }}>📸</Text>
          </View>
          <KamiText variant="label" bold color={Colors.textPrimary} align="center" style={{ marginTop: Space[2] }}>
            Photo Sanctuary
          </KamiText>
          <KamiText variant="caption" color={Colors.textMuted} align="center">
            Milestones & Vault
          </KamiText>
        </Tap>

        <View style={[styles.tornPaperWidget, { padding: 0, minHeight: 180 }]}>
          <View style={[styles.widgetTopRow, { paddingHorizontal: Space[4], paddingTop: Space[4] }]}>
            <KamiText style={styles.widgetHeader} bold>Letter Box</KamiText>
            <Text style={{ fontSize: 13 }}>✉️</Text>
          </View>

          {personalLettersLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          ) : personalLettersForSlide.length > 0 ? (
            <View
              style={{ flex: 1, justifyContent: 'center' }}
              onLayout={(e) => setPersonalCarouselWidth(e.nativeEvent.layout.width)}
            >
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handlePersonalLetterScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ alignItems: 'center' }}
              >
                {personalLettersForSlide.map((l) => {
                  const isUnlocked = Date.now() >= new Date(l.deliverAt).getTime();
                  const excerpt = isUnlocked
                    ? (l.body ? (l.body.length > 45 ? `“${l.body.substring(0, 42)}...”` : `“${l.body}”`) : 'No content')
                    : 'A surprise sealed envelope. Ready to read in the future!';

                  return (
                    <View
                      key={l.id}
                      style={{
                        width: personalCarouselWidth || 160,
                        paddingHorizontal: Space[4],
                        paddingBottom: Space[2],
                        justifyContent: 'center',
                        gap: Space[2]
                      }}
                    >
                      <View style={styles.toLabelRow}>
                        <Text style={{ fontSize: 10 }}>{isUnlocked ? '✨' : '🔒'}</Text>
                        <KamiText style={[styles.toLabelText, { color: colors.primary }]} bold>
                          Letter to Self
                        </KamiText>
                      </View>
                      <KamiText style={[styles.letterExcerptText, !isUnlocked && { fontStyle: 'italic', color: Colors.textMuted }]}>
                        {excerpt}
                      </KamiText>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <KamiText style={styles.letterWrittenText}>
                          {isUnlocked ? `Written ${getTimeAgo(l.createdAt)}` : friendlyDaysUntil(l.deliverAt)}
                        </KamiText>
                        <TouchableOpacity
                          onPress={() => navigation.navigate('Future')}
                          hitSlop={8}
                        >
                          <KamiText style={{ fontSize: 11, color: colors.primary, fontWeight: 'bold' }}>
                            {isUnlocked ? 'Read →' : 'View 🔒'}
                          </KamiText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: Space[4], paddingBottom: Space[4] }}>
              <KamiText style={{ fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 16 }}>
                No time capsules sealed yet. Write a letter to your future self!
              </KamiText>
              <TouchableOpacity
                style={[styles.widgetFooterCta, { marginTop: Space[2] }]}
                onPress={() => navigation.navigate('Future')}
              >
                <KamiText style={[styles.widgetCtaText, { color: colors.primary }]} bold>
                  Write Letter →
                </KamiText>
              </TouchableOpacity>
            </View>
          )}

          {personalLettersForSlide.length > 1 && (
            <View style={[styles.carouselDots, { paddingBottom: Space[3] }]}>
              {personalLettersForSlide.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.carouselDot,
                    { backgroundColor: i === activePersonalLetterSlide ? colors.primary : Colors.border }
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Space[5],
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  cardIcon: { fontSize: FontSize.lg },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary + '18', borderRadius: Radii.full,
    paddingHorizontal: Space[3], paddingVertical: Space[1],
  },
  singlesSectionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: Space[5],
    gap: Space[4],
    borderWidth: 1.5,
    borderColor: 'rgba(201, 104, 130, 0.08)',
    ...Shadows.card,
  },
  singlesMoodLoggedBox: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201, 104, 130, 0.15)',
  },
  singlesMoodLoggedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    padding: Space[4],
  },
  singlesMoodEmojiCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(201, 104, 130, 0.12)',
  },
  singlesMoodRow: {
    flexDirection: 'row',
    gap: Space[2],
  },
  singlesMoodCircle: {
    alignItems: 'center',
    gap: 6,
    width: 70,
  },
  singlesMoodEmojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FAF9F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  singlesWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Space[3],
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginTop: Space[1],
  },
  singlesWeekDot: {
    alignItems: 'center',
    gap: 3,
  },
  singlesNotebookCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    padding: Space[5],
    borderWidth: 1.5,
    borderColor: '#EADECA',
    ...Shadows.card,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  notebookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[3],
    paddingLeft: Space[2],
  },
  notebookSpiral: {
    position: 'absolute',
    top: -12,
    left: 20,
    right: 20,
    height: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#D3C2B0',
    borderStyle: 'dotted',
  },
  notebookBody: {
    paddingLeft: Space[2],
    borderLeftWidth: 1,
    borderLeftColor: '#F0E5D8',
    paddingVertical: Space[1],
  },
  notebookPromptText: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    lineHeight: 31,
    color: '#5C4033',
    textAlign: 'center',
  },
  singlesEmptyInner: {
    alignItems: 'center',
    paddingVertical: Space[4],
  },
  singlesJournalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    paddingVertical: Space[3] + 2,
    paddingHorizontal: Space[3] + 2,
    borderRadius: 16,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  singlesJournalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  singlesGoalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    borderRadius: 18,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  singlesGoalEmojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    elevation: 1,
  },
  singlesProgressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  singlesProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  singlesQuickRow: {
    flexDirection: 'row',
    gap: Space[4],
  },
  premiumHalfCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: Space[5],
    paddingHorizontal: Space[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(201, 104, 130, 0.05)',
    ...Shadows.card,
    elevation: 2,
    gap: 2,
  },
  premiumHalfIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    ...Shadows.sm,
    elevation: 1,
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
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
