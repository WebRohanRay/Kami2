/**
 * FutureScreen.tsx
 *
 * Letters to your future self and partner.
 * Seal and lock letters with text and photo attachments.
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

function checkUnlocked(l: Letter | CoupleLetter) {
  return Date.now() >= new Date(l.deliverAt).getTime();
}

function formatTimestamp(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (d.getFullYear() <= 1970) return 'Delivered instantly';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) + ' • ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(deliverAtIso: string): string {
  const diffMs = new Date(deliverAtIso).getTime() - Date.now();
  if (diffMs <= 0) return 'Unlocked';

  const totalSecs = Math.floor(diffMs / 1000);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const totalHours = Math.floor(totalMins / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);

  let days = totalDays;
  let months = 0;
  let years = 0;

  if (days >= 365) {
    years = Math.floor(days / 365);
    days = days % 365;
  }
  if (days >= 30) {
    months = Math.floor(days / 30);
    days = days % 30;
  }

  if (years > 0) {
    const yStr = `${years} Year${years > 1 ? 's' : ''}`;
    const mStr = months > 0 ? ` ${months} Month${months > 1 ? 's' : ''}` : '';
    return `Unlocks in ${yStr}${mStr}`;
  }
  if (months > 0) {
    const mStr = `${months} Month${months > 1 ? 's' : ''}`;
    const dStr = days > 0 ? ` ${days} Day${days > 1 ? 's' : ''}` : '';
    return `Unlocks in ${mStr}${dStr}`;
  }
  if (days > 0) {
    const dStr = `${days} Day${days > 1 ? 's' : ''}`;
    const hStr = hours > 0 ? ` ${hours} Hour${hours > 1 ? 's' : ''}` : '';
    const minStr = mins > 0 ? ` ${mins} Minute${mins > 1 ? 's' : ''}` : '';
    return `Unlocks in ${dStr}${hStr}${minStr}`;
  }
  if (hours > 0) {
    const hStr = `${hours} Hour${hours > 1 ? 's' : ''}`;
    const minStr = mins > 0 ? ` ${mins} Minute${mins > 1 ? 's' : ''}` : '';
    const sStr = secs > 0 ? ` ${secs} Second${secs > 1 ? 's' : ''}` : '';
    return `Unlocks in ${hStr}${minStr}${sStr}`;
  }
  if (mins > 0) {
    const minStr = `${mins} Minute${mins > 1 ? 's' : ''}`;
    const sStr = secs > 0 ? ` ${secs} Second${secs > 1 ? 's' : ''}` : '';
    return `Unlocks in ${minStr}${sStr}`;
  }
  return `Unlocks in ${secs} Second${secs !== 1 ? 's' : ''}`;
}

// ─── Write modal ──────────────────────────────────────────────────────────────
const WriteModal: React.FC<{
  visible: boolean; 
  onClose: () => void;
  onSave: (subject: string, body: string, deliverAt: string, imageUris: string[], isDraft?: boolean, updateId?: string) => Promise<void>; 
  saving: boolean;
  draftLetter?: Letter | CoupleLetter | null;
  replyToLetter?: Letter | CoupleLetter | null;
  activeSpace?: 'personal' | 'couple';
}> = ({ visible, onClose, onSave, saving, draftLetter, replyToLetter, activeSpace }) => {
  const [subject,  setSubject]  = useState('');
  const [body,     setBody]     = useState('');
  const [deliveryType, setDeliveryType] = useState<'instant' | 'scheduled'>('instant');
  const [customDay, setCustomDay] = useState('');
  const [customMonth, setCustomMonth] = useState('');
  const [customYear, setCustomYear] = useState('');
  const [customHour, setCustomHour] = useState('12');
  const [customMin, setCustomMin] = useState('00');
  const [customAmPm, setCustomAmPm] = useState('PM');
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const { colors } = useTheme();

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
      const date = new Date(y, m - 1, d, h, min, 0);
      return date.toISOString();
    }
    return '';
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

  const deliverAtVal = getDeliverAtString();
  const isValidDate = deliveryType === 'instant' || !!deliverAtVal;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <SafeAreaView style={[wm.root, { backgroundColor: colors.pageBg }]}>
        <View style={wm.toolbar}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
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
              <KamiText variant="caption" color={deliveryType === 'instant' ? '#fff' : Colors.textMuted} bold={deliveryType === 'instant'}>Instant ✉️</KamiText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[wm.deliveryToggleBtn, deliveryType === 'scheduled' && [wm.deliveryToggleBtnOn, { backgroundColor: colors.primary }]]}
              onPress={() => setDeliveryType('scheduled')}
            >
              <KamiText variant="caption" color={deliveryType === 'scheduled' ? '#fff' : Colors.textMuted} bold={deliveryType === 'scheduled'}>Schedule 🔒</KamiText>
            </TouchableOpacity>
          </View>

          {deliveryType === 'scheduled' && (
            <View style={wm.schedulerContainer}>
              <KamiText variant="caption" color={Colors.textMuted} style={{ marginBottom: Space[1] }}>Unlock Date (DD / MM / YYYY)</KamiText>
              <View style={wm.customDateRow}>
                <TextInput
                  style={[wm.customInput, { flex: 1.5, backgroundColor: colors.creamDeep }]}
                  placeholder="DD"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={customDay}
                  onChangeText={setCustomDay}
                />
                <KamiText variant="body" color={Colors.textMuted}>/</KamiText>
                <TextInput
                  style={[wm.customInput, { flex: 1.5, backgroundColor: colors.creamDeep }]}
                  placeholder="MM"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={customMonth}
                  onChangeText={setCustomMonth}
                />
                <KamiText variant="body" color={Colors.textMuted}>/</KamiText>
                <TextInput
                  style={[wm.customInput, { flex: 2.5, backgroundColor: colors.creamDeep }]}
                  placeholder="YYYY"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={customYear}
                  onChangeText={setCustomYear}
                />
              </View>

              <KamiText variant="caption" color={Colors.textMuted} style={{ marginTop: Space[2], marginBottom: Space[1] }}>Unlock Time</KamiText>
              <View style={wm.customDateRow}>
                <TextInput
                  style={[wm.customInput, { flex: 2, backgroundColor: colors.creamDeep }]}
                  placeholder="HH"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={customHour}
                  onChangeText={setCustomHour}
                />
                <KamiText variant="body" color={Colors.textMuted}>:</KamiText>
                <TextInput
                  style={[wm.customInput, { flex: 2, backgroundColor: colors.creamDeep }]}
                  placeholder="MM"
                  placeholderTextColor={Colors.textMuted}
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
                `Unlocks on ${new Date(deliverAtVal).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              ) : (
                'Please enter a valid future date and time'
              )}
            </KamiText>
          </View>

          {/* Subject */}
          <KamiText variant="overline" style={wm.label}>Subject</KamiText>
          <TextInput style={[wm.input, { backgroundColor: '#FAF8F5', borderColor: '#E5DEC9' }]} placeholder="Subject..." placeholderTextColor={Colors.textMuted} value={subject} onChangeText={setSubject} maxLength={120} />

          {/* Body */}
          <KamiText variant="overline" style={wm.label}>Your letter *</KamiText>
          <View style={wm.paperWrapper}>
            <TextInput
              style={[wm.bodyInput, { backgroundColor: '#FFFDF6', color: '#4A3B32', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }]} 
              placeholder="Dear partner,&#10;&#10;I want to tell you that…"
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

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: Space[2], marginTop: Space[6] }}>
            <TouchableOpacity
              style={[{ borderColor: colors.primary, backgroundColor: '#fff', flex: 1, height: 50, borderRadius: Radii.button, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }]}
              disabled={saving || !body.trim()}
              onPress={() => {
                if (!body.trim()) return;
                Keyboard.dismiss();
                onSave(subject.trim(), body.trim(), deliverAtVal, localUris, true, draftLetter?.id).then(reset);
              }}
            >
              <KamiText variant="label" color={colors.primary} bold>Save Draft 📝</KamiText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[{ backgroundColor: colors.primary, flex: 1.5, height: 50, borderRadius: Radii.button, alignItems: 'center', justifyContent: 'center' }]}
              disabled={!body.trim() || !isValidDate || saving}
              onPress={() => {
                if (!body.trim() || !isValidDate) return;
                Keyboard.dismiss();
                onSave(subject.trim(), body.trim(), deliverAtVal, localUris, false, draftLetter?.id).then(reset);
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <KamiText variant="label" color="#fff" bold>
                  {deliveryType === 'instant' ? "Send Now ✉️" : "Seal & Send 🔒"}
                </KamiText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

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
  const [countdownText, setCountdownText] = useState('');
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);

  const isUnlocked = letter ? checkUnlocked(letter) : false;

  useEffect(() => {
    if (!visible || !letter) {
      setContent(null);
      return;
    }

    if (isUnlocked) {
      // Already unlocked, fetch details
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
      // Locked: start local countdown ticking
      const updateCountdown = () => {
        const hasUnlocked = checkUnlocked(letter);
        if (hasUnlocked) {
          clearInterval(interval);
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
          setCountdownText(formatCountdown(letter.deliverAt));
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [visible, letter, isUnlocked]);

  if (!letter) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[rm.root, { backgroundColor: colors.pageBg }]}>
        <View style={rm.toolbar}>
          <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'center' }}>
            <TouchableOpacity onPress={() => onToggleFavorite?.(letter)} style={rm.favToggleBtn} hitSlop={8}>
              <KamiText variant="label" color={letter.isFavorite ? colors.primary : Colors.textMuted} bold={!!letter.isFavorite}>
                {letter.isFavorite ? '★ Favorited' : '☆ Favorite'}
              </KamiText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onToggleArchive?.(letter)} style={rm.favToggleBtn} hitSlop={8}>
              <KamiText variant="label" color={letter.isArchived ? colors.primary : Colors.textMuted} bold={!!letter.isArchived}>
                {letter.isArchived ? '📦 Archived' : '📥 Archive'}
              </KamiText>
            </TouchableOpacity>
          </View>
          <KamiText variant="overline">Letter Preview</KamiText>
          <TouchableOpacity onPress={onClose} hitSlop={8}><KamiText variant="label" color={Colors.textMuted}>Close</KamiText></TouchableOpacity>
        </View>

        {!isUnlocked && !content ? (
          /* Locked Letter Preview Layout */
          <ScrollView contentContainerStyle={[rm.content, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
            <View style={rm.lockedCenterContainer}>
              <View style={rm.lockedWaxSeal}>
                <Text style={{ fontSize: 44 }}>🔒</Text>
              </View>
              <KamiText variant="title" bold style={{ marginTop: Space[4], color: '#4A3B32' }}>{letter.subject}</KamiText>
              <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[1] }}>
                {'senderNickname' in letter ? `From: ${letter.senderNickname}` : 'For yourself'}
              </KamiText>

              <View style={[rm.lockedCountdownBox, { backgroundColor: colors.primary + '0a', borderColor: colors.primary + '18' }]}>
                <KamiText variant="overline" color={colors.primary} bold>TIME CAPSULE LOCKED</KamiText>
                <KamiText variant="title" bold color={colors.primary} style={rm.lockedCountdownTick}>
                  {countdownText || 'Calculating...'}
                </KamiText>
              </View>

              {/* Metadata Details list */}
              <View style={rm.metadataBox}>
                <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                  Created: {formatTimestamp(letter.createdAt)}
                </KamiText>
                <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                  Scheduled Unlock: {formatTimestamp(letter.deliverAt)}
                </KamiText>
                {'deliveredAt' in letter && letter.deliveredAt && (
                  <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                    Delivered: {formatTimestamp(letter.deliveredAt)}
                  </KamiText>
                )}
              </View>
            </View>
          </ScrollView>
        ) : (
          /* Unlocked Letter Full View */
          <View style={{ flex: 1 }}>
            {loading ? (
              <View style={rm.center}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              content && (
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

                  {/* Metadata display */}
                  <View style={[rm.metadataBox, { marginTop: Space[5], borderTopWidth: 1, borderTopColor: Colors.border + '22', paddingTop: Space[3] }]}>
                    <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                      Created: {formatTimestamp(letter.createdAt)}
                    </KamiText>
                    {new Date(letter.deliverAt).getFullYear() > 1970 && (
                      <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                        Scheduled Unlock: {formatTimestamp(letter.deliverAt)}
                      </KamiText>
                    )}
                    {'deliveredAt' in letter && letter.deliveredAt && (
                      <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                        Delivered: {formatTimestamp(letter.deliveredAt)}
                      </KamiText>
                    )}
                    {'readAt' in letter && letter.readAt && (
                      <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                        Read: {formatTimestamp(letter.readAt)}
                      </KamiText>
                    )}
                    {'updatedAt' in letter && letter.updatedAt && (
                      <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                        Last Updated: {formatTimestamp(letter.updatedAt)}
                      </KamiText>
                    )}
                  </View>
                </ScrollView>
              )
            )}

            {activeSpace === 'couple' && (
              <View style={[rm.reactionBar, { borderTopColor: Colors.border + '33', backgroundColor: colors.creamDeep }]}>
                {['❤️', '🥹', '🥰', '😭', '🔥'].map(emoji => {
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

// ─── Screen ───────────────────────────────────────────────────────────────────
export function FutureScreen({ navigation }: Props) {
  const user = useAuthStore(s => s.user);
  const activeSpace = user?.activeSpace ?? 'personal';
  const coupleStore = useCoupleStore();
  const coupleActions = useCouple();
  const couple = coupleStore.couple;
  const partner = coupleStore.partner;
  const partnerName = partner?.nickname || 'Partner';

  const { colors } = useTheme();

  const [letters,    setLetters]    = useState<Letter[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [writeOpen,  setWriteOpen]  = useState(false);
  const [readOpen,   setReadOpen]   = useState(false);
  const [reading,    setReading]    = useState<Letter | CoupleLetter | null>(null);
  const [replyTo,    setReplyTo]    = useState<Letter | CoupleLetter | null>(null);
  const [saving,     setSaving]     = useState(false);

  const [visibleCount, setVisibleCount] = useState(10);
  const [filterTab,    setFilterTab]    = useState<'inbox' | 'scheduled' | 'drafts' | 'favorites' | 'archive'>('inbox');
  const [editingDraft, setEditingDraft] = useState<Letter | CoupleLetter | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setVisibleCount(10);
  }, [activeSpace, filterTab]);

  // Tick interval running every 1 second to update counts and states dynamically
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
            setReplyTo(null);
          }
        } else {
          const r = await coupleActions.addLetter(couple.id, finalSubject, body, deliverAt, finalImageUrls, isDraft, replyTo?.id);
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

  // Filter letters list
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

  // Group thread replies for nested display
  const rootLetters = sortedLetters.filter(l => !('parentLetterId' in l && (l as any).parentLetterId));
  const orphanReplies = sortedLetters.filter(l => 'parentLetterId' in l && (l as any).parentLetterId && !sortedLetters.some(r => r.id === (l as any).parentLetterId));
  const displayRoots = [...rootLetters, ...orphanReplies].slice(0, visibleCount);

  const repliesMap = sortedLetters.reduce((acc, l) => {
    const parentId = 'parentLetterId' in l ? (l as any).parentLetterId : null;
    if (parentId) {
      if (!acc[parentId]) acc[parentId] = [];
      acc[parentId].push(l);
    }
    return acc;
  }, {} as Record<string, typeof sortedLetters>);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.pageBg }]}>
        <View style={{ flex: 1 }}>
          <KamiText variant="overline">{activeSpace === 'couple' ? 'Sealed capsules' : 'Letters to yourself'}</KamiText>
          <KamiText variant="title">{activeSpace === 'couple' ? 'Love Letters' : 'Future'}</KamiText>
        </View>
        <TouchableOpacity style={[s.writeBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]} onPress={() => { setReplyTo(null); setWriteOpen(true); }}>
          <Text style={[s.writePlus, { color: colors.primary }]}>+</Text>
          <KamiText variant="label" color={colors.primary} bold>Write</KamiText>
        </TouchableOpacity>
      </View>

      {/* Segmented filter */}
      <View style={{ height: 48, marginBottom: Space[2] }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
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
              <KamiText variant="caption" color={filterTab === tab ? '#fff' : Colors.textMuted} bold={filterTab === tab} style={{ textTransform: 'capitalize' }}>
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
        {((loading && activeSpace === 'personal') || (coupleStore.lettersLoading === 'loading' && activeSpace === 'couple')) && sortedLetters.length === 0 && (
          <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        )}

        {((!loading && activeSpace === 'personal') || (coupleStore.lettersLoading !== 'loading' && activeSpace === 'couple')) && sortedLetters.length === 0 && (
          <TouchableOpacity style={s.emptyState} onPress={() => { setReplyTo(null); setWriteOpen(true); }} activeOpacity={0.85}>
            <Text style={{ fontSize: 56, marginBottom: Space[3] }}>💌</Text>
            <KamiText variant="subtitle" align="center">Your Box is empty</KamiText>
            <KamiText variant="body" color={Colors.textMuted} align="center" style={{ marginTop: Space[2] }}>
              No letters found under this filter. Tap below to seal a new letter today.
            </KamiText>
            <View style={[s.emptyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
              <KamiText variant="label" color={colors.primary} bold>Write a letter ›</KamiText>
            </View>
          </TouchableOpacity>
        )}

        {sortedLetters.length > 0 && (
          <View style={{ gap: Space[4], marginTop: Space[2] }}>
            {displayRoots.map(l => {
              const replies = repliesMap[l.id] || [];
              return (
                <View key={l.id} style={s.threadContainer}>
                  {/* Root Letter bubble */}
                  <LetterCard 
                    letter={l} 
                    onOpen={() => handleOpen(l)} 
                    onDelete={() => handleDelete(l)} 
                    onToggleFavorite={handleToggleFavorite}
                    onReact={handleToggleReaction}
                    onReply={() => { setReplyTo(l); setWriteOpen(true); }}
                    activeSpace={activeSpace}
                    currentUser={user}
                  />

                  {/* Render nested replies with vertical line */}
                  {replies.length > 0 && (
                    <View style={s.repliesSection}>
                      <View style={[s.treeLine, { borderColor: colors.primary + '33' }]} />
                      <View style={{ flex: 1, gap: Space[3] }}>
                        {replies.map(reply => (
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
              );
            })}
            
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

// ─── Letter Card bubble ───────────────────────────────────────────────────────
const LetterCard: React.FC<{ 
  letter: Letter | CoupleLetter; 
  onOpen: () => void; 
  onDelete: () => void;
  onToggleFavorite?: (l: Letter | CoupleLetter) => void;
  onReact?: (letterId: string, emoji: string) => void;
  onReply?: () => void;
  activeSpace: 'personal' | 'couple';
  currentUser: any;
  isReply?: boolean;
}> = ({ letter, onOpen, onDelete, onToggleFavorite, onReact, onReply, activeSpace, currentUser, isReply }) => {
  const { colors } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;
  const isUnlocked = checkUnlocked(letter);

  const coupleLetter = 'coupleId' in letter ? (letter as CoupleLetter) : null;
  const isMe = coupleLetter ? coupleLetter.senderId === currentUser?.id : true;

  return (
    <View style={[
      s.bubbleRow, 
      isMe ? s.bubbleRowRight : s.bubbleRowLeft,
      isReply && { paddingLeft: Space[2] }
    ]}>
      {/* Sender photo if received */}
      {!isMe && coupleLetter && !isReply && (
        <View style={[s.bubbleAvatar, { backgroundColor: colors.primary + '18' }]}>
          <KamiText variant="caption" color={colors.primary} bold>
            {coupleLetter.senderNickname ? coupleLetter.senderNickname.substring(0, 1).toUpperCase() : 'P'}
          </KamiText>
        </View>
      )}

      <View style={{ flex: 1, maxWidth: '85%' }}>
        <TouchableOpacity activeOpacity={0.9} onPress={onOpen}
          onPressIn={() => Animated.spring(sc, { toValue: 0.98, useNativeDriver: true, speed: 60 }).start()}
          onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        >
          <Animated.View style={[
            s.bubbleCard,
            isMe ? [s.bubbleCardSent, { backgroundColor: colors.primary + '11', borderColor: colors.primary + '22' }] : [s.bubbleCardReceived, { backgroundColor: '#FFFDFB', borderColor: 'rgba(0, 0, 0, 0.06)' }],
            !isUnlocked && s.bubbleCardLocked,
            { transform: [{ scale: sc }] }
          ]}>
            {/* Header info */}
            <View style={s.bubbleHeaderRow}>
              <KamiText variant="caption" color={Colors.textMuted} bold>
                {isMe ? 'You' : coupleLetter?.senderNickname || 'Partner'}
              </KamiText>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
                <TouchableOpacity onPress={() => onToggleFavorite?.(letter)} hitSlop={8} style={s.favBtnMini}>
                  <Text style={{ fontSize: 13, color: letter.isFavorite ? colors.primary : '#cbd5e1' }}>
                    {letter.isFavorite ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} hitSlop={8} style={s.delBtnMini}>
                  <Text style={{ fontSize: 10, color: Colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Subject */}
            <KamiText variant="label" bold style={s.bubbleSubject} color={isMe ? colors.primaryDark : '#4A3B32'}>
              {letter.subject}
            </KamiText>

            {/* Body preview / Sealed state */}
            {isUnlocked ? (
              <KamiText variant="body" color={Colors.textSecondary} numberOfLines={isReply ? 3 : 4} style={s.bubbleExcerpt}>
                {letter.body || 'No content preview available.'}
              </KamiText>
            ) : (
              /* Sealed Envelope UI */
              <View style={[s.bubbleLockedBox, { backgroundColor: 'rgba(153, 27, 27, 0.04)', borderColor: 'rgba(153, 27, 27, 0.12)' }]}>
                <View style={s.bubbleWaxSeal}>
                  <Text style={{ fontSize: 13, color: '#fff' }}>⚜️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <KamiText variant="caption" color="#7f1d1d" bold style={{ fontSize: 9 }}>SEALED TIME CAPSULE</KamiText>
                  <KamiText variant="caption" color="#7f1d1d" style={{ fontSize: 9 }}>
                    {formatCountdown(letter.deliverAt)}
                  </KamiText>
                </View>
              </View>
            )}

            {/* Date timestamp */}
            <View style={s.bubbleFooterRow}>
              <Text style={{ fontSize: 9, color: Colors.textMuted }}>
                {new Date(letter.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
              {isUnlocked && !letter.isRead && !isMe && (
                <View style={[s.newDot, { backgroundColor: colors.primary }]} />
              )}
            </View>

            {/* One Tap reactions (only if unlocked) */}
            {isUnlocked && activeSpace === 'couple' && (
              <View style={[s.bubbleReactionsBar, { borderTopColor: Colors.border + '11' }]}>
                {['❤️', '🥹', '🥰', '😭', '🔥'].map(emoji => {
                  const reactions = coupleLetter?.reactions || [];
                  const userReaction = reactions.find(r => r.userId === currentUser?.id && r.emoji === emoji);
                  const count = reactions.filter(r => r.emoji === emoji).length;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        s.bubbleReactionChip,
                        userReaction && [s.bubbleReactionChipActive, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]
                      ]}
                      onPress={() => onReact?.(letter.id, emoji)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 13 }}>{emoji}</Text>
                      {count > 0 && (
                        <Text style={{ fontSize: 9, color: userReaction ? colors.primary : Colors.textMuted, fontWeight: 'bold' }}>{count}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Reply thread button */}
            {isUnlocked && !isMe && activeSpace === 'couple' && onReply && (
              <TouchableOpacity style={[s.replyBtnBubble, { borderColor: colors.primary + '33' }]} onPress={onReply}>
                <KamiText variant="caption" color={colors.primary} bold>↩ Reply</KamiText>
              </TouchableOpacity>
            )}
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '33', backgroundColor: Colors.pageBg },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: Space[1], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[4], paddingVertical: Space[2], borderWidth: 1.5, borderColor: Colors.primary + '44' },
  writePlus:{ fontSize: FontSize.lg, color: Colors.primary, fontWeight: FontWeight.bold, lineHeight: 22 },
  
  filterScroll: { flexDirection: 'row', paddingHorizontal: Space[5], gap: Space[2], alignItems: 'center' },
  filterTab: { height: 36, paddingHorizontal: Space[4], borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border + '55', backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  filterTabActive: { borderWidth: 1.5 },

  scroll: { paddingHorizontal: Space[5], paddingTop: Space[2], gap: Space[4] },
  center: { paddingVertical: Space[10], alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Space[10] },
  emptyBtn:   { marginTop: Space[4], backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Space[5], paddingVertical: Space[3], borderWidth: 1.5, borderColor: Colors.primary + '44' },

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
    borderStyle: 'dashed',
    marginRight: Space[3],
    marginTop: -Space[3],
    marginBottom: Space[3]
  },

  // Conversation styling
  bubbleRow: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: Space[1],
    gap: Space[2]
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  bubbleCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: Space[4],
    ...Shadows.sm,
    gap: 6
  },
  bubbleCardSent: {
    borderBottomRightRadius: 4,
  },
  bubbleCardReceived: {
    borderBottomLeftRadius: 4,
  },
  bubbleCardLocked: {
    borderStyle: 'dashed',
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%'
  },
  favBtnMini: {
    padding: 2
  },
  delBtnMini: {
    padding: 2
  },
  bubbleSubject: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.display,
  },
  bubbleExcerpt: {
    lineHeight: 20,
    fontSize: FontSize.sm
  },
  bubbleFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  bubbleLockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Space[2]
  },
  bubbleWaxSeal: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#991b1b',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  replyBtnBubble: {
    alignSelf: 'flex-start',
    marginTop: Space[2],
    paddingVertical: Space[1],
    paddingHorizontal: Space[3],
    borderRadius: Radii.full,
    borderWidth: 1,
    backgroundColor: '#fff'
  },

  bubbleReactionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingTop: Space[2],
    borderTopWidth: 1,
    marginTop: Space[2]
  },
  bubbleReactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Radii.full,
    paddingHorizontal: Space[2],
    paddingVertical: 1
  },
  bubbleReactionChipActive: {
    borderWidth: 1
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
});

const wm = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.pageBg },
  toolbar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  content:      { padding: Space[5], gap: Space[3], paddingBottom: Space[10] },
  label:        { marginBottom: Space[1] },
  replyLabelBox: { padding: Space[3], borderRadius: Radii.md, borderWidth: 1, gap: 2, marginBottom: Space[2] },
  deliveryToggleRow: { flexDirection: 'row', gap: Space[2], marginVertical: Space[1] },
  deliveryToggleBtn: { flex: 1, height: 40, borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.creamDeep, justifyContent: 'center', alignItems: 'center' },
  deliveryToggleBtnOn: { borderWidth: 0 },
  schedulerContainer: { gap: Space[1], marginVertical: Space[1] },
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
});

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
  reactionBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: Space[3], paddingHorizontal: Space[4], borderTopWidth: 1 },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.full, borderWidth: 1.5, borderColor: 'transparent' },
  reactionBtnActive: { borderColor: Colors.primary },

  // Locked preview
  lockedCenterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Space[5] },
  lockedWaxSeal: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#991b1b',
    borderWidth: 3,
    borderColor: '#7f1d1d',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5
  },
  lockedCountdownBox: {
    marginTop: Space[5],
    paddingVertical: Space[4],
    paddingHorizontal: Space[6],
    borderRadius: Radii.card,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: Space[2]
  },
  lockedCountdownTick: {
    fontSize: FontSize.lg + 2,
    fontFamily: FontFamily.body
  },
  metadataBox: {
    marginTop: Space[5],
    alignItems: 'center',
    gap: Space[1]
  },
  metaLine: {
    fontSize: 10,
    lineHeight: 14
  }
});
