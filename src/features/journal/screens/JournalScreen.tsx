/**
 * JournalScreen.tsx
 *
 * Full journal with entries list, tag filtering, full-text search,
 * write modal, and photo attachment uploads.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Keyboard, Modal,
  Platform, RefreshControl, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  Image, StatusBar as RNStatusBar, AppState, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useHome }      from '@features/home/hooks';
import { useHomeStore } from '@features/home/store';
import { useAuthStore } from '@features/auth';
import { useShallow }   from 'zustand/react/shallow';
import KamiText         from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, FontWeight, Radii, Shadows, Space, FontFamily } from '@shared/constants';
import type { JournalEntry } from '@features/home/types';
import type { MainTabScreenProps } from '@core/navigation/types';
import { pickImages, uploadImages } from '@shared/lib/storage';
import { useTheme }     from '@shared/hooks';
import { useCoupleStore, PartnerActionType } from '@features/couple/store/coupleStore';
import { useCouple }      from '@features/couple/hooks/useCouple';
import { supabase }       from '@shared/lib/supabase';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';

type Props = MainTabScreenProps<'Journal'>;

// Common tags for couples/reflections
const JOURNAL_TAGS = ['gratitude', 'reflection', 'relationship', 'ideas', 'growth', 'creative'];

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0;
  const v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

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

// ─── Write modal ─────────────────────────────────────────────────────────────
const WriteModal: React.FC<{
  visible: boolean;
  entry: JournalEntry | null;
  onClose: () => void;
  onSave: (body: string, title: string | undefined, tags: string[], imageUris: string[], moodId: string | null) => Promise<void>;
  saving: boolean;
}> = ({ visible, entry, onClose, onSave, saving }) => {
  const [title, setTitle] = useState('');
  const [body,  setBody]  = useState('');
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[wm.root, { backgroundColor: colors.pageBg }]}>
        <View style={wm.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">{entry ? 'Edit entry' : new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone || 'UTC' })}</KamiText>
          <TouchableOpacity onPress={() => { if (!body.trim()) return; Keyboard.dismiss(); onSave(body.trim(), title.trim() || undefined, selectedTags, localUris, selectedMood); }} disabled={saving || !body.trim()} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <KamiText variant="label" color={body.trim() ? colors.primary : Colors.textMuted} bold>Save</KamiText>
            }
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={wm.content}>
          <TextInput
            style={wm.titleInput} placeholder="Title (optional)"
            placeholderTextColor={Colors.textMuted} value={title}
            onChangeText={setTitle} maxLength={120}
          />
          <View style={wm.rule} />
          <TextInput
            style={wm.bodyInput} placeholder="Write freely…"
            placeholderTextColor={Colors.textMuted} value={body}
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
                    backgroundColor: Colors.creamDeep,
                    borderWidth: 1.5,
                    borderColor: selectedMood === emoji ? colors.primary : Colors.border,
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
                  <KamiText variant="caption" color={active ? colors.primary : Colors.textSecondary} bold={active}>#{t}</KamiText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Tag Input */}
          <View style={wm.customTagRow}>
            <TextInput
              style={wm.customTagInput}
              placeholder="Add custom hashtag..."
              placeholderTextColor={Colors.textMuted}
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
          <KamiText variant="caption" color={Colors.textMuted}>{body.length} / 8000</KamiText>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
