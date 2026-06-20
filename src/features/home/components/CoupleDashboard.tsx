import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
  Vibration,
} from 'react-native';
import { useTheme, useStaggeredEntrance, useHeartbeatGlow } from '@shared/hooks';
import { LinearGradient } from 'expo-linear-gradient';
import KamiText from '@shared/ui/atoms/KamiText';
import KamiButton from '@shared/ui/atoms/KamiButton';
import { RollingDigit } from '@shared/ui/atoms/RollingDigit';
import { FloatingHearts } from '@shared/ui/atoms/FloatingHearts';
import { ShimmerText } from '@shared/ui/atoms/ShimmerText';
import { Space, Radii, FontSize, FontWeight, Shadows, FontFamily, Opacity } from '@shared/constants';

import { MOODS, DurationData } from '../hooks/useHomeDashboard';

interface CoupleDashboardProps {
  user: any;
  couple: any;
  partner: any;
  partnerName: string;
  isPartnerOnline: boolean;
  durationObj: DurationData | null;
  durationText: string;
  nextEventText: string;
  partnerAction: string;
  getPresenceDescription: () => string;
  resolvedHeroBg: string | null;
  unreadLettersCount: number;
  heroContent: { title: string; script: string; time: string; cta: string };
  loveSending: boolean;
  handleSendLove: () => Promise<void>;
  setCustomMoodModalVisible: (visible: boolean) => void;
  updateProfile: (data: { currentMoodEmoji: string; currentMoodLabel: string }) => Promise<any>;
  shownTimelineEvents: any[];
  isTimelineScrollable: boolean;
  flashbackMemory: any;
  flashbackImage: string;
  flashbackTitle: string;
  flashbackDesc: string;
  lettersForSlide: any[];
  carouselWidth: number;
  setCarouselWidth: (width: number) => void;
  handleLetterScroll: (event: any) => void;
  activeLetterSlide: number;
  goalTitle: string | null;
  goalTimeRemainingText: string | null;
  goalProgress: number;
  getGoalPlantEmoji: (progress: number) => string;
  latestCoupleGoal: any;
  todayQuestion: any;
  bothAnswered: boolean;
  myAnswer: any;
  partnerAnswer: any;
  answerInput: string;
  setAnswerInput: (text: string) => void;
  submittingAnswerState: boolean;
  setQuestionAnswering: (answering: boolean) => void;
  submitAnswer: (questionId: string, coupleId: string, response: string) => Promise<void>;
  pulseAnim: Animated.Value;
  navigation: any;
  getTimeAgo: (date: Date | string) => string;
  friendlyDaysUntil: (iso: string) => string;
  initial: (name: string) => string;
  onOpenCandidWall: () => void;
  onOpenCandidViewer: () => void;
  onCapture: () => void;
}

