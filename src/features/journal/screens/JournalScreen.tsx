import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator, Alert, AppState, Platform, RefreshControl, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FlashList } from '@shopify/flash-list';
import { useHome }      from '@features/home/hooks';
import { useHomeStore } from '@features/home/store';
import { useAuthStore } from '@features/auth';
import { useShallow }   from 'zustand/react/shallow';
import KamiText         from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, FontWeight, Radii, Shadows, Space, FontFamily } from '@shared/constants';
import type { JournalEntry } from '@features/home/types';
import type { CoupleJournal } from '@features/couple/types';
import type { MainTabScreenProps } from '@core/navigation/types';
import { uploadImages } from '@shared/lib/storage';
import { useTheme }     from '@shared/hooks';
import { useCoupleStore, PartnerActionType } from '@features/couple/store/coupleStore';
import { useCouple }      from '@features/couple/hooks/useCouple';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import ConflictResolverModal from '@shared/ui/organisms/ConflictResolverModal';
// getPendingSyncCount import removed

import { EntryCard } from '../components/EntryCard';
import { WriteModal, JOURNAL_TAGS } from '../components/WriteModal';
import { PromptModal } from '../components/PromptModal';
import { PreviewModal } from '../components/PreviewModal';
import { CommentsModal } from '../components/CommentsModal';

type Props = MainTabScreenProps<'Journal'>;

import { uuid } from '@shared/lib/uuid';

function formatDate(iso: string, timezone?: string) {
  const tz = timezone || 'UTC';
  
  const getTzDateString = (date: Date) => {
    try {
      return date.toLocaleDateString('en-US', { timeZone: tz });
    } catch {
      return date.toDateString();
    }
  };

  const dStr = getTzDateString(new Date(iso));
  const todayStr = getTzDateString(new Date());
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getTzDateString(yesterday);

  if (dStr === todayStr)     return 'Today';
  if (dStr === yesterdayStr) return 'Yesterday';
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
}