const wm = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.pageBg },
  toolbar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  content:     { padding: Space[5], gap: Space[4], paddingBottom: Space[10] },
  titleInput:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rule:        { height: 1, backgroundColor: Colors.border + '44' },
  bodyInput:   { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 26, minHeight: 250, textAlignVertical: 'top' },
  sectionLabel:{ marginTop: Space[2] },
  tagContainer:{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2], marginVertical: Space[1] },
  tagChip:     { paddingHorizontal: Space[3], paddingVertical: Space[1] + 2, borderRadius: Radii.full, backgroundColor: Colors.creamDeep, borderWidth: 1, borderColor: Colors.border },
  tagChipActive:{ borderColor: Colors.primary, backgroundColor: Colors.primary + '11' },
  customTagRow:{ flexDirection: 'row', alignItems: 'center', gap: Space[2], marginTop: Space[1] },
  customTagInput:{ flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[1] + 2, fontSize: FontSize.xs, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border },
  customTagBtn:{ paddingVertical: Space[1] + 4, paddingHorizontal: Space[3], borderRadius: Radii.full, backgroundColor: Colors.primary + '11' },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space[4], borderTopWidth: 1, borderTopColor: Colors.border + '22', paddingTop: Space[3] },
  addPhotoBtn: { paddingVertical: Space[1], paddingHorizontal: Space[2] },
  photoScroll: { marginHorizontal: -Space[5], paddingHorizontal: Space[5], marginVertical: Space[2] },
  photoRow:    { flexDirection: 'row', gap: Space[3] },
  photoWrap:   { position: 'relative' },
  attachedImage:{ width: 90, height: 90, borderRadius: Radii.sm },
  removePhotoBadge:{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
  counter:     { paddingHorizontal: Space[5], paddingVertical: Space[3], alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: Colors.border + '22' },
});

// ─── Prompt modal ─────────────────────────────────────────────────────────────
const PromptModal: React.FC<{
  visible: boolean; prompt: string; existing?: string;
  onClose: () => void; onSave: (r: string) => Promise<void>; saving: boolean;
}> = ({ visible, prompt, existing, onClose, onSave, saving }) => {
  const { colors } = useTheme();
  const [response, setResponse] = useState(existing ?? '');
  const [focused, setFocused] = useState(false);

  useEffect(() => { if (visible) setResponse(existing ?? ''); }, [visible, existing]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[pm.root, { backgroundColor: colors.pageBg }]}>
        <View style={pm.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Close</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">Today's Reflection</KamiText>
          <TouchableOpacity onPress={() => { if (response.trim()) { Keyboard.dismiss(); onSave(response.trim()); } }} disabled={saving || !response.trim()} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <KamiText variant="label" color={response.trim() ? colors.primary : Colors.textMuted} bold>Save</KamiText>
            }
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={pm.content}>
          <View style={[pm.promptBox, { backgroundColor: colors.primary + '11', borderLeftColor: colors.primary, borderColor: colors.primary + '33' }]}>
            <Text style={[pm.quoteMark, { color: colors.primary + '44' }]}>"</Text>
            <KamiText variant="body" style={{ fontStyle: 'italic', lineHeight: 26 }}>{prompt}</KamiText>
          </View>
          <TextInput
            style={[pm.input, { borderColor: focused ? colors.primary : Colors.border }]}
            placeholder="Write your thoughts…"
            placeholderTextColor={Colors.textMuted}
            value={response}
            onChangeText={setResponse}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={2000}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <KamiText variant="caption" color={Colors.textMuted} align="right">{response.length} / 2000</KamiText>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
const pm = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.pageBg },
  toolbar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingVertical: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  content:   { padding: Space[5], gap: Space[4] },
  promptBox: { borderRadius: Radii.card, padding: Space[5], borderLeftWidth: 3, borderWidth: 1 },
  quoteMark: { fontSize: 40, lineHeight: 40, fontFamily: FontFamily.display },
  input:     { backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], fontSize: FontSize.base, color: Colors.textPrimary, minHeight: 220, borderWidth: 1.5, lineHeight: 24 },
});

