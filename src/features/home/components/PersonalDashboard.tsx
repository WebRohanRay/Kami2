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
import { useTheme, useStaggeredEntrance } from '@shared/hooks';
import { LinearGradient } from 'expo-linear-gradient';
import KamiText from '@shared/ui/atoms/KamiText';
import { ShimmerText } from '@shared/ui/atoms/ShimmerText';
import { Space, Radii, FontSize, FontWeight, Shadows, FontFamily, Opacity } from '@shared/constants';
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

const PersonalGoalItem = ({ g, navigation }: { g: any; navigation: any }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
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
          <KamiText variant="label" numberOfLines={1} bold color={colors.textPrimary}>{g.title}</KamiText>
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
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const entranceAnims = useStaggeredEntrance(5, { delay: 80, offsetY: 25 });

  return (
    <View style={styles.container}>
      {/* ── MOOD SANCTUARY ────────────────────────────── */}
      <Animated.View style={entranceAnims[0].style}>
      <View style={styles.singlesSectionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardIcon, { color: colors.primary }]}>✦</Text>
            <KamiText variant="subtitle" bold>Mood Sanctuary</KamiText>
          </View>
          {todayMood && (
            <View style={[styles.donePill, { backgroundColor: colors.success + '18' }]}>
              <Text style={{ fontSize: 11, color: colors.success }}>✓</Text>
              <KamiText variant="caption" color={colors.success} bold>Logged</KamiText>
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
                <KamiText variant="caption" color={colors.textSecondary} style={{ fontStyle: 'italic', lineHeight: 18 }}>
                  {todayMood.note ? `“${todayMood.note}”` : 'Tap to add some thoughts or reflection...'}
                </KamiText>
              </View>
            </LinearGradient>
          </Tap>
        ) : (
          <View style={{ gap: Space[3] }}>
            <KamiText variant="caption" color={colors.textMuted}>How is your inner world today? Select to check in:</KamiText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Space[5] }} contentContainerStyle={{ paddingHorizontal: Space[5] }}>
              <View style={styles.singlesMoodRow}>
                {MOODS.map(m => (
                  <Tap key={m.id} onPress={() => handleMoodPick(m)} style={styles.singlesMoodCircle}>
                    <View style={styles.singlesMoodEmojiWrap}>
                      <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                    </View>
                    <KamiText variant="caption" color={colors.textSecondary} bold>{m.label}</KamiText>
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
                <KamiText variant="caption" style={{ fontSize: 9 }} color={colors.textMuted}>
                  {new Date(m.loggedDate).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </KamiText>
              </View>
            ))}
          </View>
        )}
      </View>
      </Animated.View>

      {/* ── MINDFULNESS PROMPT ───────────────────────── */}
      <Animated.View style={entranceAnims[1].style}>
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
            <KamiText variant="caption" color={promptResponse ? colors.success : colors.primary} bold style={{ marginTop: 8 }}>
              {promptResponse ? '✓ Reflection written — Tap to view' : 'Write your thoughts ›'}
            </KamiText>
          </View>
        </Tap>
      )}
      </Animated.View>

      {/* ── MY JOURNAL ──────────────────────────────── */}
      <Animated.View style={entranceAnims[2].style}>
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
            <Text style={{ fontSize: 28, marginBottom: Space[2] }}>📝</Text>
            <KamiText variant="caption" color={colors.textMuted} align="center">
              Your journal is a blank canvas.{'\n'}Document your dreams, thoughts, and lessons.
            </KamiText>
            <ShimmerText shimmerColor={colors.primary}>
              <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[3] }}>Write your first entry ›</KamiText>
            </ShimmerText>
          </Tap>
        ) : (
          <View style={{ gap: Space[2] }}>
            {journalEntries.slice(0, 2).map(e => (
              <Tap key={e.id} onPress={() => navigation.navigate('Journal')} style={styles.singlesJournalItem}>
                <View style={[styles.singlesJournalDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <KamiText variant="label" numberOfLines={1} bold color={colors.textPrimary}>
                    {e.title || 'Untitled entry'}
                  </KamiText>
                  <KamiText variant="caption" color={colors.textMuted} numberOfLines={1}>{e.body}</KamiText>
                </View>
                <KamiText variant="caption" color={colors.textMuted}>
                  {new Date(e.entryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </KamiText>
              </Tap>
            ))}
          </View>
        )}
      </View>
      </Animated.View>

      {/* ── MY GOALS ────────────────────────────────── */}
      <Animated.View style={entranceAnims[3].style}>
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
            <Text style={{ fontSize: 28, marginBottom: Space[2] }}>🌱</Text>
            <KamiText variant="caption" color={colors.textMuted} align="center">No active goals set.</KamiText>
            <ShimmerText shimmerColor={colors.primary}>
              <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[3] }}>Grow a new habit ›</KamiText>
            </ShimmerText>
          </Tap>
        ) : (
          <View style={{ gap: Space[3] }}>
            {activeGoals.slice(0, 3).map(g => (
              <PersonalGoalItem key={g.id} g={g} navigation={navigation} />
            ))}
          </View>
        )}
      </View>
      </Animated.View>

      {/* ── ARCHIVE & CAPSULES ───────────────────────── */}
      <Animated.View style={entranceAnims[4].style}>
      <View style={styles.singlesQuickRow}>
        <Tap onPress={() => navigation.navigate('Memories')} style={styles.premiumHalfCard}>
          <View style={[styles.premiumHalfIconWrap, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '22' }]}>
            <Text style={{ fontSize: 22 }}>📸</Text>
          </View>
          <KamiText variant="label" bold color={colors.textPrimary} align="center" style={{ marginTop: Space[2] }}>
            Photo Sanctuary
          </KamiText>
          <KamiText variant="caption" color={colors.textMuted} align="center">
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
                      <KamiText style={[styles.letterExcerptText, !isUnlocked && { fontStyle: 'italic', color: colors.textMuted }]}>
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
              <KamiText style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic', lineHeight: 16 }}>
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
                    { backgroundColor: i === activePersonalLetterSlide ? colors.primary : colors.border }
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
      </Animated.View>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    gap: Space[5],
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  cardIcon: { fontSize: FontSize.lg },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '18', borderRadius: Radii.full,
    paddingHorizontal: Space[3], paddingVertical: Space[1],
  },
  singlesSectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: Space[5],
    gap: Space[4],
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.ghost,
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
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border + Opacity.subtle,
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
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.ghost,
  },
  singlesWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Space[3],
    borderTopWidth: 1,
    borderTopColor: colors.border + Opacity.ghost,
    marginTop: Space[1],
  },
  singlesWeekDot: {
    alignItems: 'center',
    gap: 3,
  },
  singlesNotebookCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: Space[5],
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.medium,
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
    borderBottomColor: colors.border + Opacity.medium,
    borderStyle: 'dotted',
  },
  notebookBody: {
    paddingLeft: Space[2],
    borderLeftWidth: 1,
    borderLeftColor: colors.border + Opacity.subtle,
    paddingVertical: Space[1],
  },
  notebookPromptText: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    lineHeight: 31,
    color: colors.textPrimary,
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
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border + Opacity.ghost,
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
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border + Opacity.ghost,
  },
  singlesGoalEmojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    elevation: 1,
  },
  singlesProgressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border + Opacity.ghost,
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
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    paddingVertical: Space[5],
    paddingHorizontal: Space[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.ghost,
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
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: Space[4],
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.medium,
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
    color: colors.textMuted,
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
    color: colors.textSecondary,
    lineHeight: 17,
  },
  letterWrittenText: {
    fontSize: 8,
    color: colors.textMuted,
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
