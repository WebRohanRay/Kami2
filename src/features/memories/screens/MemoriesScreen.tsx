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
import type { CoupleMemory } from '@features/couple/types';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import * as memoryService from '@infrastructure/home/memoryService';
import { pickImages, uploadImages } from '@shared/lib/storage';
import { useTheme }     from '@shared/hooks';

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
  memory: Memory | CoupleMemory | null;
  onClose: () => void;
  onSave: (title: string, body: string, emoji: string, mood: string | null, imageUris: string[]) => Promise<void>;
  saving: boolean;
  activeSpace: 'personal' | 'couple';
}> = ({ visible, memory, onClose, onSave, saving, activeSpace }) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [body,  setBody]  = useState('');
  const [emoji, setEmoji] = useState('🌸');
  const [mood,  setMood]  = useState<string | null>(null);
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(memory?.title ?? '');
      const mBody = memory ? ('description' in memory ? memory.description : (memory as any).body) : '';
      setBody(mBody ?? '');
      setEmoji(memory && 'emoji' in memory ? (memory as any).emoji : '🌸');
      setMood(memory && 'mood' in memory ? (memory as any).mood : null);
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
      <SafeAreaView style={[mm.root, { backgroundColor: colors.pageBg }]}>
        <View style={wm.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">{memory ? 'Edit memory' : 'New memory'}</KamiText>
          <TouchableOpacity onPress={() => { if (!title.trim()) return; Keyboard.dismiss(); onSave(title.trim(), body.trim(), emoji, mood, localUris); }} disabled={saving || !title.trim()} hitSlop={8}>
            {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <KamiText variant="label" color={title.trim() ? colors.primary : Colors.textMuted} bold>Save</KamiText>}
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
                    <TouchableOpacity key={e} style={[mm.emojiBtn, emoji === e && [mm.emojiBtnOn, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]]} onPress={() => setEmoji(e)}>
                      <Text style={{ fontSize: 22 }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          {/* Title */}
          <KamiText variant="overline" style={mm.label}>Title *</KamiText>
          <TextInput style={mm.input} placeholder="e.g. That perfect sunrise" placeholderTextColor={Colors.textMuted} value={title} onChangeText={setTitle} maxLength={100} autoFocus={!memory} />

          {/* Body */}
          <KamiText variant="overline" style={mm.label}>Tell the story</KamiText>
          <TextInput style={[mm.input, { height: 100, textAlignVertical: 'top' }]} placeholder="What made this moment special…" placeholderTextColor={Colors.textMuted} value={body} onChangeText={setBody} multiline maxLength={1000} />

          {/* Mood */}
          {activeSpace === 'personal' && (
            <>
              <KamiText variant="overline" style={mm.label}>How did you feel?</KamiText>
              <View style={mm.moodRow}>
                {MOODS.map(m => (
                  <TouchableOpacity key={m} style={[mm.moodBtn, mood === m && [mm.moodBtnOn, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]]} onPress={() => setMood(mood === m ? null : m)}>
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
  const activeSpace = user?.activeSpace ?? 'personal';
  const coupleStore = useCoupleStore();
  const coupleActions = useCouple();
  const couple = coupleStore.couple;

  const [memories,   setMemories]   = useState<Memory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editing,    setEditing]    = useState<Memory | CoupleMemory | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');

  useEffect(() => {
    if (activeSpace === 'couple') {
      if (couple?.id) {
        coupleActions.loadMemories();
      }
    } else {
      if (user?.id) loadMemories(search.trim() || undefined);
    }
  }, [search, user?.id, activeSpace, couple?.id]);

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
      const imageUrlsToFilter = editing ? editing.imageUrls : [];
      const existingPaths = (imageUrlsToFilter ?? [])
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

      if (activeSpace === 'couple') {
        if (!couple?.id) {
          Alert.alert('Kami', 'No couple space connected.');
          setSaving(false);
          return;
        }
        const r = editing
          ? await coupleActions.updateMemory(editing.id, title, body, relativePaths)
          : await coupleActions.addMemory(couple.id, title, body, relativePaths);

        if (!r.success) {
          Alert.alert('Kami', r.error);
        } else {
          setModalOpen(false);
          setEditing(null);
        }
      } else {
        const r = editing
          ? await memoryService.updateMemory(editing.id, { title, body, emoji, mood, imageUrls: relativePaths })
          : await memoryService.createMemory(targetId, { title, body, emoji, mood, imageUrls: relativePaths });

        if (!r.success) { Alert.alert('Kami', r.error); }
        else {
          setModalOpen(false); setEditing(null);
          loadMemories(search.trim() || undefined);
        }
      }
    } catch (e) {
      Alert.alert('Kami', 'Error saving memory.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (m: Memory | CoupleMemory) => Alert.alert('Delete memory?', `"${m.title}"`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      if (activeSpace === 'couple') {
        const r = await coupleActions.deleteMemory(m.id);
        if (!r.success) { Alert.alert('Kami', r.error); }
      } else {
        const r = await memoryService.deleteMemory(m.id);
        if (!r.success) { Alert.alert('Kami', r.error); return; }
        setMemories(prev => prev.filter(x => x.id !== m.id));
      }
    }},
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeSpace === 'couple') {
      await coupleActions.loadMemories();
    } else {
      await loadMemories(search.trim() || undefined);
    }
    setRefreshing(false);
  };

  // Group memories by month
  const groupedPersonal: Record<string, Memory[]> = {};
  if (activeSpace === 'personal') {
    memories.forEach(m => {
      const key = new Date(m.memoryDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (!groupedPersonal[key]) groupedPersonal[key] = [];
      groupedPersonal[key].push(m);
    });
  }

  const coupleMemories = coupleStore.coupleMemories;
  const filteredCoupleMemories = coupleMemories.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.title.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q));
  });

  const groupedCouple: Record<string, CoupleMemory[]> = {};
  if (activeSpace === 'couple') {
    filteredCoupleMemories.forEach(m => {
      const key = new Date(m.memoryDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (!groupedCouple[key]) groupedCouple[key] = [];
      groupedCouple[key].push(m);
    });
  }

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.pageBg }]}>
        <View style={{ flex: 1 }}>
          <KamiText variant="overline">{activeSpace === 'couple' ? 'Relationship timeline' : 'Your vault'}</KamiText>
          <KamiText variant="title">{activeSpace === 'couple' ? 'Couple Memories' : 'Memories'}</KamiText>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => { setEditing(null); setModalOpen(true); }}>
          <Text style={[s.addPlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>Add</KamiText>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {loading && activeSpace === 'personal' && memories.length === 0 && (
          <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        )}
        {coupleStore.memoriesLoading === 'loading' && activeSpace === 'couple' && coupleMemories.length === 0 && (
          <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        )}

        {activeSpace === 'personal' && !loading && memories.length === 0 && (
          <TouchableOpacity style={s.emptyState} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
            <Text style={{ fontSize: 56, marginBottom: Space[3] }}>📸</Text>
            <KamiText variant="subtitle" align="center">Your vault is empty</KamiText>
            <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
              {search ? 'Clear search filter to view your memories.' : 'Capture the moments worth remembering.'}
            </KamiText>
            <View style={[s.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
              <KamiText variant="label" color={colors.primary} bold>Add your first memory ›</KamiText>
            </View>
          </TouchableOpacity>
        )}

        {activeSpace === 'couple' && coupleStore.memoriesLoading !== 'loading' && coupleMemories.length === 0 && (
          <TouchableOpacity style={s.emptyState} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
            <Text style={{ fontSize: 56, marginBottom: Space[3] }}>💑</Text>
            <KamiText variant="subtitle" align="center">No shared memories yet</KamiText>
            <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
              {search ? 'Clear search filter to view couple memories.' : 'Start capturing your beautiful relationship milestones.'}
            </KamiText>
            <View style={[s.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
              <KamiText variant="label" color={colors.primary} bold>Add your first shared memory ›</KamiText>
            </View>
          </TouchableOpacity>
        )}

        {activeSpace === 'personal' && Object.entries(groupedPersonal).map(([month, items]) => (
          <View key={month} style={{ gap: Space[3] }}>
            <KamiText variant="overline">{month} · {items.length}</KamiText>
            {items.map(m => <MemoryCard key={m.id} memory={m} onEdit={() => { setEditing(m); setModalOpen(true); }} onDelete={() => handleDelete(m)} />)}
          </View>
        ))}

        {activeSpace === 'couple' && Object.entries(groupedCouple).map(([month, items]) => (
          <View key={month} style={{ gap: Space[4] }}>
            <KamiText variant="overline" style={{ color: colors.primary }}>❤️ {month} · {items.length}</KamiText>
            <View style={s.timelineContainer}>
              {items.map((m, idx) => (
                <CoupleMemoryTimelineCard
                  key={m.id}
                  memory={m}
                  isLast={idx === items.length - 1}
                  onEdit={() => { setEditing(m); setModalOpen(true); }}
                  onDelete={() => handleDelete(m)}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <MemoryModal visible={modalOpen} memory={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} saving={saving} activeSpace={activeSpace} />
    </SafeAreaView>
  );
};

const CoupleMemoryTimelineCard: React.FC<{
  memory: CoupleMemory;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ memory, isLast, onEdit, onDelete }) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;

  return (
    <View style={s.timelineRow}>
      {/* Left Timeline Guide */}
      <View style={s.timelineLeft}>
        <View style={[s.timelineDot, { backgroundColor: colors.primary }]} />
        {!isLast && <View style={[s.timelineLine, { backgroundColor: Colors.border }]} />}
      </View>

      {/* Card Content */}
      <View style={{ flex: 1, paddingBottom: Space[4] }}>
        <TouchableOpacity activeOpacity={1} onPress={onEdit}
          onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
          onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        >
          <Animated.View style={[s.card, { transform: [{ scale: sc }] }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={s.cardTop}>
                <KamiText variant="label" numberOfLines={1} style={{ flex: 1 }}>{memory.title}</KamiText>
                <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.delBtn}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>
              {memory.description ? <KamiText variant="body" color={Colors.textSecondary} numberOfLines={3} style={{ lineHeight: 20 }}>{memory.description}</KamiText> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space[1] }}>
                <KamiText variant="caption" color={Colors.textMuted}>
                  {new Date(memory.memoryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </KamiText>
                {memory.tags && memory.tags.length > 0 && (
                  <View style={s.tagRow}>
                    {memory.tags.map(tag => (
                      <View key={tag} style={[s.tagBadge, { backgroundColor: colors.primary + '11' }]}>
                        <KamiText variant="caption" color={colors.primary} style={{ fontSize: 10 }}>#{tag}</KamiText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Photos */}
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
      </View>
    </View>
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

  // Timeline UI styling
  timelineContainer: { paddingLeft: Space[1] },
  timelineRow: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', width: 24, marginRight: Space[2] },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 18, zIndex: 2 },
  timelineLine: { width: 2, flex: 1, marginTop: 4, marginBottom: -18 },
  tagRow: { flexDirection: 'row', gap: Space[1] },
  tagBadge: { paddingHorizontal: Space[2], paddingVertical: 2, borderRadius: Radii.full },
});

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
