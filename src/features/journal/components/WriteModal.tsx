import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useTheme } from '@shared/hooks';
import { useAuthStore } from '@features/auth';
import KamiText from '@shared/ui/atoms/KamiText';

import { FontSize, FontWeight, Radii, Space } from '@shared/constants';
import { pickImages } from '@shared/lib/storage';
import { journalSchema } from '@shared/lib/validation/schemas';
import type { JournalEntry } from '@features/home/types';

// Common tags for couples/reflections
export const JOURNAL_TAGS = ['gratitude', 'reflection', 'relationship', 'ideas', 'growth', 'creative'];

interface WriteModalProps {
  visible: boolean;
  entry: JournalEntry | null;
  onClose: () => void;
  onSave: (body: string, title: string | undefined, tags: string[], imageUris: string[], moodId: string | null) => Promise<void>;
  saving: boolean;
}

export const WriteModal: React.FC<WriteModalProps> = ({
  visible,
  entry,
  onClose,
  onSave,
  saving,
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const timezone = useAuthStore(s => s.user?.timezone);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle(entry?.title ?? '');
      setBody(entry?.body ?? '');
      setSelectedTags(entry?.tags ?? []);
      setLocalUris(entry?.imageUrls ?? []);
      setNewTag('');
      setSelectedMood(entry?.moodId ?? null);

      // Populate custom tags (anything that isn't in the default JOURNAL_TAGS)
      const existingCustom = (entry?.tags ?? []).filter(t => !JOURNAL_TAGS.includes(t));
      setCustomTags(existingCustom);
    }
  }, [visible, entry]);

  const handlePickPhotos = async () => {
    setPicking(true);
    const r = await pickImages(true);
    setPicking(false);
    if (r.success) {
      setLocalUris(prev => [...prev, ...r.uris]);
    } else if (!r.cancelled) {
      Alert.alert('Kami', r.error);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setLocalUris(prev => prev.filter((_, i) => i !== index));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    const trimmed = newTag.trim().toLowerCase().replace(/#/g, '').replace(/\s+/g, '-');
    if (!trimmed) return;
    if (!customTags.includes(trimmed)) {
      setCustomTags(prev => [...prev, trimmed]);
    }
    if (!selectedTags.includes(trimmed)) {
      setSelectedTags(prev => [...prev, trimmed]);
    }
  };

  const { colors } = useTheme();
  const wm = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[wm.root, { backgroundColor: colors.pageBg }]}>
        <View style={wm.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">{entry ? 'Edit entry' : new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone || 'UTC' })}</KamiText>
          <TouchableOpacity
            onPress={() => {
              const validation = journalSchema.safeParse({ title, body });
              if (!validation.success) {
                Alert.alert('Kami', validation.error.issues[0].message);
                return;
              }
              Keyboard.dismiss();
              onSave(body.trim(), title.trim() || undefined, selectedTags, localUris, selectedMood);
            }}
            disabled={saving}
            hitSlop={8}
          >
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <KamiText variant="label" color={colors.primary} bold>Save</KamiText>
            }
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={wm.content}>
          <TextInput
            style={wm.titleInput} placeholder="Title (optional)"
            placeholderTextColor={colors.textMuted} value={title}
            onChangeText={setTitle} maxLength={120}
          />
          <View style={wm.rule} />
          <TextInput
            style={wm.bodyInput} placeholder="Write freely…"
            placeholderTextColor={colors.textMuted} value={body}
            onChangeText={setBody} multiline autoFocus={!entry} textAlignVertical="top" maxLength={8000}
          />

          {/* Mood Selector */}
          <KamiText variant="overline" style={wm.sectionLabel}>How does this moment feel?</KamiText>
          <View style={{ flexDirection: 'row', gap: Space[2], marginVertical: Space[2] }}>
            {['😊', '😔', '🥰', '😡', '😌', '🤪'].map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={[
                  {
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.creamDeep,
                    borderWidth: 1.5,
                    borderColor: selectedMood === emoji ? colors.primary : colors.border,
                  },
                  selectedMood === emoji && { backgroundColor: colors.primary + '18' }
                ]}
                onPress={() => setSelectedMood(selectedMood === emoji ? null : emoji)}
              >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tag Selector */}
          <KamiText variant="overline" style={wm.sectionLabel}>Tags</KamiText>
          <View style={wm.tagContainer}>
            {[...JOURNAL_TAGS, ...customTags].map(t => {
              const active = selectedTags.includes(t);
              return (
                <TouchableOpacity key={t} style={[wm.tagChip, active && [wm.tagChipActive, { borderColor: colors.primary, backgroundColor: colors.primary + '11' }]]} onPress={() => toggleTag(t)}>
                  <KamiText variant="caption" color={active ? colors.primary : colors.textSecondary} bold={active}>#{t}</KamiText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Tag Input */}
          <View style={wm.customTagRow}>
            <TextInput
              style={wm.customTagInput}
              placeholder="Add custom hashtag..."
              placeholderTextColor={colors.textMuted}
              value={newTag}
              onChangeText={setNewTag}
              maxLength={25}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleAddCustomTag}
            />
            <TouchableOpacity style={[wm.customTagBtn, { backgroundColor: colors.primary + '11' }]} onPress={handleAddCustomTag} activeOpacity={0.75}>
              <KamiText variant="caption" color={colors.primary} bold>+ Add</KamiText>
            </TouchableOpacity>
          </View>

          {/* Photo Attachments */}
          <View style={wm.photoHeader}>
            <KamiText variant="overline">Photos</KamiText>
            <TouchableOpacity onPress={handlePickPhotos} style={wm.addPhotoBtn} disabled={picking}>
              {picking ? <ActivityIndicator size="small" color={colors.primary} /> : <KamiText variant="caption" color={colors.primary} bold>+ Add Photos</KamiText>}
            </TouchableOpacity>
          </View>

          {localUris.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={wm.photoScroll}>
              <View style={wm.photoRow}>
                {localUris.map((uri, idx) => (
                  <View key={idx} style={wm.photoWrap}>
                    <Image source={{ uri }} style={wm.attachedImage} />
                    <TouchableOpacity style={wm.removePhotoBadge} onPress={() => handleRemovePhoto(idx)}>
                      <Text style={{ color: '#fff', fontSize: 10 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </ScrollView>
        <View style={wm.counter}>
          <KamiText variant="caption" color={colors.textMuted}>{body.length} / 8000</KamiText>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: colors.border + '44' },
  content: { padding: Space[5], gap: Space[4], paddingBottom: Space[10] },
  titleInput: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.textPrimary },
  rule: { height: 1, backgroundColor: colors.border + '44' },
  bodyInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 29, minHeight: 250, textAlignVertical: 'top' },
  sectionLabel: { marginTop: Space[2] },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2], marginVertical: Space[1] },
  tagChip: { paddingHorizontal: Space[3], paddingVertical: Space[1] + 2, borderRadius: Radii.full, backgroundColor: colors.creamDeep, borderWidth: 1, borderColor: colors.border },
  tagChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '11' },
  customTagRow: { flexDirection: 'row', alignItems: 'center', gap: Space[2], marginTop: Space[1] },
  customTagInput: { flex: 1, backgroundColor: colors.cardBg, borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[1] + 2, fontSize: FontSize.xs, color: colors.textPrimary, borderWidth: 1.5, borderColor: colors.border },
  customTagBtn: { paddingVertical: Space[1] + 4, paddingHorizontal: Space[3], borderRadius: Radii.full, backgroundColor: colors.primary + '11' },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space[4], borderTopWidth: 1, borderTopColor: colors.border + '22', paddingTop: Space[3] },
  addPhotoBtn: { paddingVertical: Space[1], paddingHorizontal: Space[2] },
  photoScroll: { marginHorizontal: -Space[5], paddingHorizontal: Space[5], marginVertical: Space[2] },
  photoRow: { flexDirection: 'row', gap: Space[3] },
  photoWrap: { position: 'relative' },
  attachedImage: { width: 90, height: 90, borderRadius: Radii.sm, resizeMode: 'contain', backgroundColor: 'rgba(0,0,0,0.03)' },
  removePhotoBadge: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBg },
  counter: { paddingHorizontal: Space[5], paddingVertical: Space[3], alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.border + '22' },
});
