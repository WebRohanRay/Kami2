import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from 'react-native';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import KamiText from '@shared/ui/atoms/KamiText';
import { FontSize, Radii, Space } from '@shared/constants';
import type { Goal, GoalCategory } from '@features/home/types';
import type { CoupleGoal } from '@features/couple/types';
import { pickImages } from '@shared/lib/storage';
import { goalSchema } from '@shared/lib/validation/schemas';
import { useTheme } from '@shared/hooks';
import { CATEGORIES, EMOJIS } from './utils';

interface GoalModalProps {
  visible: boolean;
  goal: Goal | CoupleGoal | null;
  onClose: () => void;
  onSave: (
    title: string,
    cat: GoalCategory,
    emoji: string,
    desc: string | undefined,
    coverUri: string | null
  ) => Promise<void>;
  saving: boolean;
  activeSpace: 'personal' | 'couple';
}

export const GoalModal: React.FC<GoalModalProps> = ({
  visible,
  goal,
  onClose,
  onSave,
  saving,
  activeSpace,
}) => {
  const { colors } = useTheme();
  const gm = React.useMemo(() => getStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<GoalCategory>('personal');
  const [emoji, setEmoji] = useState('🌱');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(goal?.title ?? '');
      setDesc(goal?.description ?? '');
      setCategory((goal?.category as GoalCategory) ?? 'personal');
      setEmoji(goal?.emoji ?? '🌱');
      setCoverUri(goal && 'imageUrl' in goal ? (goal as any).imageUrl : null);
    }
  }, [visible, goal]);

  const handlePickCover = async () => {
    setPicking(true);
    const r = await pickImages(false);
    setPicking(false);
    if (r.success) {
      setCoverUri(r.uris[0]);
    } else if (!r.cancelled) {
      Alert.alert('Kami', r.error);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[gm.root, { backgroundColor: colors.pageBg }]}>
        <View style={gm.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">{goal ? 'Edit goal' : 'New goal'}</KamiText>
          <TouchableOpacity
            onPress={() => {
              const validation = goalSchema.safeParse({ title, description: desc });
              if (!validation.success) {
                Alert.alert('Kami', validation.error.issues[0].message);
                return;
              }
              Keyboard.dismiss();
              onSave(title.trim(), category, emoji, desc.trim() || undefined, coverUri);
            }}
            disabled={saving}
            hitSlop={8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <KamiText variant="label" color={colors.primary} bold>
                Save
              </KamiText>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={gm.content}>
          {/* Emoji */}
          <KamiText variant="overline" style={gm.sectionLabel}>Icon</KamiText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={gm.emojiRow}>
              {EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[
                    gm.emojiBtn,
                    emoji === e && [
                      gm.emojiBtnOn,
                      { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                    ],
                  ]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Title */}
          <KamiText variant="overline" style={gm.sectionLabel}>Goal *</KamiText>
          <TextInput
            style={gm.input}
            placeholder="e.g. Read 12 books this year"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            autoFocus={!goal}
          />

          {/* Description */}
          <KamiText variant="overline" style={gm.sectionLabel}>Why it matters (optional)</KamiText>
          <TextInput
            style={[gm.input, { height: 75, textAlignVertical: 'top' }]}
            placeholder="Your reason keeps you motivated…"
            placeholderTextColor={colors.textMuted}
            value={desc}
            onChangeText={setDesc}
            multiline
            maxLength={300}
          />

          {/* Category */}
          <KamiText variant="overline" style={gm.sectionLabel}>Category</KamiText>
          <View style={gm.catGrid}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[
                  gm.catChip,
                  category === c.id && [
                    gm.catChipOn,
                    { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                  ],
                ]}
                onPress={() => setCategory(c.id)}
              >
                <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                <KamiText
                  variant="caption"
                  color={category === c.id ? colors.primary : colors.textMuted}
                  bold={category === c.id}
                >
                  {c.label}
                </KamiText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cover Image */}
          {activeSpace === 'personal' && (
            <>
              <View style={gm.coverHeader}>
                <KamiText variant="overline">Cover Photo (optional)</KamiText>
                <TouchableOpacity onPress={handlePickCover} style={gm.addCoverBtn} disabled={picking}>
                  {picking ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <KamiText variant="caption" color={colors.primary} bold>
                      {coverUri ? 'Change Photo' : '+ Choose Cover'}
                    </KamiText>
                  )}
                </TouchableOpacity>
              </View>

              {coverUri && (
                <View style={gm.coverPreviewWrap}>
                  <KamiImage src={coverUri} bucket="goal_images" style={gm.coverPreview} />
                  <TouchableOpacity style={gm.removeCoverBadge} onPress={() => setCoverUri(null)}>
                    <Text style={{ color: '#fff', fontSize: 11 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space[5],
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4],
    paddingBottom: Space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '44',
  },
  content: { padding: Space[5], gap: Space[3], paddingBottom: Space[10] },
  sectionLabel: { marginBottom: Space[1] },
  emojiRow: { flexDirection: 'row', gap: Space[2], paddingVertical: Space[2] },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: Radii.sm,
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  emojiBtnOn: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  input: {
    backgroundColor: colors.creamDeep,
    borderRadius: Radii.input,
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
    fontSize: FontSize.base,
    color: colors.textPrimary,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[1],
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.creamDeep,
  },
  catChipOn: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  coverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space[3],
    borderTopWidth: 1,
    borderTopColor: colors.border + '22',
    paddingTop: Space[3],
  },
  addCoverBtn: { paddingVertical: Space[1], paddingHorizontal: Space[2] },
  coverPreviewWrap: { position: 'relative', marginTop: Space[2], borderRadius: Radii.card, overflow: 'hidden', height: 160 },
  coverPreview: { width: '100%', height: '100%' },
  removeCoverBadge: {
    position: 'absolute',
    top: Space[2],
    right: Space[2],
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBg,
  },
});
