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
  Image, StatusBar as RNStatusBar,
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

type Props = MainTabScreenProps<'Journal'>;

// Common tags for couples/reflections
const JOURNAL_TAGS = ['gratitude', 'reflection', 'relationship', 'ideas', 'growth', 'creative'];

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0;
  const v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Write modal ─────────────────────────────────────────────────────────────
const WriteModal: React.FC<{
  visible: boolean;
  entry: JournalEntry | null;
  onClose: () => void;
  onSave: (body: string, title: string | undefined, tags: string[], imageUris: string[]) => Promise<void>;
  saving: boolean;
}> = ({ visible, entry, onClose, onSave, saving }) => {
  const [title, setTitle] = useState('');
  const [body,  setBody]  = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(entry?.title ?? '');
      setBody(entry?.body ?? '');
      setSelectedTags(entry?.tags ?? []);
      setLocalUris(entry?.imageUrls ?? []);
      setNewTag('');

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
            <KamiText variant="overline">{entry ? 'Edit entry' : new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</KamiText>
            <TouchableOpacity onPress={() => { if (!body.trim()) return; Keyboard.dismiss(); onSave(body.trim(), title.trim() || undefined, selectedTags, localUris); }} disabled={saving || !body.trim()} hitSlop={8}>
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
  toolbar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
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

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>(JOURNAL_TAGS);

  // Sync available unique tags (including custom ones) from unfiltered database state
  useEffect(() => {
    if (!search && !selectedTag && journalEntries.length > 0) {
      const unique = Array.from(new Set([...JOURNAL_TAGS, ...journalEntries.flatMap(e => e.tags || [])]));
      setAvailableTags(unique);
    }
  }, [journalEntries, search, selectedTag]);

  // Filter local lists
  useEffect(() => {
    if (user?.id) {
      loadJournal(search.trim() || undefined, selectedTag || undefined);
    }
  }, [search, selectedTag, user?.id]);

  const handleSave = async (body: string, title?: string, tags: string[] = [], localUris: string[] = []) => {
    if (!user?.id) return;
    setWriteSaving(true);
    try {
      let relativePaths: string[] = [];

      // Determine the target ID (use editing ID or generate a new one)
      const targetId = editing ? editing.id : uuid();

      // Separate existing remote signed URLs from new local picker URIs
      const localPickerUris = localUris.filter(u => u.startsWith('file://') || u.startsWith('content://'));
      const existingPaths = (editing?.imageUrls ?? [])
        .filter(url => localUris.includes(url))
        // Map back to relative storage paths if possible, or extract path
        .map(url => {
          const match = url.match(/\/journal_images\/(.+?)\?/);
          return match ? decodeURIComponent(match[1]) : null;
        })
        .filter(Boolean) as string[];

      if (localPickerUris.length > 0) {
        const uploadRes = await uploadImages('journal_images', user.id, targetId, localPickerUris);
        if (!uploadRes.success) {
          Alert.alert('Kami', uploadRes.error);
          setWriteSaving(false);
          return;
        }
        relativePaths = [...existingPaths, ...uploadRes.paths];
      } else {
        relativePaths = existingPaths;
      }

      const r = editing
        ? await editJournalEntry(editing.id, { body, title, tags, imageUrls: relativePaths })
        : await addJournalEntry({ body, title, tags, imageUrls: relativePaths });

      if (!r.success) { Alert.alert('Kami', r.error); }
      else { setWriteVisible(false); setEditing(null); }
    } catch (e) {
      Alert.alert('Kami', 'Error saving your entry.');
    } finally {
      setWriteSaving(false);
    }
  };

  const handleDelete = (e: JournalEntry) => Alert.alert('Delete entry?', 'This cannot be undone and will delete all attachments.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { const r = await removeJournalEntry(e.id); if (!r.success) Alert.alert('Kami', r.error); } },
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

  const handleRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.pageBg }]}>
        <View>
          <KamiText variant="overline">Your thoughts</KamiText>
          <KamiText variant="title">Journal</KamiText>
        </View>
        <TouchableOpacity style={[s.writeBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => { setEditing(null); setWriteVisible(true); }} accessibilityRole="button">
          <Text style={[s.writeBtnPlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>New entry</KamiText>
        </TouchableOpacity>
      </View>

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Today's prompt card */}
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
              <KamiText variant="body" style={{ fontStyle: 'italic', fontWeight: '500', lineHeight: 22 }} numberOfLines={3}>"{todayPrompt.content}"</KamiText>
              <KamiText variant="caption" color={promptResponse ? Colors.success : colors.primary} bold>
                {promptResponse ? '✓ Answered — Tap to edit' : 'Tap to reflect ›'}
              </KamiText>
            </View>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {journalLoading === 'loading' && journalEntries.length === 0 && (
          <View style={s.centerState}><ActivityIndicator color={colors.primary} /></View>
        )}

        {/* Empty state */}
        {journalLoading !== 'loading' && journalEntries.length === 0 && (
          <TouchableOpacity style={s.emptyState} onPress={() => { setEditing(null); setWriteVisible(true); }} activeOpacity={0.85}>
            <Text style={{ fontSize: 48, marginBottom: Space[3] }}>📓</Text>
            <KamiText variant="subtitle" align="center">No entries found</KamiText>
            <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
              {search || selectedTag ? 'Clear filters to view your entries.' : 'Write your first entry. No rules, just you.'}
            </KamiText>
            <View style={[s.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
              <KamiText variant="label" color={colors.primary} bold>Start writing ›</KamiText>
            </View>
          </TouchableOpacity>
        )}

        {/* Entries */}
        {journalEntries.map((e, idx) => {
          const showDate = idx === 0 || new Date(e.entryDate).toDateString() !== new Date(journalEntries[idx - 1].entryDate).toDateString();
          return (
            <React.Fragment key={e.id}>
              {showDate && (
                <KamiText variant="overline" style={s.dateLabel}>{formatDate(e.entryDate)}</KamiText>
              )}
              <EntryCard
                entry={e}
                onEdit={() => { setEditing(e); setWriteVisible(true); }}
                onDelete={() => handleDelete(e)}
                onTogglePin={() => togglePin(e)}
              />
            </React.Fragment>
          );
        })}

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <WriteModal visible={writeVisible} entry={editing} onClose={() => { setWriteVisible(false); setEditing(null); }} onSave={handleSave} saving={writeSaving} />
      {todayPrompt && (
        <PromptModal visible={promptVisible} prompt={todayPrompt.content} existing={promptResponse?.response} onClose={() => setPromptVisible(false)} onSave={handlePromptSave} saving={promptSaving} />
      )}
    </SafeAreaView>
  );
}

const EntryCard: React.FC<{ entry: JournalEntry; onEdit: () => void; onDelete: () => void; onTogglePin: () => void }> = ({ entry, onEdit, onDelete, onTogglePin }) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1} onPress={onEdit}
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
            <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.cardBtn}>
              <Text style={{ fontSize: 13, color: Colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <KamiText variant="body" color={Colors.textSecondary} numberOfLines={4} style={s.entryBody}>
          {entry.body}
        </KamiText>

        {/* Horizontal Photo Preview */}
        {entry.imageUrls && entry.imageUrls.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imageRowScroll}>
            <View style={s.imageRow}>
              {entry.imageUrls.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={s.cardImage} />
              ))}
            </View>
          </ScrollView>
        )}

        {entry.tags && entry.tags.length > 0 && (
          <View style={s.tagRow}>
            {entry.tags.map(t => (
              <View key={t} style={[s.tag, { backgroundColor: colors.primary + '15' }]}><KamiText variant="caption" color={colors.primary}>#{t}</KamiText></View>
            ))}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default JournalScreen;

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.pageBg },
  header:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '33', backgroundColor: Colors.pageBg },
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

  entryCard: { backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], gap: Space[3], borderWidth: 1, borderColor: Colors.border + '44', ...Shadows.sm },
  entryCardPinned: { borderColor: Colors.primary + '55', backgroundColor: Colors.creamMid + '22' },
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
});
