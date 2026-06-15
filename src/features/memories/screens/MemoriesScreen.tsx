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
  Dimensions,
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
import { FontSize, Radii, Shadows, Space } from '@shared/constants';
import { useAuthStore } from '@features/auth';
import { useHomeStore } from '@features/home/store';
import { useShallow } from 'zustand/react/shallow';
import type { MainTabScreenProps } from '@core/navigation/types';
import type { Memory } from '@features/home/types';
import type { CoupleMemory } from '@features/couple/types';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import * as memoryService from '@infrastructure/home/memoryService';
import { useTheme, usePaginatedList } from '@shared/hooks';
import { LinearGradient } from 'expo-linear-gradient';

import {
  MemoryModal,
  MemoryPreviewModal,
  MemoryTimelineCard,
  AnimatedStarPulse,
  getStarCoordinates,
  getStarOpacity,
  FloatingStarWrapper,
} from '../components';

type Props = MainTabScreenProps<'Memories'>;

import { uuid } from '@shared/lib/uuid';

const { width: screenWidth } = Dimensions.get('window');

interface GalaxyStarNodeProps {
  memory: Memory | CoupleMemory;
  coords: { x: number; y: number };
  opacity: number;
  glowColor: string;
  onPress: () => void;
  styles: any;
}

const GalaxyStarNode: React.FC<GalaxyStarNodeProps> = ({ memory, coords, opacity, glowColor, onPress, styles }) => {
  const starScale = useRef(new Animated.Value(1)).current;
  const emojiStr = 'emoji' in memory ? (memory as any).emoji : '🌸';

  return (
    <FloatingStarWrapper
      style={[
        styles.starWrapper,
        {
          left: `${coords.x}%`,
          top: `${coords.y}%`,
          opacity: opacity,
          zIndex: 5,
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => Animated.spring(starScale, { toValue: 1.25, useNativeDriver: true, friction: 6 }).start()}
        onPressOut={() => Animated.spring(starScale, { toValue: 1, useNativeDriver: true, friction: 6 }).start()}
        onPress={onPress}
        style={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale: starScale }], alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedStarPulse color={glowColor} />
          <View style={styles.starCoreContainer}>
            <Text style={[styles.starShape, { color: '#ffffff', textShadowColor: glowColor }]}>★</Text>
          </View>
          <Text style={styles.starEmojiLabel}>{emojiStr}</Text>
          <KamiText variant="caption" bold color="#fff" style={styles.starText} numberOfLines={1}>
            {memory.title}
          </KamiText>
        </Animated.View>
      </TouchableOpacity>
    </FloatingStarWrapper>
  );
};

interface ConstellationLinesProps {
  stars: (Memory | CoupleMemory)[];
  styles: any;
}

const ConstellationLines: React.FC<ConstellationLinesProps> = ({ stars, styles }) => {
  if (stars.length < 2) return null;

  const canvasWidth = screenWidth;
  const canvasHeight = 620;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {stars.slice(0, -1).map((_, idx) => {
        const coordsA = getStarCoordinates(idx);
        const coordsB = getStarCoordinates(idx + 1);

        const ax = (coordsA.x / 100) * canvasWidth;
        const ay = (coordsA.y / 100) * canvasHeight;
        const bx = (coordsB.x / 100) * canvasWidth;
        const by = (coordsB.y / 100) * canvasHeight;

        const length = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
        const angle = Math.atan2(by - ay, bx - ax);

        const midX = (ax + bx) / 2;
        const midY = (ay + by) / 2;

        return (
          <View
            key={`line-${idx}`}
            style={[
              styles.constellationLine,
              {
                left: midX - length / 2,
                top: midY - 0.75,
                width: length,
                transform: [{ rotate: `${angle}rad` }],
              }
            ]}
          />
        );
      })}
    </View>
  );
};

