/**
 * MemoriesScreen.tsx
 *
 * Personal photo memory vault with search, write/edit modal,
 * and multiple image uploads to secure Supabase storage.
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FlashList } from '@shopify/flash-list';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, Radii, Shadows, Space } from '@shared/constants';
import { useAuthStore } from '@features/auth';
import type { MainTabScreenProps } from '@core/navigation/types';
import type { Memory } from '@features/home/types';
import type { CoupleMemory } from '@features/couple/types';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import * as memoryService from '@infrastructure/home/memoryService';
import { uploadImages } from '@shared/lib/storage';
import { useTheme, usePaginatedList } from '@shared/hooks';
import { LinearGradient } from 'expo-linear-gradient';

import {
  MemoryModal,
  MemoryPreviewModal,
  MemoryTimelineCard,
  AnimatedStarPulse,
  getStarCoordinates,
  getStarOpacity,
} from '../components';

type Props = MainTabScreenProps<'Memories'>;

import { uuid } from '@shared/lib/uuid';

export function MemoriesScreen({ navigation }: Props) {
  const user = useAuthStore(s => s.user);
  const activeSpace = user?.activeSpace ?? 'personal';
  const coupleStore = useCoupleStore();
  const coupleActions = useCouple();
  const { couple, coupleMemories } = coupleStore;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Memory | CoupleMemory | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'galaxy'>('timeline');
  const [previewMemory, setPreviewMemory] = useState<Memory | CoupleMemory | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const {
    data: memories,
    loading,
    refreshing,
    hasMore: memoriesHasMore,
    loadMore,
    refresh,
    setData: setMemories,
  } = usePaginatedList<Memory>({
    fetcher: useCallback(
      (page: number, limit: number) => {
        if (!user?.id) return Promise.resolve({ success: true as const, data: [] });
        return memoryService.fetchMemories(search.trim() || undefined, limit, page);
      },
      [search, user?.id]
    ),
    limit: 15,
    dependencies: [search, user?.id, activeSpace],
  });

  const [isFocused, setIsFocused] = useState(navigation.isFocused());
  const [appState, setAppState] = useState(AppState.currentState);

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
        refresh();
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
    }
  }, [activeSpace, couple?.id]);

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
      const bucket = activeSpace === 'couple' ? 'couple_memory_images' : 'memory_images';
      const ownerId = activeSpace === 'couple' && couple?.id ? couple.id : user.id;

      const imageUrlsToFilter = editing ? editing.imageUrls : [];
      const existingPaths = (imageUrlsToFilter ?? [])
        .filter(url => localUris.includes(url))
        .map(url => {
          const match = url.match(new RegExp(`\\/${bucket}\\/(.+?)\\?`));
          return match ? decodeURIComponent(match[1]) : null;
        })
        .filter(Boolean) as string[];

      if (localPickerUris.length > 0) {
        const uploadRes = await uploadImages(bucket, ownerId, targetId, localPickerUris);
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

        if (!r.success) {
          Alert.alert('Kami', r.error);
        } else {
          setModalOpen(false);
          setEditing(null);
          refresh();
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

  const isListRefreshing = activeSpace === 'couple'
    ? coupleStore.memoriesLoading === 'refreshing'
    : refreshing;

  const handleRefresh = async () => {
    if (activeSpace === 'couple') {
      await coupleActions.loadMemories();
    } else {
      await refresh();
    }
  };

  const filteredCoupleMemories = useMemo(() => {
    return coupleMemories.filter((m: CoupleMemory) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const titleMatch = m.title?.toLowerCase().includes(q);
      const descMatch = m.description?.toLowerCase().includes(q);
      const locMatch = m.location?.toLowerCase().includes(q);
      const moodMatch = m.mood?.toLowerCase().includes(q);
      const tagMatch = m.tags?.some((t: string) => t.toLowerCase().includes(q));
      return titleMatch || descMatch || locMatch || moodMatch || tagMatch;
    });
  }, [coupleMemories, search]);

  const listToCategorize = useMemo(() => {
    return activeSpace === 'couple' ? filteredCoupleMemories : memories;
  }, [activeSpace, filteredCoupleMemories, memories]);

  const recentMemories = useMemo(() => {
    return [...listToCategorize].sort((a, b) => new Date(b.memoryDate).getTime() - new Date(a.memoryDate).getTime());
  }, [listToCategorize]);

  const paginatedMemories = recentMemories;

  const renderItem = ({ item, index }: { item: Memory | CoupleMemory; index: number }) => {
    return (
      <MemoryTimelineCard
        memory={item}
        index={index}
        total={recentMemories.length}
        isLast={index === paginatedMemories.length - 1}
        onPressCard={() => { setPreviewMemory(item); setPreviewVisible(true); }}
        onDelete={() => handleDelete(item)}
      />
    );
  };

  const renderHeader = () => {
    const showLoading = (loading && activeSpace === 'personal' && memories.length === 0) ||
      (coupleStore.memoriesLoading === 'loading' && activeSpace === 'couple' && coupleMemories.length === 0);
    if (!showLoading) return null;
    return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
  };

  const renderEmpty = () => {
    const showLoading = (loading && activeSpace === 'personal' && memories.length === 0) ||
      (coupleStore.memoriesLoading === 'loading' && activeSpace === 'couple' && coupleMemories.length === 0);
    if (showLoading) return null;

    if (activeSpace === 'personal') {
      return (
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
      );
    }

    return (
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
    );
  };

  const handleLoadMore = () => {
    if (activeSpace === 'couple') {
      coupleActions.loadMoreMemories();
    } else {
      loadMore();
    }
  };

  const renderFooter = () => {
    const hasMore = activeSpace === 'couple'
      ? coupleStore.memoriesHasMore
      : memoriesHasMore;
    const isLoading = activeSpace === 'couple'
      ? coupleStore.memoriesLoading === 'loading'
      : loading;

    if (isLoading && recentMemories.length > 0) {
      return (
        <View style={{ paddingVertical: Space[4], alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return <View style={{ height: Space[8] }} />;
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
                {(activeSpace === 'couple' ? filteredCoupleMemories : memories).map((m: Memory | CoupleMemory, idx: number) => {
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
        <FlashList
          data={paginatedMemories}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={{ height: Space[3] }} />}
          contentContainerStyle={{ paddingHorizontal: Space[5], paddingTop: Space[2] }}
          refreshControl={<RefreshControl refreshing={isListRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
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
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? 40 : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '33', backgroundColor: Colors.pageBg },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  addPlus:{ fontSize: 18, color: Colors.primary, fontWeight: 'bold', lineHeight: 22 },

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

  center: { paddingVertical: Space[10], alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn:   { marginTop: Space[4], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: Colors.primary + '44' },
});

export default MemoriesScreen;