// ─── Screen ──────────────────────────────────────────────────────────────────
export function JournalScreen({ navigation }: Props) {
  const user = useAuthStore(s => s.user);
  const { journalEntries, journalLoading, todayPrompt, promptResponse } =
    useHomeStore(useShallow(s => ({
      journalEntries: s.journalEntries,
      journalLoading: s.journalLoading,
      todayPrompt:    s.todayPrompt,
      promptResponse: s.promptResponse,
    })));
  const { loadJournal, addJournalEntry, editJournalEntry, removeJournalEntry, respondToPrompt, refresh } = useHome();

  const [writeVisible, setWriteVisible]   = useState(false);
  const [editing,      setEditing]        = useState<JournalEntry | null>(null);
  const [writeSaving,  setWriteSaving]    = useState(false);
  const [promptVisible,setPromptVisible]  = useState(false);
  const [promptSaving, setPromptSaving]   = useState(false);
  const [refreshing,   setRefreshing]     = useState(false);
  const [previewEntry, setPreviewEntry]   = useState<JournalEntry | null>(null);
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
  const { couple, coupleJournals } = useCoupleStore();
  const { 
    loadJournals: loadCoupleJournals, 
    addJournal: addCoupleJournal, 
    updateJournal: updateCoupleJournal,
    deleteJournal: deleteCoupleJournal,
    addComment: addCoupleComment, 
    toggleReaction 
  } = useCouple();

  const [selectedCommentsEntry, setSelectedCommentsEntry] = useState<any>(null);
  const [commentsVisible, setCommentsVisible] = useState(false);

  const [visibleEntries, setVisibleEntries] = useState(10);

  useEffect(() => {
    setVisibleEntries(10);
  }, [user?.activeSpace]);

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
        }
      }
    } catch (e) {
      console.error('[JournalScreen] handleSave exception caught:', e);
      Alert.alert('Kami', 'Error saving your entry.');
    } finally {
      setWriteSaving(false);
    }
  };

  const handleDelete = (e: JournalEntry) => Alert.alert('Delete entry?', 'This cannot be undone and will delete all attachments.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { 
      if (user?.activeSpace === 'couple') {
        const r = await deleteCoupleJournal(e.id);
        if (!r.success) {
          Alert.alert('Kami', r.error);
        } else {
          await loadCoupleJournals();
        }
      } else {
        const r = await removeJournalEntry(e.id); 
        if (!r.success) {
          Alert.alert('Kami', r.error);
        } else {
          await loadJournal(search.trim() || undefined, selectedTag || undefined);
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
  };

  const togglePin = async (e: JournalEntry) => {
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
  const activeList = user?.activeSpace === 'couple' ? coupleJournals : journalEntries;
  const dateEntriesMap = activeList.reduce((acc, entry) => {
    const dStr = entry.entryDate ? entry.entryDate.split('T')[0] : new Date(entry.createdAt).toISOString().split('T')[0];
    if (!acc[dStr]) acc[dStr] = [];
    acc[dStr].push(entry);
    return acc;
  }, {} as Record<string, typeof activeList>);

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.pageBg }]}>
        <View style={{ flex: 1 }}>
          <KamiText variant="overline">Your thoughts</KamiText>
          <KamiText variant="title">Journal</KamiText>
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
                    <View style={[s.calCellDot, { backgroundColor: dotColor }]} />
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Today's prompt card */}
        {todayPrompt && viewMode === 'feed' && (
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
              <KamiText variant="body" style={{ fontStyle: 'italic', fontWeight: '500', lineHeight: 22 }} numberOfLines={3}>"{todayPrompt.content}"</KamiText>
              <KamiText variant="caption" color={promptResponse ? Colors.success : colors.primary} bold>
                {promptResponse ? '✓ Answered — Tap to edit' : 'Tap to reflect ›'}
              </KamiText>
            </View>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {journalLoading === 'loading' && activeList.length === 0 && (
          <View style={s.centerState}><ActivityIndicator color={colors.primary} /></View>
        )}

        {/* Empty state */}
        {(() => {
          let listToRender = user?.activeSpace === 'couple' ? coupleJournals : journalEntries;
          if (viewMode === 'calendar') {
            if (selectedDateFilter) {
              listToRender = listToRender.filter(e => {
                const dStr = e.entryDate ? e.entryDate.split('T')[0] : new Date(e.createdAt).toISOString().split('T')[0];
                return dStr === selectedDateFilter;
              });
            } else {
              listToRender = listToRender.filter(e => {
                const eDate = new Date(e.entryDate || e.createdAt);
                return eDate.getFullYear() === year && eDate.getMonth() === month;
              });
            }
          } else {
            if (search.trim()) {
              const q = search.toLowerCase().trim();
              listToRender = listToRender.filter(e => 
                (e.title && e.title.toLowerCase().includes(q)) || 
                (e.body && e.body.toLowerCase().includes(q))
              );
            }
            if (selectedTag) {
              listToRender = listToRender.filter(e => 
                e.tags && e.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
              );
            }
          }

          if (listToRender.length === 0) {
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
          }

          const sortedList = [...listToRender].sort((a, b) => new Date(b.entryDate || b.createdAt).getTime() - new Date(a.entryDate || a.createdAt).getTime());
          const paginatedList = sortedList.slice(0, visibleEntries);

          return (
            <>
              {paginatedList.map((e, idx) => {
                const getTzDateStr = (dateStr: string) => {
                  try {
                    return new Date(dateStr).toLocaleDateString('en-US', { timeZone: user?.timezone ?? 'UTC' });
                  } catch {
                    return new Date(dateStr).toDateString();
                  }
                };
                const showDate = idx === 0 || getTzDateStr(e.entryDate) !== getTzDateStr(paginatedList[idx - 1].entryDate);
                
                return (
                  <React.Fragment key={e.id}>
                    {showDate && (
                      <KamiText variant="overline" style={s.dateLabel}>{formatDate(e.entryDate)}</KamiText>
                    )}
                    <EntryCard
                      entry={e}
                      onPressCard={() => {
                        setPreviewEntry(e);
                        setPreviewVisible(true);
                      }}
                      onDelete={() => handleDelete(e)}
                      onTogglePin={() => togglePin(e)}
                      activeSpace={user?.activeSpace}
                      user={user}
                      onReact={toggleReaction}
                      onOpenComments={(item) => {
                        setSelectedCommentsEntry(item);
                        setCommentsVisible(true);
                      }}
                    />
                  </React.Fragment>
                );
              })}
              {sortedList.length > visibleEntries && (
                <TouchableOpacity
                  style={[s.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
                  onPress={() => setVisibleEntries(prev => prev + 10)}
                  activeOpacity={0.8}
                >
                  <KamiText variant="label" color={colors.primary} bold>Load More Entries</KamiText>
                </TouchableOpacity>
              )}
            </>
          );
        })()}

        <View style={{ height: Space[8] }} />
      </ScrollView>

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
            // Find updated entry in coupleJournals and update comments modal
            const freshList = useCoupleStore.getState().coupleJournals;
            const updated = freshList.find(x => x.id === id);
            if (updated) setSelectedCommentsEntry(updated);
          } else {
            Alert.alert('Kami', r.error);
          }
        }} 
      />
    </SafeAreaView>
  );
}

