import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Alert, TextInput, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Space, Radii, Shadows, FontFamily } from '@shared/constants';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';
import {
  QUICK_NOTES, DEFAULT_STICKERS, MAX_CANVAS_ITEMS, MAX_PHOTOS,
  NOTE_COLORS, REACTION_EMOJIS,
} from '../types';
import type {
  PartnerSpaceItem, NoteContent, PhotoContent, StickerContent,
  GiftContent, NoteColor, NoteFontStyle, DisappearCondition,
} from '../types';

export type QuickComposeMode = 'picker' | 'photo' | 'note' | 'sticker' | 'gift';

interface QuickComposeSheetProps {
  initialMode?: QuickComposeMode;
  onDismiss: () => void;
  onItemAdded: (item: PartnerSpaceItem) => void;
}

/**
 * Bottom sheet for quickly adding content to partner's canvas.
 * Supports: Photo, Note, Sticker, Gift.
 * Includes schedule and disappear toggles.
 */
const QuickComposeSheet: React.FC<QuickComposeSheetProps> = ({ initialMode = 'picker', onDismiss, onItemAdded }) => {
  const { colors } = useTheme();
  const space = usePartnerSpaceStore((s) => s.space);
  const permissions = usePartnerSpaceStore((s) => s.permissions);
  const rawItems = usePartnerSpaceStore((s) => s.items);

  // Derive counts with stable references to avoid infinite loops
  const { photoCount, itemCount } = useMemo(() => {
    const active = rawItems.filter((i) => !i.isDeleted && !i.disappeared && !i.isHidden && i.isScheduledPublished);
    return {
      photoCount: active.filter((i) => i.type === 'photo').length,
      itemCount: active.length,
    };
  }, [rawItems]);

  const [mode, setMode] = useState<QuickComposeMode>(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoPhotoOpened = useRef(false);

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);

  // Disappear state
  const [disappearEnabled, setDisappearEnabled] = useState(false);
  const [disappearCondition, setDisappearCondition] = useState<DisappearCondition>('after_24h');

  // Note state
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState<NoteColor>('yellow');
  const [noteFontStyle, setNoteFontStyle] = useState<NoteFontStyle>('handwritten');

  // Gift state
  const [giftNoteText, setGiftNoteText] = useState('');

  // Load recent photos on mount
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== 'granted') return;
      }
    })();
  }, []);

  const checkCanAdd = useCallback((type: string): boolean => {
    if (itemCount >= MAX_CANVAS_ITEMS) {
      Alert.alert('Canvas is full 💕', `You can have up to ${MAX_CANVAS_ITEMS} items. Remove some to add more.`);
      return false;
    }
    if (type === 'photo' && photoCount >= MAX_PHOTOS) {
      Alert.alert('Photo limit reached 📸', `You can have up to ${MAX_PHOTOS} photos. Remove one to add another.`);
      return false;
    }

    // Check permissions
    const permKey = `allow${type.charAt(0).toUpperCase() + type.slice(1)}s` as keyof typeof permissions;
    if (permissions && permKey in permissions && !(permissions as any)[permKey]) {
      Alert.alert(
        'Not right now 💕',
        `Your partner has turned off ${type}s for the moment. Maybe they're planning something special? 🤫`
      );
      return false;
    }

    return true;
  }, [itemCount, photoCount, permissions]);

  const checkScheduleAndDisappear = useCallback((): boolean => {
    if (scheduleEnabled && permissions && !permissions.allowScheduledDrops) {
      Alert.alert('Not right now 💕', 'Scheduled drops are turned off for this widget.');
      return false;
    }

    if (disappearEnabled && permissions && !permissions.allowDisappearing) {
      Alert.alert('Not right now 💕', 'Disappearing items are turned off for this widget.');
      return false;
    }

    return true;
  }, [disappearEnabled, permissions, scheduleEnabled]);

  // ─── Add Photo ─────────────────────────────────────────────────
  const addPhoto = useCallback(async (uri: string) => {
    if (!space || !checkCanAdd('photo') || !checkScheduleAndDisappear()) return;
    setIsSubmitting(true);

    const uploadRes = await SpaceService.uploadPhoto(space.id, uri, 'photo.jpg');
    if (!uploadRes.success) {
      Alert.alert('Oops', uploadRes.error);
      setIsSubmitting(false);
      return;
    }

    const res = await SpaceService.addItem(space.id, 'photo', {
      imageUrl: uploadRes.data,
      caption: '',
    } as PhotoContent, {
      scheduledAt: scheduleEnabled ? (scheduledAt || undefined) : undefined,
      disappearCondition: disappearEnabled ? disappearCondition : undefined,
    });

    if (res.success) {
      onItemAdded(res.data);
    }
    setIsSubmitting(false);
  }, [space, checkCanAdd, checkScheduleAndDisappear, scheduleEnabled, scheduledAt, disappearEnabled, disappearCondition, onItemAdded]);

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await addPhoto(result.assets[0].uri);
    }
  }, [addPhoto]);

  useEffect(() => {
    if (initialMode !== 'photo' || autoPhotoOpened.current) return;
    autoPhotoOpened.current = true;
    pickPhoto();
  }, [initialMode, pickPhoto]);

  // ─── Add Note ──────────────────────────────────────────────────
  const addNote = useCallback(async () => {
    if (!space || !checkCanAdd('note') || !checkScheduleAndDisappear() || !noteText.trim()) return;
    setIsSubmitting(true);

    const res = await SpaceService.addItem(space.id, 'note', {
      text: noteText.trim(),
      color: noteColor,
      fontStyle: noteFontStyle,
    } as NoteContent, {
      scheduledAt: scheduleEnabled ? (scheduledAt || undefined) : undefined,
      disappearCondition: disappearEnabled ? disappearCondition : undefined,
    });

    if (res.success) {
      onItemAdded(res.data);
    }
    setIsSubmitting(false);
  }, [space, checkCanAdd, checkScheduleAndDisappear, noteText, noteColor, noteFontStyle, scheduleEnabled, scheduledAt, disappearEnabled, disappearCondition, onItemAdded]);

  // ─── Add Sticker ───────────────────────────────────────────────
  const addSticker = useCallback(async (sticker: typeof DEFAULT_STICKERS[0]) => {
    if (!space || !checkCanAdd('sticker')) return;
    setIsSubmitting(true);

    const res = await SpaceService.addItem(space.id, 'sticker', {
      stickerId: sticker.id,
      packId: 'default',
      stickerSource: sticker.source,
      sourceType: sticker.sourceType,
    } as StickerContent, {
      width: 80,
      height: 80,
    });

    if (res.success) {
      onItemAdded(res.data);
    }
    setIsSubmitting(false);
  }, [space, checkCanAdd, onItemAdded]);

  // ─── Add Gift ──────────────────────────────────────────────────
  const addGift = useCallback(async () => {
    if (!space || !checkCanAdd('gift') || !checkScheduleAndDisappear() || !giftNoteText.trim()) return;
    setIsSubmitting(true);

    const hiddenContent: NoteContent = {
      text: giftNoteText.trim(),
      color: 'pink',
      fontStyle: 'handwritten',
    };

    const res = await SpaceService.addItem(space.id, 'gift', {
      giftType: 'note',
      hiddenContent,
    } as GiftContent, {
      width: 120,
      height: 130,
      scheduledAt: scheduleEnabled ? (scheduledAt || undefined) : undefined,
      disappearCondition: disappearEnabled ? disappearCondition : undefined,
    });

    if (res.success) {
      onItemAdded(res.data);
    }
    setIsSubmitting(false);
  }, [space, checkCanAdd, checkScheduleAndDisappear, giftNoteText, scheduleEnabled, scheduledAt, disappearEnabled, disappearCondition, onItemAdded]);

  // ─── Quick Schedule Helpers ────────────────────────────────────
  const setQuickSchedule = (label: string) => {
    const now = new Date();
    let target: Date;

    switch (label) {
      case 'tomorrow_morning':
        target = new Date(now);
        target.setDate(target.getDate() + 1);
        target.setHours(7, 0, 0, 0);
        break;
      case 'tonight':
        target = new Date(now);
        target.setHours(21, 0, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        break;
      default:
        target = new Date(now.getTime() + 3600000); // 1 hour
    }

    setScheduledAt(target.toISOString());
    setScheduleEnabled(true);
  };

  // ─── Render ────────────────────────────────────────────────────

  const renderPicker = () => (
    <>
      {/* Content type buttons */}
      <View style={styles.typeGrid}>
        <TouchableOpacity onPress={pickPhoto} style={[styles.typeBtn, { backgroundColor: colors.primary + '10' }]}>
          <Text style={styles.typeBtnEmoji}>📸</Text>
          <Text style={[styles.typeBtnLabel, { color: colors.primary }]}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('note')} style={[styles.typeBtn, { backgroundColor: colors.primary + '10' }]}>
          <Text style={styles.typeBtnEmoji}>💌</Text>
          <Text style={[styles.typeBtnLabel, { color: colors.primary }]}>Note</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('sticker')} style={[styles.typeBtn, { backgroundColor: colors.primary + '10' }]}>
          <Text style={styles.typeBtnEmoji}>😊</Text>
          <Text style={[styles.typeBtnLabel, { color: colors.primary }]}>Sticker</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('gift')} style={[styles.typeBtn, { backgroundColor: colors.primary + '10' }]}>
          <Text style={styles.typeBtnEmoji}>🎁</Text>
          <Text style={[styles.typeBtnLabel, { color: colors.primary }]}>Gift</Text>
        </TouchableOpacity>
      </View>

      {/* Quick notes row */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Quick notes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
        {QUICK_NOTES.map((note, i) => (
          <TouchableOpacity
            key={i}
            onPress={async () => {
              if (!space || !checkCanAdd('note')) return;
              setIsSubmitting(true);
              const res = await SpaceService.addItem(space.id, 'note', {
                text: note.text, color: 'yellow', fontStyle: 'handwritten',
              } as NoteContent);
              if (res.success) onItemAdded(res.data);
              setIsSubmitting(false);
            }}
            style={[styles.quickNoteBtn, { backgroundColor: colors.creamDeep }]}
          >
            <Text style={styles.quickNoteText}>{note.text}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );

  const renderNoteComposer = () => (
    <View>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Write a note 💌</Text>
      <TextInput
        value={noteText}
        onChangeText={(t) => setNoteText(t.slice(0, 100))}
        style={[
          styles.noteInput,
          {
            backgroundColor: NOTE_COLORS[noteColor],
            fontFamily: noteFontStyle === 'handwritten' ? FontFamily.handwriting : FontFamily.body,
            fontSize: noteFontStyle === 'handwritten' ? 18 : 14,
            fontWeight: noteFontStyle === 'bold' ? '600' : '400',
          },
        ]}
        placeholder="Say something sweet..."
        placeholderTextColor="rgba(0,0,0,0.3)"
        multiline
        maxLength={100}
        autoFocus
      />
      <Text style={[styles.charCount, { color: colors.textMuted }]}>{noteText.length}/100</Text>

      {/* Color picker */}
      <View style={styles.colorRow}>
        {(Object.keys(NOTE_COLORS) as NoteColor[]).map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setNoteColor(c)}
            style={[
              styles.colorDot,
              { backgroundColor: NOTE_COLORS[c] },
              noteColor === c && styles.colorDotSelected,
              c === 'white' && styles.colorDotWhite,
            ]}
          />
        ))}
      </View>

      {/* Font style */}
      <View style={styles.fontRow}>
        {(['handwritten', 'clean', 'bold'] as NoteFontStyle[]).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setNoteFontStyle(f)}
            style={[
              styles.fontBtn,
              noteFontStyle === f && { backgroundColor: colors.primary + '15' },
            ]}
          >
            <Text style={[
              styles.fontBtnText,
              { fontFamily: f === 'handwritten' ? FontFamily.handwriting : FontFamily.body },
              f === 'bold' && { fontWeight: '600' },
              noteFontStyle === f && { color: colors.primary },
            ]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={addNote}
        disabled={!noteText.trim() || isSubmitting}
        style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: noteText.trim() ? 1 : 0.5 }]}
      >
        <Text style={styles.sendBtnText}>{isSubmitting ? 'Sending...' : 'Send 💌'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStickerPicker = () => (
    <View>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Pick a sticker 😊</Text>
      <View style={styles.stickerGrid}>
        {DEFAULT_STICKERS.map((sticker) => (
          <TouchableOpacity
            key={sticker.id}
            onPress={() => addSticker(sticker)}
            style={styles.stickerBtn}
            disabled={isSubmitting}
          >
            <Text style={styles.stickerEmoji}>{sticker.source}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGiftComposer = () => (
    <View>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Hide a surprise inside 🎁</Text>
      <TextInput
        value={giftNoteText}
        onChangeText={(t) => setGiftNoteText(t.slice(0, 100))}
        style={[styles.noteInput, { backgroundColor: '#FFE4EC' }]}
        placeholder="Write a secret message..."
        placeholderTextColor="rgba(0,0,0,0.3)"
        multiline
        maxLength={100}
        autoFocus
      />
      <TouchableOpacity
        onPress={addGift}
        disabled={!giftNoteText.trim() || isSubmitting}
        style={[styles.sendBtn, { backgroundColor: '#FF6B8A', opacity: giftNoteText.trim() ? 1 : 0.5 }]}
      >
        <Text style={styles.sendBtnText}>{isSubmitting ? 'Wrapping...' : 'Wrap as Gift 🎁'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPhotoMode = () => (
    <View>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Add a photo 📸</Text>
      <TouchableOpacity
        onPress={pickPhoto}
        disabled={isSubmitting}
        style={[styles.photoPickBtn, { borderColor: colors.primary }]}
      >
        <Text style={styles.photoPickEmoji}>📷</Text>
        <Text style={[styles.photoPickText, { color: colors.primary }]}>
          {isSubmitting ? 'Uploading...' : 'Choose from Gallery'}
        </Text>
      </TouchableOpacity>
      <Text style={[styles.photoCount, { color: colors.textMuted }]}>
        {photoCount}/{MAX_PHOTOS} photos on canvas
      </Text>
    </View>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onDismiss}
        style={styles.backdrop}
      >
        <View style={styles.backdropFill} />
      </TouchableOpacity>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        style={styles.keyboardAvoider}
        pointerEvents="box-none"
      >
        <View
          style={[styles.sheet, { backgroundColor: colors.cardBg }]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Back button if not on picker */}
          {mode !== 'picker' && initialMode === 'picker' && (
            <TouchableOpacity onPress={() => setMode('picker')} style={styles.sheetBack}>
              <Text style={[styles.sheetBackText, { color: colors.textSecondary }]}>← Back</Text>
            </TouchableOpacity>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetContent}
          >
            {mode === 'picker' && renderPicker()}
            {mode === 'photo' && renderPhotoMode()}
            {mode === 'note' && renderNoteComposer()}
            {mode === 'sticker' && renderStickerPicker()}
            {mode === 'gift' && renderGiftComposer()}

            {/* Schedule toggle */}
            {mode !== 'picker' && mode !== 'sticker' && (
              <View style={[styles.toggleSection, { borderTopColor: colors.divider }]}>
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>⏰ Schedule for later</Text>
                  <Switch
                    value={scheduleEnabled}
                    onValueChange={setScheduleEnabled}
                    trackColor={{ false: colors.divider, true: colors.primary + '60' }}
                    thumbColor={scheduleEnabled ? colors.primary : '#CCC'}
                  />
                </View>
                {scheduleEnabled && (
                  <View style={styles.quickScheduleRow}>
                    <TouchableOpacity onPress={() => setQuickSchedule('tomorrow_morning')} style={[styles.quickScheduleBtn, { backgroundColor: colors.creamDeep }]}>
                      <Text style={styles.quickScheduleText}>Tomorrow morning</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setQuickSchedule('tonight')} style={[styles.quickScheduleBtn, { backgroundColor: colors.creamDeep }]}>
                      <Text style={styles.quickScheduleText}>Tonight</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Disappear toggle */}
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>🫧 Make it disappear</Text>
                  <Switch
                    value={disappearEnabled}
                    onValueChange={setDisappearEnabled}
                    trackColor={{ false: colors.divider, true: colors.primary + '60' }}
                    thumbColor={disappearEnabled ? colors.primary : '#CCC'}
                  />
                </View>
                {disappearEnabled && (
                  <View style={styles.disappearOptions}>
                    {(['after_24h', 'after_seen', 'after_reacted'] as DisappearCondition[]).map((cond) => (
                      <TouchableOpacity
                        key={cond}
                        onPress={() => setDisappearCondition(cond)}
                        style={[
                          styles.disappearBtn,
                          disappearCondition === cond && { backgroundColor: colors.primary + '15' },
                        ]}
                      >
                        <Text style={[
                          styles.disappearBtnText,
                          { color: disappearCondition === cond ? colors.primary : colors.textSecondary },
                        ]}>
                          {cond === 'after_24h' ? 'After 24 hours' :
                           cond === 'after_seen' ? 'After seen' : 'After reacted'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default React.memo(QuickComposeSheet);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  keyboardAvoider: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 0,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetContent: {
    paddingBottom: 36,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 3,
    marginTop: 14,
    marginBottom: 18,
  },
  sheetBack: {
    marginBottom: Space[3],
  },
  sheetBackText: {
    fontSize: FontSize.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: Space[3],
    marginBottom: Space[4],
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Space[3],
    borderRadius: Radii.lg,
    gap: 4,
  },
  typeBtnEmoji: { fontSize: 26 },
  typeBtnLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Space[2],
    marginTop: Space[2],
  },
  quickRow: { marginBottom: Space[3] },
  quickNoteBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radii.full,
    marginRight: Space[2],
  },
  quickNoteText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.handwriting,
  },
  noteInput: {
    borderRadius: Radii.lg,
    padding: Space[4],
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: Space[2],
  },
  charCount: { fontSize: FontSize.xs, textAlign: 'right', marginBottom: Space[3] },
  colorRow: { flexDirection: 'row', gap: Space[2], marginBottom: Space[3] },
  colorDot: {
    width: 32, height: 32, borderRadius: 16,
  },
  colorDotSelected: { borderWidth: 3, borderColor: '#333' },
  colorDotWhite: { borderWidth: 1, borderColor: '#DDD' },
  fontRow: { flexDirection: 'row', gap: Space[2], marginBottom: Space[4] },
  fontBtn: {
    flex: 1,
    paddingVertical: Space[2],
    alignItems: 'center',
    borderRadius: Radii.md,
  },
  fontBtnText: { fontSize: FontSize.sm },
  sendBtn: {
    paddingVertical: Space[3],
    borderRadius: Radii.button,
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space[2],
  },
  stickerBtn: {
    width: 52, height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerEmoji: { fontSize: 32 },
  photoPickBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Radii.lg,
    paddingVertical: Space[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    marginBottom: Space[3],
  },
  photoPickEmoji: { fontSize: 36 },
  photoPickText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  photoCount: { fontSize: FontSize.xs, textAlign: 'center' },
  toggleSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Space[4],
    paddingTop: Space[4],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[2],
  },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  quickScheduleRow: {
    flexDirection: 'row',
    gap: Space[2],
    marginBottom: Space[3],
    marginLeft: Space[2],
  },
  quickScheduleBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radii.full,
  },
  quickScheduleText: { fontSize: FontSize.xs },
  disappearOptions: {
    flexDirection: 'row',
    gap: Space[2],
    marginBottom: Space[3],
    marginLeft: Space[2],
  },
  disappearBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radii.full,
  },
  disappearBtnText: { fontSize: FontSize.xs },
});
