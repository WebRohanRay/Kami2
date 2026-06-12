import React from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, Radii, Space, Shadows } from '@shared/constants';
import { useTheme, useTextScale } from '@shared/hooks';
import { useAuthStore } from '@features/auth';
import type { Goal } from '@features/home/types';
import type { CoupleGoal } from '@features/couple/types';
import { CATEGORIES } from './utils';

interface GoalPreviewModalProps {
  visible: boolean;
  goal: Goal | CoupleGoal | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onProgress: (g: Goal | CoupleGoal, delta: number) => void;
}

export const GoalPreviewModal: React.FC<GoalPreviewModalProps> = ({
  visible,
  goal,
  onClose,
  onEdit,
  onDelete,
  onProgress,
}) => {
  const { colors } = useTheme();
  const { scaleSize } = useTextScale();
  const user = useAuthStore(s => s.user);

  if (!goal) return null;

  const completed = goal.status === 'completed';
  const cat = CATEGORIES.find(c => c.id === goal.category);
  const imageUrl = 'imageUrl' in goal ? (goal as any).imageUrl : null;

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

  const handleOptionsPress = () => {
    const options = [
      { text: 'Cancel', style: 'cancel' as const },
      {
        text: 'Edit Goal',
        onPress: () => {
          onClose();
          onEdit();
        },
      },
      {
        text: 'Delete Goal',
        style: 'destructive' as const,
        onPress: () => {
          onClose();
          onDelete();
        },
      },
    ];
    Alert.alert('Options', undefined, options);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[gp.root, { backgroundColor: colors.pageBg }]}>
        {/* Modern Borderless Header */}
        <View style={[gp.header, { borderBottomColor: 'rgba(28,25,23,0.06)' }]}>
          <KamiText variant="title" bold>Preview Goal</KamiText>
          <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleOptionsPress}
              style={[gp.menuBtn, { backgroundColor: colors.primary + '18' }]}
              accessibilityRole="button"
              accessibilityLabel="Options"
            >
              <Text style={{ fontSize: 16, color: colors.primary, fontWeight: 'bold' }}>•••</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[gp.closeBtn, { backgroundColor: 'rgba(28,25,23,0.06)' }]} accessibilityRole="button" accessibilityLabel="Close Preview">
              <KamiText variant="caption" color={Colors.textPrimary} bold>Close</KamiText>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={gp.scroll} showsVerticalScrollIndicator={false}>
          {/* Immersive Cover Photo */}
          {imageUrl ? (
            <View style={gp.coverWrap}>
              <Image source={{ uri: imageUrl }} style={gp.cover} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)']}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          ) : (
            <View style={[gp.coverPlaceholder, { backgroundColor: colors.creamDeep }]}>
              <Text style={{ fontSize: 44, opacity: 0.85 }}>🎯</Text>
            </View>
          )}

          {/* Premium Goal Card details */}
          <View style={gp.cardDetails}>
            <View style={gp.titleRow}>
              <Text style={gp.emojiBadge}>{goal.emoji}</Text>
              <KamiText variant="title" bold style={gp.title}>
                {goal.title}
              </KamiText>
            </View>

            {/* Description quote styling */}
            {goal.description && (
              <View style={[gp.descBox, { backgroundColor: colors.creamDeep + '44', borderColor: colors.primary + '1a' }]}>
                <KamiText variant="body" color={Colors.textSecondary} style={{ fontStyle: 'italic', lineHeight: 22 }}>
                  "{goal.description}"
                </KamiText>
              </View>
            )}

            {/* Metadata tags */}
            <View style={gp.metaRow}>
              {cat && (
                <View style={[gp.badge, { backgroundColor: colors.primary + '15' }]}>
                  <KamiText variant="caption" color={colors.primary} bold>{cat.emoji} {cat.label}</KamiText>
                </View>
              )}
              {goal.targetDate && (
                <View style={[gp.badge, { backgroundColor: 'rgba(28,25,23,0.05)' }]}>
                  <KamiText variant="caption" color={Colors.textSecondary} bold>
                    🗓 Due {new Date(goal.targetDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: user?.timezone ?? 'UTC',
                    })}
                  </KamiText>
                </View>
              )}
            </View>
          </View>

          {/* Botanical Vine Progress Section */}
          <View style={[gp.progressCard, { backgroundColor: '#FFFFFF', borderColor: colors.creamMid }]}>
            <View style={gp.progressHeader}>
              <View style={gp.stageIndicator}>
                <Text style={{ fontSize: 18 }}>{getStageEmoji()}</Text>
                <KamiText variant="label" bold color={completed ? Colors.success : colors.primary}>
                  {getStageName()}
                </KamiText>
              </View>
              <KamiText variant="title" bold color={completed ? Colors.success : colors.primary}>
                {goal.progress}%
              </KamiText>
            </View>

            <View style={gp.vineTrackContainer}>
              <View style={gp.vineBg} />
              <LinearGradient
                colors={completed ? ['#34D399', '#059669'] : [colors.primary, colors.primaryDark || colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[gp.vineFill, { width: `${goal.progress}%` }]}
              />

              <View style={[
                gp.vineNotch,
                { left: '30%' },
                goal.progress >= 30 && [gp.vineNotchActive, { borderColor: completed ? Colors.success : colors.primary }],
              ]}>
                <Text style={[gp.vineNotchEmoji, { opacity: goal.progress >= 30 ? 1 : 0.4 }]}>🌱</Text>
              </View>

              <View style={[
                gp.vineNotch,
                { left: '70%' },
                goal.progress >= 70 && [gp.vineNotchActive, { borderColor: completed ? Colors.success : colors.primary }],
              ]}>
                <Text style={[gp.vineNotchEmoji, { opacity: goal.progress >= 70 ? 1 : 0.4 }]}>🌿</Text>
              </View>

              <View style={[
                gp.vineNotch,
                { left: '100%' },
                goal.progress >= 100 && [gp.vineNotchActive, { borderColor: completed ? Colors.success : '#34D399' }],
              ]}>
                <Text style={[gp.vineNotchEmoji, { opacity: goal.progress >= 100 ? 1 : 0.4 }]}>🌸</Text>
              </View>
            </View>
          </View>

          {/* Premium Stepper controls */}
          {!completed && (
            <View style={gp.stepperContainer}>
              <KamiText variant="overline" style={{ marginBottom: Space[3], color: Colors.textSecondary }}>Adjust Progress</KamiText>
              <View style={gp.stepperRow}>
                {/* Decrement group */}
                <View style={gp.stepperGroup}>
                  <TouchableOpacity style={gp.stepperBtn} onPress={() => { Vibration.vibrate(15); onProgress(goal, -10); }} disabled={goal.progress === 0}>
                    <KamiText variant="caption" color={Colors.textSecondary} bold>-10</KamiText>
                  </TouchableOpacity>
                  <TouchableOpacity style={gp.stepperBtn} onPress={() => { Vibration.vibrate(15); onProgress(goal, -5); }} disabled={goal.progress === 0}>
                    <KamiText variant="caption" color={Colors.textSecondary} bold>-5</KamiText>
                  </TouchableOpacity>
                </View>

                {/* Increment group */}
                <View style={gp.stepperGroup}>
                  <TouchableOpacity style={[gp.stepperBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '22' }]} onPress={() => { Vibration.vibrate(15); onProgress(goal, 5); }} disabled={goal.progress === 100}>
                    <KamiText variant="caption" color={colors.primary} bold>+5</KamiText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[gp.stepperBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => { Vibration.vibrate(15); onProgress(goal, 10); }} disabled={goal.progress === 100}>
                    <KamiText variant="caption" color="#fff" bold>+10</KamiText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {completed && (
            <LinearGradient
              colors={['#ECFDF5', '#D1FAE5']}
              style={[gp.completedBadge, { borderColor: '#A7F3D0' }]}
            >
              <Text style={{ fontSize: 20 }}>🌸</Text>
              <KamiText variant="body" color={Colors.success} bold>Bloomed & Completed Goal!</KamiText>
            </LinearGradient>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const gp = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 20 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1 },
  menuBtn: { paddingVertical: Space[2], paddingHorizontal: Space[3], borderRadius: Radii.md, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { paddingVertical: Space[2], paddingHorizontal: Space[4], borderRadius: Radii.full, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Space[5], gap: Space[5] },
  
  coverWrap: { width: '100%', height: 200, borderRadius: Radii.card, overflow: 'hidden', position: 'relative', ...Shadows.md },
  cover: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverPlaceholder: { width: '100%', height: 120, borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(28,25,23,0.06)' },
  
  cardDetails: { gap: Space[3] },
  titleRow: { flexDirection: 'row', gap: Space[3], alignItems: 'center' },
  emojiBadge: { fontSize: 38, width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF', textAlign: 'center', lineHeight: 50, ...Shadows.sm, borderWidth: 1, borderColor: 'rgba(28,25,23,0.06)' },
  title: { fontSize: 20, lineHeight: 28, color: Colors.textPrimary, flex: 1 },
  
  descBox: { padding: Space[4], borderRadius: Radii.card, borderWidth: 1, borderStyle: 'dashed' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  badge: { paddingVertical: Space[1], paddingHorizontal: Space[3], borderRadius: Radii.full, flexDirection: 'row', alignItems: 'center' },
  
  progressCard: { padding: Space[4], borderRadius: Radii.card, borderWidth: 1.5, ...Shadows.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space[1] },
  stageIndicator: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  
  vineTrackContainer: { height: 10, borderRadius: 5, backgroundColor: '#E2E8F0', position: 'relative', marginVertical: Space[4] },
  vineBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E2E8F0', borderRadius: 5 },
  vineFill: { height: '100%', borderRadius: 5 },
  vineNotch: { position: 'absolute', top: -9, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -14 }], ...Shadows.sm },
  vineNotchActive: { backgroundColor: '#F0FDF4', borderWidth: 2, ...Shadows.md },
  vineNotchEmoji: { fontSize: 13 },
  
  stepperContainer: { gap: Space[2] },
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Space[4] },
  stepperGroup: { flexDirection: 'row', gap: Space[2], flex: 1 },
  stepperBtn: { flex: 1, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: 'rgba(28,25,23,0.08)', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: Space[3], borderRadius: Radii.card, paddingHorizontal: Space[4], paddingVertical: Space[4], borderWidth: 1.5, ...Shadows.md },
});