const EntryCard: React.FC<{
  entry: any;
  onPressCard: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  activeSpace?: 'personal' | 'couple';
  user?: any;
  onReact?: (entryId: string, emoji: string) => void;
  onOpenComments?: (entry: any) => void;
}> = ({ entry, onPressCard, onDelete, onTogglePin, activeSpace, user, onReact, onOpenComments }) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1} onPress={onPressCard}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[s.entryCard, entry.isPinned && [s.entryCardPinned, { borderColor: colors.primary + '55', backgroundColor: colors.creamMid + '22' }], { transform: [{ scale: sc }] }]}>
        <View style={s.entryHeader}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
            {entry.isPinned && <Text style={{ fontSize: 13 }}>📌</Text>}
            <KamiText variant="label" numberOfLines={1} style={{ flex: 1 }}>
              {entry.title || 'Untitled entry'}
            </KamiText>
          </View>
          <View style={s.entryActions}>
            <TouchableOpacity onPress={onTogglePin} hitSlop={8} style={s.cardBtn}>
              <Text style={{ fontSize: 13, color: entry.isPinned ? colors.primary : Colors.textMuted }}>📌</Text>
            </TouchableOpacity>
            {(!activeSpace || activeSpace === 'personal' || entry.userId === user?.id) && (
              <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.cardBtn}>
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <KamiText variant="body" color={Colors.textSecondary} numberOfLines={4} style={s.entryBody}>
          {entry.body}
        </KamiText>

        {/* Horizontal Photo Preview */}
        {entry.imageUrls && entry.imageUrls.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imageRowScroll}>
            <View style={s.imageRow}>
              {entry.imageUrls.map((url: string, i: number) => (
                <Image key={i} source={{ uri: url }} style={s.cardImage} />
              ))}
            </View>
          </ScrollView>
        )}

        {entry.tags && entry.tags.length > 0 && (
          <View style={s.tagRow}>
            {entry.tags.map((t: string) => (
              <View key={t} style={[s.tag, { backgroundColor: colors.primary + '15' }]}><KamiText variant="caption" color={colors.primary}>#{t}</KamiText></View>
            ))}
          </View>
        )}

        {activeSpace === 'couple' && (
          <View style={[s.coupleActionsRow, { borderTopColor: Colors.border + '22' }]}>
            <KamiText variant="caption" color={Colors.textMuted} style={{ flex: 1 }} bold>
              By {entry.userNickname || 'Partner'}
            </KamiText>
            
            <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'center' }}>
              {['❤️', '😊', '🥰'].map(emoji => {
                const count = (entry.reactions ?? []).filter((r: any) => r.emoji === emoji).length;
                const active = (entry.reactions ?? []).some((r: any) => r.emoji === emoji && r.userId === user?.id);
                return (
                  <TouchableOpacity 
                    key={emoji} 
                    style={[
                      s.premiumReactionBtn, 
                      active && [s.premiumReactionBtnActive, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]
                    ]}
                    onPress={() => onReact?.(entry.id, emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 14 }}>{emoji}</Text>
                    {count > 0 && (
                      <KamiText variant="caption" color={active ? colors.primary : Colors.textSecondary} bold style={{ fontSize: 10 }}>
                        {count}
                      </KamiText>
                    )}
                  </TouchableOpacity>
                );
              })}
              
              <TouchableOpacity style={[s.premiumReactionBtn, { paddingHorizontal: Space[3] }]} onPress={() => onOpenComments?.(entry)}>
                <Text style={{ fontSize: 14 }}>💬</Text>
                {(entry.comments ?? []).length > 0 && (
                  <KamiText variant="caption" color={Colors.textSecondary} bold style={{ fontSize: 10 }}>
                    {(entry.comments ?? []).length}
                  </KamiText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const PreviewModal: React.FC<{
  visible: boolean;
  entry: any;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: (e: any) => void;
  activeSpace?: 'personal' | 'couple';
  user?: any;
}> = ({ visible, entry, onClose, onEdit, onDelete, activeSpace, user }) => {
  const { colors } = useTheme();
  
  if (!entry) return null;

  const canEdit = !activeSpace || activeSpace === 'personal' || entry.userId === user?.id;
  const { width: screenWidth } = Dimensions.get('window');
  const carouselWidth = screenWidth - 40; // 20 padding on each side (Space[5] is 20)

  const handleOptionsPress = () => {
    const options: any[] = [
      { text: 'Cancel', style: 'cancel' },
    ];
    if (canEdit) {
      options.unshift({
        text: 'Edit Entry',
        onPress: () => { onClose(); onEdit(); }
      });
    }
    if (onDelete) {
      options.unshift({
        text: 'Delete Entry',
        style: 'destructive' as const,
        onPress: () => { onClose(); onDelete(entry); }
      });
    }
    Alert.alert('Options', undefined, options);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[pv.root, { backgroundColor: colors.pageBg }]}>
        <View style={pv.header}>
          <KamiText variant="title">Preview Entry</KamiText>
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
          {/* Mood & Date header */}
          <View style={pv.metaRow}>
            {entry.moodId ? (
              <View style={[pv.moodBadge, { backgroundColor: colors.primary + '11' }]}>
                <KamiText variant="caption" color={colors.primary} bold>{entry.moodId}</KamiText>
              </View>
            ) : <View />}
            <KamiText variant="caption" color={Colors.textMuted}>
              {formatDate(entry.entryDate || entry.createdAt, user?.timezone)}
            </KamiText>
          </View>

          {/* Title */}
          <KamiText variant="subtitle" bold style={pv.title}>
            {entry.title || 'Untitled Entry'}
          </KamiText>

          {/* Couple Space authorship info */}
          {activeSpace === 'couple' && (
            <View style={pv.authorRow}>
              <KamiText variant="caption" color={colors.primary} bold>
                By {entry.userNickname || 'Partner'}
              </KamiText>
            </View>
          )}

          {/* Premium Image Scroller / Carousel */}
          {entry.imageUrls && entry.imageUrls.length > 0 && (
            <View style={pv.imageScrollerContainer}>
              <ScrollView 
                horizontal 
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={pv.imageScrollView}
                testID="journal-image-carousel"
                accessibilityLabel="Journal Image Carousel"
              >
                {entry.imageUrls.map((url: string, index: number) => (
                  <View key={index} style={{ width: carouselWidth, height: 240, overflow: 'hidden' }}>
                    <Image 
                      source={{ uri: url }} 
                      style={pv.scrollerImage} 
                      resizeMode="cover" 
                      testID={`journal-image-${index}`}
                    />
                  </View>
                ))}
              </ScrollView>
              {/* Pagination Dots indicator */}
              {entry.imageUrls.length > 1 && (
                <View style={pv.dotIndicatorRow}>
                  {entry.imageUrls.map((_: any, index: number) => (
                    <View key={index} style={[pv.dot, { backgroundColor: colors.primary + '44' }]} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Body */}
          <View style={pv.bodyContainer}>
            <KamiText variant="body" color={Colors.textSecondary} style={pv.bodyText}>
              {entry.body}
            </KamiText>
          </View>

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <View style={pv.tagRow}>
              {entry.tags.map((t: string) => (
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

const CommentsModal: React.FC<{
  visible: boolean;
  entry: any;
  onClose: () => void;
  onAddComment: (entryId: string, text: string) => Promise<void>;
}> = ({ visible, entry, onClose, onAddComment }) => {
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!entry) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[cm.root, { backgroundColor: colors.pageBg }]}>
        <View style={cm.header}>
          <KamiText variant="title">Comments</KamiText>
          <TouchableOpacity onPress={onClose} style={cm.closeBtn}>
            <KamiText variant="label" color={colors.primary} bold>Close</KamiText>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={cm.scroll} keyboardShouldPersistTaps="handled">
          <View style={[cm.entrySummary, { backgroundColor: colors.creamDeep + '15' }]}>
            <KamiText variant="label" bold>{entry.title || 'Shared Entry'}</KamiText>
            <KamiText variant="caption" color={Colors.textSecondary} numberOfLines={3}>{entry.body}</KamiText>
          </View>
          <View style={cm.commentsList}>
            {(entry.comments ?? []).length === 0 ? (
              <KamiText variant="caption" color={Colors.textMuted} align="center" style={{ marginVertical: Space[4] }}>
                No comments yet. Leave a sweet note!
              </KamiText>
            ) : (
              (entry.comments ?? []).map((c: any) => {
                const isMe = c.userId === user?.id;
                return (
                  <View 
                    key={c.id} 
                    style={[
                      cm.commentBubbleWrap, 
                      isMe ? cm.commentBubbleWrapRight : cm.commentBubbleWrapLeft
                    ]}
                  >
                    <View 
                      style={[
                        cm.commentBubble, 
                        isMe 
                          ? [cm.commentBubbleRight, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '22' }] 
                          : [cm.commentBubbleLeft, { backgroundColor: '#F1F5F9', borderColor: 'rgba(0,0,0,0.03)' }]
                      ]}
                    >
                      <View style={cm.commentBubbleHeader}>
                        <KamiText variant="caption" color={isMe ? colors.primaryDark : Colors.textPrimary} bold style={{ fontSize: 10 }}>
                          {isMe ? 'You' : c.userNickname}
                        </KamiText>
                        <KamiText variant="caption" color={Colors.textMuted} style={{ fontSize: 8 }}>
                          {new Date(c.createdAt).toLocaleDateString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: user?.timezone ?? 'UTC' })}
                        </KamiText>
                      </View>
                      <KamiText variant="body" color={Colors.textSecondary} style={{ fontSize: FontSize.sm, lineHeight: 18 }}>{c.body}</KamiText>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
        <View style={[cm.inputRow, { borderTopColor: Colors.border + '44' }]}>
          <TextInput
            style={[cm.input, { borderColor: colors.primary + '22', backgroundColor: colors.creamDeep + '11' }]}
            placeholder="Write a comment..."
            placeholderTextColor={Colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={250}
          />
          <TouchableOpacity 
            style={[cm.sendBtn, { backgroundColor: colors.primary }]}
            disabled={!commentText.trim() || submitting}
            onPress={async () => {
              setSubmitting(true);
              await onAddComment(entry.id, commentText.trim());
              setCommentText('');
              setSubmitting(false);
            }}
          >
            <KamiText variant="caption" color="#fff" bold>Send</KamiText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const cm = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  closeBtn: { padding: Space[2] },
  scroll: { padding: Space[5] },
  entrySummary: { padding: Space[4], borderRadius: Radii.card, gap: Space[1], marginBottom: Space[4], borderWidth: 1, borderColor: Colors.border + '22' },
  commentsList: { gap: Space[3] },
  commentCard: { padding: Space[3], backgroundColor: Colors.cardBg, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border + '11', gap: 2 },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: Space[3], gap: Space[2], borderTopWidth: 1 },
  input: { flex: 1, height: 42, borderRadius: Radii.input, borderWidth: 1, paddingHorizontal: Space[3], color: Colors.textPrimary, fontSize: FontSize.sm },
  sendBtn: { paddingVertical: Space[2] + 2, paddingHorizontal: Space[4], borderRadius: Radii.full },

  // Bubble comments styling
  commentBubbleWrap: {
    width: '100%',
    flexDirection: 'row',
    marginVertical: 4,
  },
  commentBubbleWrapRight: {
    justifyContent: 'flex-end',
  },
  commentBubbleWrapLeft: {
    justifyContent: 'flex-start',
  },
  commentBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
  },
  commentBubbleRight: {
    borderBottomRightRadius: 4,
  },
  commentBubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  commentBubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Space[3],
    marginBottom: 2,
  },
});

const pv = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  editBtn: { paddingVertical: Space[1] + 2, paddingHorizontal: Space[3], borderRadius: Radii.md },
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

export default JournalScreen;

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

  entryCard: { backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], gap: Space[3], borderWidth: 1.5, borderColor: 'rgba(201, 104, 130, 0.12)', ...Shadows.md, elevation: 2 },
  entryCardPinned: { borderColor: Colors.primary + '77', backgroundColor: '#FFFDFD', shadowColor: Colors.primary, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  entryHeader:{ flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  entryActions:{ flexDirection: 'row', gap: Space[2] },
  entryBody:  { lineHeight: 22 },
  cardBtn:  { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  
  // Image attachments preview
  imageRowScroll: { marginHorizontal: -Space[4], paddingHorizontal: Space[4], marginVertical: Space[1] },
  imageRow:    { flexDirection: 'row', gap: Space[2] },
  cardImage:   { width: 80, height: 80, borderRadius: Radii.sm },

  tagRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: Space[1] },
  tag:        { backgroundColor: Colors.primary + '15', borderRadius: Radii.full, paddingHorizontal: Space[2], paddingVertical: 2 },

  // Couple Space journal card styles
  coupleActionsRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Space[3], borderTopWidth: 1, marginTop: Space[2] },
  premiumReactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: '#FAF9F6',
  },
  premiumReactionBtnActive: {
    borderColor: Colors.primary,
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
  viewToggleRow: { flexDirection: 'row', marginHorizontal: Space[5], marginVertical: Space[3], gap: Space[2] },
  toggleBtn: { flex: 1, height: 38, borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border + '55', backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { borderWidth: 1.5 },

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
  calCellDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
});
