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
  Image, StatusBar as RNStatusBar, AppState, Dimensions,
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
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import * as memoryService from '@infrastructure/home/memoryService';
import { pickImages, uploadImages } from '@shared/lib/storage';
import { useTheme }     from '@shared/hooks';
import { LinearGradient } from 'expo-linear-gradient';

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
}> = ({ visible, memory, onClose, onSave, saving, activeSpace }) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [body,  setBody]  = useState('');
  const [emoji, setEmoji] = useState('🌸');
  const [mood,  setMood]  = useState<string | null>(null);
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
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">{memory ? 'Edit memory' : 'New memory'}</KamiText>
          <TouchableOpacity
            onPress={() => {
              if (!title.trim()) return;
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
            disabled={saving || !title.trim()}
            hitSlop={8}
          >
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

          {/* Couple Enhancements */}
          {activeSpace === 'couple' && (
            <>
              <KamiText variant="overline" style={mm.label}>Date (YYYY-MM-DD)</KamiText>
              <TextInput style={mm.input} placeholder="e.g. 2026-06-07" placeholderTextColor={Colors.textMuted} value={memoryDate} onChangeText={setMemoryDate} maxLength={10} />

              <KamiText variant="overline" style={mm.label}>Time</KamiText>
              <TextInput style={mm.input} placeholder="e.g. 5:00 PM" placeholderTextColor={Colors.textMuted} value={memoryTime} onChangeText={setMemoryTime} maxLength={20} />

              <KamiText variant="overline" style={mm.label}>Location</KamiText>
              <TextInput style={mm.input} placeholder="e.g. Eiffel Tower, Paris" placeholderTextColor={Colors.textMuted} value={location} onChangeText={setLocation} maxLength={100} />

              <KamiText variant="overline" style={mm.label}>Mood Label / Emoji</KamiText>
              <TextInput style={mm.input} placeholder="e.g. 😊 Happy or Excited" placeholderTextColor={Colors.textMuted} value={mood || ''} onChangeText={setMood} maxLength={30} />

              <KamiText variant="overline" style={mm.label}>Tags (comma-separated for categorization)</KamiText>
              <TextInput style={mm.input} placeholder="e.g. trip, adventure, special" placeholderTextColor={Colors.textMuted} value={tagsText} onChangeText={setTagsText} maxLength={100} />
            </>
          )}

          {/* Mood for personal */}
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
  const { couple, coupleMemories } = coupleStore;

  const [memories,   setMemories]   = useState<Memory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editing,    setEditing]    = useState<Memory | CoupleMemory | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');
  const [viewMode,   setViewMode]   = useState<'timeline' | 'galaxy'>('timeline');
  const [timelineLimit, setTimelineLimit] = useState(5);
  const [previewMemory, setPreviewMemory] = useState<Memory | CoupleMemory | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const [isFocused, setIsFocused] = useState(navigation.isFocused());
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    setTimelineLimit(5);
  }, [activeSpace, search]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => setAppState(next));
    return () => sub.remove();
  }, []);

  // Focus auto-refresh and presence action broadcast
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
      if (activeSpace === 'couple') {
        coupleActions.loadMemories();
      } else {
        loadMemories(search.trim() || undefined);
      }
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, activeSpace, search]);

  useEffect(() => {
    if (activeSpace === 'couple' && couple?.id && user?.id) {
      if (isFocused && appState === 'active') {
        const action = modalOpen 
          ? 'writing_memory' 
          : previewVisible
            ? 'viewing_memory' 
            : 'reading_memories';
        useCoupleStore.getState().setMyActiveAction(action);
        broadcastPartnerAction(couple.id, user.id, action);
      } else {
        const store = useCoupleStore.getState();
        const cleared1 = store.clearMyActiveAction('writing_memory');
        const cleared2 = store.clearMyActiveAction('viewing_memory');
        const cleared3 = store.clearMyActiveAction('reading_memories');
        if (cleared1 || cleared2 || cleared3) {
          broadcastPartnerAction(couple.id, user.id, 'idle');
        }
      }
    }
  }, [activeSpace, couple?.id, user?.id, isFocused, appState, modalOpen, previewVisible]);

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

  const handleSave = async (
    title: string,
    body: string,
    emoji: string,
    mood: string | null,
    localUris: string[] = [],
    memoryDate?: string,
    tags: string[] = [],
    location?: string,
    memoryTime?: string
  ) => {
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
          ? await coupleActions.updateMemory(editing.id, title, body, relativePaths, memoryDate, tags, location, mood || undefined, memoryTime)
          : await coupleActions.addMemory(couple.id, title, body, relativePaths, memoryDate, tags, location, mood || undefined, memoryTime);

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

  const filteredCoupleMemories = coupleMemories.filter((m: any) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const titleMatch = m.title?.toLowerCase().includes(q);
    const descMatch = m.description?.toLowerCase().includes(q);
    const locMatch = m.location?.toLowerCase().includes(q);
    const moodMatch = m.mood?.toLowerCase().includes(q);
    const tagMatch = m.tags?.some((t: any) => t.toLowerCase().includes(q));
    return titleMatch || descMatch || locMatch || moodMatch || tagMatch;
  });

  const listToCategorize = activeSpace === 'couple' ? filteredCoupleMemories : memories;

  const tripTags = ['trip', 'travel', 'vacation', 'adventure'];
  const specialTags = ['anniversary', 'birthday', 'special', 'date'];

  const recentMemories = [...listToCategorize].sort((a, b) => new Date(b.memoryDate).getTime() - new Date(a.memoryDate).getTime());
  
  const tripMemories = listToCategorize.filter((m: any) => 
    m.tags && m.tags.some((t: any) => tripTags.includes(t.toLowerCase()))
  );
  
  const specialMemories = listToCategorize.filter((m: any) => 
    m.tags && m.tags.some((t: any) => specialTags.includes(t.toLowerCase()))
  );
  
  const otherMemories = listToCategorize.filter((m: any) => 
    !m.tags || !m.tags.some((t: any) => tripTags.includes(t.toLowerCase()) || specialTags.includes(t.toLowerCase()))
  );

  const renderHorizontalSection = (title: string, items: any[], emptyText: string) => {
    return (
      <View style={s.sectionContainer}>
        <View style={s.sectionHeader}>
          <KamiText variant="subtitle" bold color={colors.primary}>{title}</KamiText>
          <View style={[s.sectionBadge, { backgroundColor: colors.primary + '18' }]}>
            <KamiText variant="caption" color={colors.primary} bold>{items.length}</KamiText>
          </View>
        </View>
        
        {items.length === 0 ? (
          <View style={[s.horizontalEmptyCard, { borderColor: Colors.border + '33' }]}>
            <KamiText variant="caption" color={Colors.textMuted}>{emptyText}</KamiText>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScrollContainer}>
            {items.map(m => (
              <MemoryNetflixCard
                key={m.id}
                memory={m}
                onPressCard={() => { setPreviewMemory(m); setPreviewVisible(true); }}
                onDelete={() => handleDelete(m)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style={viewMode === 'galaxy' ? 'light' : 'dark'} />

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

      {/* View Mode Toggle Switch */}
      <View style={s.viewToggleRow}>
        <TouchableOpacity
          style={[
            s.toggleBtn, 
            viewMode === 'timeline' && [s.toggleBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
          ]}
          onPress={() => setViewMode('timeline')}
        >
          <KamiText variant="caption" color={viewMode === 'timeline' ? '#fff' : Colors.textMuted} bold={viewMode === 'timeline'}>
            📜 Timeline Feed
          </KamiText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.toggleBtn, 
            viewMode === 'galaxy' && [s.toggleBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
          ]}
          onPress={() => setViewMode('galaxy')}
        >
          <KamiText variant="caption" color={viewMode === 'galaxy' ? '#fff' : Colors.textMuted} bold={viewMode === 'galaxy'}>
            🌌 Memory Galaxy
          </KamiText>
        </TouchableOpacity>
      </View>

      {viewMode === 'galaxy' ? (
        <LinearGradient
          colors={['#08091a', '#12142e', '#03030c']}
          style={s.galaxyBg}
        >
          {/* Soft background decorative stars */}
          <View style={[s.bgStarDot, { top: '15%', left: '20%' }]} />
          <View style={[s.bgStarDot, { top: '35%', left: '75%', opacity: 0.6 }]} />
          <View style={[s.bgStarDot, { top: '65%', left: '15%', opacity: 0.4 }]} />
          <View style={[s.bgStarDot, { top: '80%', left: '60%', opacity: 0.7 }]} />
          <View style={[s.bgStarDot, { top: '45%', left: '40%', opacity: 0.3 }]} />
          <View style={[s.bgStarDot, { top: '25%', left: '85%', opacity: 0.5 }]} />
          <View style={[s.bgStarDot, { top: '70%', left: '80%', opacity: 0.4 }]} />

          {(activeSpace === 'couple' ? filteredCoupleMemories : memories).length === 0 ? (
            <View style={s.galaxyEmpty}>
              <Text style={{ fontSize: 56, marginBottom: Space[4] }}>🌌</Text>
              <KamiText variant="subtitle" color="#fff" align="center">Your galaxy is dark</KamiText>
              <KamiText variant="caption" color="rgba(255,255,255,0.6)" align="center" style={{ marginTop: Space[2], paddingHorizontal: Space[5] }}>
                Add a memory to light up your first star in this relationship sky.
              </KamiText>
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.galaxyScroll} showsVerticalScrollIndicator={false}>
              <View style={s.galaxyCanvas}>
                {(activeSpace === 'couple' ? filteredCoupleMemories : memories).map((m: any, idx: number) => {
                  const coords = getStarCoordinates(idx);
                  const opacity = getStarOpacity(m.memoryDate);

                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        s.starWrapper,
                        {
                          left: `${coords.x}%` as any,
                          top: `${coords.y}%` as any,
                          opacity: opacity,
                        }
                      ]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setPreviewMemory(m);
                        setPreviewVisible(true);
                      }}
                    >
                      <AnimatedStarPulse />
                      <Text style={s.starEmoji}>⭐</Text>
                      <KamiText variant="caption" bold color="#fff" style={s.starText} numberOfLines={1}>
                        {m.title}
                      </KamiText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </LinearGradient>
      ) : (
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

          {recentMemories.length > 0 ? (
            <View style={s.timelineContainer}>
              {recentMemories.slice(0, timelineLimit).map((m, idx) => (
                <MemoryTimelineCard
                  key={m.id}
                  memory={m}
                  index={idx}
                  total={recentMemories.length}
                  isLast={idx === Math.min(recentMemories.length, timelineLimit) - 1}
                  onPressCard={() => { setPreviewMemory(m); setPreviewVisible(true); }}
                  onDelete={() => handleDelete(m)}
                />
              ))}
              {recentMemories.length > timelineLimit && (
                <TouchableOpacity
                  style={[s.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
                  onPress={() => setTimelineLimit(prev => prev + 5)}
                  activeOpacity={0.8}
                >
                  <KamiText variant="label" color={colors.primary} bold>Load More Moments</KamiText>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            (memories.length > 0 || coupleMemories.length > 0) && (
              <View style={s.center}>
                <KamiText variant="body" color={Colors.textMuted}>No matching memories found.</KamiText>
              </View>
            )
          )}

          <View style={{ height: Space[8] }} />
        </ScrollView>
      )}

      <MemoryModal visible={modalOpen} memory={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} saving={saving} activeSpace={activeSpace} />
      
      <MemoryPreviewModal
        visible={previewVisible}
        memory={previewMemory}
        onClose={() => { setPreviewVisible(false); setPreviewMemory(null); }}
        onEdit={() => { setEditing(previewMemory); setModalOpen(true); }}
        onDelete={() => handleDelete(previewMemory!)}
        activeSpace={activeSpace}
        user={user}
      />
    </SafeAreaView>
  );
};

const getRotationAngle = (id: string) => {
  const charCodeSum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return charCodeSum % 2 === 0 ? '1.2deg' : '-1.2deg';
};

const MemoryTimelineCard: React.FC<{
  memory: any;
  index: number;
  total: number;
  isLast: boolean;
  onPressCard: () => void;
  onDelete: () => void;
}> = ({ memory, index, total, isLast, onPressCard, onDelete }) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;

  const desc = 'description' in memory ? memory.description : (memory as any).body;
  const mood = 'mood' in memory ? memory.mood : null;
  const location = 'location' in memory ? memory.location : null;
  const time = 'memoryTime' in memory ? memory.memoryTime : null;
  const lastEdited = 'lastEditedNickname' in memory ? memory.lastEditedNickname : null;
  const emoji = 'emoji' in memory ? memory.emoji : '📸';

  // Reverse chronological index
  const displayIndex = total - index;

  return (
    <View style={s.timelineRow}>
      {/* Left Timeline Guide */}
      <View style={s.timelineLeft}>
        <View style={[s.premiumTimelineDot, { borderColor: colors.primaryLight, backgroundColor: '#fff' }]}>
          <View style={[s.premiumTimelineDotInner, { backgroundColor: colors.primary }]} />
        </View>
        {!isLast && <View style={[s.premiumTimelineLine, { borderColor: colors.primaryLight + '55' }]} />}
      </View>

      {/* Card Content */}
      <View style={{ flex: 1, paddingBottom: Space[4] }}>
        <TouchableOpacity activeOpacity={1} onPress={onPressCard}
          onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
          onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        >
          <Animated.View style={[s.card, { transform: [{ scale: sc }, { rotate: getRotationAngle(memory.id) }] }]}>
            <View style={{ flex: 1, gap: 6 }}>
              {/* Header with index, emoji, title and delete button */}
              <View style={s.cardTop}>
                <View style={[s.tagBadge, { backgroundColor: colors.primary + '15', marginRight: 4 }]}>
                  <KamiText variant="caption" color={colors.primary} bold style={{ fontSize: 10 }}>#{displayIndex}</KamiText>
                </View>
                <Text style={{ fontSize: 20, marginRight: 4 }}>{emoji}</Text>
                <KamiText variant="label" numberOfLines={1} style={{ flex: 1 }}>{memory.title}</KamiText>
                <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.delBtn}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Description */}
              {desc ? <KamiText variant="body" color={Colors.textSecondary} style={{ lineHeight: 20 }}>{desc}</KamiText> : null}

              {/* Details grid: location, time, mood, last edited */}
              <View style={{ gap: 4, marginTop: 2 }}>
                {/* Date & Time */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 10 }}>📅</Text>
                  <KamiText variant="caption" color={Colors.textMuted}>
                    {new Date(memory.memoryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {time ? ` · ${time}` : ''}
                  </KamiText>
                </View>

                {/* Location & Mood */}
                {(location || mood) && (
                  <View style={{ flexDirection: 'row', gap: Space[3], alignItems: 'center' }}>
                    {location ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 10 }}>📍</Text>
                        <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1} style={{ maxWidth: 150 }}>{location}</KamiText>
                      </View>
                    ) : null}
                    {mood ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <KamiText variant="caption" color={Colors.textMuted}>Mood: {mood}</KamiText>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Last edited */}
                {lastEdited ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 10 }}>✏️</Text>
                    <KamiText variant="caption" color={colors.primary} style={{ fontSize: 10 }}>Last edited by {lastEdited}</KamiText>
                  </View>
                ) : null}
              </View>

              {/* Tags and photos */}
              {memory.tags && memory.tags.length > 0 && (
                <View style={[s.tagRow, { marginTop: Space[1] }]}>
                  {memory.tags.map((tag: string) => (
                    <View key={tag} style={[s.tagBadge, { backgroundColor: colors.primary + '11' }]}>
                      <KamiText variant="caption" color={colors.primary} style={{ fontSize: 9 }}>#{tag}</KamiText>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {memory.imageUrls && memory.imageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imageScroll}>
                <View style={s.imageRow}>
                  {memory.imageUrls.map((url: string, i: number) => (
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

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '33', backgroundColor: Colors.pageBg },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  addPlus:{ fontSize: FontSize.lg, color: Colors.primary, fontWeight: FontWeight.bold, lineHeight: 22 },

  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Space[5], marginTop: Space[4], paddingHorizontal: Space[3], backgroundColor: Colors.cardBg, borderRadius: Radii.input, borderWidth: 1, borderColor: Colors.border + '88', ...Shadows.sm },
  searchIcon:{ fontSize: FontSize.sm, marginRight: Space[2] },
  searchInput:{ flex: 1, height: 44, fontSize: FontSize.base, color: Colors.textPrimary },

  viewToggleRow: { flexDirection: 'row', marginHorizontal: Space[5], marginVertical: Space[3], gap: Space[2] },
  toggleBtn: { flex: 1, height: 38, borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border + '55', backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { borderWidth: 1.5 },

  galaxyBg: { flex: 1, position: 'relative' },
  galaxyScroll: { flexGrow: 1 },
  galaxyCanvas: { height: 620, width: '100%', position: 'relative' },
  galaxyEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 120, paddingHorizontal: Space[5] },
  bgStarDot: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#fff', opacity: 0.8 },
  
  starWrapper: { position: 'absolute', alignItems: 'center', width: 80, height: 60, marginLeft: -40, marginTop: -30, justifyContent: 'center' },
  starEmoji: { fontSize: 24, zIndex: 3 },
  starText: { fontSize: 10, color: 'rgba(255, 255, 255, 0.95)', marginTop: 2, textAlign: 'center', width: 80, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, zIndex: 4 },
  starGlow: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(234, 179, 8, 0.45)', zIndex: 1 },

  galaxyModalBackdrop: { flex: 1, backgroundColor: 'rgba(5, 6, 15, 0.85)', justifyContent: 'center', alignItems: 'center', padding: Space[5] },
  galaxyModalCard: { width: '100%', borderRadius: Radii.card, borderWidth: 2, padding: Space[5], ...Shadows.md },
  galaxyModalClose: { position: 'absolute', top: Space[4], right: Space[4], width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  galaxyModalDesc: { fontSize: FontSize.base, lineHeight: 22, color: 'rgba(255, 255, 255, 0.9)', marginVertical: Space[3] },
  galaxyModalPhotos: { marginVertical: Space[3], marginHorizontal: -Space[5], paddingHorizontal: Space[5] },
  galaxyModalPhoto: { width: 180, height: 120, borderRadius: Radii.sm },
  galaxyModalActions: { flexDirection: 'row', gap: Space[3], marginTop: Space[4] },
  galaxyModalBtn: { flex: 1, height: 44, borderRadius: Radii.button, justifyContent: 'center', alignItems: 'center' },

  scroll: { paddingHorizontal: Space[5], paddingTop: Space[2], gap: Space[4] },
  center: { paddingVertical: Space[10], alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn:   { marginTop: Space[4], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  
  card:    { flexDirection: 'column', gap: Space[3], backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], borderWidth: 1, borderColor: Colors.border + '44', ...Shadows.sm },
  cardLeft:{ alignItems: 'center', width: 44 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  delBtn:  { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border + '33' },

  imageScroll: { marginHorizontal: -Space[4], paddingHorizontal: Space[4], marginTop: Space[1] },
  imageRow:    { flexDirection: 'row', gap: Space[2] },
  photo:       { width: 200, height: 130, borderRadius: Radii.sm },

  timelineContainer: { paddingLeft: Space[1] },
  timelineRow: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', width: 24, marginRight: Space[2] },
  premiumTimelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    zIndex: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  premiumTimelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  premiumTimelineLine: {
    width: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    flex: 1,
    marginTop: 4,
    marginBottom: -22,
    alignSelf: 'center',
    zIndex: 1,
  },
  tagRow: { flexDirection: 'row', gap: Space[1] },
  tagBadge: { paddingHorizontal: Space[2], paddingVertical: 2, borderRadius: Radii.full },
  netflixCard: {
    width: 260,
    borderRadius: Radii.card,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: Space[4],
  },
  cardImageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  netflixCardPhoto: {
    width: 260,
    height: 140,
    resizeMode: 'cover',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  netflixCardNoPhoto: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netflixCardInfo: {
    padding: Space[3],
    gap: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netflixCardDelete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netflixCardDesc: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  netflixMetaGrid: {
    marginTop: Space[1],
    gap: 2,
  },
  netflixMetaSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  netflixMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  netflixMetaIcon: {
    fontSize: 10,
  },
  sectionContainer: {
    marginBottom: Space[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    marginHorizontal: Space[5],
    marginBottom: Space[2],
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  horizontalScrollContainer: {
    paddingHorizontal: Space[5],
    gap: Space[4],
    paddingBottom: Space[2],
  },
  horizontalEmptyCard: {
    height: 80,
    marginHorizontal: Space[5],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[3],
    paddingHorizontal: Space[5],
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.border + '66',
    marginVertical: Space[2],
    ...Shadows.sm,
  },
});

const MemoryNetflixCard: React.FC<{
  memory: any;
  onPressCard: () => void;
  onDelete: () => void;
}> = ({ memory, onPressCard, onDelete }) => {
  const { colors } = useTheme();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const desc = 'description' in memory ? memory.description : (memory as any).body;
  const mood = memory.mood;
  const location = memory.location;
  const time = memory.memoryTime;
  const lastEdited = memory.lastEditedNickname;

  return (
    <View style={[s.netflixCard, { backgroundColor: Colors.cardBg, borderColor: Colors.border + '44' }]}>
      {/* Photo carousel */}
      {memory.imageUrls && memory.imageUrls.length > 0 ? (
        <View style={s.cardImageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / 260);
              if (slide !== activeImageIndex) {
                setActiveImageIndex(slide);
              }
            }}
            scrollEventThrottle={16}
          >
            {memory.imageUrls.map((url: string, i: number) => (
              <Image key={i} source={{ uri: url }} style={s.netflixCardPhoto} />
            ))}
          </ScrollView>
          {memory.imageUrls.length > 1 && (
            <View style={s.dotsContainer}>
              {memory.imageUrls.map((_: any, i: number) => (
                <View
                  key={i}
                  style={[
                    s.dot,
                    { backgroundColor: i === activeImageIndex ? colors.primary : 'rgba(255,255,255,0.5)' }
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={[s.netflixCardNoPhoto, { backgroundColor: colors.primary + '08' }]}>
          <Text style={{ fontSize: 32 }}>📸</Text>
        </View>
      )}

      {/* Info Content */}
      <TouchableOpacity style={s.netflixCardInfo} onPress={onPressCard} activeOpacity={0.9}>
        <View style={s.cardHeaderRow}>
          <KamiText variant="label" bold numberOfLines={1} style={{ flex: 1 }}>
            {memory.title}
          </KamiText>
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={[s.netflixCardDelete, { backgroundColor: Colors.border + '44' }]}>
            <Text style={{ color: Colors.textMuted, fontSize: 11 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {desc ? (
          <KamiText variant="body" color={Colors.textSecondary} numberOfLines={2} style={s.netflixCardDesc}>
            {desc}
          </KamiText>
        ) : null}

        {/* Metadata Details Grid */}
        <View style={s.netflixMetaGrid}>
          {/* Row 1: Date & Time */}
          <View style={s.netflixMetaItem}>
            <Text style={s.netflixMetaIcon}>📅</Text>
            <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1}>
              {new Date(memory.memoryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              {time ? ` · ${time}` : ''}
            </KamiText>
          </View>

          {/* Row 2: Location & Mood */}
          {(location || mood) && (
            <View style={s.netflixMetaSubRow}>
              {location ? (
                <View style={s.netflixMetaItem}>
                  <Text style={s.netflixMetaIcon}>📍</Text>
                  <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1} style={{ maxWidth: 120 }}>
                    {location}
                  </KamiText>
                </View>
              ) : null}
              {mood ? (
                <View style={s.netflixMetaItem}>
                  <KamiText variant="caption" color={Colors.textMuted} numberOfLines={1}>
                    Mood: {mood}
                  </KamiText>
                </View>
              ) : null}
            </View>
          )}

          {/* Row 3: Last Edited By */}
          {lastEdited ? (
            <View style={[s.netflixMetaItem, { marginTop: 2 }]}>
              <Text style={s.netflixMetaIcon}>✏️</Text>
              <KamiText variant="caption" color={colors.primary} numberOfLines={1} style={{ fontSize: 10 }}>
                Last edited by {lastEdited}
              </KamiText>
            </View>
          ) : null}
        </View>

        {/* Tags badges */}
        {memory.tags && memory.tags.length > 0 && (
          <View style={[s.tagRow, { marginTop: 4 }]}>
            {memory.tags.map((tag: string) => (
              <View key={tag} style={[s.tagBadge, { backgroundColor: colors.primary + '11' }]}>
                <KamiText variant="caption" color={colors.primary} style={{ fontSize: 9 }}>#{tag}</KamiText>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const MemoryCard: React.FC<{ memory: Memory; onPressCard: () => void; onDelete: () => void }> = ({ memory, onPressCard, onDelete }) => {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity activeOpacity={1} onPress={onPressCard}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[s.card, { transform: [{ scale: sc }, { rotate: getRotationAngle(memory.id) }] }]}>
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

const AnimatedStarPulse = () => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View 
      style={[
        s.starGlow,
        {
          opacity: pulse,
          transform: [{ scale: pulse.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.4] }) }]
        }
      ]}
    />
  );
};

const MemoryPreviewModal: React.FC<{
  visible: boolean;
  memory: Memory | CoupleMemory | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  activeSpace?: 'personal' | 'couple';
  user?: any;
}> = ({ visible, memory, onClose, onEdit, onDelete, activeSpace, user }) => {
  const { colors } = useTheme();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setActiveImageIndex(0);
    }
  }, [visible]);

  if (!memory) return null;

  const desc = 'description' in memory ? memory.description : (memory as any).body;
  const mood = 'mood' in memory ? (memory as any).mood : null;
  const location = 'location' in memory ? (memory as any).location : null;
  const time = 'memoryTime' in memory ? (memory as any).memoryTime : null;
  const lastEdited = 'lastEditedNickname' in memory ? (memory as any).lastEditedNickname : null;
  const emoji = 'emoji' in memory ? (memory as any).emoji : '📸';

  const canEdit = !activeSpace || activeSpace === 'personal' || ('userId' in memory ? memory.userId === user?.id : true);
  const { width: screenWidth } = Dimensions.get('window');
  const carouselWidth = screenWidth - 40; // 20 padding on each side

  const handleOptionsPress = () => {
    const options = [
      { text: 'Cancel', style: 'cancel' as const },
    ];
    if (canEdit) {
      options.unshift({
        text: 'Edit Memory',
        onPress: () => { onClose(); onEdit(); }
      });
    }
    options.unshift({
      text: 'Delete Memory',
      style: 'destructive' as const,
      onPress: () => { onClose(); onDelete(); }
    });
    Alert.alert('Options', undefined, options);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[pv.root, { backgroundColor: colors.pageBg }]}>
        <View style={pv.header}>
          <KamiText variant="title">Preview Memory</KamiText>
          <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={handleOptionsPress} 
              style={[pv.menuBtn, { backgroundColor: colors.primary + '18' }]}
              accessibilityRole="button"
              accessibilityLabel="Options"
            >
              <Text style={{ fontSize: 18, color: colors.primary, fontWeight: 'bold' }}>☰</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={pv.closeBtn} accessibilityRole="button" accessibilityLabel="Close Preview">
              <KamiText variant="label" color={Colors.textMuted} bold style={{ fontSize: 13 }}>Close</KamiText>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={pv.scroll} showsVerticalScrollIndicator={false}>
          {/* Header metadata (Mood, Date, Time, Location) */}
          <View style={pv.metaRow}>
            {mood ? (
              <View style={[pv.moodBadge, { backgroundColor: colors.primary + '11' }]}>
                <KamiText variant="caption" color={colors.primary} bold>Mood: {mood}</KamiText>
              </View>
            ) : <View />}
            <KamiText variant="caption" color={Colors.textMuted}>
              {new Date(memory.memoryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {time ? ` · ${time}` : ''}
            </KamiText>
          </View>

          {/* Location details */}
          {location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -Space[2], marginBottom: Space[2] }}>
              <Text style={{ fontSize: 12 }}>📍</Text>
              <KamiText variant="caption" color={Colors.textSecondary} bold>{location}</KamiText>
            </View>
          )}

          {/* Title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2], marginVertical: Space[1] }}>
            <Text style={{ fontSize: 32 }}>{emoji}</Text>
            <KamiText variant="subtitle" bold style={[pv.title, { flex: 1 }]}>
              {memory.title}
            </KamiText>
          </View>

          {/* Authorship / last edited info */}
          {lastEdited && (
            <View style={pv.authorRow}>
              <KamiText variant="caption" color={colors.primary} bold>
                ✏️ Last edited by {lastEdited}
              </KamiText>
            </View>
          )}

          {/* Premium Image Scroller / Carousel */}
          {memory.imageUrls && memory.imageUrls.length > 0 && (
            <View style={pv.imageScrollerContainer}>
              <ScrollView 
                horizontal 
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={pv.imageScrollView}
                testID="memory-image-carousel"
                accessibilityLabel="Memory Image Carousel"
                onScroll={(e) => {
                  const slide = Math.round(e.nativeEvent.contentOffset.x / carouselWidth);
                  if (slide !== activeImageIndex) {
                    setActiveImageIndex(slide);
                  }
                }}
                scrollEventThrottle={16}
              >
                {memory.imageUrls.map((url: string, index: number) => (
                  <View key={index} style={{ width: carouselWidth, height: 250, overflow: 'hidden' }}>
                    <Image 
                      source={{ uri: url }} 
                      style={pv.scrollerImage} 
                      resizeMode="cover" 
                      testID={`memory-image-${index}`}
                    />
                  </View>
                ))}
              </ScrollView>
              {/* Pagination Dots indicator */}
              {memory.imageUrls.length > 1 && (
                <View style={pv.dotIndicatorRow}>
                  {memory.imageUrls.map((_: any, index: number) => (
                    <View 
                      key={index} 
                      style={[
                        pv.dot, 
                        { backgroundColor: index === activeImageIndex ? colors.primary : colors.primary + '33' }
                      ]} 
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Description Body */}
          {desc ? (
            <View style={pv.bodyContainer}>
              <KamiText variant="body" color={Colors.textSecondary} style={pv.bodyText}>
                {desc}
              </KamiText>
            </View>
          ) : null}

          {/* Tags */}
          {'tags' in memory && memory.tags && memory.tags.length > 0 && (
            <View style={pv.tagRow}>
              {memory.tags.map((t: string) => (
                <View key={t} style={[pv.tagChip, { backgroundColor: colors.primary + '15' }]}>
                  <KamiText variant="caption" color={colors.primary}>#{t}</KamiText>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStarCoordinates = (index: number) => {
  const positions = [
    { x: 15, y: 12 }, { x: 72, y: 15 }, { x: 42, y: 28 }, { x: 80, y: 40 },
    { x: 20, y: 48 }, { x: 50, y: 62 }, { x: 82, y: 72 }, { x: 28, y: 78 },
    { x: 68, y: 82 }, { x: 12, y: 32 }, { x: 58, y: 10 }, { x: 88, y: 22 },
    { x: 28, y: 24 }, { x: 74, y: 30 }, { x: 34, y: 58 }, { x: 62, y: 50 },
    { x: 15, y: 68 }, { x: 48, y: 42 }, { x: 68, y: 64 }, { x: 88, y: 85 },
  ];
  return positions[index % positions.length];
};

const getStarOpacity = (memoryDate: string) => {
  const ageDays = Math.max(1, (Date.now() - new Date(memoryDate).getTime()) / 86400000);
  const opacity = Math.max(0.35, 1.0 - (ageDays / 180));
  return opacity;
};

const pv = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  editBtn: { paddingVertical: Space[1] + 2, paddingHorizontal: Space[3], borderRadius: Radii.md },
  deleteBtn: { paddingVertical: Space[1] + 2, paddingHorizontal: Space[3], borderRadius: Radii.md },
  menuBtn: { paddingVertical: Space[1] + 2, paddingHorizontal: Space[3], borderRadius: Radii.md },
  closeBtn: { padding: Space[2] },
  scroll: { padding: Space[5], gap: Space[4] },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space[1] },
  moodBadge: { paddingVertical: 2, paddingHorizontal: Space[2], borderRadius: Radii.sm },
  title: { fontSize: FontSize.lg, lineHeight: 28, color: Colors.textPrimary },
  authorRow: { marginTop: -Space[2], marginBottom: Space[2] },
  imageScrollerContainer: { marginVertical: Space[3], width: '100%', borderRadius: Radii.card, overflow: 'hidden' },
  imageScrollView: { width: '100%', height: 250 },
  scrollerImage: { width: '100%', height: '100%' },
  dotIndicatorRow: { flexDirection: 'row', justifyContent: 'center', gap: Space[1] + 2, marginTop: Space[2] },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bodyContainer: { paddingVertical: Space[2] },
  bodyText: { fontSize: FontSize.base, lineHeight: 26 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2], marginTop: Space[2] },
  tagChip: { paddingVertical: 4, paddingHorizontal: Space[3], borderRadius: Radii.full },
});

export default MemoriesScreen;
