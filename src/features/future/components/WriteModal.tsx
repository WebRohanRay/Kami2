import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  StatusBar as RNStatusBar,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { FontSize, FontWeight, Radii, Space, Opacity } from '@shared/constants';
import { useAuthStore } from '@features/auth';
import { useTheme } from '@shared/hooks';
import { ImageZoomModal } from '@shared/ui';
import { pickImages, pickAndCropImage } from '@shared/lib/storage';
import { futureLetterSchema } from '@shared/lib/validation/schemas';
import type { Letter } from '@features/home/types';
import type { CoupleLetter } from '@features/couple/types';

interface WriteModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (
    subject: string,
    body: string,
    deliverAt: string,
    imageUris: string[],
    isDraft?: boolean,
    updateId?: string
  ) => Promise<void>;
  saving: boolean;
  draftLetter?: Letter | CoupleLetter | null;
  replyToLetter?: Letter | CoupleLetter | null;
  activeSpace?: 'personal' | 'couple';
}

export const WriteModal: React.FC<WriteModalProps> = ({
  visible,
  onClose,
  onSave,
  saving,
  draftLetter,
  replyToLetter,
  activeSpace,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [deliveryType, setDeliveryType] = useState<'instant' | 'scheduled'>('instant');
  const [customDay, setCustomDay] = useState('');
  const [customMonth, setCustomMonth] = useState('');
  const [customYear, setCustomYear] = useState('');
  const [customHour, setCustomHour] = useState('12');
  const [customMin, setCustomMin] = useState('00');
  const [customAmPm, setCustomAmPm] = useState('PM');
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const { colors } = useTheme();
  const wm = React.useMemo(() => getStyles(colors), [colors]);
  const timezone = useAuthStore(s => s.user?.timezone);

  const reset = () => {
    setSubject('');
    setBody('');
    setDeliveryType('instant');
    setCustomDay('');
    setCustomMonth('');
    setCustomYear('');
    setCustomHour('12');
    setCustomMin('00');
    setCustomAmPm('PM');
    setLocalUris([]);
  };

  useEffect(() => {
    if (visible) {
      if (draftLetter) {
        setSubject(draftLetter.subject ?? '');
        setBody(draftLetter.body ?? '');
        setLocalUris(draftLetter.imageUrls ?? []);

        const deliverDate = new Date(draftLetter.deliverAt);
        if (deliverDate.getFullYear() <= 1970) {
          setDeliveryType('instant');
        } else {
          setDeliveryType('scheduled');
          setCustomDay(deliverDate.getDate().toString());
          setCustomMonth((deliverDate.getMonth() + 1).toString());
          setCustomYear(deliverDate.getFullYear().toString());

          let h = deliverDate.getHours();
          const isPm = h >= 12;
          if (h > 12) h -= 12;
          if (h === 0) h = 12;
          setCustomHour(h.toString());
          setCustomMin(deliverDate.getMinutes().toString().padStart(2, '0'));
          setCustomAmPm(isPm ? 'PM' : 'AM');
        }
      } else if (replyToLetter) {
        reset();
        setSubject(`Re: ${replyToLetter.subject}`);
        setDeliveryType('instant');
      } else {
        reset();
      }
    }
  }, [visible, draftLetter, replyToLetter]);

  const getDeliverAtString = () => {
    if (deliveryType === 'instant') {
      return '1970-01-01T00:00:00.000Z'; // backdated to deliver instantly
    }
    const d = parseInt(customDay, 10);
    const m = parseInt(customMonth, 10);
    const y = parseInt(customYear, 10);
    let h = parseInt(customHour, 10) || 12;
    const min = parseInt(customMin, 10) || 0;

    if (customAmPm === 'PM' && h < 12) h += 12;
    if (customAmPm === 'AM' && h === 12) h = 0;

    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      try {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const dateStr = `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00`;
        const dateUTC = new Date(`${dateStr}Z`);
        const localTime = new Date(dateUTC.toLocaleString('en-US', { timeZone: timezone || 'UTC' }));
        const diff = dateUTC.getTime() - localTime.getTime();
        return new Date(dateUTC.getTime() + diff).toISOString();
      } catch (e) {
        const date = new Date(y, m - 1, d, h, min, 0);
        return date.toISOString();
      }
    }
    return '';
  };

  const handlePickPhotos = async () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to select your photos:',
      [
        {
          text: 'Select Multiple (No Crop)',
          onPress: async () => {
            setPicking(true);
            const r = await pickImages(true);
            setPicking(false);
            if (r.success) {
              setLocalUris(prev => [...prev, ...r.uris]);
            } else if (!r.cancelled) {
              Alert.alert('Kami', r.error);
            }
          },
        },
        {
          text: 'Select & Crop Photo',
          onPress: async () => {
            setPicking(true);
            const r = await pickAndCropImage();
            setPicking(false);
            if (r.success) {
              setLocalUris(prev => [...prev, ...r.uris]);
            } else if (!r.cancelled) {
              Alert.alert('Kami', r.error);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleRemovePhoto = (index: number) => {
    setLocalUris(prev => prev.filter((_, i) => i !== index));
  };

  const deliverAtVal = getDeliverAtString();
  const isValidDate = deliveryType === 'instant' || !!deliverAtVal;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <SafeAreaView style={[wm.root, { backgroundColor: colors.pageBg }]}>
        <View style={wm.toolbar}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <KamiText variant="label" color={colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline" bold>{draftLetter ? 'Edit Draft' : replyToLetter ? 'Reply Thread' : 'Write a letter'}</KamiText>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={wm.content}>
          {replyToLetter && (
            <View style={[wm.replyLabelBox, { backgroundColor: colors.primary + '0f', borderColor: colors.primary + '22' }]}>
              <KamiText variant="caption" color={colors.primary} bold>Replying to Partner's Letter:</KamiText>
              <KamiText variant="body" numberOfLines={2} style={{ fontSize: FontSize.sm, fontStyle: 'italic' }}>
                "{replyToLetter.subject}"
              </KamiText>
            </View>
          )}

          {/* Delivery selection */}
          <KamiText variant="overline" style={wm.label}>Delivery Schedule</KamiText>
          <View style={wm.deliveryToggleRow}>
            <TouchableOpacity
              style={[wm.deliveryToggleBtn, deliveryType === 'instant' && [wm.deliveryToggleBtnOn, { backgroundColor: colors.primary }]]}
              onPress={() => setDeliveryType('instant')}
            >
              <KamiText variant="caption" color={deliveryType === 'instant' ? colors.textOnPrimary : colors.textMuted} bold={deliveryType === 'instant'}>Instant ✉️</KamiText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[wm.deliveryToggleBtn, deliveryType === 'scheduled' && [wm.deliveryToggleBtnOn, { backgroundColor: colors.primary }]]}
              onPress={() => setDeliveryType('scheduled')}
            >
              <KamiText variant="caption" color={deliveryType === 'scheduled' ? colors.textOnPrimary : colors.textMuted} bold={deliveryType === 'scheduled'}>Schedule 🔒</KamiText>
            </TouchableOpacity>
          </View>

          {deliveryType === 'scheduled' && (
            <View style={wm.schedulerContainer}>
              <KamiText variant="caption" color={colors.textMuted} style={{ marginBottom: Space[1] }}>Unlock Date (DD / MM / YYYY)</KamiText>
              <View style={wm.customDateRow}>
                <TextInput
                  style={[wm.customInput, { flex: 1.5, backgroundColor: colors.creamDeep }]}
                  placeholder="DD"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={customDay}
                  onChangeText={setCustomDay}
                />
                <KamiText variant="body" color={colors.textMuted}>/</KamiText>
                <TextInput
                  style={[wm.customInput, { flex: 1.5, backgroundColor: colors.creamDeep }]}
                  placeholder="MM"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={customMonth}
                  onChangeText={setCustomMonth}
                />
                <KamiText variant="body" color={colors.textMuted}>/</KamiText>
                <TextInput
                  style={[wm.customInput, { flex: 2.5, backgroundColor: colors.creamDeep }]}
                  placeholder="YYYY"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={customYear}
                  onChangeText={setCustomYear}
                />
              </View>

              <KamiText variant="caption" color={colors.textMuted} style={{ marginTop: Space[2], marginBottom: Space[1] }}>Unlock Time</KamiText>
              <View style={wm.customDateRow}>
                <TextInput
                  style={[wm.customInput, { flex: 2, backgroundColor: colors.creamDeep }]}
                  placeholder="HH"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={customHour}
                  onChangeText={setCustomHour}
                />
                <KamiText variant="body" color={colors.textMuted}>:</KamiText>
                <TextInput
                  style={[wm.customInput, { flex: 2, backgroundColor: colors.creamDeep }]}
                  placeholder="MM"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={customMin}
                  onChangeText={setCustomMin}
                />
                <TouchableOpacity
                  style={[wm.customInput, { flex: 2.5, backgroundColor: colors.creamDeep, justifyContent: 'center' }]}
                  onPress={() => setCustomAmPm(prev => prev === 'AM' ? 'PM' : 'AM')}
                >
                  <KamiText variant="body" align="center" bold>{customAmPm}</KamiText>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Unlock Preview timestamp */}
          <View style={[wm.unlockDate, { backgroundColor: colors.creamDeep }]}>
            <Text style={{ fontSize: 20 }}>{deliveryType === 'instant' ? '✉️' : '🔒'}</Text>
            <KamiText variant="body" color={colors.primary} bold style={{ flex: 1 }}>
              {deliveryType === 'instant' ? (
                'Delivers immediately'
              ) : deliverAtVal ? (
                `Unlocks on ${new Date(deliverAtVal).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone || 'UTC' })}`
              ) : (
                'Please enter a valid future date and time'
              )}
            </KamiText>
          </View>

          {/* Subject */}
          <KamiText variant="overline" style={wm.label}>Subject</KamiText>
          <TextInput style={[wm.input, { backgroundColor: '#FAF8F5', borderColor: '#E5DEC9' }]} placeholder="Subject..." placeholderTextColor={colors.textMuted} value={subject} onChangeText={setSubject} maxLength={120} />

          {/* Body */}
          <KamiText variant="overline" style={wm.label}>Your letter *</KamiText>
          <View style={wm.paperWrapper}>
            <TextInput
              style={[wm.bodyInput, { backgroundColor: '#FFFDF6', color: '#4A3B32', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }]}
              placeholder="Dear partner,&#10;&#10;I want to tell you that…"
              placeholderTextColor={colors.textMuted}
              value={body}
              onChangeText={setBody}
              multiline
              autoFocus={!draftLetter}
              textAlignVertical="top"
              maxLength={5000}
            />
          </View>
          <KamiText variant="caption" color={colors.textMuted} align="right">{body.length} / 5000</KamiText>

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
                    <TouchableOpacity onPress={() => setZoomImageUri(uri)} activeOpacity={0.9}>
                      <Image source={{ uri }} style={wm.attachedImage} />
                    </TouchableOpacity>
                    <TouchableOpacity style={wm.removePhotoBadge} onPress={() => handleRemovePhoto(idx)}>
                      <Text style={{ color: '#fff', fontSize: 10 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: Space[2], marginTop: Space[6] }}>
            <TouchableOpacity
              style={[{ borderColor: colors.primary, backgroundColor: colors.cardBg, flex: 1, height: 50, borderRadius: Radii.button, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }]}
              disabled={saving}
              onPress={() => {
                const validation = futureLetterSchema.safeParse({ subject, body, deliverAt: deliverAtVal });
                if (!validation.success) {
                  Alert.alert('Kami', validation.error.issues[0].message);
                  return;
                }
                Keyboard.dismiss();
                onSave(subject.trim(), body.trim(), deliverAtVal, localUris, true, draftLetter?.id).then(reset);
              }}
            >
              <KamiText variant="label" color={colors.primary} bold>Save Draft 📝</KamiText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[{ backgroundColor: colors.primary, flex: 1.5, height: 50, borderRadius: Radii.button, alignItems: 'center', justifyContent: 'center' }]}
              disabled={saving}
              onPress={() => {
                const validation = futureLetterSchema.safeParse({ subject, body, deliverAt: deliverAtVal });
                if (!validation.success) {
                  Alert.alert('Kami', validation.error.issues[0].message);
                  return;
                }
                Keyboard.dismiss();
                onSave(subject.trim(), body.trim(), deliverAtVal, localUris, false, draftLetter?.id).then(reset);
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <KamiText variant="label" color={colors.textOnPrimary} bold>
                  {deliveryType === 'instant' ? 'Send Now ✉️' : 'Seal & Send 🔒'}
                </KamiText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
        <ImageZoomModal visible={zoomImageUri !== null} imageUri={zoomImageUri} onClose={() => setZoomImageUri(null)} />
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: colors.border + '44' },
  content: { padding: Space[5], gap: Space[3], paddingBottom: Space[10] },
  label: { marginBottom: Space[1] },
  replyLabelBox: { padding: Space[3], borderRadius: Radii.md, borderWidth: 1, gap: 2, marginBottom: Space[2] },
  deliveryToggleRow: { flexDirection: 'row', gap: Space[2], marginVertical: Space[1] },
  deliveryToggleBtn: { flex: 1, height: 40, borderRadius: Radii.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.creamDeep, justifyContent: 'center', alignItems: 'center' },
  deliveryToggleBtnOn: { borderWidth: 0 },
  schedulerContainer: { gap: Space[1], marginVertical: Space[1] },
  customDateRow: { flexDirection: 'row', alignItems: 'center', gap: Space[2], marginTop: Space[1], marginBottom: Space[2] },
  customInput: { backgroundColor: colors.creamDeep, borderRadius: Radii.input, paddingHorizontal: Space[4], paddingVertical: Space[3], fontSize: FontSize.base, color: colors.textPrimary, borderWidth: 1.5, borderColor: colors.border, textAlign: 'center' },
  unlockDate: { flexDirection: 'row', alignItems: 'center', gap: Space[2], backgroundColor: colors.creamDeep, borderRadius: Radii.card, padding: Space[3], marginVertical: Space[1] },
  input: { backgroundColor: colors.creamDeep, borderRadius: Radii.input, paddingHorizontal: Space[4], paddingVertical: Space[3], fontSize: FontSize.base, color: colors.textPrimary, borderWidth: 1.5, borderColor: colors.border },
  bodyInput: { paddingHorizontal: Space[4], paddingLeft: Space[6], paddingVertical: Space[3], fontSize: FontSize.base, color: '#4A3B32', minHeight: 220, lineHeight: 28, fontStyle: 'italic', borderLeftWidth: 1.5, borderLeftColor: '#fca5a5' },
  paperWrapper: { position: 'relative', borderRadius: Radii.card, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space[4], borderTopWidth: 1, borderTopColor: colors.border + '22', paddingTop: Space[3] },
  addPhotoBtn: { paddingVertical: Space[1], paddingHorizontal: Space[2] },
  photoScroll: { marginHorizontal: -Space[5], paddingHorizontal: Space[5], marginVertical: Space[2] },
  photoRow: { flexDirection: 'row', gap: Space[3] },
  photoWrap: { position: 'relative' },
  attachedImage: { width: 90, height: 90, borderRadius: Radii.sm, resizeMode: 'contain', backgroundColor: 'rgba(0,0,0,0.03)' },
  removePhotoBadge: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBg },
});
