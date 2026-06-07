/**
 * FutureScreen.tsx
 *
 * Letters to your future self.
 * Seam and lock letters with text and photo attachments.
 * Body content and images are kept sealed on the database level until the unlock date.
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator, Alert, Animated, Keyboard, Modal,
  Platform, RefreshControl, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  Image, StatusBar as RNStatusBar, AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import KamiText from '@shared/ui/atoms/KamiText';
import KamiButton from '@shared/ui/atoms/KamiButton';
import { Colors, FontFamily, FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import { useAuthStore } from '@features/auth';
import type { MainTabScreenProps } from '@core/navigation/types';
import type { Letter } from '@features/home/types';
import type { CoupleLetter } from '@features/couple/types';
import { useCoupleStore, PartnerActionType } from '@features/couple/store/coupleStore';
import { useCouple } from '@features/couple/hooks/useCouple';
import { broadcastPartnerAction } from '@features/couple/services/broadcastService';
import * as coupleService from '@infrastructure/couple/coupleService';
import * as futureService from '@infrastructure/home/futureService';
import { pickImages, uploadImages } from '@shared/lib/storage';
import { useTheme } from '@shared/hooks';

type Props = MainTabScreenProps<'Future'>;

const DELIVERY_OPTIONS = [
  { label: 'Send Now',  days: 0   },
  { label: '1 month',   days: 30  },
  { label: '3 months',  days: 90  },
  { label: '6 months',  days: 180 },
  { label: '1 year',    days: 365 },
  { label: '2 years',   days: 730 },
  { label: '5 years',   days: 1825},
];

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0;
  const v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

function friendly(raw: string) {
  if (raw.includes('JWT') || raw.includes('auth')) return 'Session expired. Please sign in again.';
  return 'Something went wrong. Please try again.';
}

function getRelativePathFromSignedUrl(url: string): string {
  if (!url.includes('letter_images/')) return url;
  const parts = url.split('letter_images/');
  const pathWithQuery = parts[1];
  return pathWithQuery.split('?')[0];
}

function daysUntil(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (d <= 0) return 'Ready to read ✨';
  if (d === 1) return 'Opens tomorrow';
  if (d < 30)  return `Opens in ${d} days`;
  if (d < 365) return `Opens in ${Math.floor(d / 30)} months`;
  return `Opens in ${Math.floor(d / 365)} year${Math.floor(d / 365) > 1 ? 's' : ''}`;
}

function checkUnlocked(l: Letter | CoupleLetter) {
  return Date.now() >= new Date(l.deliverAt).getTime();
}

function getNextAnniversaryDays(anniversaryDate: string): number {
  const ann = new Date(anniversaryDate);
  const now = new Date();
  const nextAnn = new Date(now.getFullYear(), ann.getMonth(), ann.getDate());
  if (nextAnn.getTime() < now.getTime()) {
    nextAnn.setFullYear(now.getFullYear() + 1);
  }
  const diff = nextAnn.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diff / 86400000));
}

function getNextNewYearDays(): number {
  const now = new Date();
  const nextYear = now.getFullYear() + 1;
  const nextNY = new Date(nextYear, 0, 1);
  const diff = nextNY.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diff / 86400000));
}

// ─── Write modal ──────────────────────────────────────────────────────────────
const WriteModal: React.FC<{
  visible: boolean; 
  onClose: () => void;
  onSave: (subject: string, body: string, daysFromNow: number, imageUris: string[], isDraft?: boolean, updateId?: string) => Promise<void>; 
  saving: boolean;
  draftLetter?: Letter | CoupleLetter | null;
  anniversaryDate?: string | null;
  activeSpace?: 'personal' | 'couple';
}> = ({ visible, onClose, onSave, saving, draftLetter, anniversaryDate, activeSpace }) => {
  const [subject,  setSubject]  = useState('');
  const [body,     setBody]     = useState('');
  const [delivery, setDelivery] = useState({ label: '1 year', days: 365 });
  const [customMonth, setCustomMonth] = useState('');
  const [customDay, setCustomDay] = useState('');
  const [customYear, setCustomYear] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const { colors } = useTheme();

  const getDeliveryOptions = () => {
    const opts = [
      { label: 'Send Now ✉️', days: 0 },
      { label: '1 month', days: 30 },
      { label: '3 months', days: 90 },
      { label: '1 year', days: 365 },
    ];
    if (activeSpace === 'couple' && anniversaryDate) {
      const annDays = getNextAnniversaryDays(anniversaryDate);
      if (annDays > 0) {
        opts.push({ label: 'Anniversary 💖', days: annDays });
      }
    }
    const nyDays = getNextNewYearDays();
    opts.push({ label: 'New Year 🎆', days: nyDays });
    return opts;
  };

  const reset = () => {
    setSubject('');
    setBody('');
    setDelivery({ label: '1 year', days: 365 });
    setCustomMonth('');
    setCustomDay('');
    setCustomYear('');
    setIsCustom(false);
    setLocalUris([]);
  };

  useEffect(() => {
    if (visible) {
      if (draftLetter) {
        setSubject(draftLetter.subject ?? '');
        setBody(draftLetter.body ?? '');
        setLocalUris(draftLetter.imageUrls ?? []);
        
        // Calculate days remaining if locked, else send now
        const diffMs = new Date(draftLetter.deliverAt).getTime() - Date.now();
        const diffDays = Math.max(0, Math.ceil(diffMs / 86400000));
        setDelivery({ label: diffDays === 0 ? 'Send Now ✉️' : 'Draft lock', days: diffDays });
      } else {
        reset();
      }
    }
  }, [visible, draftLetter]);

  const handleCustomDateChange = (mStr: string, dStr: string, yStr: string) => {
    const mm = mStr.replace(/[^0-9]/g, '');
    const dd = dStr.replace(/[^0-9]/g, '');
    const yyyy = yStr.replace(/[^0-9]/g, '');

    const m = parseInt(mm, 10);
    const d = parseInt(dd, 10);
    const y = parseInt(yyyy, 10);

    if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2026) {
        const targetDate = new Date(y, m - 1, d);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);
        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / 86400000);
        if (diffDays > 0) {
          setDelivery({ label: `Custom: ${targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`, days: diffDays });
          return;
        }
      }
    }
    setDelivery({ label: 'Custom Date', days: -1 });
  };

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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <SafeAreaView style={[wm.root, { backgroundColor: colors.pageBg }]}>
        <View style={wm.toolbar}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline" bold>{draftLetter ? 'Edit Draft' : 'Write a letter'}</KamiText>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={wm.content}>
          {/* Delivery time */}
          <KamiText variant="overline" style={wm.label}>Deliver in</KamiText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={wm.deliveryRow}>
              {getDeliveryOptions().map(o => (
                <TouchableOpacity
                  key={o.label}
                  style={[
                    wm.deliveryChip,
                    { backgroundColor: colors.creamDeep },
                    !isCustom && delivery.days === o.days && [
                      wm.deliveryChipOn,
                      { borderColor: colors.primary, backgroundColor: colors.primary + '18' }
                    ]
                  ]}
                  onPress={() => {
                    setIsCustom(false);
                    setDelivery(o);
                  }}
                >
                  <KamiText
                    variant="caption"
                    color={!isCustom && delivery.days === o.days ? colors.primary : Colors.textMuted}
                    bold={!isCustom && delivery.days === o.days}
                  >
                    {o.label}
                  </KamiText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  wm.deliveryChip,
                  { backgroundColor: colors.creamDeep },
                  isCustom && [
                    wm.deliveryChipOn,
                    { borderColor: colors.primary, backgroundColor: colors.primary + '18' }
                  ]
                ]}
                onPress={() => {
                  setIsCustom(true);
                  handleCustomDateChange(customMonth, customDay, customYear);
                }}
              >
                <KamiText
                  variant="caption"
                  color={isCustom ? colors.primary : Colors.textMuted}
                  bold={isCustom}
                >
                  Custom Date
                </KamiText>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {isCustom && (
            <View>
              <KamiText variant="caption" color={Colors.textMuted} style={{ marginBottom: Space[1] }}>Unlock Date (MM / DD / YYYY)</KamiText>
              <View style={wm.customDateRow}>
                <TextInput
                  style={[wm.customInput, { flex: 1.5, backgroundColor: colors.creamDeep }]}
                  placeholder="MM"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={customMonth}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/[^0-9]/g, '');
                    setCustomMonth(cleaned);
                    handleCustomDateChange(cleaned, customDay, customYear);
                  }}
                />
                <KamiText variant="body" color={Colors.textMuted}>/</KamiText>
                <TextInput
                  style={[wm.customInput, { flex: 1.5, backgroundColor: colors.creamDeep }]}
                  placeholder="DD"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={customDay}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/[^0-9]/g, '');
                    setCustomDay(cleaned);
                    handleCustomDateChange(customMonth, cleaned, customYear);
                  }}
                />
                <KamiText variant="body" color={Colors.textMuted}>/</KamiText>
                <TextInput
                  style={[wm.customInput, { flex: 2, backgroundColor: colors.creamDeep }]}
                  placeholder="YYYY"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={customYear}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/[^0-9]/g, '');
                    setCustomYear(cleaned);
                    handleCustomDateChange(customMonth, customDay, cleaned);
                  }}
                />
              </View>
            </View>
          )}

          {/* Unlock date display */}
          <View style={[wm.unlockDate, { backgroundColor: colors.creamDeep }]}>
            <Text style={{ fontSize: 20 }}>{delivery.days === 0 ? '✉️' : '🔒'}</Text>
            <KamiText variant="body" color={colors.primary} bold>
              {delivery.days > 0 ? (
                `Unlocks on ${new Date(Date.now() + delivery.days * 86400000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
              ) : delivery.days === 0 ? (
                'Delivers immediately'
              ) : (
                'Please enter a valid date'
              )}
            </KamiText>
          </View>

          {/* Subject */}
          <KamiText variant="overline" style={wm.label}>Subject</KamiText>
          <TextInput style={[wm.input, { backgroundColor: '#FAF8F5', borderColor: '#E5DEC9' }]} placeholder="To my future self…" placeholderTextColor={Colors.textMuted} value={subject} onChangeText={setSubject} maxLength={120} />

          {/* Body */}
          <KamiText variant="overline" style={wm.label}>Your letter *</KamiText>
          <View style={wm.paperWrapper}>
            <TextInput
              style={[wm.bodyInput, { backgroundColor: '#FFFDF6', color: '#4A3B32', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }]} 
              placeholder="Dear future me,&#10;&#10;I hope you're well. Right now I'm thinking about…"
              placeholderTextColor="rgba(74, 59, 50, 0.4)" 
              value={body} 
              onChangeText={setBody}
              multiline 
              autoFocus={!draftLetter} 
              textAlignVertical="top" 
              maxLength={5000}
            />
          </View>
          <KamiText variant="caption" color={Colors.textMuted} align="right">{body.length} / 5000</KamiText>

          {/* Attachments */}
          <View style={wm.photoHeader}>
            <KamiText variant="overline">Attach Photos</KamiText>
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

          {/* Submit Actions */}
          <View style={{ flexDirection: 'row', gap: Space[2], marginTop: Space[6] }}>
            <TouchableOpacity
              style={[{ borderColor: colors.primary, backgroundColor: '#fff', flex: 1, height: 50, borderRadius: Radii.button, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }]}
              disabled={saving || !body.trim()}
              onPress={() => {
                if (!body.trim()) return;
                Keyboard.dismiss();
                onSave(subject.trim(), body.trim(), delivery.days >= 0 ? delivery.days : 365, localUris, true, draftLetter?.id).then(reset);
              }}
            >
              <KamiText variant="label" color={colors.primary} bold>Save Draft 📝</KamiText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[{ backgroundColor: colors.primary, flex: 1.5, height: 50, borderRadius: Radii.button, alignItems: 'center', justifyContent: 'center' }]}
              disabled={!body.trim() || delivery.days < 0 || saving}
              onPress={() => {
                if (!body.trim() || delivery.days < 0) return;
                Keyboard.dismiss();
                onSave(subject.trim(), body.trim(), delivery.days, localUris, false, draftLetter?.id).then(reset);
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <KamiText variant="label" color="#fff" bold>
                  {delivery.days === 0 ? "Send Now ✉️" : "Seal & Send 🔒"}
                </KamiText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
const wm = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.pageBg },
  toolbar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  content:      { padding: Space[5], gap: Space[3], paddingBottom: Space[10] },
  label:        { marginBottom: Space[1] },
  deliveryRow:  { flexDirection: 'row', gap: Space[2], paddingVertical: Space[2] },
  deliveryChip: { paddingHorizontal: Space[4], paddingVertical: Space[2], borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.creamDeep },
  deliveryChipOn:{ borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  customDateRow:{ flexDirection: 'row', alignItems: 'center', gap: Space[2], marginTop: Space[1], marginBottom: Space[2] },
  customInput:  { backgroundColor: Colors.creamDeep, borderRadius: Radii.input, paddingHorizontal: Space[4], paddingVertical: Space[3], fontSize: FontSize.base, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border, textAlign: 'center' },
  unlockDate:   { flexDirection: 'row', alignItems: 'center', gap: Space[2], backgroundColor: Colors.rose100, borderRadius: Radii.card, padding: Space[3], marginVertical: Space[1] },
  input:        { backgroundColor: Colors.creamDeep, borderRadius: Radii.input, paddingHorizontal: Space[4], paddingVertical: Space[3], fontSize: FontSize.base, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border },
  bodyInput:    { paddingHorizontal: Space[4], paddingLeft: Space[6], paddingVertical: Space[3], fontSize: FontSize.base, color: '#4A3B32', minHeight: 220, lineHeight: 28, fontStyle: 'italic', borderLeftWidth: 1.5, borderLeftColor: '#fca5a5' },
  paperWrapper: { position: 'relative', borderRadius: Radii.card, borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden' },
  photoHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space[4], borderTopWidth: 1, borderTopColor: Colors.border + '22', paddingTop: Space[3] },
  addPhotoBtn:  { paddingVertical: Space[1], paddingHorizontal: Space[2] },
  photoScroll:  { marginHorizontal: -Space[5], paddingHorizontal: Space[5], marginVertical: Space[2] },
  photoRow:     { flexDirection: 'row', gap: Space[3] },
  photoWrap:    { position: 'relative' },
  attachedImage:{ width: 90, height: 90, borderRadius: Radii.sm },
  removePhotoBadge:{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
  submitBtn:    { marginTop: Space[6] },
});

// ─── Read modal (calls RPC to pull locked body/attachments) ───────────────────
const ReadModal: React.FC<{
  visible: boolean;
  letter: Letter | CoupleLetter | null;
  onClose: () => void;
  activeSpace: 'personal' | 'couple';
  onToggleFavorite?: (l: Letter | CoupleLetter) => void;
  onToggleArchive?: (l: Letter | CoupleLetter) => void;
  onToggleReaction?: (letterId: string, emoji: string) => void;
}> = ({ visible, letter, onClose, activeSpace, onToggleFavorite, onToggleArchive, onToggleReaction }) => {
  const [content, setContent] = useState<{ body: string; imageUrls: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (visible && letter) {
      setLoading(true);
      const fetchPromise = activeSpace === 'couple'
        ? coupleService.fetchCoupleLetterDetails(letter.id)
        : futureService.fetchLetter(letter.id);

      fetchPromise.then(r => {
        setLoading(false);
        if (r.success) setContent(r.data);
        else Alert.alert('Kami', r.error);
      });
    } else {
      setContent(null);
    }
  }, [visible, letter]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[rm.root, { backgroundColor: colors.pageBg }]}>
        <View style={rm.toolbar}>
          {letter ? (
            <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'center' }}>
              <TouchableOpacity onPress={() => onToggleFavorite?.(letter)} style={rm.favToggleBtn} hitSlop={8}>
                <KamiText variant="label" color={letter.isFavorite ? colors.primary : Colors.textMuted} bold={!!letter.isFavorite}>
                  {letter.isFavorite ? '🎀 Favorited' : '♡ Favorite'}
                </KamiText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onToggleArchive?.(letter)} style={rm.favToggleBtn} hitSlop={8}>
                <KamiText variant="label" color={letter.isArchived ? colors.primary : Colors.textMuted} bold={!!letter.isArchived}>
                  {letter.isArchived ? '📦 Archived' : '📥 Archive'}
                </KamiText>
              </TouchableOpacity>
            </View>
          ) : <View />}
          <KamiText variant="overline">Your letter</KamiText>
          <TouchableOpacity onPress={onClose} hitSlop={8}><KamiText variant="label" color={Colors.textMuted}>Close</KamiText></TouchableOpacity>
        </View>
        {loading && (
          <View style={rm.center}><ActivityIndicator color={colors.primary} /></View>
        )}
        {!loading && letter && content && (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={rm.content}>
              <View style={[rm.envelope, { backgroundColor: colors.creamDeep }]}>
                <Text style={rm.envelopeEmoji}>{letter.isFavorite ? '🎀' : '📄'}</Text>
                <KamiText variant="overline" align="center" style={{ marginTop: Space[2] }}>
                  Written {new Date(letter.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </KamiText>
                {activeSpace === 'couple' && 'senderId' in letter && (
                  <KamiText variant="caption" align="center" color={Colors.textMuted} style={{ marginTop: Space[1] }}>
                    {(letter as CoupleLetter).senderId === user?.id
                      ? 'From: You'
                      : `From: ${(letter as CoupleLetter).senderNickname || 'Partner'}`}
                  </KamiText>
                )}
              </View>
              <KamiText variant="title" style={{ marginBottom: Space[3] }}>{letter.subject}</KamiText>
              <KamiText variant="body" style={{ lineHeight: 28, fontFamily: FontFamily.display }}>{content.body}</KamiText>
              
              {content.imageUrls.length > 0 && (
                <View style={rm.photoSection}>
                  <KamiText variant="overline" style={{ marginBottom: Space[2] }}>Attached Photos</KamiText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={rm.photoScroll}>
                    <View style={rm.photoRow}>
                      {content.imageUrls.map((url, i) => (
                        <Image key={i} source={{ uri: url }} style={rm.attachedImage} />
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </ScrollView>

            {activeSpace === 'couple' && (
              <View style={[rm.reactionBar, { borderTopColor: Colors.border + '33', backgroundColor: colors.creamDeep }]}>
                {['❤️', '😊', '🥰', '😮', '😢', '👍'].map(emoji => {
                  const coupleLetter = letter as CoupleLetter;
                  const userReaction = coupleLetter.reactions?.find(r => r.userId === user?.id && r.emoji === emoji);
                  const count = coupleLetter.reactions?.filter(r => r.emoji === emoji).length || 0;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        rm.reactionBtn,
                        userReaction && [rm.reactionBtnActive, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]
                      ]}
                      onPress={() => onToggleReaction?.(letter.id, emoji)}
                    >
                      <Text style={{ fontSize: 20 }}>{emoji}</Text>
                      {count > 0 && (
                        <KamiText variant="caption" color={userReaction ? colors.primary : Colors.textMuted} bold={!!userReaction} style={{ fontSize: 10 }}>
                          {count}
                        </KamiText>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};
const rm = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.pageBg },
  toolbar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  content:     { padding: Space[5], paddingBottom: Space[10] },
  envelope:    { alignItems: 'center', backgroundColor: Colors.rose100, borderRadius: Radii.card, padding: Space[5], marginBottom: Space[5] },
  envelopeEmoji:{ fontSize: 48 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Space[10] },
  photoSection:{ marginTop: Space[5], borderTopWidth: 1, borderTopColor: Colors.border + '22', paddingTop: Space[4] },
  photoScroll: { marginHorizontal: -Space[5], paddingHorizontal: Space[5] },
  photoRow:    { flexDirection: 'row', gap: Space[3] },
  attachedImage:{ width: 140, height: 140, borderRadius: Radii.card },
  favToggleBtn:{ paddingVertical: Space[1], paddingHorizontal: Space[2] },
  reactionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    borderTopWidth: 1,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reactionBtnActive: {
    borderColor: Colors.primary,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export function FutureScreen({ navigation }: Props) {
  const user = useAuthStore(s => s.user);
  const activeSpace = user?.activeSpace ?? 'personal';
  const coupleStore = useCoupleStore();
  const coupleActions = useCouple();
  const couple = coupleStore.couple;

  const { colors } = useTheme();

  const [letters,    setLetters]    = useState<Letter[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [writeOpen,  setWriteOpen]  = useState(false);
  const [readOpen,   setReadOpen]   = useState(false);
  const [reading,    setReading]    = useState<Letter | CoupleLetter | null>(null);
  const [saving,     setSaving]     = useState(false);

  const [visibleCount, setVisibleCount] = useState(10);
  const [filterTab,    setFilterTab]    = useState<'inbox' | 'scheduled' | 'drafts' | 'favorites' | 'archive'>('inbox');
  const [editingDraft, setEditingDraft] = useState<Letter | CoupleLetter | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setVisibleCount(10);
  }, [activeSpace, filterTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const [isFocused, setIsFocused] = useState(navigation.isFocused());
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => setAppState(next));
    return () => sub.remove();
  }, []);

  // Focus listener to refresh data on navigate focus
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
      if (activeSpace === 'couple') {
        coupleActions.loadLetters();
      } else {
        loadLetters();
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

  // Real-time ephemeral broadcast status when entering/leaving screen or writing/reading
  useEffect(() => {
    if (activeSpace !== 'couple' || !couple?.id || !user?.id) return;
    if (isFocused && appState === 'active') {
      const action: PartnerActionType = writeOpen 
        ? (editingDraft ? 'editing_draft' : 'writing_letter') 
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
  }, [activeSpace, couple?.id, user?.id, isFocused, appState, writeOpen, readOpen, editingDraft]);

  // Dual-mode loaders
  useEffect(() => {
    if (activeSpace === 'couple') {
      if (couple?.id) {
        coupleActions.loadLetters();
      }
    } else {
      loadLetters();
    }
  }, [activeSpace, couple?.id]);

  async function loadLetters() {
    setLoading(true);
    const r = await futureService.fetchLetters();
    setLoading(false);
    if (!r.success) { Alert.alert('Kami', r.error); return; }
    setLetters(r.data);
  }

  const handleSave = async (
    subject: string, 
    body: string, 
    daysFromNow: number, 
    localUris: string[] = [], 
    isDraft = false, 
    updateId?: string
  ) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const targetId = updateId || uuid();
      const deliverAt = new Date(Date.now() + daysFromNow * 86400000).toISOString();
      const finalSubject = subject.trim() || (activeSpace === 'couple' ? 'Love Letter' : 'To my future self');

      const remoteUrls = localUris.filter(u => u.startsWith('http'));
      const localOnly = localUris.filter(u => !u.startsWith('http'));

      let relativePaths: string[] = [];
      if (localOnly.length > 0) {
        const uploadRes = await uploadImages('letter_images', user.id, targetId, localOnly);
        if (!uploadRes.success) {
          Alert.alert('Kami', uploadRes.error);
          setSaving(false);
          return;
        }
        relativePaths = uploadRes.paths;
      }

      const remoteRelativePaths = remoteUrls.map(getRelativePathFromSignedUrl);
      const finalImageUrls = [...remoteRelativePaths, ...relativePaths];

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
            imageUrls: finalImageUrls
          });
          if (!r.success) { Alert.alert('Kami', r.error); }
          else {
            setWriteOpen(false);
            setEditingDraft(null);
          }
        } else {
          const r = await coupleActions.addLetter(couple.id, finalSubject, body, deliverAt, finalImageUrls, isDraft);
          if (!r.success) { Alert.alert('Kami', r.error); }
          else {
            setWriteOpen(false);
          }
        }
      } else {
        if (updateId) {
          const r = await futureService.updateLetter(updateId, {
            subject: finalSubject,
            body,
            deliverAt,
            isDraft,
            imageUrls: finalImageUrls
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
            imageUrls: finalImageUrls,
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

  const handleOpen = async (l: Letter | CoupleLetter) => {
    if (l.isDraft) {
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

    if (!checkUnlocked(l)) {
      Alert.alert('🔒 Sealed envelope', `This letter is locked and cannot be read until ${new Date(l.deliverAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.`);
      return;
    }
    setReading(l); 
    setReadOpen(true);

    // Mark as read automatically on open if not already read
    if (!l.isRead) {
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
  };

  const handleToggleFavorite = async (l: Letter | CoupleLetter) => {
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
  };

  const handleToggleArchive = async (l: Letter | CoupleLetter) => {
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
  };

  const handleToggleReaction = async (letterId: string, emoji: string) => {
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
  };

  const handleDelete = (l: Letter | CoupleLetter) => Alert.alert('Delete letter?', `"${l.subject}"`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      if (activeSpace === 'couple') {
        const r = await coupleActions.deleteLetter(l.id);
        if (!r.success) { Alert.alert('Kami', r.error); }
      } else {
        const r = await futureService.deleteLetter(l.id);
        if (!r.success) { Alert.alert('Kami', r.error); return; }
        setLetters(prev => prev.filter(x => x.id !== l.id));
      }
    }},
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeSpace === 'couple') {
      await coupleActions.loadLetters();
    } else {
      await loadLetters();
    }
    setRefreshing(false);
  };

  const currentLetters = activeSpace === 'couple' ? coupleStore.coupleLetters : letters;

  // Apply filters
  const filteredLetters = currentLetters.filter(l => {
    const isUnlocked = checkUnlocked(l);
    if (filterTab === 'inbox') {
      return isUnlocked && !l.isDraft && !l.isArchived;
    }
    if (filterTab === 'scheduled') {
      return !isUnlocked && !l.isDraft && !l.isArchived;
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

  const paginatedLetters = sortedLetters.slice(0, visibleCount);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.pageBg }]}>
        <View style={{ flex: 1 }}>
          <KamiText variant="overline">{activeSpace === 'couple' ? 'Sealed capsules' : 'Letters to yourself'}</KamiText>
          <KamiText variant="title">{activeSpace === 'couple' ? 'Love Letters' : 'Future'}</KamiText>
        </View>
        <TouchableOpacity style={[s.writeBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => setWriteOpen(true)}>
          <Text style={[s.writePlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>Write</KamiText>
        </TouchableOpacity>
      </View>

      {/* Segmented Filter Row */}
      <View style={{ height: 48, marginBottom: Space[2] }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={s.filterScroll}
        >
          {(['inbox', 'scheduled', 'drafts', 'favorites', 'archive'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                s.filterTab,
                { backgroundColor: colors.creamDeep, borderColor: Colors.border + '44' },
                filterTab === tab && [s.filterTabActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
              ]}
              onPress={() => setFilterTab(tab)}
            >
              <KamiText
                variant="caption"
                color={filterTab === tab ? '#fff' : Colors.textMuted}
                bold={filterTab === tab}
                style={{ textTransform: 'capitalize' }}
              >
                {tab}
              </KamiText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {((loading && activeSpace === 'personal') ||
          (coupleStore.lettersLoading === 'loading' && activeSpace === 'couple')) && sortedLetters.length === 0 && (
          <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        )}

        {((!loading && activeSpace === 'personal') ||
          (coupleStore.lettersLoading !== 'loading' && activeSpace === 'couple')) && sortedLetters.length === 0 && (
          <TouchableOpacity style={s.emptyState} onPress={() => setWriteOpen(true)} activeOpacity={0.85}>
            <Text style={{ fontSize: 56, marginBottom: Space[3] }}>💌</Text>
            {filterTab === 'inbox' && (
              <>
                <KamiText variant="subtitle" align="center">Your Inbox is empty</KamiText>
                <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
                  No unlocked letters are ready to read. Check the Scheduled tab or seal a new letter today.
                </KamiText>
              </>
            )}
            {filterTab === 'scheduled' && (
              <>
                <KamiText variant="subtitle" align="center">No Scheduled Letters</KamiText>
                <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
                  No letters are currently locked. Write a time capsule to open on a special future date!
                </KamiText>
              </>
            )}
            {filterTab === 'drafts' && (
              <>
                <KamiText variant="subtitle" align="center">No Drafts</KamiText>
                <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
                  You don't have any letters in progress. Start writing and save it as a draft!
                </KamiText>
              </>
            )}
            {filterTab === 'favorites' && (
              <>
                <KamiText variant="subtitle" align="center">No Favorites</KamiText>
                <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
                  Mark letters with a star to pin your favorite memories here.
                </KamiText>
              </>
            )}
            {filterTab === 'archive' && (
              <>
                <KamiText variant="subtitle" align="center">No Archived Letters</KamiText>
                <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
                  Archive letters to clean up your main inbox while keeping them safe forever.
                </KamiText>
              </>
            )}
            <View style={[s.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
              <KamiText variant="label" color={colors.primary} bold>Write a letter ›</KamiText>
            </View>
          </TouchableOpacity>
        )}

        {sortedLetters.length > 0 && (
          <View style={{ gap: Space[3], marginTop: Space[2] }}>
            {paginatedLetters.map(l => (
              <LetterCard 
                key={l.id} 
                letter={l} 
                onOpen={() => handleOpen(l)} 
                onDelete={() => handleDelete(l)} 
                onToggleFavorite={handleToggleFavorite}
                activeSpace={activeSpace}
              />
            ))}
            {sortedLetters.length > visibleCount && (
              <TouchableOpacity
                style={[s.loadMoreBtn, { backgroundColor: colors.creamDeep }]}
                onPress={() => setVisibleCount(prev => prev + 10)}
                activeOpacity={0.8}
              >
                <KamiText variant="label" color={colors.primary} bold>Load More</KamiText>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <WriteModal
        visible={writeOpen}
        onClose={() => { setWriteOpen(false); setEditingDraft(null); }}
        onSave={handleSave}
        saving={saving}
        draftLetter={editingDraft}
        anniversaryDate={couple?.anniversaryDate}
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

const LetterCard: React.FC<{ 
  letter: Letter | CoupleLetter; 
  onOpen: () => void; 
  onDelete: () => void;
  onToggleFavorite?: (l: Letter | CoupleLetter) => void;
  activeSpace: 'personal' | 'couple';
}> = ({ letter, onOpen, onDelete, onToggleFavorite, activeSpace }) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;
  const user = useAuthStore(s => s.user);

  const coupleLetter = 'coupleId' in letter ? (letter as CoupleLetter) : null;
  const senderText = coupleLetter
    ? coupleLetter.senderId === user?.id
      ? 'From: You'
      : `From: ${coupleLetter.senderNickname || 'Partner'}`
    : null;

  const isUnlocked = checkUnlocked(letter);

  return (
    <TouchableOpacity activeOpacity={1} onPress={onOpen}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[
        s.envelopeCard,
        isUnlocked ? s.envelopeUnlocked : s.envelopeSealed,
        { transform: [{ scale: sc }] }
      ]}>
        {/* Envelope stamp/seal indicator on the left */}
        <View style={s.envelopeStampCol}>
          {isUnlocked ? (
            <View style={[s.openedLetterIcon, { backgroundColor: colors.primary + '11' }]}>
              <Text style={{ fontSize: 22 }}>📄</Text>
            </View>
          ) : (
            <View style={s.waxSealCircle}>
              <View style={s.waxSealInner}>
                <Text style={s.waxSealSymbol}>⚜️</Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.cardRow}>
            <KamiText variant="label" numberOfLines={1} style={[s.letterSubject, { color: '#4A3B32' }]} bold>{letter.subject}</KamiText>
            <View style={s.cardActions}>
              <TouchableOpacity onPress={() => onToggleFavorite?.(letter)} hitSlop={8} style={s.favBtn}>
                <Text style={{ fontSize: 16, color: letter.isFavorite ? colors.primary : '#cbd5e1' }}>
                  {letter.isFavorite ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.delBtn}>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          {senderText && (
            <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: -2, marginBottom: 2 }}>
              {senderText}
            </KamiText>
          )}
          
          <View style={s.letterMetaRow}>
            <Text style={{ fontSize: 11 }}>{isUnlocked ? '🔓' : '🔒'}</Text>
            <KamiText variant="caption" color={isUnlocked ? colors.primary : Colors.textMuted} bold={isUnlocked}>
              {daysUntil(letter.deliverAt)}
            </KamiText>
          </View>
          
          <KamiText variant="caption" color={Colors.textMuted}>
            Written {new Date(letter.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </KamiText>
          
          {isUnlocked && !letter.isRead && (
            <View style={[s.newBadge, { backgroundColor: colors.primary }]}>
              <KamiText variant="caption" color="#fff" bold style={{ fontSize: 8 }}>NEW</KamiText>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '33', backgroundColor: Colors.pageBg },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  writePlus:{ fontSize: FontSize.lg, color: Colors.primary, fontWeight: FontWeight.bold, lineHeight: 22 },
  
  // Segmented filter tabs
  filterScroll: { flexDirection: 'row', paddingHorizontal: Space[5], gap: Space[2], alignItems: 'center' },
  filterTab: { height: 36, paddingHorizontal: Space[4], borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border + '55', backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  filterTabActive: { borderWidth: 1.5 },

  scroll: { paddingHorizontal: Space[5], paddingTop: Space[2], gap: Space[4] },
  center: { paddingVertical: Space[10], alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn:   { marginTop: Space[4], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  envelopeCard: {
    flexDirection: 'row',
    gap: Space[4],
    borderRadius: 20,
    padding: Space[4],
    borderWidth: 1.5,
    ...Shadows.md,
    backgroundColor: '#FAF8F2', // warm scrapbook paper background
    elevation: 2,
  },
  envelopeSealed: {
    borderColor: 'rgba(201, 104, 130, 0.12)',
    borderStyle: 'dashed',
  },
  envelopeUnlocked: {
    borderColor: 'rgba(201, 104, 130, 0.22)',
    backgroundColor: '#FFFDF9', // open paper background
  },
  envelopeStampCol: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
  },
  openedLetterIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waxSealCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#991b1b', // crimson red wax
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#7f1d1d',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  waxSealInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#b91c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waxSealSymbol: {
    color: '#FCD34D', // gold seal symbol
    fontSize: 14,
    fontWeight: 'bold',
  },
  letterSubject: {
    fontSize: FontSize.sm + 1,
    fontFamily: FontFamily.display,
  },
  letterMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  favBtn:   { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border + '33' },
  delBtn:   { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border + '33' },
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
  newBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderRadius: Radii.sm,
    paddingHorizontal: Space[1] + 1,
    paddingVertical: 1,
  },
});
