import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, Space, Radii, FontSize, FontFamily } from '@shared/constants';
import { useTheme } from '@shared/hooks';
import { useAuthStore } from '@features/auth';
import { ImageZoomModal } from '@shared/ui';
import * as coupleService from '@infrastructure/couple/coupleService';
import * as futureService from '@infrastructure/home/futureService';
import type { Letter } from '@features/home/types';
import type { CoupleLetter } from '@features/couple/types';
import { checkUnlocked, formatTimestamp, formatCountdown } from './utils';
import { CountdownText } from './CountdownText';

interface ReadModalProps {
  visible: boolean;
  letter: Letter | CoupleLetter | null;
  onClose: () => void;
  activeSpace: 'personal' | 'couple';
  onToggleFavorite?: (l: Letter | CoupleLetter) => void;
  onToggleArchive?: (l: Letter | CoupleLetter) => void;
  onToggleReaction?: (letterId: string, emoji: string) => void;
}

export const ReadModal: React.FC<ReadModalProps> = ({
  visible,
  letter,
  onClose,
  activeSpace,
  onToggleFavorite,
  onToggleArchive,
  onToggleReaction,
}) => {
  const [content, setContent] = useState<{ body: string; imageUrls: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdownText, setCountdownText] = useState('');
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
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
                  Created: {formatTimestamp(letter.createdAt, user?.timezone)}
                </KamiText>
                <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                  Scheduled Unlock: {formatTimestamp(letter.deliverAt, user?.timezone)}
                </KamiText>
                {'deliveredAt' in letter && letter.deliveredAt && (
                  <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                    Delivered: {formatTimestamp(letter.deliveredAt, user?.timezone)}
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
                      Written {new Date(letter.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: user?.timezone ?? 'UTC' })}
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
                            <TouchableOpacity key={i} onPress={() => setZoomImageUri(url)} activeOpacity={0.9}>
                              <Image source={{ uri: url }} style={rm.attachedImage} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Metadata display */}
                  <View style={[rm.metadataBox, { marginTop: Space[5], borderTopWidth: 1, borderTopColor: Colors.border + '22', paddingTop: Space[3] }]}>
                    <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                      Created: {formatTimestamp(letter.createdAt, user?.timezone)}
                    </KamiText>
                    {new Date(letter.deliverAt).getFullYear() > 1970 && (
                      <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                        Scheduled Unlock: {formatTimestamp(letter.deliverAt, user?.timezone)}
                      </KamiText>
                    )}
                    {'deliveredAt' in letter && letter.deliveredAt && (
                      <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                        Delivered: {formatTimestamp(letter.deliveredAt, user?.timezone)}
                      </KamiText>
                    )}
                    {'readAt' in letter && letter.readAt && (
                      <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                        Read: {formatTimestamp(letter.readAt, user?.timezone)}
                      </KamiText>
                    )}
                    {'updatedAt' in letter && letter.updatedAt && (
                      <KamiText variant="caption" color={Colors.textMuted} style={rm.metaLine}>
                        Last Updated: {formatTimestamp(letter.updatedAt, user?.timezone)}
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
                        userReaction && [rm.reactionBtnActive, { backgroundColor: colors.primary + '22', borderColor: colors.primary }],
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
        <ImageZoomModal visible={zoomImageUri !== null} imageUri={zoomImageUri} onClose={() => setZoomImageUri(null)} />
      </SafeAreaView>
    </Modal>
  );
};

const rm = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  content: { padding: Space[5], paddingBottom: Space[10] },
  envelope: { alignItems: 'center', backgroundColor: Colors.rose100, borderRadius: Radii.card, padding: Space[5], marginBottom: Space[5] },
  envelopeEmoji: { fontSize: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Space[10] },
  photoSection: { marginTop: Space[5], borderTopWidth: 1, borderTopColor: Colors.border + '22', paddingTop: Space[4] },
  photoScroll: { marginHorizontal: -Space[5], paddingHorizontal: Space[5] },
  photoRow: { flexDirection: 'row', gap: Space[3] },
  attachedImage: { width: 140, height: 140, borderRadius: Radii.card, resizeMode: 'contain', backgroundColor: 'rgba(0,0,0,0.03)' },
  favToggleBtn: { paddingVertical: Space[1], paddingHorizontal: Space[2] },
  reactionBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: Space[3], paddingHorizontal: Space[4], borderTopWidth: 1 },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.full, borderWidth: 1.5, borderColor: 'transparent' },
  reactionBtnActive: { borderColor: Colors.primary },
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
    elevation: 5,
  },
  lockedCountdownBox: {
    marginTop: Space[5],
    paddingVertical: Space[4],
    paddingHorizontal: Space[6],
    borderRadius: Radii.card,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: Space[2],
  },
  lockedCountdownTick: {
    fontSize: FontSize.lg + 2,
    fontFamily: FontFamily.body,
  },
  metadataBox: {
    marginTop: Space[5],
    alignItems: 'center',
    gap: Space[1],
  },
  metaLine: {
    fontSize: 10,
    lineHeight: 14,
  },
});
