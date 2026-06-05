/**
 * MemoriesScreen.tsx
 *
 * Personal photo memory vault with search, write/edit modal,
 * and multiple image uploads to secure Supabase storage.
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator, Alert, Animated, Keyboard, Modal,
  Platform, RefreshControl, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  Image, StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import { useAuthStore } from '@features/auth';
import type { MainTabScreenProps } from '@core/navigation/types';
import type { Memory } from '@features/home/types';
import * as memoryService from '@infrastructure/home/memoryService';
import { pickImages, uploadImages } from '@shared/lib/storage';

type Props = MainTabScreenProps<'Memories'>;

const MEMORY_EMOJIS = ['🌸','📸','🌅','✨','🎉','💛','🌊','🏔','🎵','🍃','🌙','❤️','🎂','✈️','🌺','⭐'];
const MOODS = ['😊','😌','🥹','😍','😂','🤩','😢','😤'];

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0;
  const v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

// ─── Memory modal ─────────────────────────────────────────────────────────────
const MemoryModal: React.FC<{
  visible: boolean;
  memory: Memory | null;
  onClose: () => void;
  onSave: (title: string, body: string, emoji: string, mood: string | null, imageUris: string[]) => Promise<void>;
  saving: boolean;
}> = ({ visible, memory, onClose, onSave, saving }) => {
  const [title, setTitle] = useState('');
  const [body,  setBody]  = useState('');
  const [emoji, setEmoji] = useState('🌸');
  const [mood,  setMood]  = useState<string | null>(null);
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(memory?.title ?? '');
      setBody(memory?.body ?? '');
      setEmoji(memory?.emoji ?? '🌸');
      setMood(memory?.mood ?? null);
      setLocalUris(memory?.imageUrls ?? []);
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
      <SafeAreaView style={mm.root}>
        <View style={wm.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">{memory ? 'Edit memory' : 'New memory'}</KamiText>
          <TouchableOpacity onPress={() => { if (!title.trim()) return; Keyboard.dismiss(); onSave(title.trim(), body.trim(), emoji, mood, localUris); }} disabled={saving || !title.trim()} hitSlop={8}>
            {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : <KamiText variant="label" color={title.trim() ? Colors.primary : Colors.textMuted} bold>Save</KamiText>}
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={mm.content}>
          {/* Emoji */}
          <KamiText variant="overline" style={mm.label}>Emoji</KamiText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={mm.emojiRow}>
              {MEMORY_EMOJIS.map(e => (
                <TouchableOpacity key={e} style={[mm.emojiBtn, emoji === e && mm.emojiBtnOn]} onPress={() => setEmoji(e)}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Title */}
          <KamiText variant="overline" style={mm.label}>Title *</KamiText>
          <TextInput style={mm.input} placeholder="e.g. That perfect sunrise" placeholderTextColor={Colors.textMuted} value={title} onChangeText={setTitle} maxLength={100} autoFocus={!memory} />

          {/* Body */}
          <KamiText variant="overline" style={mm.label}>Tell the story</KamiText>
          <TextInput style={[mm.input, { height: 100, textAlignVertical: 'top' }]} placeholder="What made this moment special…" placeholderTextColor={Colors.textMuted} value={body} onChangeText={setBody} multiline maxLength={1000} />

          {/* Mood */}
          <KamiText variant="overline" style={mm.label}>How did you feel?</KamiText>
          <View style={mm.moodRow}>
            {MOODS.map(m => (
              <TouchableOpacity key={m} style={[mm.moodBtn, mood === m && mm.moodBtnOn]} onPress={() => setMood(mood === m ? null : m)}>
                <Text style={{ fontSize: 24 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Photos */}
          <View style={wm.photoHeader}>
            <KamiText variant="overline">Photos</KamiText>
            <TouchableOpacity onPress={handlePickPhotos} style={wm.addPhotoBtn} disabled={picking}>
              {picking ? <ActivityIndicator size="small" color={Colors.primary} /> : <KamiText variant="caption" color={Colors.primary} bold>+ Add Photos</KamiText>}
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
const wm = StyleSheet.create({
  toolbar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space[4], borderTopWidth: 1, borderTopColor: Colors.border + '22', paddingTop: Space[3] },
  addPhotoBtn: { paddingVertical: Space[1], paddingHorizontal: Space[2] },
  photoScroll: { marginHorizontal: -Space[5], paddingHorizontal: Space[5], marginVertical: Space[2] },
  photoRow:    { flexDirection: 'row', gap: Space[3] },
  photoWrap:   { position: 'relative' },
  attachedImage:{ width: 90, height: 90, borderRadius: Radii.sm },
  removePhotoBadge:{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
});
const mm = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.pageBg },
  content:   { padding: Space[5], gap: Space[3], paddingBottom: Space[10] },
  label:     { marginBottom: Space[1] },
  emojiRow:  { flexDirection: 'row', gap: Space[2], paddingVertical: Space[2] },
  emojiBtn:  { width: 48, height: 48, borderRadius: Radii.sm, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  emojiBtnOn:{ borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  input:     { backgroundColor: Colors.creamDeep, borderRadius: Radii.input, paddingHorizontal: Space[4], paddingVertical: Space[3], fontSize: FontSize.base, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border },
  moodRow:   { flexDirection: 'row', gap: Space[2] },
  moodBtn:   { width: 44, height: 44, borderRadius: Radii.sm, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  moodBtnOn: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export function MemoriesScreen({ navigation }: Props) {
  const user = useAuthStore(s => s.user);
  
  const [memories,   setMemories]   = useState<Memory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editing,    setEditing]    = useState<Memory | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');

  useEffect(() => {
    if (user?.id) loadMemories(search.trim() || undefined);
  }, [search, user?.id]);

  async function loadMemories(searchQuery?: string) {
    setLoading(true);
    const r = await memoryService.fetchMemories(searchQuery);
    setLoading(false);
    if (!r.success) { Alert.alert('Kami', r.error); return; }
    setMemories(r.data);
  }

  const handleSave = async (title: string, body: string, emoji: string, mood: string | null, localUris: string[] = []) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      let relativePaths: string[] = [];
      const targetId = editing ? editing.id : uuid();

      // Separate local picker files from remote signed URLs
      const localPickerUris = localUris.filter(u => u.startsWith('file://') || u.startsWith('content://'));
      const existingPaths = (editing?.imageUrls ?? [])
        .filter(url => localUris.includes(url))
        .map(url => {
          const match = url.match(/\/memory_images\/(.+?)\?/);
          return match ? decodeURIComponent(match[1]) : null;
        })
        .filter(Boolean) as string[];

      if (localPickerUris.length > 0) {
        const uploadRes = await uploadImages('memory_images', user.id, targetId, localPickerUris);
        if (!uploadRes.success) {
          Alert.alert('Kami', uploadRes.error);
          setSaving(false);
          return;
        }
        relativePaths = [...existingPaths, ...uploadRes.paths];
      } else {
        relativePaths = existingPaths;
      }

      const r = editing
        ? await memoryService.updateMemory(editing.id, { title, body, emoji, mood, imageUrls: relativePaths })
        : await memoryService.createMemory(targetId, { title, body, emoji, mood, imageUrls: relativePaths });

      if (!r.success) { Alert.alert('Kami', r.error); }
      else {
        setModalOpen(false); setEditing(null);
        loadMemories(search.trim() || undefined);
      }
    } catch (e) {
      Alert.alert('Kami', 'Error saving memory.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (m: Memory) => Alert.alert('Delete memory?', `"${m.title}"`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      const r = await memoryService.deleteMemory(m.id);
      if (!r.success) { Alert.alert('Kami', r.error); return; }
      setMemories(prev => prev.filter(x => x.id !== m.id));
    }},
  ]);

  const handleRefresh = async () => { setRefreshing(true); await loadMemories(search.trim() || undefined); setRefreshing(false); };

  // Group memories by month
  const grouped: Record<string, Memory[]> = {};
  memories.forEach(m => {
    const key = new Date(m.memoryDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <KamiText variant="overline">Your vault</KamiText>
          <KamiText variant="title">Memories</KamiText>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => { setEditing(null); setModalOpen(true); }}>
          <Text style={s.addPlus}>+</Text>
          <KamiText variant="label" color={Colors.primary} bold>Add</KamiText>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search memories..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        {loading && memories.length === 0 && (
          <View style={s.center}><ActivityIndicator color={Colors.primary} /></View>
        )}

        {!loading && memories.length === 0 && (
          <TouchableOpacity style={s.emptyState} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
            <Text style={{ fontSize: 56, marginBottom: Space[3] }}>📸</Text>
            <KamiText variant="subtitle" align="center">Your vault is empty</KamiText>
            <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
              {search ? 'Clear search filter to view your memories.' : 'Capture the moments worth remembering.'}
            </KamiText>
            <View style={s.emptyBtn}>
              <KamiText variant="label" color={Colors.primary} bold>Add your first memory ›</KamiText>
            </View>
          </TouchableOpacity>
        )}

        {Object.entries(grouped).map(([month, items]) => (
          <View key={month} style={{ gap: Space[3] }}>
            <KamiText variant="overline">{month} · {items.length}</KamiText>
            {items.map(m => <MemoryCard key={m.id} memory={m} onEdit={() => { setEditing(m); setModalOpen(true); }} onDelete={() => handleDelete(m)} />)}
          </View>
        ))}

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <MemoryModal visible={modalOpen} memory={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} saving={saving} />
    </SafeAreaView>
  );
}

const MemoryCard: React.FC<{ memory: Memory; onEdit: () => void; onDelete: () => void }> = ({ memory, onEdit, onDelete }) => {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity activeOpacity={1} onPress={onEdit}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[s.card, { transform: [{ scale: sc }] }]}>
        <View style={{ flexDirection: 'row', gap: Space[3] }}>
          <View style={s.cardLeft}>
            <Text style={{ fontSize: 32 }}>{memory.emoji}</Text>
            {memory.mood && <Text style={{ fontSize: 18, marginTop: 4 }}>{memory.mood}</Text>}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={s.cardTop}>
              <KamiText variant="label" numberOfLines={1} style={{ flex: 1 }}>{memory.title}</KamiText>
              <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.delBtn}>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            {memory.body ? <KamiText variant="body" color={Colors.textSecondary} numberOfLines={3} style={{ lineHeight: 20 }}>{memory.body}</KamiText> : null}
            <KamiText variant="caption" color={Colors.textMuted}>
              {new Date(memory.memoryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </KamiText>
          </View>
        </View>

        {/* Carousel/Grid of photos */}
        {memory.imageUrls && memory.imageUrls.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imageScroll}>
            <View style={s.imageRow}>
              {memory.imageUrls.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={s.photo} />
              ))}
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default MemoriesScreen;

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '33', backgroundColor: Colors.pageBg },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  addPlus:{ fontSize: FontSize.lg, color: Colors.primary, fontWeight: FontWeight.bold, lineHeight: 22 },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Space[5], marginTop: Space[4], paddingHorizontal: Space[3], backgroundColor: Colors.cardBg, borderRadius: Radii.input, borderWidth: 1, borderColor: Colors.border + '88', ...Shadows.sm },
  searchIcon:{ fontSize: FontSize.sm, marginRight: Space[2] },
  searchInput:{ flex: 1, height: 44, fontSize: FontSize.base, color: Colors.textPrimary },

  scroll: { paddingHorizontal: Space[5], paddingTop: Space[4], gap: Space[4] },
  center: { paddingVertical: Space[10], alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn:   { marginTop: Space[4], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  
  card:    { flexDirection: 'column', gap: Space[3], backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], borderWidth: 1, borderColor: Colors.border + '44', ...Shadows.sm },
  cardLeft:{ alignItems: 'center', width: 44 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  delBtn:  { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },

  // Horizontal photos list
  imageScroll: { marginHorizontal: -Space[4], paddingHorizontal: Space[4], marginTop: Space[1] },
  imageRow:    { flexDirection: 'row', gap: Space[2] },
  photo:       { width: 200, height: 130, borderRadius: Radii.sm },
});
