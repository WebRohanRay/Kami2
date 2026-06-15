import React, { useState, useEffect } from 'react';
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
  Image,
  StatusBar as RNStatusBar,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { FontSize, Radii, Space } from '@shared/constants';
import type { Memory } from '@features/home/types';
import type { CoupleMemory } from '@features/couple/types';
import { pickImages } from '@shared/lib/storage';
import { memorySchema } from '@shared/lib/validation/schemas';
import { useTheme } from '@shared/hooks';

export const MEMORY_EMOJIS = ['🌸', '📸', '🌅', '✨', '🎉', '💛', '🌊', '🏔', '🎵', '🍃', '🌙', '❤️', '🎂', '✈️', '🌺', '⭐'];
export const MOODS = ['😊', '😌', '🥹', '😍', '😂', '🤩', '😢', '😤'];

interface MemoryModalProps {
  visible: boolean;
  memory: Memory | CoupleMemory | null;
  onClose: () => void;
  onSave: (
    title: string,
    body: string,
    emoji: string,
    mood: string | null,
    imageUris: string[],
    memoryDate?: string,
    tags?: string[],
    location?: string,
    memoryTime?: string
  ) => Promise<void>;
  saving: boolean;
  activeSpace: 'personal' | 'couple';
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  visible,
  memory,
  onClose,
  onSave,
  saving,
  activeSpace,
}) => {
  const { colors } = useTheme();
  const wm = React.useMemo(() => getWmStyles(colors), [colors]);
  const mm = React.useMemo(() => getMmStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [emoji, setEmoji] = useState('🌸');
  const [mood, setMood] = useState<string | null>(null);
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  // New fields for Couple Space/Personal Space enhancements
  const [location, setLocation] = useState('');
  const [memoryTime, setMemoryTime] = useState('');
  const [memoryDate, setMemoryDate] = useState('');
  const [tagsText, setTagsText] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle(memory?.title ?? '');
      const mBody = memory ? ('description' in memory ? memory.description : (memory as any).body) : '';
      setBody(mBody ?? '');
      setEmoji(memory && 'emoji' in memory ? (memory as any).emoji : '🌸');
      setMood(memory && 'mood' in memory ? (memory as any).mood : null);
      setLocalUris(memory?.imageUrls ?? []);

      setLocation(memory && 'location' in memory ? ((memory as any).location ?? '') : '');
      setMemoryTime(memory && 'memoryTime' in memory ? ((memory as any).memoryTime ?? '') : '');

      const defaultDate = new Date().toISOString().split('T')[0];
      setMemoryDate(memory?.memoryDate ? memory.memoryDate.split('T')[0] : defaultDate);

      setTagsText(memory && 'tags' in memory ? ((memory as any).tags ?? []).join(', ') : '');
    }
  }, [visible, memory]);

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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[mm.root, { backgroundColor: colors.pageBg }]}>
        <View style={wm.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">{memory ? 'Edit memory' : 'New memory'}</KamiText>
          <TouchableOpacity
            onPress={() => {
              const validation = memorySchema.safeParse({ title, description: body });
              if (!validation.success) {
                Alert.alert('Kami', validation.error.issues[0].message);
                return;
              }
              Keyboard.dismiss();
              const parsedTags = tagsText
                .split(',')
                .map(t => t.trim().toLowerCase())
                .filter(Boolean);
              onSave(
                title.trim(),
                body.trim(),
                emoji,
                mood,
                localUris,
                memoryDate.trim() || undefined,
                parsedTags,
                location.trim() || undefined,
                memoryTime.trim() || undefined
              );
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
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={mm.content}>
          {/* Emoji */}
          {activeSpace === 'personal' && (
            <>
              <KamiText variant="overline" style={mm.label}>Emoji</KamiText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={mm.emojiRow}>
                  {MEMORY_EMOJIS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[
                        mm.emojiBtn,
                        emoji === e && [
                          mm.emojiBtnOn,
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
            </>
          )}

          {/* Title */}
          <KamiText variant="overline" style={mm.label}>Title *</KamiText>
          <TextInput
            style={mm.input}
            placeholder="e.g. That perfect sunrise"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            autoFocus={!memory}
          />

          {/* Body */}
          <KamiText variant="overline" style={mm.label}>Tell the story</KamiText>
          <TextInput
            style={[mm.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="What made this moment special…"
            placeholderTextColor={colors.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
          />

          {/* Couple Enhancements */}
          {activeSpace === 'couple' && (
            <>
              <KamiText variant="overline" style={mm.label}>Date (YYYY-MM-DD)</KamiText>
              <TextInput
                style={mm.input}
                placeholder="e.g. 2026-06-07"
                placeholderTextColor={colors.textMuted}
                value={memoryDate}
                onChangeText={setMemoryDate}
                maxLength={10}
              />

              <KamiText variant="overline" style={mm.label}>Time</KamiText>
              <TextInput
                style={mm.input}
                placeholder="e.g. 5:00 PM"
                placeholderTextColor={colors.textMuted}
                value={memoryTime}
                onChangeText={setMemoryTime}
                maxLength={20}
              />

              <KamiText variant="overline" style={mm.label}>Location</KamiText>
              <TextInput
                style={mm.input}
                placeholder="e.g. Eiffel Tower, Paris"
                placeholderTextColor={colors.textMuted}
                value={location}
                onChangeText={setLocation}
                maxLength={100}
              />

              <KamiText variant="overline" style={mm.label}>Mood Label / Emoji</KamiText>
              <TextInput
                style={mm.input}
                placeholder="e.g. 😊 Happy or Excited"
                placeholderTextColor={colors.textMuted}
                value={mood || ''}
                onChangeText={setMood}
                maxLength={30}
              />

              <KamiText variant="overline" style={mm.label}>Tags (comma-separated for categorization)</KamiText>
              <TextInput
                style={mm.input}
                placeholder="e.g. trip, adventure, special"
                placeholderTextColor={colors.textMuted}
                value={tagsText}
                onChangeText={setTagsText}
                maxLength={100}
              />
            </>
          )}

          {/* Mood for personal */}
          {activeSpace === 'personal' && (
            <>
              <KamiText variant="overline" style={mm.label}>How did you feel?</KamiText>
              <View style={mm.moodRow}>
                {MOODS.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      mm.moodBtn,
                      mood === m && [
                        mm.moodBtnOn,
                        { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                      ],
                    ]}
                    onPress={() => setMood(mood === m ? null : m)}
                  >
                    <Text style={{ fontSize: 24 }}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Photos */}
          <View style={wm.photoHeader}>
            <KamiText variant="overline">Photos</KamiText>
            <TouchableOpacity onPress={handlePickPhotos} style={wm.addPhotoBtn} disabled={picking}>
              {picking ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <KamiText variant="caption" color={colors.primary} bold>
                  + Add Photos
                </KamiText>
              )}
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
      </SafeAreaView>
    </Modal>
  );
};

const getWmStyles = (colors: any) => StyleSheet.create({
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
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space[4],
    borderTopWidth: 1,
    borderTopColor: colors.border + '22',
    paddingTop: Space[3],
  },
  addPhotoBtn: { paddingVertical: Space[1], paddingHorizontal: Space[2] },
  photoScroll: { marginHorizontal: -Space[5], paddingHorizontal: Space[5], marginVertical: Space[2] },
  photoRow: { flexDirection: 'row', gap: Space[3] },
  photoWrap: { position: 'relative' },
  attachedImage: { width: 90, height: 90, borderRadius: Radii.sm, resizeMode: 'contain', backgroundColor: 'rgba(0,0,0,0.03)' },
  removePhotoBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBg,
  },
});

const getMmStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: Space[5], gap: Space[3], paddingBottom: Space[10] },
  label: { marginBottom: Space[1] },
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
  moodRow: { flexDirection: 'row', gap: Space[2] },
  moodBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.sm,
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  moodBtnOn: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
});
