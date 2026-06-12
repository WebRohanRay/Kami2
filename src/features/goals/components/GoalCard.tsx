import React, { useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, Radii, Space, Shadows } from '@shared/constants';
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
  const { scaleSize } = useTextScale();
  const sc = useRef(new Animated.Value(1)).current;
  const cat = CATEGORIES.find(c => c.id === goal.category);
  const imageUrl = 'imageUrl' in goal ? (goal as any).imageUrl : null;

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
            <Image source={{ uri: imageUrl }} style={styles.cardCover} />
            <View style={styles.cardCoverOverlay} />
          </View>
        )}

        <View style={styles.cardTop}>
          <View style={[styles.gardenBadge, { borderColor: completed ? '#6EE7B7' : '#A7F3D0' }]}>
            <Text style={{ fontSize: 20 }}>{getStageEmoji()}</Text>
          </View>
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
                { color: Colors.textPrimary },
              ]}
            >
              {goal.title} {goal.emoji}
            </KamiText>
            {goal.description ? (
              <KamiText variant="caption" color={imageUrl ? '#e0d5d7' : Colors.textMuted} numberOfLines={1}>
                {goal.description}
              </KamiText>
            ) : (
              <KamiText variant="caption" color={imageUrl ? '#e0d5d7' : Colors.textMuted}>
                {cat?.emoji} {cat?.label}
              </KamiText>
            )}
          </View>
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.delBtn}>
            <Text style={{ fontSize: 12, color: Colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Organic Progress Section */}
        <View style={styles.organicProgSection}>
          <View style={styles.organicProgHeader}>
            <View style={styles.stageIndicator}>
              <Text style={{ fontSize: 12 }}>{getStageEmoji()}</Text>
              <KamiText variant="caption" bold color={completed ? Colors.success : colors.primary}>
                {getStageName()}
              </KamiText>
            </View>
            <KamiText variant="caption" bold color={completed ? Colors.success : colors.primary}>
              {goal.progress}%
            </KamiText>
          </View>

          <View style={styles.vineTrackContainer}>
            {/* Vine background line */}
            <View style={styles.vineBg} />
            {/* Active vine progress line */}
            <LinearGradient
              colors={completed ? ['#34D399', '#059669'] : [colors.primary, colors.primaryDark || colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.vineFill, { width: `${goal.progress}%` }]}
            />

            {/* Organic Growth Notches */}
            {/* Sprout Notch at 30% */}
            <View style={[
              styles.vineNotch,
              { left: '30%' },
              goal.progress >= 30 && [styles.vineNotchActive, { borderColor: completed ? Colors.success : colors.primary }],
            ]}>
              <Text style={[styles.vineNotchEmoji, { opacity: goal.progress >= 30 ? 1 : 0.4 }]}>🌱</Text>
            </View>

            {/* Grow Notch at 70% */}
            <View style={[
              styles.vineNotch,
              { left: '70%' },
              goal.progress >= 70 && [styles.vineNotchActive, { borderColor: completed ? Colors.success : colors.primary }],
            ]}>
              <Text style={[styles.vineNotchEmoji, { opacity: goal.progress >= 70 ? 1 : 0.4 }]}>🌿</Text>
            </View>

            {/* Bloom Notch at 100% */}
            <View style={[
              styles.vineNotch,
              { left: '100%' },
              goal.progress >= 100 && [styles.vineNotchActive, { borderColor: completed ? Colors.success : '#34D399' }],
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
                ? <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1} style={{ fontSize: 9 }}>🗓 {daysLeft(goal.targetDate)}</KamiText>
                : <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1} style={{ fontSize: 9 }}>{STATUS_LABELS[goal.status]}</KamiText>
              }
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity style={[styles.ctrlBtnCompact, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33' }]} onPress={() => { Vibration.vibrate(15); onProgress(goal, 2); }} disabled={goal.progress === 100}>
                <KamiText style={[styles.ctrlTextCompact, { color: colors.primary, fontSize: scaleSize(9) }]}>+2%</KamiText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtnCompact, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33' }]} onPress={() => { Vibration.vibrate(15); onProgress(goal, 5); }} disabled={goal.progress === 100}>
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
            <KamiText variant="caption" color={Colors.success} bold>Bloomed & Completed</KamiText>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { position: 'relative', borderRadius: Radii.card, padding: Space[4], gap: Space[3], borderWidth: 1.5, overflow: 'hidden', ...Shadows.md, elevation: 3 },
  cardActive: {
    backgroundColor: '#FFFDFD',
    borderColor: 'rgba(201, 104, 130, 0.12)',
  },
  cardDone: {
    opacity: 0.9,
    backgroundColor: '#F3FAF6',
    borderColor: '#CBECE0',
  },
  cardCoverWrap: { ...StyleSheet.absoluteFillObject, height: 80, overflow: 'hidden' },
  cardCover: { width: '100%', height: '100%' },
  cardCoverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  gardenBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dcfce7', ...Shadows.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space[3], zIndex: 1 },
  delBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border + '33', zIndex: 2 },
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
    backgroundColor: '#E2E8F0',
    position: 'relative',
    marginVertical: Space[3],
    marginHorizontal: Space[2],
  },
  vineBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E2E8F0',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -12 }],
    ...Shadows.sm,
  },
  vineNotchActive: {
    backgroundColor: '#F0FDF4',
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
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE3E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlTextCompact: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: Space[2], backgroundColor: '#d1fae5', borderRadius: Radii.sm, paddingHorizontal: Space[3], paddingVertical: Space[2], alignSelf: 'flex-start', borderWidth: 1, borderColor: '#6ee7b7' },
});