export function JournalScreen({ navigation }: Props) {
  const user = useAuthStore(s => s.user);
  const { journalEntries, journalLoading, todayPrompt, promptResponse } =
    useHomeStore(useShallow(s => ({
      journalEntries: s.journalEntries,
      journalLoading: s.journalLoading,
      todayPrompt:    s.todayPrompt,
      promptResponse: s.promptResponse,
    })));
  const { loadJournal, loadMoreJournal, addJournalEntry, editJournalEntry, removeJournalEntry, respondToPrompt, refresh } = useHome();

  const [writeVisible, setWriteVisible]   = useState(false);
  const [editing,      setEditing]        = useState<JournalEntry | CoupleJournal | null>(null);
  const [writeSaving,  setWriteSaving]    = useState(false);
  const [promptVisible,setPromptVisible]  = useState(false);
  const [promptSaving, setPromptSaving]   = useState(false);
  const [refreshing,   setRefreshing]     = useState(false);
  const [previewEntry, setPreviewEntry]   = useState<JournalEntry | CoupleJournal | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>(JOURNAL_TAGS);

  // Calendar state
  const [viewMode, setViewMode] = useState<'feed' | 'calendar'>('feed');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Couple Space state
  const { couple, coupleJournals, journalsHasMore, journalsLoading } = useCoupleStore();
  const { 
    loadJournals: loadCoupleJournals, 
    loadMoreJournals: loadMoreCoupleJournals,
    addJournal: addCoupleJournal, 
    updateJournal: updateCoupleJournal,
    deleteJournal: deleteCoupleJournal,
    addComment: addCoupleComment, 
    toggleReaction 
  } = useCouple();

  const [selectedCommentsEntry, setSelectedCommentsEntry] = useState<any>(null);
  const [commentsVisible, setCommentsVisible] = useState(false);

  // Sync state from Zustand
  const { pendingSyncCount, isSyncing } = useHomeStore(
    useShallow((s) => ({
      pendingSyncCount: s.pendingSyncCount,
      isSyncing: s.isSyncing,
    }))
  );
  const [conflictEntityId, setConflictEntityId] = useState<string | null>(null);
  const [conflictModalVisible, setConflictModalVisible] = useState(false);

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

  const updatePendingCount = () => {};

  const [isFocused, setIsFocused] = useState(navigation.isFocused());
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => setAppState(next));
    return () => sub.remove();
  }, []);

  // Focus listener to auto-refresh data when focused
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
      updatePendingCount();
      if (user?.activeSpace === 'couple') {
        loadCoupleJournals();
      } else {
        if (user?.id) {
          loadJournal(search.trim() || undefined, selectedTag || undefined);
        }
      }
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, user?.activeSpace, user?.id, search, selectedTag, loadCoupleJournals, loadJournal]);

  // Real-time ephemeral broadcast status when writing a journal or responding to prompt
  useEffect(() => {
    if (user?.activeSpace !== 'couple' || !couple?.id || !user?.id) return;
    if (isFocused) {
      let action: PartnerActionType = 'reading_journal';
      if (commentsVisible) {
        action = 'commenting_journal';
      } else if (writeVisible) {
        action = 'writing_journal';
      } else if (promptVisible) {
        action = 'answering_prompt';
      }
      useCoupleStore.getState().setMyActiveAction(action);
      broadcastPartnerAction(couple.id, user.id, action);
    } else {
      const store = useCoupleStore.getState();
      const cleared1 = store.clearMyActiveAction('writing_journal');
      const cleared2 = store.clearMyActiveAction('answering_prompt');
      const cleared3 = store.clearMyActiveAction('commenting_journal');
      const cleared4 = store.clearMyActiveAction('reading_journal');
      if (cleared1 || cleared2 || cleared3 || cleared4) {
        broadcastPartnerAction(couple.id, user.id, 'idle');
      }
    }
  }, [isFocused, writeVisible, promptVisible, commentsVisible, user?.activeSpace, couple?.id, user?.id]);

  useEffect(() => {
    if (user?.activeSpace === 'couple') {
      loadCoupleJournals();
    }
  }, [user?.activeSpace, loadCoupleJournals]);

  // Sync available unique tags (including custom ones) from unfiltered database state
  useEffect(() => {
    const activeList = user?.activeSpace === 'couple' ? coupleJournals : journalEntries;
    if (!search && !selectedTag && activeList.length > 0) {
      const unique = Array.from(new Set([...JOURNAL_TAGS, ...activeList.flatMap(e => e.tags || [])]));
      setAvailableTags(unique);
    }
  }, [journalEntries, coupleJournals, search, selectedTag, user?.activeSpace]);

  // Filter local lists
  useEffect(() => {
    if (user?.id && user?.activeSpace !== 'couple') {
      loadJournal(search.trim() || undefined, selectedTag || undefined);
    }
  }, [search, selectedTag, user?.id, user?.activeSpace, loadJournal]);

  const handleSave = async (body: string, title?: string, tags: string[] = [], localUris: string[] = [], moodId: string | null = null) => {
    if (!user?.id) return;
    setWriteSaving(true);
    try {
      let relativePaths: string[] = [];
      const targetId = editing ? editing.id : uuid();

      // Separate existing remote signed URLs from new local picker URIs
      const localPickerUris = localUris.filter(u => u.startsWith('file://') || u.startsWith('content://'));
      const bucket = user.activeSpace === 'couple' ? 'couple_journal_images' : 'journal_images';
      const ownerId = user.activeSpace === 'couple' && couple?.id ? couple.id : user.id;

      const existingPaths = (editing?.imageUrls ?? [])
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
          setWriteSaving(false);
          return;
        }
        relativePaths = [...existingPaths, ...uploadRes.paths];
      } else {
        relativePaths = existingPaths;
      }

      if (user.activeSpace === 'couple' && couple) {
        if (editing) {
          const r = await updateCoupleJournal(editing.id, body, title, tags, relativePaths, moodId);
          if (!r.success) {
            console.error('[JournalScreen] updateCoupleJournal failed:', r.error);
            Alert.alert('Kami', r.error);
          } else {
            setWriteVisible(false);
            setEditing(null);
            await loadCoupleJournals();
            updatePendingCount();
          }
        } else {
          const r = await addCoupleJournal(couple.id, body, title, tags, relativePaths, moodId);
          if (!r.success) {
            console.error('[JournalScreen] addCoupleJournal failed:', r.error);
            Alert.alert('Kami', r.error);
          } else {
            setWriteVisible(false);
            setEditing(null);
            await loadCoupleJournals();
            updatePendingCount();
          }
        }
      } else {
        const r = editing
          ? await editJournalEntry(editing.id, { body, title, tags, imageUrls: relativePaths, moodId: moodId || undefined })
          : await addJournalEntry({ body, title, tags, imageUrls: relativePaths, moodId: moodId || undefined });

        if (!r.success) {
          console.error('[JournalScreen] solo journal save failed:', r.error);
          Alert.alert('Kami', r.error);
        } else {
          setWriteVisible(false);
          setEditing(null);
          await loadJournal(search.trim() || undefined, selectedTag || undefined);
          updatePendingCount();
        }
      }
    } catch (e) {
      console.error('[JournalScreen] handleSave exception caught:', e);
      Alert.alert('Kami', 'Error saving your entry.');
    } finally {
      setWriteSaving(false);
    }
  };

  const handleDelete = (e: JournalEntry | CoupleJournal) => Alert.alert('Delete entry?', 'This cannot be undone and will delete all attachments.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { 
      if (user?.activeSpace === 'couple') {
        const r = await deleteCoupleJournal(e.id);
        if (!r.success) {
          Alert.alert('Kami', r.error);
        } else {
          await loadCoupleJournals();
          updatePendingCount();
        }
      } else {
        const r = await removeJournalEntry(e.id); 
        if (!r.success) {
          Alert.alert('Kami', r.error);
        } else {
          await loadJournal(search.trim() || undefined, selectedTag || undefined);
          updatePendingCount();
        }
      }
    } },
  ]);

  const handlePromptSave = async (resp: string) => {
    if (!todayPrompt) return;
    setPromptSaving(true);
    const r = await respondToPrompt(todayPrompt.id, resp);
    setPromptSaving(false);
    if (!r.success) { Alert.alert('Kami', r.error); return; }
    setPromptVisible(false);
    updatePendingCount();
  };

  const togglePin = async (e: JournalEntry | CoupleJournal) => {
    const r = await editJournalEntry(e.id, { isPinned: !e.isPinned });
    if (!r.success) {
      Alert.alert('Kami', r.error);
    }
  };

  const handleRefresh = async () => { 
    setRefreshing(true); 
    if (user?.activeSpace === 'couple') {
      await loadCoupleJournals();
    } else {
      await refresh(); 
    }
    setRefreshing(false); 
  };

  // Calendar View calculations
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const calendarCells: (Date | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const moodColors: Record<string, string> = {
    '😊': '#FACC15', // Yellow
    '😔': '#60A5FA', // Blue
    '🥰': '#F472B6', // Pink
    '😡': '#F87171', // Red
    '😌': '#34D399', // Green
    '🤪': '#A78BFA'  // Purple
  };

  const handlePrevMonth = () => {
    setCalendarDate(new Date(year, month - 1, 1));
    setSelectedDateFilter(null);
  };
  const handleNextMonth = () => {
    setCalendarDate(new Date(year, month + 1, 1));
    setSelectedDateFilter(null);
  };

  // Map dates of active list to entries
  const activeList: (JournalEntry | CoupleJournal)[] = user?.activeSpace === 'couple' ? coupleJournals : journalEntries;
  const dateEntriesMap = useMemo(() => {
    return activeList.reduce((acc, entry) => {
      const dStr = entry.entryDate ? entry.entryDate.split('T')[0] : new Date(entry.createdAt).toISOString().split('T')[0];
      if (!acc[dStr]) acc[dStr] = [];
      acc[dStr].push(entry);
      return acc;
    }, {} as Record<string, (JournalEntry | CoupleJournal)[]>);
  }, [activeList]);

  // Filter/sort entries
  const listToRender = useMemo(() => {
    let list = user?.activeSpace === 'couple' ? coupleJournals : journalEntries;
    if (viewMode === 'calendar') {
      if (selectedDateFilter) {
        list = list.filter(e => {
          const dStr = e.entryDate ? e.entryDate.split('T')[0] : new Date(e.createdAt).toISOString().split('T')[0];
          return dStr === selectedDateFilter;
        });
      } else {
        list = list.filter(e => {
          const eDate = new Date(e.entryDate || e.createdAt);
          return eDate.getFullYear() === year && eDate.getMonth() === month;
        });
      }
    } else {
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        list = list.filter(e => 
          (e.title && e.title.toLowerCase().includes(q)) || 
          (e.body && e.body.toLowerCase().includes(q))
        );
      }
      if (selectedTag) {
        list = list.filter(e => 
          e.tags && e.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
        );
      }
    }
    return [...list].sort((a, b) => new Date(a.entryDate || a.createdAt).getTime() - new Date(b.entryDate || b.createdAt).getTime());
  }, [user?.activeSpace, coupleJournals, journalEntries, viewMode, selectedDateFilter, year, month, search, selectedTag]);

  const paginatedList = listToRender;

  const { colors } = useTheme();

  const renderItem = ({ item, index }: { item: JournalEntry | CoupleJournal; index: number }) => {
    const getTzDateStr = (dateStr: string) => {
      try {
        return new Date(dateStr).toLocaleDateString('en-US', { timeZone: user?.timezone ?? 'UTC' });
      } catch {
        return new Date(dateStr).toDateString();
      }
    };
    
    const showDate = index === 0 || getTzDateStr(item.entryDate) !== getTzDateStr(paginatedList[index - 1]?.entryDate);
    
    return (
      <View key={item.id} style={{ gap: Space[3] }}>
        {showDate && (
          <KamiText variant="overline" style={s.dateLabel}>{formatDate(item.entryDate)}</KamiText>
        )}
        <EntryCard
          entry={item}
          onPressCard={() => {
            setPreviewEntry(item);
            setPreviewVisible(true);
          }}
          onDelete={() => handleDelete(item)}
          onTogglePin={() => togglePin(item)}
          activeSpace={user?.activeSpace}
          user={user}
          onReact={toggleReaction}
          onOpenComments={(commentsItem) => {
            setSelectedCommentsEntry(commentsItem);
            setCommentsVisible(true);
          }}
          onPressConflict={(entityId) => {
            setConflictEntityId(entityId);
            setConflictModalVisible(true);
          }}
        />
      </View>
    );
  };

  const renderHeader = () => {
    if (viewMode !== 'feed') return null;
    return (
      <View style={{ gap: Space[3], marginBottom: Space[3] }}>
        {todayPrompt && (
          <TouchableOpacity
            style={[s.promptCard, { borderColor: colors.primary + '33', backgroundColor: Colors.cardBg }]}
            onPress={() => setPromptVisible(true)}
            activeOpacity={0.85}
          >
            <View style={[s.promptIconWrap, { backgroundColor: colors.primary + '15' }]}>
              <Text style={{ fontSize: 20, color: colors.primary }}>✍️</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <KamiText variant="overline" color={colors.primary} bold>Daily Reflection</KamiText>
              <KamiText style={{ fontFamily: 'Lora-Regular', fontSize: FontSize.md, lineHeight: 24, color: Colors.textPrimary }} numberOfLines={3}>"{todayPrompt.content}"</KamiText>
              <KamiText variant="caption" color={promptResponse ? Colors.success : colors.primary} bold>
                {promptResponse ? '✓ Answered — Tap to edit' : 'Tap to reflect ›'}
              </KamiText>
            </View>
          </TouchableOpacity>
        )}
        {journalLoading === 'loading' && paginatedList.length === 0 && (
          <View style={s.centerState}><ActivityIndicator color={colors.primary} /></View>
        )}
      </View>
    );
  };

  const handleLoadMore = () => {
    if (user?.activeSpace === 'couple') {
      loadMoreCoupleJournals();
    } else {
      loadMoreJournal(search.trim() || undefined, selectedTag || undefined);
    }
  };

  const renderFooter = () => {
    if (viewMode !== 'feed') return null;
    const hasMore = user?.activeSpace === 'couple'
      ? journalsHasMore
      : useHomeStore.getState().journalHasMore;
    const isLoading = user?.activeSpace === 'couple'
      ? journalsLoading === 'loading'
      : journalLoading === 'loading';

    if (isLoading && listToRender.length > 0) {
      return (
        <View style={{ paddingVertical: Space[4], alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return <View style={{ height: Space[8] }} />;
  };

  const renderEmpty = () => {
    if (journalLoading === 'loading') return null;
    return (
      <TouchableOpacity style={s.emptyState} onPress={() => { setEditing(null); setWriteVisible(true); }} activeOpacity={0.85}>
        <Text style={{ fontSize: 48, marginBottom: Space[3] }}>📓</Text>
        <KamiText variant="subtitle" align="center">No entries found</KamiText>
        <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
          {search || selectedTag || selectedDateFilter ? 'Clear filters to view entries.' : 'Write your first entry. No rules, just you.'}
        </KamiText>
        <View style={[s.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
          <KamiText variant="label" color={colors.primary} bold>Start writing ›</KamiText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.pageBg }]}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <View>
            <KamiText variant="overline">Your thoughts</KamiText>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <KamiText variant="title">Journal</KamiText>
              {uiSyncStatus === 'syncing' && (
                <View style={[s.syncStatusBadge, { backgroundColor: '#fef3c7' }]}>
                  <ActivityIndicator size="small" color="#d97706" style={{ marginRight: 4, transform: [{ scale: 0.8 }] }} />
                  <KamiText variant="caption" color="#d97706" bold>Syncing...</KamiText>
                </View>
              )}
              {uiSyncStatus === 'saved' && (
                <View style={[s.syncStatusBadge, { backgroundColor: '#ecfdf5' }]}>
                  <KamiText variant="caption" color="#059669" bold>✓ Saved</KamiText>
                </View>
              )}
              {uiSyncStatus === 'idle' && pendingSyncCount > 0 && (
                <View style={[s.syncStatusBadge, { backgroundColor: '#f3f4f6' }]}>
                  <KamiText variant="caption" color="#6b7280" bold>☁ {pendingSyncCount} offline</KamiText>
                </View>
              )}
            </View>
          </View>
        </View>
        <TouchableOpacity style={[s.writeBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => { setEditing(null); setWriteVisible(true); }} accessibilityRole="button">
          <Text style={[s.writeBtnPlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>New entry</KamiText>
        </TouchableOpacity>
      </View>

      {/* View Mode Toggle Switch */}
      <View style={s.viewToggleRow}>
        <TouchableOpacity
          style={[
            s.toggleBtn, 
            viewMode === 'feed' && [s.toggleBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
          ]}
          onPress={() => setViewMode('feed')}
        >
          <KamiText variant="caption" color={viewMode === 'feed' ? '#fff' : Colors.textMuted} bold={viewMode === 'feed'}>
            📰 Feed View
          </KamiText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.toggleBtn, 
            viewMode === 'calendar' && [s.toggleBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
          ]}
          onPress={() => setViewMode('calendar')}
        >
          <KamiText variant="caption" color={viewMode === 'calendar' ? '#fff' : Colors.textMuted} bold={viewMode === 'calendar'}>
            📅 Calendar View
          </KamiText>
        </TouchableOpacity>
      </View>

      {viewMode === 'feed' && (
        <>
          {/* Search Input */}
          <View style={s.searchBar}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Search entries..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Tags Quick Filter */}
          <View style={s.tagsScrollWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagsFilterRow}>
              <TouchableOpacity
                style={[s.filterChip, selectedTag === null && [s.filterChipActive, { borderColor: colors.primary, backgroundColor: colors.primary + '11' }]]}
                onPress={() => setSelectedTag(null)}
              >
                <KamiText variant="caption" color={selectedTag === null ? colors.primary : Colors.textSecondary} bold={selectedTag === null}>All</KamiText>
              </TouchableOpacity>
              {availableTags.map(t => {
                const active = selectedTag === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[s.filterChip, active && [s.filterChipActive, { borderColor: colors.primary, backgroundColor: colors.primary + '11' }]]}
                    onPress={() => setSelectedTag(active ? null : t)}
                  >
                    <KamiText variant="caption" color={active ? colors.primary : Colors.textSecondary} bold={active}>#{t}</KamiText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

      {viewMode === 'calendar' && (
        <View style={[s.calendarCard, { backgroundColor: Colors.cardBg, borderColor: Colors.border + '44' }]}>
          {/* Month Navigator */}
          <View style={s.calHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={s.calArrow}>
              <Text style={{ fontSize: 24, color: colors.primary, lineHeight: 28 }}>‹</Text>
            </TouchableOpacity>
            <KamiText variant="label" bold style={s.calMonthTitle}>
              {calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: user?.timezone ?? 'UTC' })}
            </KamiText>
            <TouchableOpacity onPress={handleNextMonth} style={s.calArrow}>
              <Text style={{ fontSize: 24, color: colors.primary, lineHeight: 28 }}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Weekdays */}
          <View style={s.calWeekdays}>
            {weekdays.map((wd, i) => (
              <Text key={i} style={[s.calWeekdayText, { color: Colors.textMuted }]}>{wd}</Text>
            ))}
          </View>

          {/* Grid */}
          <View style={s.calGrid}>
            {calendarCells.map((date, idx) => {
              if (!date) {
                return <View key={`empty-${idx}`} style={s.calCellEmpty} />;
              }

              const dayNum = date.getDate();
              const dStr = date.toISOString().split('T')[0];
              const hasEntries = !!dateEntriesMap[dStr];
              const dayEntries = dateEntriesMap[dStr] || [];
              const primaryMood = dayEntries[0]?.moodId;
              const dotColor = primaryMood ? (moodColors[primaryMood] || '#CBD5E1') : '#CBD5E1';
              const isSelected = selectedDateFilter === dStr;

              return (
                <TouchableOpacity
                  key={dStr}
                  style={[
                    s.calCell,
                    isSelected && { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primary + '0a' }
                  ]}
                  onPress={() => setSelectedDateFilter(isSelected ? null : dStr)}
                >
                  <Text style={[s.calCellText, isSelected && { fontWeight: 'bold', color: colors.primary }]}>
                    {dayNum}
                  </Text>
                  {hasEntries && (
                    <View style={[styles.calCellDot, { backgroundColor: dotColor }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Emotion count breakdown row */}
          <View style={s.emotionBreakdownContainer}>
            <KamiText variant="overline" style={{ fontSize: 9, color: Colors.textMuted }}>Monthly Emotions</KamiText>
            <View style={s.emotionBreakdownRow}>
              {Object.entries(moodColors).map(([mood, color]) => {
                const count = activeList.filter(e => {
                  const eDate = new Date(e.entryDate || e.createdAt);
                  return eDate.getFullYear() === year && eDate.getMonth() === month && e.moodId === mood;
                }).length;

                if (count === 0) return null;

                return (
                  <View key={mood} style={[s.emotionTag, { backgroundColor: color + '15' }]}>
                    <KamiText variant="caption" color={color} bold style={{ fontSize: 10 }}>{mood} {count}</KamiText>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Selected Date Header / Clear filter */}
          {selectedDateFilter && (
            <View style={s.filterHeaderRow}>
              <KamiText variant="caption" bold color={colors.primary}>
                Filtering: {new Date(selectedDateFilter).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: user?.timezone ?? 'UTC' })}
              </KamiText>
              <TouchableOpacity onPress={() => setSelectedDateFilter(null)}>
                <KamiText variant="caption" color={colors.primary} bold>Show All</KamiText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <FlashList
        data={paginatedList}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={{ height: Space[3] }} />}
        contentContainerStyle={{ paddingHorizontal: Space[5], paddingTop: Space[2] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />

      <WriteModal visible={writeVisible} entry={editing} onClose={() => { setWriteVisible(false); setEditing(null); }} onSave={handleSave} saving={writeSaving} />
      <PreviewModal
        visible={previewVisible}
        entry={previewEntry}
        onClose={() => { setPreviewVisible(false); setPreviewEntry(null); }}
        onEdit={() => {
          setEditing(previewEntry);
          setWriteVisible(true);
        }}
        onDelete={handleDelete}
        activeSpace={user?.activeSpace}
        user={user}
      />
      {todayPrompt && (
        <PromptModal visible={promptVisible} prompt={todayPrompt.content} existing={promptResponse?.response} onClose={() => setPromptVisible(false)} onSave={handlePromptSave} saving={promptSaving} />
      )}
      <CommentsModal 
        visible={commentsVisible} 
        entry={selectedCommentsEntry} 
        onClose={() => { setCommentsVisible(false); setSelectedCommentsEntry(null); }} 
        onAddComment={async (id, text) => {
          const r = await addCoupleComment(id, text);
          if (r.success) {
            const freshList = useCoupleStore.getState().coupleJournals;
            const updated = freshList.find(x => x.id === id);
            if (updated) setSelectedCommentsEntry(updated);
          } else {
            Alert.alert('Kami', r.error);
          }
        }} 
      />
      <ConflictResolverModal
        visible={conflictModalVisible}
        entityId={conflictEntityId || ''}
        entityType="journal_entries"
        onClose={() => {
          setConflictModalVisible(false);
          setConflictEntityId(null);
        }}
        onResolve={async () => {
          if (user?.activeSpace === 'couple') {
            await loadCoupleJournals();
          } else {
            await loadJournal(search.trim() || undefined, selectedTag || undefined);
          }
          updatePendingCount();
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.pageBg },
  header:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '33', backgroundColor: Colors.pageBg },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  writeBtnPlus: { fontSize: FontSize.lg, color: Colors.primary, fontWeight: FontWeight.bold, lineHeight: 22 },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Space[5], marginTop: Space[4], paddingHorizontal: Space[3], backgroundColor: Colors.cardBg, borderRadius: Radii.input, borderWidth: 1, borderColor: Colors.border + '88', ...Shadows.sm },
  searchIcon:{ fontSize: FontSize.sm, marginRight: Space[2] },
  searchInput:{ flex: 1, height: 44, fontSize: FontSize.base, color: Colors.textPrimary },

  // Tags filter
  tagsScrollWrapper: { marginVertical: Space[2] },
  tagsFilterRow: { flexDirection: 'row', gap: Space[2], paddingHorizontal: Space[5] },
  filterChip:  { paddingHorizontal: Space[3], paddingVertical: Space[1] + 2, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '11' },

  scroll: { paddingHorizontal: Space[5], paddingTop: Space[2], gap: Space[3] },

  promptCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.card, padding: Space[4], gap: Space[4], borderWidth: 1.5, ...Shadows.card },
  promptIconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },

  dateLabel:  { marginTop: Space[2], marginBottom: -Space[1] },

  centerState:{ paddingVertical: Space[10], alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10], paddingHorizontal: Space[5] },
  emptyBtn:   { marginTop: Space[4], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: Colors.primary + '44' },

  // Calendar styles
  calendarCard: {
    marginHorizontal: Space[5],
    marginVertical: Space[2],
    borderRadius: Radii.card,
    borderWidth: 1,
    padding: Space[4],
    ...Shadows.sm,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space[3],
  },
  calMonthTitle: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  calArrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.creamDeep,
  },
  calWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Space[2],
  },
  calWeekdayText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    width: 36,
    textAlign: 'center',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 8,
  },
  calCell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    position: 'relative',
  },
  calCellEmpty: {
    width: 36,
    height: 36,
  },
  calCellText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  emotionBreakdownContainer: {
    marginTop: Space[4],
    borderTopWidth: 1,
    borderTopColor: Colors.border + '33',
    paddingTop: Space[3],
    gap: Space[2],
  },
  emotionBreakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space[2],
  },
  emotionTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space[3],
    borderTopWidth: 1,
    borderTopColor: Colors.border + '33',
    paddingTop: Space[3],
  },
  globalSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space[5],
    paddingVertical: Space[3],
    borderBottomWidth: 1.5,
  },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    marginLeft: Space[2],
  },
  viewToggleRow: { flexDirection: 'row', marginHorizontal: Space[5], marginVertical: Space[3], gap: Space[2] },
  toggleBtn: { flex: 1, height: 38, borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border + '55', backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { borderWidth: 1.5 },
});

const styles = StyleSheet.create({
  calCellDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});

export default JournalScreen;