export function MemoriesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const user = useAuthStore(s => s.user);
  const activeSpace = user?.activeSpace ?? 'personal';
  const coupleStore = useCoupleStore();
  const coupleActions = useCouple();
  const { couple, coupleMemories } = coupleStore;

  const [modalOpen, setModalOpen] = useState(false);

  // Sync state from Zustand
  const { pendingSyncCount, isSyncing } = useHomeStore(
    useShallow((s) => ({
      pendingSyncCount: s.pendingSyncCount,
      isSyncing: s.isSyncing,
    }))
  );

  // Local UI status: 'idle' | 'syncing' | 'saved'
  const [uiSyncStatus, setUiSyncStatus] = useState<'idle' | 'syncing' | 'saved'>('idle');

  useEffect(() => {
    if (isSyncing) {
      setUiSyncStatus('syncing');
    } else if (pendingSyncCount === 0 && uiSyncStatus === 'syncing') {
      setUiSyncStatus('saved');
      const timer = setTimeout(() => {
        setUiSyncStatus('idle');
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setUiSyncStatus('idle');
    }
  }, [isSyncing, pendingSyncCount]);
  const [editing, setEditing] = useState<Memory | CoupleMemory | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'galaxy'>('timeline');
  const [previewMemory, setPreviewMemory] = useState<Memory | CoupleMemory | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Shooting star state
  const [shootingStar, setShootingStar] = useState<{ x: number; y: number } | null>(null);
  const shoot = useRef(new Animated.Value(0)).current;

  const triggerShootingStar = () => {
    const startX = Math.random() * 200 + 100;
    const startY = Math.random() * 100;
    setShootingStar({ x: startX, y: startY });
    shoot.setValue(0);
    Animated.timing(shoot, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      setShootingStar(null);
    });
  };

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
      if (activeSpace === 'couple') {
        if (!couple?.id) {
          Alert.alert('Kami', 'No couple space connected.');
          setSaving(false);
          return;
        }
        const r = editing
          ? await coupleActions.updateMemory(editing.id, title, body, localUris, memoryDate, tags, location, mood || undefined, memoryTime)
          : await coupleActions.addMemory(couple.id, title, body, localUris, memoryDate, tags, location, mood || undefined, memoryTime);

        if (!r.success) {
          Alert.alert('Kami', r.error);
        } else {
          setModalOpen(false);
          setEditing(null);
        }
      } else {
        const targetId = editing ? editing.id : uuid();
        const r = editing
          ? await memoryService.updateMemory(editing.id, { title, body, emoji, mood, imageUrls: localUris })
          : await memoryService.createMemory(targetId, { title, body, emoji, mood, imageUrls: localUris });

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
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  };

  const renderEmpty = () => {
    const showLoading = (loading && activeSpace === 'personal' && memories.length === 0) ||
      (coupleStore.memoriesLoading === 'loading' && activeSpace === 'couple' && coupleMemories.length === 0);
    if (showLoading) return null;

    if (activeSpace === 'personal') {
      return (
        <TouchableOpacity style={styles.emptyState} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
          <Text style={{ fontSize: 56, marginBottom: Space[3] }}>📸</Text>
          <KamiText variant="subtitle" align="center">Your vault is empty</KamiText>
          <KamiText variant="body" color={colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
            {search ? 'Clear search filter to view your memories.' : 'Capture the moments worth remembering.'}
          </KamiText>
          <View style={[styles.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
            <KamiText variant="label" color={colors.primary} bold>Add your first memory ›</KamiText>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={styles.emptyState} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
        <Text style={{ fontSize: 56, marginBottom: Space[3] }}>💑</Text>
        <KamiText variant="subtitle" align="center">No shared memories yet</KamiText>
        <KamiText variant="body" color={colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
          {search ? 'Clear search filter to view couple memories.' : 'Start capturing your beautiful relationship milestones.'}
        </KamiText>
        <View style={[styles.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
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
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style={viewMode === 'galaxy' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.pageBg }]}>
        <View style={{ flex: 1 }}>
          <KamiText variant="overline">{activeSpace === 'couple' ? 'Relationship timeline' : 'Your vault'}</KamiText>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <KamiText variant="title">{activeSpace === 'couple' ? 'Couple Memories' : 'Memories'}</KamiText>
            {uiSyncStatus === 'syncing' && (
              <View style={[styles.syncStatusBadge, { backgroundColor: '#fef3c7' }]}>
                <ActivityIndicator size="small" color="#d97706" style={{ marginRight: 4, transform: [{ scale: 0.8 }] }} />
                <KamiText variant="caption" color="#d97706" bold>Syncing...</KamiText>
              </View>
            )}
            {uiSyncStatus === 'saved' && (
              <View style={[styles.syncStatusBadge, { backgroundColor: '#ecfdf5' }]}>
                <KamiText variant="caption" color="#059669" bold>✓ Saved</KamiText>
              </View>
            )}
            {uiSyncStatus === 'idle' && pendingSyncCount > 0 && (
              <View style={[styles.syncStatusBadge, { backgroundColor: '#f3f4f6' }]}>
                <KamiText variant="caption" color="#6b7280" bold>☁ {pendingSyncCount} offline</KamiText>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => { setEditing(null); setModalOpen(true); }}>
          <Text style={[styles.addPlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>Add</KamiText>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search memories..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* View Mode Toggle Switch */}
      <View style={styles.viewToggleRow}>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            viewMode === 'timeline' && [styles.toggleBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
          ]}
          onPress={() => setViewMode('timeline')}
        >
          <KamiText variant="caption" color={viewMode === 'timeline' ? '#fff' : colors.textMuted} bold={viewMode === 'timeline'}>
            📜 Timeline Feed
          </KamiText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            viewMode === 'galaxy' && [styles.toggleBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
          ]}
          onPress={() => setViewMode('galaxy')}
        >
          <KamiText variant="caption" color={viewMode === 'galaxy' ? '#fff' : colors.textMuted} bold={viewMode === 'galaxy'}>
            🌌 Memory Galaxy
          </KamiText>
        </TouchableOpacity>
      </View>

      {viewMode === 'galaxy' ? (
        <LinearGradient
          colors={['#08091a', '#12142e', '#03030c']}
          style={styles.galaxyBg}
        >
          {/* Soft background decorative stars */}
          <View style={[styles.bgStarDot, { top: '15%', left: '20%' }]} />
          <View style={[styles.bgStarDot, { top: '35%', left: '75%', opacity: 0.6 }]} />
          <View style={[styles.bgStarDot, { top: '65%', left: '15%', opacity: 0.4 }]} />
          <View style={[styles.bgStarDot, { top: '80%', left: '60%', opacity: 0.7 }]} />
          <View style={[styles.bgStarDot, { top: '45%', left: '40%', opacity: 0.3 }]} />
          <View style={[styles.bgStarDot, { top: '25%', left: '85%', opacity: 0.5 }]} />
          <View style={[styles.bgStarDot, { top: '70%', left: '80%', opacity: 0.4 }]} />

          {(activeSpace === 'couple' ? filteredCoupleMemories : memories).length === 0 ? (
            <View style={styles.galaxyEmpty}>
              <Text style={{ fontSize: 56, marginBottom: Space[4] }}>🌌</Text>
              <KamiText variant="subtitle" color="#fff" align="center">Your galaxy is dark</KamiText>
              <KamiText variant="caption" color="rgba(255,255,255,0.6)" align="center" style={{ marginTop: Space[2], paddingHorizontal: Space[5] }}>
                Add a memory to light up your first star in this relationship sky.
              </KamiText>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.galaxyScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.galaxyCanvas}>
                {/* 1. Constellation connector threads */}
                <ConstellationLines stars={[...(activeSpace === 'couple' ? filteredCoupleMemories : memories)].sort((a, b) => new Date(a.memoryDate).getTime() - new Date(b.memoryDate).getTime())} styles={styles} />

                {/* 2. Interactive star nodes */}
                {(activeSpace === 'couple' ? filteredCoupleMemories : memories).map((m: Memory | CoupleMemory, idx: number) => {
                  const coords = getStarCoordinates(idx);
                  const opacity = getStarOpacity(m.memoryDate);

                  // Determine starlight colors
                  const moodStr = 'mood' in m ? m.mood : null;
                  const emojiStr = 'emoji' in m ? (m as any).emoji : '🌸';
                  
                  const getGlowColor = () => {
                    if (moodStr) {
                      if (['😍', '❤️', '😘', '🥰'].some(item => moodStr.includes(item))) return 'rgba(244, 160, 181, 0.6)'; // Pink glow
                      if (['😭', '😢', '😔', '😪', '😤'].some(item => moodStr.includes(item))) return 'rgba(56, 189, 248, 0.6)'; // Blue glow
                      if (['😌', '😴', '🍃'].some(item => moodStr.includes(item))) return 'rgba(34, 197, 94, 0.6)'; // Green glow
                    }
                    if (emojiStr === '❤️' || emojiStr === '🎂' || emojiStr === '🎉') return 'rgba(244, 160, 181, 0.6)';
                    if (emojiStr === '🌊' || emojiStr === '🌙' || emojiStr === '✨') return 'rgba(56, 189, 248, 0.6)';
                    return 'rgba(252, 211, 77, 0.65)'; // Golden starlight
                  };
                  
                  const glowColor = getGlowColor();

                  return (
                    <GalaxyStarNode
                      key={m.id}
                      memory={m}
                      coords={coords}
                      opacity={opacity}
                      glowColor={glowColor}
                      onPress={() => {
                        triggerShootingStar();
                        setPreviewMemory(m);
                        setPreviewVisible(true);
                      }}
                      styles={styles}
                    />
                  );
                })}

                {/* 3. Interactive Shooting Star Comet Overlay */}
                {shootingStar && (
                  <Animated.View
                    style={[
                      styles.shootingStar,
                      {
                        left: shootingStar.x,
                        top: shootingStar.y,
                        transform: [
                          {
                            translateX: shoot.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -300],
                            }),
                          },
                          {
                            translateY: shoot.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 300],
                            }),
                          },
                          {
                            scaleX: shoot.interpolate({
                              inputRange: [0, 0.2, 0.8, 1],
                              outputRange: [0, 1, 1, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                )}
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

const getStyles = (colors: any) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? 40 : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: colors.border + '33', backgroundColor: colors.pageBg },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: colors.primary + '44' },
  addPlus:{ fontSize: 18, color: colors.primary, fontWeight: 'bold', lineHeight: 22 },

  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Space[5], marginTop: Space[4], paddingHorizontal: Space[3], backgroundColor: colors.cardBg, borderRadius: Radii.input, borderWidth: 1, borderColor: colors.border + '88', ...Shadows.sm },
  searchIcon:{ fontSize: FontSize.sm, marginRight: Space[2] },
  searchInput:{ flex: 1, height: 44, fontSize: FontSize.base, color: colors.textPrimary },

  viewToggleRow: { flexDirection: 'row', marginHorizontal: Space[5], marginVertical: Space[3], gap: Space[2] },
  toggleBtn: { flex: 1, height: 38, borderRadius: Radii.full, borderWidth: 1.5, borderColor: colors.border + '55', backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { borderWidth: 1.5 },

  galaxyBg: { flex: 1, position: 'relative' },
  galaxyScroll: { flexGrow: 1 },
  galaxyCanvas: { height: 620, width: '100%', position: 'relative' },
  galaxyEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 120, paddingHorizontal: Space[5] },
  bgStarDot: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#fff', opacity: 0.8 },

  starWrapper: { position: 'absolute', alignItems: 'center', width: 85, height: 65, marginLeft: -42, marginTop: -32, justifyContent: 'center' },
  starCoreContainer: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  starShape: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6, zIndex: 4 },
  starEmojiLabel: { position: 'absolute', top: -14, fontSize: 11, zIndex: 5 },
  starText: { fontSize: FontSize.xs - 2, color: 'rgba(255, 255, 255, 0.95)', marginTop: 4, textAlign: 'center', width: 85, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, zIndex: 4 },

  center: { paddingVertical: Space[10], alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn:   { marginTop: Space[4], backgroundColor: colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: colors.primary + '44' },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    marginLeft: Space[2],
  },
  constellationLine: {
    position: 'absolute',
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    zIndex: 1,
  },
  shootingStar: {
    position: 'absolute',
    width: 100,
    height: 2,
    backgroundColor: '#ffffff',
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
    opacity: 0.8,
    zIndex: 2,
  },
});

export default MemoriesScreen;
