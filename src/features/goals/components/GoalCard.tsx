import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import KamiText from '@shared/ui/atoms/KamiText';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import { ParticleEmitter } from '@shared/ui/atoms/ParticleEmitter';
import { FontSize, Radii, Space, Shadows, Opacity } from '@shared/constants';
import { useTheme, useTextScale } from '@shared/hooks';
import type { Goal } from '@features/home/types';
import type { CoupleGoal } from '@features/couple/types';
import { CATEGORIES, STATUS_LABELS, daysLeft } from './utils';

interface GoalCardProps {
  goal: Goal | CoupleGoal;
  onPressCard: () => void;
  onDelete: () => void;
  onProgress: (g: Goal | CoupleGoal, delta: number) => void;
  completed?: boolean;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  onPressCard,
  onDelete,
  onProgress,
  completed,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { scaleSize } = useTextScale();
  const sc = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const cat = CATEGORIES.find(c => c.id === goal.category);
  const imageUrl = 'imageUrl' in goal ? (goal as any).imageUrl : null;
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [bloomTrigger, setBloomTrigger] = useState(0);

  // Animated progress for organic vine fill
  const progressAnim = useRef(new Animated.Value(goal.progress)).current;
  const prevProgress = useRef(goal.progress);

  useEffect(() => {
    const prev = prevProgress.current;
    const curr = goal.progress;

    // Animate the vine fill with organic ease-out
    Animated.timing(progressAnim, {
      toValue: curr,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Detect threshold crossings
    const crossedThreshold = [30, 70, 100].some(t => prev < t && curr >= t);
    if (crossedThreshold) {
      // Badge bounce
      Animated.sequence([
        Animated.spring(badgeScale, { toValue: 1.4, tension: 100, friction: 5, useNativeDriver: true }),
        Animated.spring(badgeScale, { toValue: 1.0, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();

      // Haptic feedback
      Vibration.vibrate([0, 20, 60, 20]);

      // Leaf particle burst
      setParticleTrigger(t => t + 1);
    }

    // Special bloom celebration at 100%
    if (curr >= 100 && prev < 100) {
      setBloomTrigger(t => t + 1);
    }

    prevProgress.current = curr;
  }, [goal.progress]);

  // Plant growth stage representation: Sprout 🌱 (<30%), Growing Vine 🌿 (30-99%), Blooming Flower 🌸 (100%)
  const getStageEmoji = () => {
    if (goal.progress < 30) return '🌱';
    if (goal.progress < 100) return '🌿';
    return '🌸';
  };

  const getStageName = () => {
    if (goal.progress < 30) return 'Sprouting Stage';
    if (goal.progress < 100) return 'Growing Stage';
    return 'Full Bloom';
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPressCard}
      delayPressIn={0}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[
        styles.card,
        completed ? styles.cardDone : styles.cardActive,
        { transform: [{ scale: sc }] },
      ]}>

        {/* Cover Photo */}
        {imageUrl && (
          <View style={styles.cardCoverWrap}>
            <KamiImage src={imageUrl} bucket="goal_images" style={styles.cardCover} />
            <View style={styles.cardCoverOverlay} />
          </View>
        )}

        <View style={styles.cardTop}>
          <Animated.View style={[styles.gardenBadge, { borderColor: completed ? colors.success : colors.success + Opacity.medium, transform: [{ scale: badgeScale }] }]}>
            <Text style={{ fontSize: 20 }}>{getStageEmoji()}</Text>
          </Animated.View>
          <View style={{ flex: 1, gap: 2 }}>
            <KamiText
              variant="label"
              numberOfLines={1}
              style={[
                imageUrl && {
                  color: '#fff',
                  textShadowColor: 'rgba(0,0,0,0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                },
                { color: colors.textPrimary },
              ]}
            >
              {goal.title} {goal.emoji}
            </KamiText>
            {goal.description ? (
              <KamiText variant="caption" color={imageUrl ? '#e0d5d7' : colors.textMuted} numberOfLines={1}>
                {goal.description}
              </KamiText>
            ) : (
              <KamiText variant="caption" color={imageUrl ? '#e0d5d7' : colors.textMuted}>
                {cat?.emoji} {cat?.label}
              </KamiText>
            )}
          </View>
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.delBtn}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Organic Progress Section */}
        <View style={styles.organicProgSection}>
          <View style={styles.organicProgHeader}>
            <View style={styles.stageIndicator}>
              <Text style={{ fontSize: 12 }}>{getStageEmoji()}</Text>
              <KamiText variant="caption" bold color={completed ? colors.success : colors.primary}>
                {getStageName()}
              </KamiText>
            </View>
            <KamiText variant="caption" bold color={completed ? colors.success : colors.primary}>
              {goal.progress}%
            </KamiText>
          </View>

          <View style={styles.vineTrackContainer}>
            {/* Vine background line */}
            <View style={styles.vineBg} />
            {/* Active vine progress line (animated) */}
            <Animated.View
              style={[
                styles.vineFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            >
              <LinearGradient
                colors={completed ? ['#34D399', '#059669'] : [colors.primary, colors.primaryDark || colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>

            {/* Particle emitter for milestone celebrations */}
            <ParticleEmitter
              trigger={particleTrigger}
              particles={['🍃', '🌿', '✨']}
              count={8}
              direction="up"
              distance={80}
            />
            <ParticleEmitter
              trigger={bloomTrigger}
              particles={['🌸', '🌺', '💮', '✨', '🎉']}
              count={18}
              direction="radial"
              distance={100}
            />

            {/* Organic Growth Notches */}
            {/* Sprout Notch at 30% */}
            <View style={[
              styles.vineNotch,
              { left: '30%' },
              goal.progress >= 30 && [styles.vineNotchActive, { borderColor: completed ? colors.success : colors.primary }],
            ]}>
              <Text style={[styles.vineNotchEmoji, { opacity: goal.progress >= 30 ? 1 : 0.4 }]}>🌱</Text>
            </View>

            {/* Grow Notch at 70% */}
            <View style={[
              styles.vineNotch,
              { left: '70%' },
              goal.progress >= 70 && [styles.vineNotchActive, { borderColor: completed ? colors.success : colors.primary }],
            ]}>
              <Text style={[styles.vineNotchEmoji, { opacity: goal.progress >= 70 ? 1 : 0.4 }]}>🌿</Text>
            </View>

            {/* Bloom Notch at 100% */}
            <View style={[
              styles.vineNotch,
              { left: '100%' },
              goal.progress >= 100 && [styles.vineNotchActive, { borderColor: completed ? colors.success : '#34D399' }],
            ]}>
              <Text style={[styles.vineNotchEmoji, { opacity: goal.progress >= 100 ? 1 : 0.4 }]}>🌸</Text>
            </View>
          </View>
        </View>

        {!completed && (
          <View style={styles.controls}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity style={styles.ctrlBtnCompact} onPress={() => { Vibration.vibrate(15); onProgress(goal, -10); }} disabled={goal.progress === 0}>
                <KamiText style={[styles.ctrlTextCompact, { fontSize: scaleSize(9) }]}>-10%</KamiText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtnCompact} onPress={() => { Vibration.vibrate(15); onProgress(goal, -5); }} disabled={goal.progress === 0}>
                <KamiText style={[styles.ctrlTextCompact, { fontSize: scaleSize(9) }]}>-5%</KamiText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtnCompact} onPress={() => { Vibration.vibrate(15); onProgress(goal, -2); }} disabled={goal.progress === 0}>
                <KamiText style={[styles.ctrlTextCompact, { fontSize: scaleSize(9) }]}>-2%</KamiText>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {goal.targetDate
                ? <KamiText variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 9 }}>🗓 {daysLeft(goal.targetDate)}</KamiText>
                : <KamiText variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 9 }}>{STATUS_LABELS[goal.status]}</KamiText>
              }
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity style={[styles.ctrlBtnCompact, { backgroundColor: colors.primary + Opacity.light, borderColor: colors.primary + Opacity.medium }]} onPress={() => { Vibration.vibrate(15); onProgress(goal, 2); }} disabled={goal.progress === 100}>
                <KamiText style={[styles.ctrlTextCompact, { color: colors.primary, fontSize: scaleSize(9) }]}>+2%</KamiText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtnCompact, { backgroundColor: colors.primary + Opacity.light, borderColor: colors.primary + Opacity.medium }]} onPress={() => { Vibration.vibrate(15); onProgress(goal, 5); }} disabled={goal.progress === 100}>
                <KamiText style={[styles.ctrlTextCompact, { color: colors.primary, fontSize: scaleSize(9) }]}>+5%</KamiText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtnCompact, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => { Vibration.vibrate(15); onProgress(goal, 10); }} disabled={goal.progress === 100}>
                <KamiText style={[styles.ctrlTextCompact, { color: '#fff', fontSize: scaleSize(9) }]}>+10%</KamiText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {completed && (
          <View style={styles.completedBadge}>
            <Text style={{ fontSize: 14 }}>🌸</Text>
            <KamiText variant="caption" color={colors.success} bold>Bloomed & Completed</KamiText>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  card: { position: 'relative', borderRadius: Radii.card, padding: Space[4], gap: Space[3], borderWidth: 1.5, overflow: 'hidden', ...Shadows.md, elevation: 3 },
  cardActive: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border + Opacity.subtle,
  },
  cardDone: {
    opacity: 0.9,
    backgroundColor: colors.success + Opacity.ghost,
    borderColor: colors.success + Opacity.medium,
  },
  cardCoverWrap: { ...StyleSheet.absoluteFillObject, height: 80, overflow: 'hidden' },
  cardCover: { width: '100%', height: '100%' },
  cardCoverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  gardenBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.success + Opacity.muted, ...Shadows.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space[3], zIndex: 1 },
  delBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border + Opacity.medium, zIndex: 2 },
  organicProgSection: {
    gap: Space[2],
    marginVertical: Space[1],
  },
  organicProgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[1],
  },
  vineTrackContainer: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border + Opacity.medium,
    position: 'relative',
    marginVertical: Space[3],
    marginHorizontal: Space[2],
  },
  vineBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.border + Opacity.medium,
    borderRadius: 3,
  },
  vineFill: {
    height: '100%',
    borderRadius: 3,
  },
  vineNotch: {
    position: 'absolute',
    top: -9,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -12 }],
    ...Shadows.sm,
  },
  vineNotchActive: {
    backgroundColor: colors.success + Opacity.ghost,
    borderWidth: 2,
    ...Shadows.md,
  },
  vineNotchEmoji: {
    fontSize: 12,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  ctrlBtnCompact: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border + Opacity.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlTextCompact: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: Space[2], backgroundColor: colors.success + Opacity.muted, borderRadius: Radii.sm, paddingHorizontal: Space[3], paddingVertical: Space[2], alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.success + Opacity.strong },
});
