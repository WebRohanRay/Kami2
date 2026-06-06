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
  Image, StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import KamiText from '@shared/ui/atoms/KamiText';
import KamiButton from '@shared/ui/atoms/KamiButton';
import { Colors, FontFamily, FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import { useAuthStore } from '@features/auth';
import type { MainTabScreenProps } from '@core/navigation/types';
import type { Letter } from '@features/home/types';
import * as futureService from '@infrastructure/home/futureService';
import { pickImages, uploadImages } from '@shared/lib/storage';
import { useTheme } from '@shared/hooks';

type Props = MainTabScreenProps<'Future'>;

const DELIVERY_OPTIONS = [
  { label: '1 month',  days: 30  },
  { label: '3 months', days: 90  },
  { label: '6 months', days: 180 },
  { label: '1 year',   days: 365 },
  { label: '2 years',  days: 730 },
  { label: '5 years',  days: 1825},
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

function daysUntil(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (d <= 0) return 'Ready to read ✨';
  if (d === 1) return 'Opens tomorrow';
  if (d < 30)  return `Opens in ${d} days`;
  if (d < 365) return `Opens in ${Math.floor(d / 30)} months`;
  return `Opens in ${Math.floor(d / 365)} year${Math.floor(d / 365) > 1 ? 's' : ''}`;
}

// ─── Write modal ──────────────────────────────────────────────────────────────
const WriteModal: React.FC<{
  visible: boolean; onClose: () => void;
  onSave: (subject: string, body: string, daysFromNow: number, imageUris: string[]) => Promise<void>; saving: boolean;
}> = ({ visible, onClose, onSave, saving }) => {
  const [subject,  setSubject]  = useState('');
  const [body,     setBody]     = useState('');
  const [delivery, setDelivery] = useState(DELIVERY_OPTIONS[2]);
  const [customMonth, setCustomMonth] = useState('');
  const [customDay, setCustomDay] = useState('');
  const [customYear, setCustomYear] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const { colors } = useTheme();

  const reset = () => {
    setSubject('');
    setBody('');
    setDelivery(DELIVERY_OPTIONS[2]);
    setCustomMonth('');
    setCustomDay('');
    setCustomYear('');
    setIsCustom(false);
    setLocalUris([]);
  };

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
    setDelivery({ label: 'Custom Date', days: 0 });
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
          <KamiText variant="overline" bold>Write a letter</KamiText>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={wm.content}>
          {/* Delivery time */}
          <KamiText variant="overline" style={wm.label}>Deliver in</KamiText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={wm.deliveryRow}>
              {DELIVERY_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.days}
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
            <Text style={{ fontSize: 20 }}>🔒</Text>
            <KamiText variant="body" color={colors.primary} bold>
              {delivery.days > 0 ? (
                `Unlocks on ${new Date(Date.now() + delivery.days * 86400000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
              ) : (
                'Please enter a valid number of days'
              )}
            </KamiText>
          </View>

          {/* Subject */}
          <KamiText variant="overline" style={wm.label}>Subject</KamiText>
          <TextInput style={[wm.input, { backgroundColor: colors.creamDeep }]} placeholder="To my future self…" placeholderTextColor={Colors.textMuted} value={subject} onChangeText={setSubject} maxLength={120} />

          {/* Body */}
          <KamiText variant="overline" style={wm.label}>Your letter *</KamiText>
          <TextInput
            style={[wm.bodyInput, { backgroundColor: colors.creamDeep }]} placeholder="Dear future me,&#10;&#10;I hope you're well. Right now I'm thinking about…"
            placeholderTextColor={Colors.textMuted} value={body} onChangeText={setBody}
            multiline autoFocus textAlignVertical="top" maxLength={5000}
          />
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

          {/* Submit Button */}
          <KamiButton
            label="Seal & Send Letter 🔒"
            loading={saving}
            disabled={!body.trim() || delivery.days <= 0}
            onPress={() => {
              if (!body.trim() || delivery.days <= 0) return;
              Keyboard.dismiss();
              onSave(subject.trim() || 'To my future self', body.trim(), delivery.days, localUris).then(reset);
            }}
            style={wm.submitBtn}
          />
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
  bodyInput:    { backgroundColor: Colors.creamDeep, borderRadius: Radii.card, paddingHorizontal: Space[4], paddingVertical: Space[3], fontSize: FontSize.base, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border, minHeight: 220, lineHeight: 24, fontFamily: FontFamily.display },
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
  letter: Letter | null;
  onClose: () => void;
}> = ({ visible, letter, onClose }) => {
  const [content, setContent] = useState<{ body: string; imageUrls: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    if (visible && letter) {
      setLoading(true);
      futureService.fetchLetter(letter.id).then(r => {
        setLoading(false);
        if (r.success) setContent(r.data);
        else Alert.alert('Kami', r.error);
      });
    } else {
      setContent(null);
    }
  }, [visible, letter]);

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[rm.root, { backgroundColor: colors.pageBg }]}>
        <View style={rm.toolbar}>
          <View />
          <KamiText variant="overline">Your letter</KamiText>
          <TouchableOpacity onPress={onClose} hitSlop={8}><KamiText variant="label" color={Colors.textMuted}>Close</KamiText></TouchableOpacity>
        </View>
        {loading && (
          <View style={rm.center}><ActivityIndicator color={colors.primary} /></View>
        )}
        {!loading && letter && content && (
          <ScrollView contentContainerStyle={rm.content}>
            <View style={[rm.envelope, { backgroundColor: colors.creamDeep }]}>
              <Text style={rm.envelopeEmoji}>💌</Text>
              <KamiText variant="overline" align="center" style={{ marginTop: Space[2] }}>
                Written {new Date(letter.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </KamiText>
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
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export function FutureScreen({ navigation }: Props) {
  const user = useAuthStore(s => s.user);
  const { colors } = useTheme();

  const [letters,    setLetters]    = useState<Letter[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [writeOpen,  setWriteOpen]  = useState(false);
  const [readOpen,   setReadOpen]   = useState(false);
  const [reading,    setReading]    = useState<Letter | null>(null);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { loadLetters(); }, []);

  async function loadLetters() {
    setLoading(true);
    const r = await futureService.fetchLetters();
    setLoading(false);
    if (!r.success) { Alert.alert('Kami', r.error); return; }
    setLetters(r.data);
  }

  const handleSave = async (subject: string, body: string, daysFromNow: number, localUris: string[] = []) => {
    if (!user?.id) return;
    setSaving(false);
    setSaving(true);
    try {
      const targetId = uuid();
      const deliverAt = new Date(Date.now() + daysFromNow * 86400000).toISOString();

      let relativePaths: string[] = [];
      if (localUris.length > 0) {
        const uploadRes = await uploadImages('letter_images', user.id, targetId, localUris);
        if (!uploadRes.success) {
          Alert.alert('Kami', uploadRes.error);
          setSaving(false);
          return;
        }
        relativePaths = uploadRes.paths;
      }

      const r = await futureService.createLetter(targetId, { subject, body, deliverAt, imageUrls: relativePaths });
      if (!r.success) { Alert.alert('Kami', r.error); }
      else {
        setLetters(prev => [...prev, r.data].sort((a, b) => new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime()));
        setWriteOpen(false);
      }
    } catch (e) {
      Alert.alert('Kami', 'Failed to seal your letter.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = (l: Letter) => {
    if (!l.isUnlocked) {
      Alert.alert('🔒 Sealed envelope', `This letter is locked and cannot be read until ${new Date(l.deliverAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.`);
      return;
    }
    setReading(l); setReadOpen(true);
  };

  const handleDelete = (l: Letter) => Alert.alert('Delete letter?', `"${l.subject}"`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      const r = await futureService.deleteLetter(l.id);
      if (!r.success) { Alert.alert('Kami', r.error); return; }
      setLetters(prev => prev.filter(x => x.id !== l.id));
    }},
  ]);

  const handleRefresh = async () => { setRefreshing(true); await loadLetters(); setRefreshing(false); };

  const unlocked = letters.filter(l => l.isUnlocked);
  const sealed   = letters.filter(l => !l.isUnlocked);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.pageBg }]}>
        <View>
          <KamiText variant="overline">Letters to yourself</KamiText>
          <KamiText variant="title">Future</KamiText>
        </View>
        <TouchableOpacity style={[s.writeBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => setWriteOpen(true)}>
          <Text style={[s.writePlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>Write</KamiText>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {loading && letters.length === 0 && (
          <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        )}

        {!loading && letters.length === 0 && (
          <TouchableOpacity style={s.emptyState} onPress={() => setWriteOpen(true)} activeOpacity={0.85}>
            <Text style={{ fontSize: 56, marginBottom: Space[3] }}>💌</Text>
            <KamiText variant="subtitle" align="center">Write to your future self</KamiText>
            <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
              Seal a letter. Open it months from now and see how much you've grown.
            </KamiText>
            <View style={[s.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
              <KamiText variant="label" color={colors.primary} bold>Write your first letter ›</KamiText>
            </View>
          </TouchableOpacity>
        )}

        {/* Unlocked */}
        {unlocked.length > 0 && (
          <View style={{ gap: Space[3] }}>
            <View style={s.sectionHeader}>
              <Text style={{ fontSize: 18 }}>✨</Text>
              <KamiText variant="overline" style={{ color: colors.primary }}>Ready to read · {unlocked.length}</KamiText>
            </View>
            {unlocked.map(l => <LetterCard key={l.id} letter={l} onOpen={() => handleOpen(l)} onDelete={() => handleDelete(l)} />)}
          </View>
        )}

        {/* Sealed */}
        {sealed.length > 0 && (
          <View style={{ gap: Space[3] }}>
            <View style={s.sectionHeader}>
              <Text style={{ fontSize: 18 }}>🔒</Text>
              <KamiText variant="overline">Sealed · {sealed.length}</KamiText>
            </View>
            {sealed.map(l => <LetterCard key={l.id} letter={l} onOpen={() => handleOpen(l)} onDelete={() => handleDelete(l)} />)}
          </View>
        )}

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <WriteModal visible={writeOpen} onClose={() => setWriteOpen(false)} onSave={handleSave} saving={saving} />
      <ReadModal visible={readOpen} letter={reading} onClose={() => { setReadOpen(false); setReading(null); }} />
    </SafeAreaView>
  );
}

const LetterCard: React.FC<{ letter: Letter; onOpen: () => void; onDelete: () => void }> = ({ letter, onOpen, onDelete }) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity activeOpacity={1} onPress={onOpen}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[s.card, letter.isUnlocked && [s.cardOpen, { borderColor: colors.primary + '55', backgroundColor: colors.creamDeep }], { transform: [{ scale: sc }] }]}>
        <View style={s.cardLeft}>
          <Text style={{ fontSize: 30 }}>{letter.isUnlocked ? '💌' : '🔒'}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.cardRow}>
            <KamiText variant="label" numberOfLines={1} style={{ flex: 1 }}>{letter.subject}</KamiText>
            <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.delBtn}>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          </View>
          <KamiText variant="caption" color={letter.isUnlocked ? colors.primary : Colors.textMuted} bold={letter.isUnlocked}>
            {daysUntil(letter.deliverAt)}
          </KamiText>
          <KamiText variant="caption" color={Colors.textMuted}>
            Written {new Date(letter.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </KamiText>
          {letter.isUnlocked && (
            <KamiText variant="caption" color={colors.primary} bold>Tap to read ›</KamiText>
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
  scroll: { paddingHorizontal: Space[5], paddingTop: Space[4], gap: Space[4] },
  center: { paddingVertical: Space[10], alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn:   { marginTop: Space[4], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  card:     { flexDirection: 'row', gap: Space[3], backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], borderWidth: 1, borderColor: Colors.border + '44', ...Shadows.sm },
  cardOpen: { borderColor: Colors.primary + '55', backgroundColor: Colors.rose100 },
  cardLeft: { alignItems: 'center', justifyContent: 'flex-start', width: 44, paddingTop: Space[1] },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  delBtn:   { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.creamDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
});
