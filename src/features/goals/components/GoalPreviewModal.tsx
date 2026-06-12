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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, Radii, Space, Shadows } from '@shared/constants';
import { useTheme } from '@shared/hooks';
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
        <View style={gp.header}>
          <KamiText variant="title">Preview Goal</KamiText>
          <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleOptionsPress}
              style={[gp.menuBtn, { backgroundColor: colors.primary + '18' }]}
              accessibilityRole="button"
              accessibilityLabel="Options"
            >
              <Text style={{ fontSize: 18, color: colors.primary, fontWeight: 'bold' }}>☰</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={gp.closeBtn} accessibilityRole="button" accessibilityLabel="Close Preview">
              <KamiText variant="label" color={Colors.textMuted} bold style={{ fontSize: 13 }}>Close</KamiText>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={gp.scroll} showsVerticalScrollIndicator={false}>
          {/* Cover Photo */}
          {imageUrl && (
            <View style={gp.coverWrap}>
              <Image source={{ uri: imageUrl }} style={gp.cover} />
              <View style={gp.coverOverlay} />
            </View>
          )}

          {/* Goal title & emoji */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
            <Text style={{ fontSize: 36 }}>{goal.emoji}</Text>
            <KamiText variant="subtitle" bold style={[gp.title, { flex: 1 }]}>
              {goal.title}
            </KamiText>
          </View>

          {/* Description */}
          {goal.description && (
            <View style={gp.descBox}>
              <KamiText variant="body" color={Colors.textSecondary} style={{ fontStyle: 'italic', lineHeight: 22 }}>
                "{goal.description}"
              </KamiText>
            </View>
          )}

          {/* Metadata chips */}
          <View style={gp.metaRow}>
            {cat && (
              <View style={[gp.badge, { backgroundColor: colors.primary + '11' }]}>
                <KamiText variant="caption" color={colors.primary} bold>{cat.emoji} {cat.label}</KamiText>
              </View>
            )}
            {goal.targetDate && (
              <View style={[gp.badge, { backgroundColor: '#F1F5F9' }]}>
                <KamiText variant="caption" color={Colors.textSecondary} bold>
                  🗓 Due: {new Date(goal.targetDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: user?.timezone ?? 'UTC',
                  })}
                </KamiText>
              </View>
            )}
          </View>

          {/* Progress Section */}
          <View style={gp.progressSection}>
            <View style={gp.progressHeader}>
              <View style={gp.stageIndicator}>
                <Text style={{ fontSize: 16 }}>{getStageEmoji()}</Text>
                <KamiText variant="label" bold color={completed ? Colors.success : colors.primary}>
                  {getStageName()}
                </KamiText>
              </View>
              <KamiText variant="label" bold color={completed ? Colors.success : colors.primary}>
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

          {/* Stepper controls if active */}
          {!completed && (
            <View style={gp.stepperContainer}>
              <KamiText variant="overline" style={{ marginBottom: Space[2] }}>Adjust Progress</KamiText>
              <View style={gp.stepperRow}>
                {/* Decrements */}
                <View style={gp.stepperGroup}>
                  <TouchableOpacity style={gp.stepperBtn} onPress={() => onProgress(goal, -10)} disabled={goal.progress === 0}>
                    <KamiText variant="caption" color={Colors.textSecondary} bold>-10%</KamiText>
                  </TouchableOpacity>
                  <TouchableOpacity style={gp.stepperBtn} onPress={() => onProgress(goal, -5)} disabled={goal.progress === 0}>
                    <KamiText variant="caption" color={Colors.textSecondary} bold>-5%</KamiText>
                  </TouchableOpacity>
                  <TouchableOpacity style={gp.stepperBtn} onPress={() => onProgress(goal, -2)} disabled={goal.progress === 0}>
                    <KamiText variant="caption" color={Colors.textSecondary} bold>-2%</KamiText>
                  </TouchableOpacity>
                </View>

                {/* Increments */}
                <View style={gp.stepperGroup}>
                  <TouchableOpacity style={[gp.stepperBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33' }]} onPress={() => onProgress(goal, 2)} disabled={goal.progress === 100}>
                    <KamiText variant="caption" color={colors.primary} bold>+2%</KamiText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[gp.stepperBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33' }]} onPress={() => onProgress(goal, 5)} disabled={goal.progress === 100}>
                    <KamiText variant="caption" color={colors.primary} bold>+5%</KamiText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[gp.stepperBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => onProgress(goal, 10)} disabled={goal.progress === 100}>
                    <KamiText variant="caption" color="#fff" bold>+10%</KamiText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {completed && (
            <View style={gp.completedBadge}>
              <Text style={{ fontSize: 18 }}>🌸</Text>
              <KamiText variant="body" color={Colors.success} bold>Bloomed & Completed Goal</KamiText>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const gp = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  menuBtn: { paddingVertical: Space[1] + 2, paddingHorizontal: Space[3], borderRadius: Radii.md },
  closeBtn: { padding: Space[2] },
  scroll: { padding: Space[5], gap: Space[5] },
  title: { fontSize: FontSize.lg, lineHeight: 28, color: Colors.textPrimary },
  descBox: { padding: Space[4], backgroundColor: Colors.cardBg, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.border + '22' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  badge: { paddingVertical: 4, paddingHorizontal: Space[3], borderRadius: Radii.full },
  progressSection: { marginVertical: Space[2] },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space[2] },
  stageIndicator: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  vineTrackContainer: { height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', position: 'relative', marginVertical: Space[4] },
  vineBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E2E8F0', borderRadius: 4 },
  vineFill: { height: '100%', borderRadius: 4 },
  vineNotch: { position: 'absolute', top: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -12 }], ...Shadows.sm },
  vineNotchActive: { backgroundColor: '#F0FDF4', borderWidth: 2, ...Shadows.md },
  vineNotchEmoji: { fontSize: 12 },
  stepperContainer: { marginTop: Space[2] },
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Space[3] },
  stepperGroup: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'flex-start' },
  stepperBtn: { flex: 1, height: 40, borderRadius: Radii.md, borderWidth: 1, borderColor: '#FFE3E3', backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center' },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: Space[2], backgroundColor: '#d1fae5', borderRadius: Radii.card, paddingHorizontal: Space[4], paddingVertical: Space[3], alignSelf: 'flex-start', borderWidth: 1.5, borderColor: '#6ee7b7' },
  coverWrap: { width: '100%', height: 160, borderRadius: Radii.card, overflow: 'hidden', position: 'relative', marginBottom: Space[2] },
  cover: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
});
