/**
 * FutureScreen.tsx
 *
 * Letters to your future self and partner.
 * Seal and lock letters with text and photo attachments.
 * Body content and images are kept sealed on the database level until the unlock date.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  AppState,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FlashList } from '@shopify/flash-list';
import KamiText from '@shared/ui/atoms/KamiText';
import KamiLoading from '@shared/ui/atoms/KamiLoading';
import { FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import { useAuthStore } from '@features/auth';
import { useHomeStore } from '@features/home/store';
import { useShallow } from 'zustand/react/shallow';
import type { MainTabScreenProps } from '@core/navigation/types';
import type { Letter } from '@features/home/types';
import type { CoupleLetter } from '@features/couple/types';
import { useCoupleStore, PartnerActionType } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import * as coupleService from '@infrastructure/couple/coupleService';
import * as futureService from '@infrastructure/home/futureService';
import { useTheme } from '@shared/hooks';

import {
  WriteModal,
  ReadModal,
  LetterCard,
  checkUnlocked,
} from '../components';

type Props = MainTabScreenProps<'Future'>;

import { uuid } from '@shared/lib/uuid';

export function FutureScreen({ navigation }: Props) {
  const user = useAuthStore(s => s.user);
  const activeSpace = user?.activeSpace ?? 'personal';
  const coupleStore = useCoupleStore();
  const coupleActions = useCouple();
  const couple = coupleStore.couple;

  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

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



  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [readOpen, setReadOpen] = useState(false);
  const [reading, setReading] = useState<Letter | CoupleLetter | null>(null);
  const [replyTo, setReplyTo] = useState<Letter | CoupleLetter | null>(null);
  const [saving, setSaving] = useState(false);

  const [lettersPage, setLettersPage] = useState(1);
  const [lettersHasMore, setLettersHasMore] = useState(true);
  const [filterTab, setFilterTab] = useState<'inbox' | 'scheduled' | 'drafts' | 'favorites' | 'archive'>('inbox');
  const [editingDraft, setEditingDraft] = useState<Letter | CoupleLetter | null>(null);

  const [isFocused, setIsFocused] = useState(navigation.isFocused());
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => setAppState(next));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
      if (activeSpace === 'couple') {
        coupleActions.loadLetters();
      } else {
        loadLetters(1);
      }
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, activeSpace]);

  const draftLetter = editingDraft;

  useEffect(() => {
    if (activeSpace !== 'couple' || !couple?.id || !user?.id) return;
    if (isFocused) {
      const action: PartnerActionType = writeOpen
        ? (draftLetter ? 'editing_draft' : 'writing_letter')
        : readOpen
          ? 'reading_letter'
          : 'viewing_letters';
      useCoupleStore.getState().setMyActiveAction(action);
      broadcastPartnerAction(couple.id, user.id, action);
    } else {
      const store = useCoupleStore.getState();
      const cleared1 = store.clearMyActiveAction('writing_letter');
      const cleared2 = store.clearMyActiveAction('editing_draft');
      const cleared3 = store.clearMyActiveAction('reading_letter');
      const cleared4 = store.clearMyActiveAction('viewing_letters');
      if (cleared1 || cleared2 || cleared3 || cleared4) {
        broadcastPartnerAction(couple.id, user.id, 'idle');
      }
    }
  }, [activeSpace, couple?.id, user?.id, isFocused, writeOpen, readOpen, draftLetter]);

  useEffect(() => {
    if (activeSpace === 'couple') {
      if (couple?.id) {
        coupleActions.loadLetters();
      }
    } else {
      loadLetters(1);
    }
  }, [activeSpace, couple?.id]);

  const loadLetters = useCallback(async (page = 1) => {
    setLoading(true);
    const r = await futureService.fetchLetters(20, page);
    setLoading(false);
    if (!r.success) { Alert.alert('Kami', r.error); return; }
    if (page === 1) {
      setLetters(r.data);
    } else {
      setLetters(prev => [...prev, ...r.data]);
    }
    setLettersPage(page);
    setLettersHasMore(r.data.length === 20);
  }, []);

  // Refetch when background sync completes
  const prevIsSyncing = useRef(isSyncing);
  useEffect(() => {
    if (prevIsSyncing.current && !isSyncing) {
      if (activeSpace === 'couple') {
        coupleActions.loadLetters();
      } else {
        loadLetters(1);
      }
    }
    prevIsSyncing.current = isSyncing;
  }, [isSyncing, activeSpace, coupleActions, loadLetters]);

  const handleSave = async (
    subject: string,
    body: string,
    deliverAt: string,
    localUris: string[] = [],
    isDraft = false,
    updateId?: string
  ) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const targetId = updateId || uuid();
      const finalSubject = subject.trim() || (activeSpace === 'couple' ? 'Love Letter' : 'To my future self');

      if (activeSpace === 'couple') {
        if (!couple?.id) {
          Alert.alert('Kami', 'No couple space connected.');
          setSaving(false);
          return;
        }
        if (updateId) {
          const r = await coupleActions.updateLetter(updateId, {
            subject: finalSubject,
            body,
            deliverAt,
            isDraft,
            imageUrls: localUris
          });
          if (!r.success) { Alert.alert('Kami', r.error); }
          else {
            setWriteOpen(false);
            setEditingDraft(null);
            setReplyTo(null);
          }
        } else {
          const r = await coupleActions.addLetter(couple.id, finalSubject, body, deliverAt, localUris, isDraft, replyTo?.id);
          if (!r.success) { Alert.alert('Kami', r.error); }
          else {
            setWriteOpen(false);
            setReplyTo(null);
          }
        }
      } else {
        if (updateId) {
          const r = await futureService.updateLetter(updateId, {
            subject: finalSubject,
            body,
            deliverAt,
            isDraft,
            imageUrls: localUris
          });
          if (!r.success) { Alert.alert('Kami', r.error); }
          else {
            setLetters(prev => {
              const filtered = prev.filter(x => x.id !== r.data.id);
              return [...filtered, r.data].sort((a, b) => new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime());
            });
            setWriteOpen(false);
            setEditingDraft(null);
          }
        } else {
          const r = await futureService.createLetter(targetId, {
            subject: finalSubject,
            body,
            deliverAt,
            imageUrls: localUris,
            isDraft
          });
          if (!r.success) { Alert.alert('Kami', r.error); }
          else {
            setLetters(prev => [...prev, r.data].sort((a, b) => new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime()));
            setWriteOpen(false);
          }
        }
      }
    } catch (e) {
      Alert.alert('Kami', 'Failed to seal your letter.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = useCallback(async (l: Letter | CoupleLetter) => {
    if (l.isDraft) {
      if (l.body) {
        setEditingDraft({
          ...l,
          body: l.body,
          imageUrls: l.imageUrls || []
        });
        setWriteOpen(true);
        return;
      }
      setLoading(true);
      const res = activeSpace === 'couple'
        ? await coupleService.fetchCoupleLetterDetails(l.id)
        : await futureService.fetchLetter(l.id);
      setLoading(false);
      if (res.success) {
        setEditingDraft({
          ...l,
          body: res.data.body,
          imageUrls: res.data.imageUrls
        });
        setWriteOpen(true);
      } else {
        Alert.alert('Kami', res.error);
      }
      return;
    }

    setReading(l);
    setReadOpen(true);

    if (checkUnlocked(l) && !l.isRead) {
      if (activeSpace === 'couple') {
        const res = await coupleService.markCoupleLetterRead(l.id);
        if (res.success) {
          coupleActions.loadLetters();
        }
      } else {
        const res = await futureService.markLetterRead(l.id);
        if (res.success) {
          loadLetters();
        }
      }
    }
  }, [activeSpace, coupleActions, loadLetters]);

  const handleToggleFavorite = useCallback(async (l: Letter | CoupleLetter) => {
    const isFav = l.isFavorite || false;
    if (activeSpace === 'couple') {
      const res = await coupleService.toggleCoupleLetterFavorite(l.id, isFav);
      if (res.success) {
        coupleActions.loadLetters();
        if (reading && reading.id === l.id) {
          setReading(prev => prev ? { ...prev, isFavorite: !isFav } : null);
        }
      } else {
        Alert.alert('Kami', res.error);
      }
    } else {
      const res = await futureService.toggleFavoriteLetter(l.id, isFav);
      if (res.success) {
        loadLetters();
        if (reading && reading.id === l.id) {
          setReading(prev => prev ? { ...prev, isFavorite: !isFav } : null);
        }
      } else {
        Alert.alert('Kami', res.error);
      }
    }
  }, [activeSpace, coupleActions, reading, loadLetters]);

  const handleToggleArchive = useCallback(async (l: Letter | CoupleLetter) => {
    const isArchived = l.isArchived || false;
    if (activeSpace === 'couple') {
      const res = await coupleActions.toggleLetterArchive(l.id, isArchived);
      if (res.success) {
        if (reading && reading.id === l.id) {
          setReading(prev => prev ? { ...prev, isArchived: !isArchived } : null);
        }
      } else {
        Alert.alert('Kami', res.error);
      }
    } else {
      const res = await futureService.toggleLetterArchive(l.id, isArchived);
      if (res.success) {
        loadLetters();
        if (reading && reading.id === l.id) {
          setReading(prev => prev ? { ...prev, isArchived: !isArchived } : null);
        }
      } else {
        Alert.alert('Kami', res.error);
      }
    }
  }, [activeSpace, coupleActions, reading, loadLetters]);

  const handleToggleReaction = useCallback(async (letterId: string, emoji: string) => {
    if (activeSpace !== 'couple') return;
    const res = await coupleActions.toggleLetterReaction(letterId, emoji);
    if (res.success) {
      const updatedLetters = useCoupleStore.getState().coupleLetters;
      const match = updatedLetters.find(x => x.id === letterId);
      if (match) {
        setReading(match);
      }
    } else {
      Alert.alert('Kami', res.error);
    }
  }, [activeSpace, coupleActions]);

  const handleDelete = useCallback((l: Letter | CoupleLetter) => Alert.alert('Delete letter?', `"${l.subject}"`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete', style: 'destructive', onPress: async () => {
        if (activeSpace === 'couple') {
          const r = await coupleActions.deleteLetter(l.id);
          if (!r.success) { Alert.alert('Kami', r.error); }
        } else {
          const r = await futureService.deleteLetter(l.id);
          if (!r.success) { Alert.alert('Kami', r.error); return; }
          setLetters(prev => prev.filter(x => x.id !== l.id));
        }
      }
    },
  ]), [activeSpace, coupleActions]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeSpace === 'couple') {
      await coupleActions.loadLetters();
    } else {
      await loadLetters();
    }
    setRefreshing(false);
  }, [activeSpace, coupleActions, loadLetters]);

  const currentLetters = activeSpace === 'couple' ? coupleStore.coupleLetters : letters;

  // Filter letters list
  const filteredLetters = currentLetters.filter(l => {
    const isUnlockedVal = checkUnlocked(l);
    if (filterTab === 'inbox') {
      return isUnlockedVal && !l.isDraft && !l.isArchived;
    }
    if (filterTab === 'scheduled') {
      return !isUnlockedVal && !l.isDraft && !l.isArchived;
    }
    if (filterTab === 'drafts') {
      return !!l.isDraft && !l.isArchived && ('senderId' in l ? l.senderId === user?.id : true);
    }
    if (filterTab === 'favorites') {
      return !!l.isFavorite && !l.isDraft && !l.isArchived;
    }
    if (filterTab === 'archive') {
      return !!l.isArchived;
    }
    return true;
  });

  const sortedLetters = [...filteredLetters].sort((a, b) => {
    if (filterTab === 'scheduled') {
      return new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime();
    }
    if (filterTab === 'drafts') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(b.deliverAt).getTime() - new Date(a.deliverAt).getTime();
  });

  const repliesMap = useMemo(() => {
    return sortedLetters.reduce((acc, l: any) => {
      const parentId = 'parentLetterId' in l ? (l as any).parentLetterId : null;
      if (parentId) {
        if (!acc[parentId]) acc[parentId] = [];
        acc[parentId].push(l);
      }
      return acc;
    }, {} as Record<string, typeof sortedLetters>);
  }, [sortedLetters]);

  const displayRoots = useMemo(() => {
    const rootLetters = sortedLetters.filter((l: any) => !('parentLetterId' in l && (l as any).parentLetterId));
    const orphanReplies = sortedLetters.filter((l: any) => 'parentLetterId' in l && (l as any).parentLetterId && !sortedLetters.some((r: any) => r.id === (l as any).parentLetterId));
    return [...rootLetters, ...orphanReplies];
  }, [sortedLetters]);

  const listData = useMemo(() => {
    return displayRoots.map((l: any) => ({
      id: l.id,
      rootLetter: l,
      replies: repliesMap[l.id] || []
    }));
  }, [displayRoots, repliesMap]);

  const renderEmpty = useCallback(() => {
    const isLoading = (loading && activeSpace === 'personal') || (coupleStore.lettersLoading === 'loading' && activeSpace === 'couple');
    if (isLoading) {
      return (
        <View style={styles.center}>
          <KamiLoading emoji="💌" message="Opening your letters..." />
        </View>
      );
    }
    if (sortedLetters.length > 0) return null;
    return (
      <TouchableOpacity style={styles.emptyState} onPress={() => { setReplyTo(null); setWriteOpen(true); }} activeOpacity={0.85}>
        <Text style={{ fontSize: 56, marginBottom: Space[3] }}>💌</Text>
        <KamiText variant="subtitle" align="center">Your Box is empty</KamiText>
        <KamiText variant="body" color={colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
          No letters found under this filter. Tap below to seal a new letter today.
        </KamiText>
        <View style={[styles.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
          <KamiText variant="label" color={colors.primary} bold>Write a letter ›</KamiText>
        </View>
      </TouchableOpacity>
    );
  }, [loading, activeSpace, coupleStore.lettersLoading, sortedLetters.length, colors, styles]);

  const handleLoadMore = useCallback(() => {
    if (activeSpace === 'couple') {
      coupleActions.loadMoreLetters();
    } else {
      if (loading || !lettersHasMore) return;
      loadLetters(lettersPage + 1);
    }
  }, [activeSpace, coupleActions, loading, lettersHasMore, lettersPage, loadLetters]);

  const renderFooter = useCallback(() => {
    const hasMore = activeSpace === 'couple'
      ? coupleStore.lettersHasMore
      : lettersHasMore;
    const isLoading = activeSpace === 'couple'
      ? coupleStore.lettersLoading === 'loading'
      : loading;

    if (isLoading && listData.length > 0) {
      return (
        <View style={{ paddingVertical: Space[4], alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return <View style={{ height: Space[8] }} />;
  }, [activeSpace, coupleStore.lettersHasMore, lettersHasMore, coupleStore.lettersLoading, loading, listData.length, colors.primary]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <View style={styles.threadContainer}>
      {/* Root Letter bubble */}
      <LetterCard
        letter={item.rootLetter}
        onOpen={() => handleOpen(item.rootLetter)}
        onDelete={() => handleDelete(item.rootLetter)}
        onToggleFavorite={handleToggleFavorite}
        onReact={handleToggleReaction}
        onReply={() => { setReplyTo(item.rootLetter); setWriteOpen(true); }}
        activeSpace={activeSpace}
        currentUser={user}
      />

      {/* Render nested replies with vertical line */}
      {item.replies.length > 0 && (
        <View style={styles.repliesSection}>
          <View style={[styles.treeLine, { borderColor: colors.primary + '33' }]} />
          <View style={{ flex: 1, gap: Space[3] }}>
            {item.replies.map((reply: any) => (
              <LetterCard
                key={reply.id}
                letter={reply}
                onOpen={() => handleOpen(reply)}
                onDelete={() => handleDelete(reply)}
                onToggleFavorite={handleToggleFavorite}
                onReact={handleToggleReaction}
                onReply={() => { setReplyTo(reply); setWriteOpen(true); }}
                activeSpace={activeSpace}
                currentUser={user}
                isReply
              />
            ))}
          </View>
        </View>
      )}
    </View>
  ), [handleOpen, handleDelete, handleToggleFavorite, handleToggleReaction, activeSpace, user, colors.primary, styles]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.pageBg }]}>
        <View style={{ flex: 1 }}>
          <KamiText variant="overline">{activeSpace === 'couple' ? 'Sealed capsules' : 'Letters to yourself'}</KamiText>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <KamiText variant="title">{activeSpace === 'couple' ? 'Love Letters' : 'Future'}</KamiText>
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
        <TouchableOpacity style={[styles.writeBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => { setReplyTo(null); setWriteOpen(true); }}>
          <Text style={[styles.writePlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>Write</KamiText>
        </TouchableOpacity>
      </View>

      {/* Segmented filter */}
      <View style={{ height: 48, marginBottom: Space[2] }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['inbox', 'scheduled', 'drafts', 'favorites', 'archive'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.filterTab,
                { backgroundColor: colors.creamDeep, borderColor: colors.border + '44' },
                filterTab === tab && [styles.filterTabActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
              ]}
              onPress={() => setFilterTab(tab)}
            >
              <KamiText variant="caption" color={filterTab === tab ? '#fff' : colors.textMuted} bold={filterTab === tab} style={{ textTransform: 'capitalize' }}>
                {tab}
              </KamiText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.scroll}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />

      <WriteModal
        visible={writeOpen}
        onClose={() => { setWriteOpen(false); setEditingDraft(null); setReplyTo(null); }}
        onSave={handleSave}
        saving={saving}
        draftLetter={editingDraft}
        replyToLetter={replyTo}
        activeSpace={activeSpace}
      />
      <ReadModal
        visible={readOpen}
        letter={reading}
        onClose={() => { setReadOpen(false); setReading(null); }}
        activeSpace={activeSpace}
        onToggleFavorite={handleToggleFavorite}
        onToggleArchive={handleToggleArchive}
        onToggleReaction={handleToggleReaction}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? 40 : Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: colors.border + '33', backgroundColor: colors.pageBg },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: colors.primary + '44' },
  writePlus: { fontSize: FontSize.lg, color: colors.primary, fontWeight: FontWeight.bold, lineHeight: 22 },

  filterScroll: { flexDirection: 'row', paddingHorizontal: Space[5], gap: Space[2], alignItems: 'center' },
  filterTab: { height: 36, paddingHorizontal: Space[4], borderRadius: Radii.full, borderWidth: 1.5, borderColor: colors.border + '55', backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  filterTabActive: { borderWidth: 1.5 },

  scroll: { paddingHorizontal: Space[5], paddingTop: Space[2], gap: Space[4] },
  center: { paddingVertical: Space[10], alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn: { marginTop: Space[4], backgroundColor: colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: colors.primary + '44' },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    marginLeft: Space[2],
  },

  threadContainer: {
    gap: Space[2]
  },
  repliesSection: {
    flexDirection: 'row',
    paddingLeft: Space[6]
  },
  treeLine: {
    width: 2,
    borderLeftWidth: 1.5,
    borderColor: colors.border + '88',
    borderStyle: 'dashed',
    marginRight: Space[3],
    marginTop: -Space[3],
    marginBottom: Space[3]
  },
});

export default FutureScreen;