export const CoupleDashboard: React.FC<CoupleDashboardProps> = ({
  user,
  couple,
  partner,
  partnerName,
  isPartnerOnline,
  durationObj,
  durationText,
  nextEventText,
  partnerAction,
  getPresenceDescription,
  resolvedHeroBg,
  unreadLettersCount,
  heroContent,
  loveSending,
  handleSendLove,
  setCustomMoodModalVisible,
  updateProfile,
  shownTimelineEvents,
  isTimelineScrollable,
  flashbackMemory,
  flashbackImage,
  flashbackTitle,
  flashbackDesc,
  lettersForSlide,
  setCarouselWidth,
  carouselWidth,
  handleLetterScroll,
  activeLetterSlide,
  goalTitle,
  goalTimeRemainingText,
  goalProgress,
  getGoalPlantEmoji,
  latestCoupleGoal,
  todayQuestion,
  bothAnswered,
  myAnswer,
  partnerAnswer,
  answerInput,
  setAnswerInput,
  submittingAnswerState,
  setQuestionAnswering,
  submitAnswer,
  pulseAnim,
  navigation,
  getTimeAgo,
  friendlyDaysUntil,
  initial,
  onOpenCandidWall,
  onOpenCandidViewer,
  onCapture,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const name = user?.nickname ? user.nickname.split(' ')[0] : 'You';
  const entranceAnims = useStaggeredEntrance(10, { delay: 80, offsetY: 25 });
  const { pulseStyle: heartPulse, glowStyle: heartGlow, glowRingStyle: heartGlowRing } = useHeartbeatGlow({ color: colors.primary, size: 44 });
  const [loveTrigger, setLoveTrigger] = useState(0);

  // Orbital rotation for mood ring connector heart
  const orbitAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.timing(orbitAnim, { toValue: 1, duration: 6000, useNativeDriver: true })
    ).start();
  }, []);
  const orbitSpin = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Quick action bounce anims
  const qaScales = React.useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  const qaPress = (idx: number) => {
    Vibration.vibrate(10);
    Animated.sequence([
      Animated.spring(qaScales[idx], { toValue: 0.88, tension: 200, friction: 6, useNativeDriver: true }),
      Animated.spring(qaScales[idx], { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const goalProgressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(goalProgressAnim, {
      toValue: goalProgress || 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [goalProgress]);

  return (
    <View style={styles.container}>
      {/* ── 1. RELATIONSHIP STATUS & TIMER CARD ───── */}
      <Animated.View style={entranceAnims[0].style}>
      <LinearGradient
        colors={[colors.primary + '18', colors.primary + '05']}
        style={styles.statusTimerCard}
      >
        <View style={styles.timerHeaderRow}>
          <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
            <Animated.View style={[heartGlowRing, heartGlow]} />
            <Animated.View style={heartPulse}>
              <Text style={{ fontSize: 24 }}>❤️</Text>
            </Animated.View>
          </View>
          <KamiText style={[styles.timerHeaderTitle, { color: colors.primary }]} bold>Our Love Clock</KamiText>
        </View>

        {durationObj ? (
          <View style={styles.elegantClockWrapper}>
            {/* Years, Months, Days row */}
            <View style={styles.elegantMainRow}>
              {durationObj.years > 0 && (
                <View style={styles.elegantMainUnit}>
                  <KamiText style={[styles.elegantMainVal, { color: colors.accent }]} bold>{durationObj.years}</KamiText>
                  <KamiText style={styles.elegantMainLbl}>years</KamiText>
                </View>
              )}
              {durationObj.months > 0 && (
                <View style={styles.elegantMainUnit}>
                  <KamiText style={[styles.elegantMainVal, { color: colors.accent }]} bold>{durationObj.months}</KamiText>
                  <KamiText style={styles.elegantMainLbl}>months</KamiText>
                </View>
              )}
              <View style={styles.elegantMainUnit}>
                <KamiText style={[styles.elegantMainVal, { color: colors.accent }]} bold>{durationObj.days}</KamiText>
                <KamiText style={styles.elegantMainLbl}>days</KamiText>
              </View>
            </View>

            {/* Delicate Divider Line */}
            <View style={[styles.elegantDivider, { backgroundColor: colors.primary + '22' }]} />

            {/* Hours, Minutes, Seconds Live Ticker (Rolling Digits) */}
            <View style={styles.elegantTickerRow}>
              <View style={styles.elegantTickerUnit}>
                <View style={{ flexDirection: 'row' }}>
                  <RollingDigit value={Math.floor(durationObj.hours / 10)} fontSize={12} color={colors.primaryDark} fontWeight="500" />
                  <RollingDigit value={durationObj.hours % 10} fontSize={12} color={colors.primaryDark} fontWeight="500" />
                </View>
                <KamiText style={styles.elegantTickerLbl}>Hours</KamiText>
              </View>
              <KamiText style={[styles.elegantTickerColon, { color: colors.primary + '44' }]}>:</KamiText>
              <View style={styles.elegantTickerUnit}>
                <View style={{ flexDirection: 'row' }}>
                  <RollingDigit value={Math.floor(durationObj.minutes / 10)} fontSize={12} color={colors.primaryDark} fontWeight="500" />
                  <RollingDigit value={durationObj.minutes % 10} fontSize={12} color={colors.primaryDark} fontWeight="500" />
                </View>
                <KamiText style={styles.elegantTickerLbl}>Mins</KamiText>
              </View>
              <KamiText style={[styles.elegantTickerColon, { color: colors.primary + '44' }]}>:</KamiText>
              <View style={styles.elegantTickerUnit}>
                <View style={{ flexDirection: 'row' }}>
                  <RollingDigit value={Math.floor(durationObj.seconds / 10)} fontSize={12} color={colors.primaryDark} fontWeight="500" />
                  <RollingDigit value={durationObj.seconds % 10} fontSize={12} color={colors.primaryDark} fontWeight="500" />
                </View>
                <KamiText style={styles.elegantTickerLbl}>Secs</KamiText>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.timerDisplayBox}>
            <KamiText style={styles.timerLabel} variant="caption" color={colors.textMuted} align="center">TOGETHER FOR</KamiText>
            <KamiText style={[styles.timerText, { color: colors.primaryDark }]} bold align="center">
              {durationText || 'Connected'}
            </KamiText>
          </View>
        )}

        {nextEventText ? (
          <View style={[styles.nextEventBadge, { backgroundColor: colors.primary + '12' }]}>
            <KamiText variant="caption" color={colors.primary} bold align="center">
              {nextEventText}
            </KamiText>
          </View>
        ) : null}
      </LinearGradient>
      </Animated.View>

      {/* ── 2. LIVE PRESENCE CARD ──────────────────── */}
      {isPartnerOnline && (
        <Animated.View style={entranceAnims[1].style}>
        <View style={styles.livePresenceCard}>
          <View style={styles.livePresenceLeft}>
            <View style={styles.liveGreenDot} />
            <View style={{ flex: 1 }}>
              <KamiText bold style={styles.presenceTitle}>{getPresenceDescription()}</KamiText>
              <KamiText style={styles.presenceSub}>{partnerAction !== 'idle' ? 'Active now' : 'Online'}</KamiText>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.presenceViewBtn, { backgroundColor: colors.primary + '11' }]}
            onPress={() => {
              if (
                partnerAction === 'writing_letter' ||
                partnerAction === 'editing_draft' ||
                partnerAction === 'reading_letter' ||
                partnerAction === 'viewing_letters'
              ) {
                navigation.navigate('Future');
              } else if (
                partnerAction === 'reading_memories' ||
                partnerAction === 'viewing_memory' ||
                partnerAction === 'writing_memory'
              ) {
                navigation.navigate('Memories');
              } else if (
                partnerAction === 'creating_goal' ||
                partnerAction === 'editing_goal' ||
                partnerAction === 'viewing_goals'
              ) {
                navigation.navigate('Goals');
              } else if (
                partnerAction === 'writing_journal' ||
                partnerAction === 'answering_prompt' ||
                partnerAction === 'commenting_journal' ||
                partnerAction === 'reading_journal'
              ) {
                navigation.navigate('Journal');
              }
            }}
          >
            <KamiText variant="caption" color={colors.primary} bold>View →</KamiText>
          </TouchableOpacity>
        </View>
        </Animated.View>
      )}

      {/* ── 3. TODAY'S MOMENT CARD (HERO) ─────────── */}
      <Animated.View style={entranceAnims[2].style}>
      <ImageBackground
        source={{ uri: resolvedHeroBg || 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop' }}
        style={styles.heroCardImage}
        imageStyle={{ borderRadius: 24 }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(109, 17, 41, 0.95)']}
          style={styles.heroOverlay}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <KamiText style={styles.heroBadgeText} bold>Today's Moment ✨</KamiText>
            </View>
            <View style={styles.heroMailBadge}>
              <Text style={{ fontSize: 18 }}>✉️</Text>
              {unreadLettersCount > 0 && (
                <View style={[styles.heroUnreadBadge, { backgroundColor: colors.primary }]}>
                  <KamiText style={styles.heroUnreadText} bold>{unreadLettersCount}</KamiText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.heroContentBottom}>
            <KamiText style={styles.heroTitleText}>{heroContent.title}</KamiText>
            <KamiText style={[styles.heroTitleScript, { color: colors.primaryLight }]}>{heroContent.script}</KamiText>
            <KamiText style={styles.heroTimeText}>{heroContent.time}</KamiText>
            <TouchableOpacity
              style={styles.heroCtaBtn}
              onPress={() => navigation.navigate('Future')}
            >
              <KamiText bold style={{ color: colors.primary }}>{heroContent.cta}</KamiText>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
      </Animated.View>

      {/* ── CANDID ACCESS BUTTONS ──────────────────── */}
      <Animated.View style={[entranceAnims[8].style, styles.candidButtonsRow]}>
        <TouchableOpacity
          style={[styles.candidBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
          onPress={onOpenCandidWall}
          delayPressIn={0}
        >
          <Text style={styles.candidBtnIcon}>📸</Text>
          <KamiText bold color={colors.primaryDark} style={styles.candidBtnText}>Wall</KamiText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.candidBtn, { backgroundColor: colors.primary + '25', borderColor: colors.primary + '50' }]}
          onPress={onCapture}
          delayPressIn={0}
        >
          <Text style={styles.candidBtnIcon}>⚡</Text>
          <KamiText bold color={colors.primaryDark} style={styles.candidBtnText}>Capture</KamiText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.candidBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}
          onPress={onOpenCandidViewer}
          delayPressIn={0}
        >
          <Text style={styles.candidBtnIcon}>✨</Text>
          <KamiText bold color={colors.accent} style={styles.candidBtnText}>Partner</KamiText>
        </TouchableOpacity>
      </Animated.View>


      {/* ── PARTNER SPACE CARD ──────────────────────── */}
      <Animated.View style={entranceAnims[9].style}>
        <TouchableOpacity
          style={[styles.partnerSpaceCard, { backgroundColor: colors.cardBg, borderColor: colors.primary + '22' }]}
          onPress={() => navigation.getParent()?.navigate('PartnerSpace')}
          activeOpacity={0.85}
          delayPressIn={0}
        >
          <View style={styles.partnerSpaceLeft}>
            <View style={[styles.partnerSpaceIconCircle, { backgroundColor: colors.primary + '12' }]}>
              <Text style={{ fontSize: 22 }}>💌</Text>
            </View>
            <View style={{ flex: 1 }}>
              <KamiText style={styles.widgetHeader} bold>Partner Space</KamiText>
              <KamiText variant="caption" color={colors.textMuted}>
                Decorate {partnerName}'s home screen
              </KamiText>
            </View>
          </View>
          <View style={[styles.partnerSpaceArrow, { backgroundColor: colors.primary + '12' }]}>
            <KamiText bold color={colors.primary} style={{ fontSize: 14 }}>→</KamiText>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ── 5. COUPLE MOOD RING WIDGET ───────────── */}
      <Animated.View style={entranceAnims[4].style}>
      <View style={styles.moodRingCard}>
        <View style={styles.widgetTopRow}>
          <KamiText style={styles.widgetHeader} bold>Couple Mood Ring</KamiText>
          <Text style={{ fontSize: 13 }}>🔮</Text>
        </View>

        <View style={styles.moodRingAvatarsRow}>
          {/* Left: You */}
          <View style={styles.moodRingUserCol}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.moodRingAvatar} />
            ) : (
              <View style={[styles.moodRingAvatar, { backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: 'bold' }}>{initial(name)}</Text>
              </View>
            )}
            <KamiText variant="caption" color={colors.textMuted} bold style={{ marginTop: 4 }}>You</KamiText>
            <View style={[styles.moodRingStatusPill, { backgroundColor: colors.primary + '11' }]}>
              <Text style={{ fontSize: 16 }}>{user?.currentMoodEmoji || '❓'}</Text>
              <KamiText variant="caption" color={colors.primary} bold style={{ fontSize: 10 }}>
                {user?.currentMoodEmoji ? user.currentMoodLabel : 'Set mood'}
              </KamiText>
            </View>
          </View>

          {/* Center Connect Line */}
          <Animated.View style={[styles.moodRingCenterLine, { transform: [{ rotate: orbitSpin }] }]}>
            <Text style={{ fontSize: 16, color: colors.primary }}>💖</Text>
          </Animated.View>

          {/* Right: Partner */}
          <View style={styles.moodRingUserCol}>
            {partner?.avatarUrl ? (
              <Image source={{ uri: partner.avatarUrl }} style={styles.moodRingAvatar} />
            ) : (
              <View style={[styles.moodRingAvatar, { backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: 'bold' }}>{initial(partnerName)}</Text>
              </View>
            )}
            <KamiText variant="caption" color={colors.textMuted} bold style={{ marginTop: 4 }}>{partnerName}</KamiText>
            <View style={[styles.moodRingStatusPill, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={{ fontSize: 16 }}>{partner?.currentMoodEmoji || '❓'}</Text>
              <KamiText variant="caption" color={colors.textSecondary} bold style={{ fontSize: 10 }}>
                {partner?.currentMoodEmoji ? partner.currentMoodLabel : 'No mood set'}
              </KamiText>
            </View>
          </View>
        </View>

        {/* Quick Share Mood Chips */}
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(0, 0, 0, 0.05)', paddingTop: Space[3], marginTop: Space[2] }}>
          <KamiText variant="caption" color={colors.textMuted} style={{ marginBottom: Space[2] }}>How are you feeling right now?</KamiText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRingChipsRow}>
            <TouchableOpacity
              onPress={() => setCustomMoodModalVisible(true)}
              style={[
                styles.moodRingChip,
                { borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: colors.primary + '08' }
              ]}
            >
              <Text style={{ fontSize: 16 }}>🔮</Text>
              <KamiText variant="caption" color={colors.primary} bold>
                Custom Status
              </KamiText>
            </TouchableOpacity>
            {MOODS.map(m => {
              const isCurrent = user?.currentMoodEmoji === m.emoji;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={async () => {
                    await updateProfile({ currentMoodEmoji: m.emoji, currentMoodLabel: m.label });
                    Alert.alert('Mood Updated 🌸', `You shared that you feel ${m.label} ${m.emoji}.`);
                  }}
                  style={[
                    styles.moodRingChip,
                    { borderColor: isCurrent ? colors.primary : colors.border + '55' },
                    isCurrent && { backgroundColor: colors.primary + '11' }
                  ]}
                >
                  <Text style={{ fontSize: 16 }}>{m.emoji}</Text>
                  <KamiText variant="caption" color={isCurrent ? colors.primary : colors.textSecondary} bold={isCurrent}>
                    {m.label}
                  </KamiText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
      </Animated.View>


      {/* ── 7. MEMORY FLASHBACK CARD ────────────────── */}
      <Animated.View style={entranceAnims[6].style}>
      {flashbackMemory && (
        <ImageBackground
          source={{ uri: flashbackImage }}
          style={styles.flashbackCardBg}
          imageStyle={{ borderRadius: 24 }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.85)']}
            style={styles.flashbackOverlay}
          >
            <View style={styles.flashbackBadge}>
              <Text style={{ fontSize: 10, marginRight: 4 }}>📅</Text>
              <KamiText style={styles.flashbackBadgeText} bold>Flashback Moment</KamiText>
            </View>

            <View style={styles.flashbackContentBottom}>
              <KamiText style={styles.flashbackTitleText}>{flashbackTitle} ❤️</KamiText>
              <KamiText style={styles.flashbackDescText}>{flashbackDesc}</KamiText>
              <TouchableOpacity
                style={styles.flashbackCta}
                onPress={() => navigation.navigate('Memories')}
              >
                <KamiText bold style={{ color: colors.primary, fontSize: 12 }}>Relive this memory →</KamiText>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </ImageBackground>
      )}
      </Animated.View>

      {/* ── 8 & 9. WIDGETS ROW SPLIT ────────────────── */}
      <Animated.View style={entranceAnims[7].style}>
      <View style={styles.widgetsSplitRow}>
        {/* Swipeable Letters Carousel Widget */}
        <View style={[styles.tornPaperWidget, { padding: 0 }]}>
          <View style={[styles.widgetTopRow, { paddingHorizontal: Space[4], paddingTop: Space[4] }]}>
            <KamiText style={styles.widgetHeader} bold>Letter Box</KamiText>
            <Text style={{ fontSize: 13 }}>✉️</Text>
          </View>

          {lettersForSlide.length > 0 ? (
            <View
              style={{ flex: 1, justifyContent: 'center' }}
              onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}
            >
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleLetterScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ alignItems: 'center' }}
              >
                {lettersForSlide.map((l: any) => {
                  const isUnlocked = Date.now() >= new Date(l.deliverAt).getTime();
                  const isMe = l.senderId === user?.id;
                  const senderLabel = isMe
                    ? `To: ${partnerName}`
                    : `From: ${partnerName}`;

                  const excerpt = isUnlocked
                    ? (l.body ? (l.body.length > 45 ? `“${l.body.substring(0, 42)}...”` : `“${l.body}”`) : 'No content')
                    : 'A surprise sealed envelope. Ready to read in the future!';

                  return (
                    <View
                      key={l.id}
                      style={{
                        width: carouselWidth || 160,
                        paddingHorizontal: Space[4],
                        paddingBottom: Space[2],
                        justifyContent: 'center',
                        gap: Space[2]
                      }}
                    >
                      <View style={styles.toLabelRow}>
                        <Text style={{ fontSize: 10 }}>{isUnlocked ? '❤️' : '🔒'}</Text>
                        <KamiText style={[styles.toLabelText, { color: isMe ? colors.primary : colors.textMuted }]} bold>
                          {senderLabel}
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
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: Space[4], paddingBottom: Space[4], alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginBottom: Space[2] }}>✉️</Text>
              <KamiText style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic', lineHeight: 16, textAlign: 'center' }}>
                No letters opened yet. Write a time capsule to surprise your partner!
              </KamiText>
              <ShimmerText shimmerColor={colors.primary}>
                <TouchableOpacity
                  style={[styles.widgetFooterCta, { marginTop: Space[2] }]}
                  onPress={() => navigation.navigate('Future')}
                >
                  <KamiText style={[styles.widgetCtaText, { color: colors.primary }]} bold>
                    Write Letter →
                  </KamiText>
                </TouchableOpacity>
              </ShimmerText>
            </View>
          )}

          {lettersForSlide.length > 1 && (
            <View style={[styles.carouselDots, { paddingBottom: Space[3] }]}>
              {lettersForSlide.map((_: any, i: number) => (
                <View
                  key={i}
                  style={[
                    styles.carouselDot,
                    { backgroundColor: i === activeLetterSlide ? colors.primary : colors.border }
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Our Goal Widget Card */}
        <View style={styles.goalWidgetCard}>
          <View style={styles.widgetTopRow}>
            <KamiText style={styles.widgetHeader} bold>Our Goal</KamiText>
            <Text style={{ fontSize: 13 }}>🏔</Text>
          </View>
          {goalTitle ? (
            <>
              <View style={{ gap: 2 }}>
                <KamiText style={styles.goalWidgetTitle} bold>{goalTitle}</KamiText>
                <KamiText style={styles.goalWidgetDaysLeft}>{goalTimeRemainingText}</KamiText>
              </View>

              <View style={styles.goalWidgetMiddle}>
                <View style={styles.avatarOverlapRow}>
                  {user?.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.widgetOverlapAvatar} />
                  ) : (
                    <View style={[styles.widgetOverlapAvatar, { backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 9, color: colors.primary, fontWeight: 'bold' }}>{initial(name)}</Text>
                    </View>
                  )}
                  {partner?.avatarUrl ? (
                    <Image source={{ uri: partner.avatarUrl }} style={[styles.widgetOverlapAvatar, { marginLeft: -12 }]} />
                  ) : (
                    <View style={[styles.widgetOverlapAvatar, { marginLeft: -12, backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 9, color: colors.primary, fontWeight: 'bold' }}>{initial(partnerName)}</Text>
                    </View>
                  )}
                </View>
                {latestCoupleGoal && (latestCoupleGoal as any).imageUrl ? (
                  <Image source={{ uri: (latestCoupleGoal as any).imageUrl }} style={styles.widgetGoalImage} />
                ) : (
                  <View style={[styles.widgetGoalImagePlaceholder, { backgroundColor: colors.creamDeep, width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 16 }}>{getGoalPlantEmoji(goalProgress)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.goalWidgetProgressRow}>
                <KamiText style={styles.progressPercentText} bold>{goalProgress}% Complete</KamiText>
                <View style={styles.progressBarTrack}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: goalProgressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            </>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', paddingVertical: Space[2], alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginBottom: Space[1] }}>🌱</Text>
              <KamiText style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic', lineHeight: 16, textAlign: 'center' }}>
                No active shared goals. Create one to track milestones together!
              </KamiText>
            </View>
          )}

          <TouchableOpacity
            style={styles.widgetFooterCta}
            onPress={() => navigation.navigate('Goals')}
          >
            <KamiText style={[styles.widgetCtaText, { color: colors.primary }]} bold>
              {goalTitle ? 'View Goal →' : 'Add Goal →'}
            </KamiText>
          </TouchableOpacity>
        </View>
      </View>
      </Animated.View>

      {/* Today's Daily Question (Redesigned, premium, elegant) */}
      <Animated.View style={entranceAnims[8].style}>
      {todayQuestion && (
        <View style={styles.dailyQuestionCard}>
          {/* Header */}
          <View style={styles.widgetTopRow}>
            <KamiText style={styles.widgetHeader} bold>Daily Reflection 💭</KamiText>
            {bothAnswered && (
              <View style={[styles.completedBadge, { backgroundColor: colors.primary + '15' }]}>
                <KamiText variant="caption" color={colors.primary} bold>COMPLETED</KamiText>
              </View>
            )}
          </View>

          {/* Question Text Box */}
          <View style={[styles.questionPromptBox, { backgroundColor: colors.creamDeep + '22', borderColor: colors.primaryLight + '22' }]}>
            <KamiText variant="body" style={styles.questionPromptText}>
              “{todayQuestion.content}”
            </KamiText>
          </View>

          {/* Answers / Inputs */}
          {bothAnswered ? (
            <View style={{ gap: Space[4], marginTop: Space[1] }}>
              {/* Mine */}
              <View style={styles.bubbleContainer}>
                <View style={styles.bubbleMetaRow}>
                  {user?.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.bubbleAvatar} />
                  ) : (
                    <View style={[styles.bubbleAvatar, { backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' }]}>
                      <KamiText style={{ fontSize: 9, color: colors.primary }} bold>Y</KamiText>
                    </View>
                  )}
                  <KamiText variant="caption" color={colors.textMuted} bold>You</KamiText>
                </View>
                <View style={[styles.bubbleMine, { backgroundColor: colors.creamDeep + '44', borderColor: colors.primaryLight + '44', alignSelf: 'flex-start' }]}>
                  <KamiText variant="body" style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 18 }}>{myAnswer.response}</KamiText>
                </View>
              </View>

              {/* Partner */}
              <View style={styles.bubbleContainer}>
                <View style={styles.bubbleMetaRow}>
                  {partner?.avatarUrl ? (
                    <Image source={{ uri: partner.avatarUrl }} style={styles.bubbleAvatar} />
                  ) : (
                    <View style={[styles.bubbleAvatar, { backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' }]}>
                      <KamiText style={{ fontSize: 9, color: colors.primary }} bold>{partnerName[0]}</KamiText>
                    </View>
                  )}
                  <KamiText variant="caption" color={colors.textMuted} bold>{partnerName}</KamiText>
                </View>
                <View style={[styles.bubblePartner, { backgroundColor: colors.inputBg, borderColor: colors.border + Opacity.strong, alignSelf: 'flex-start' }]}>
                  <KamiText variant="body" style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 18 }}>{partnerAnswer.response}</KamiText>
                </View>
              </View>
            </View>
          ) : myAnswer ? (
            <View style={styles.waitingContainer}>
              <View style={[styles.statusBadge, { backgroundColor: colors.success + '15' }]}>
                <Text style={{ fontSize: 12, color: colors.success }}>✓</Text>
                <KamiText variant="caption" color={colors.success} bold>Answered</KamiText>
              </View>
              <KamiText variant="caption" color={colors.textMuted} style={{ marginTop: 6, textAlign: 'center' }}>
                Waiting for {partnerName} to answer to reveal responses...
              </KamiText>
            </View>
          ) : (
            <View style={{ gap: Space[3], marginTop: Space[1] }}>
              <TextInput
                style={[styles.answerInput, { borderColor: colors.primary + '22', backgroundColor: colors.creamDeep + '11' }]}
                placeholder="Type your response to reveal partner's answer..."
                placeholderTextColor={colors.textMuted}
                value={answerInput}
                onChangeText={setAnswerInput}
                multiline
                numberOfLines={3}
                onFocus={() => setQuestionAnswering(true)}
                onBlur={() => setQuestionAnswering(false)}
              />
              <KamiButton
                label="Submit Answer"
                loading={submittingAnswerState}
                disabled={!answerInput.trim() || submittingAnswerState}
                onPress={() => submitAnswer(todayQuestion.id, couple.id, answerInput.trim())}
              />
            </View>
          )}
        </View>
      )}
      </Animated.View>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    gap: Space[5],
  },
  statusTimerCard: {
    padding: Space[2],
    borderRadius: 14,
    marginHorizontal: Space[8],
    marginBottom: Space[3],
    borderWidth: 1,
    borderColor: colors.border + Opacity.ghost,
    backgroundColor: 'transparent',
  },
  timerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    justifyContent: 'center',
    marginBottom: Space[3],
  },
  timerHeaderTitle: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  timerDisplayBox: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingVertical: Space[3],
    paddingHorizontal: Space[2],
    borderWidth: 1,
    borderColor: colors.border + Opacity.ghost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerLabel: {
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 4,
  },
  timerText: {
    fontSize: FontSize.base + 1,
    fontWeight: FontWeight.bold,
    lineHeight: 24,
    fontFamily: FontFamily.display,
  },
  nextEventBadge: {
    alignSelf: 'center',
    paddingVertical: Space[2] - 2,
    paddingHorizontal: Space[4],
    borderRadius: Radii.full,
    marginTop: Space[3],
  },
  elegantClockWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Space[1],
  },
  elegantMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Space[3],
    marginBottom: Space[1],
  },
  elegantMainUnit: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  elegantMainVal: {
    fontSize: 36,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  elegantMainLbl: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  elegantDivider: {
    width: '60%',
    height: 1,
    marginVertical: Space[2],
  },
  elegantTickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[1] + 2,
  },
  elegantTickerUnit: {
    alignItems: 'center',
    minWidth: 28,
  },
  elegantTickerVal: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily.body,
  },
  elegantTickerColon: {
    fontSize: 12,
    fontWeight: '400',
    alignSelf: 'center',
    marginBottom: 2,
  },
  elegantTickerLbl: {
    fontSize: 8,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 0,
  },
  livePresenceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: Radii.full,
    paddingVertical: Space[2],
    paddingHorizontal: Space[4],
    borderWidth: 1,
    borderColor: colors.border + Opacity.ghost,
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
    color: colors.textPrimary,
  },
  presenceSub: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  presenceViewBtn: {
    paddingVertical: Space[1] + 2,
    paddingHorizontal: Space[4],
    borderRadius: Radii.full,
  },
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
    color: colors.textSecondary,
  },
  moodRingCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: Space[5],
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.subtle,
    ...Shadows.md,
    elevation: 3,
    marginHorizontal: Space[5],
    marginBottom: Space[5],
    gap: Space[4],
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
  moodRingAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space[2],
  },
  moodRingUserCol: {
    alignItems: 'center',
    flex: 1,
  },
  moodRingAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#fff',
    ...Shadows.sm,
    elevation: 2,
  },
  moodRingCenterLine: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space[2],
  },
  moodRingStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space[3],
    paddingVertical: 4,
    borderRadius: Radii.full,
    marginTop: Space[2],
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  moodRingChipsRow: {
    gap: Space[2],
    paddingBottom: 4,
  },
  moodRingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space[3],
    paddingVertical: Space[2] - 2,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    backgroundColor: colors.inputBg,
  },
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
  verticalTimelineWrap: {
    marginHorizontal: Space[5],
    paddingVertical: Space[2],
  },
  timelineItemRow: {
    flexDirection: 'row',
    gap: Space[3],
    minHeight: 64,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 38,
  },
  timelineIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
    ...Shadows.sm,
  },
  timelineConnectorLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineRightContent: {
    flex: 1,
    paddingBottom: Space[4],
  },
  timelineMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Space[2],
  },
  timelineItemTitle: {
    fontSize: FontSize.sm,
    color: colors.textPrimary,
    flex: 1,
  },
  timelineItemTime: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: FontSize.xs,
    color: colors.textMuted,
    fontWeight: '400',
  },
  timelineItemDesc: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  emptyJourneyBox: {
    padding: Space[5],
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.medium,
    borderStyle: 'dashed',
    marginHorizontal: Space[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  widgetsSplitRow: {
    flexDirection: 'row',
    gap: Space[4],
    marginHorizontal: Space[5],
    marginBottom: Space[5],
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
  goalWidgetCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: Space[4],
    borderWidth: 1,
    borderColor: colors.border + Opacity.strong,
    ...Shadows.sm,
    elevation: 2,
    justifyContent: 'space-between',
    minHeight: 180,
  },
  goalWidgetTitle: {
    fontSize: 14,
    fontFamily: FontFamily.display,
    color: colors.textPrimary,
    marginTop: 4,
  },
  goalWidgetDaysLeft: {
    fontSize: 10,
    color: colors.textSecondary,
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
    borderColor: colors.cardBg,
    backgroundColor: colors.creamDeep,
  },
  widgetGoalImage: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.creamDeep,
  },
  widgetGoalImagePlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalWidgetProgressRow: {
    gap: 4,
    marginVertical: 4,
  },
  progressPercentText: {
    fontSize: 9,
    color: colors.textSecondary,
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
  dailyQuestionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: Space[5],
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.subtle,
    ...Shadows.md,
    marginHorizontal: Space[5],
    marginBottom: Space[5],
    gap: Space[4],
  },
  completedBadge: {
    paddingHorizontal: Space[2] + 2,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionPromptBox: {
    padding: Space[4],
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  questionPromptText: {
    fontSize: FontSize.md,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 22,
    color: '#4A3B32',
    fontFamily: FontFamily.display,
    textAlign: 'center',
  },
  bubbleContainer: {
    gap: 4,
    width: '100%',
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  bubbleAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  bubbleMine: {
    padding: Space[4],
    borderRadius: Radii.card,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-end',
    maxWidth: '85%',
    shadowColor: colors.primary,
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
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[3],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[1],
    paddingHorizontal: Space[3],
    paddingVertical: Space[1] - 2,
    borderRadius: Radii.full,
  },
  answerInput: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: Radii.input,
    padding: Space[4],
    color: colors.textPrimary,
    textAlignVertical: 'top',
    fontSize: FontSize.base,
  },
  candidButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space[3],
    marginHorizontal: Space[5],
    marginBottom: Space[5],
  },
  candidBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radii.card,
    borderWidth: 1,
    ...Shadows.sm,
  },
  candidBtnIcon: {
    fontSize: 16,
    marginRight: Space[2],
  },
  candidBtnText: {
    fontSize: FontSize.sm,
  },
  partnerSpaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Space[4],
    borderRadius: Radii.card,
    borderWidth: 1,
    ...Shadows.sm,
  },
  partnerSpaceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    flex: 1,
  },
  partnerSpaceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerSpaceArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
