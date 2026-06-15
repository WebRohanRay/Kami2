import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  Vibration,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { ParticleEmitter } from '@shared/ui/atoms/ParticleEmitter';
import { Space, Radii, FontSize, FontFamily, Shadows, Opacity } from '@shared/constants';
import { useTheme, useTextScale } from '@shared/hooks';
import { useAuthStore } from '@features/auth';
import { ImageZoomModal } from '@shared/ui';
import * as coupleService from '@infrastructure/couple/coupleService';
import * as futureService from '@infrastructure/home/futureService';
import type { Letter } from '@features/home/types';
import type { CoupleLetter } from '@features/couple/types';
import { checkUnlocked, formatTimestamp, formatCountdown } from './utils';

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
  const [sealBreakTrigger, setSealBreakTrigger] = useState(0);
  const { colors } = useTheme();
  const rm = React.useMemo(() => getStyles(colors), [colors]);
  const { scaleSize } = useTextScale();
  const user = useAuthStore(s => s.user);

  // Paper unfold animation
  const paperScale = useRef(new Animated.Value(0.85)).current;
  const paperOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (content) {
      paperScale.setValue(0.85);
      paperOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(paperScale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
        Animated.timing(paperOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [content]);

  const isUnlocked = letter ? checkUnlocked(letter) : false;

  useEffect(() => {
    if (!visible || !letter) {
      setContent(null);
      return;
    }

    if (isUnlocked) {
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
      const updateCountdown = () => {
        const hasUnlocked = checkUnlocked(letter);
        if (hasUnlocked) {
          clearInterval(interval);
          Vibration.vibrate([0, 50, 100, 30]); // tactile wax seal crack vibration
          setSealBreakTrigger(t => t + 1);
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
        {/* Borderless Action Header */}
        <View style={[rm.toolbar, { borderBottomColor: 'rgba(28,25,23,0.06)' }]}>
          <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'center' }}>
            <TouchableOpacity onPress={() => onToggleFavorite?.(letter)} style={rm.favToggleBtn} hitSlop={8}>
              <KamiText variant="caption" color={letter.isFavorite ? colors.primary : colors.textMuted} bold={!!letter.isFavorite}>
                {letter.isFavorite ? '★ Favorited' : '☆ Favorite'}
              </KamiText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onToggleArchive?.(letter)} style={rm.favToggleBtn} hitSlop={8}>
              <KamiText variant="caption" color={letter.isArchived ? colors.primary : colors.textMuted} bold={!!letter.isArchived}>
                {letter.isArchived ? '📦 Archived' : '📥 Archive'}
              </KamiText>
            </TouchableOpacity>
          </View>
          <KamiText variant="overline">Letter Preview</KamiText>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={rm.closeWrap}>
            <KamiText variant="caption" color={colors.textPrimary} bold>Close</KamiText>
          </TouchableOpacity>
        </View>

        {!isUnlocked && !content ? (
          /* Locked Letter Envelope Redesign */
          <ScrollView contentContainerStyle={[rm.content, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
            <View style={[rm.paperEnvelope, { backgroundColor: colors.creamDeep, borderColor: colors.creamMid }]}>
              <View style={rm.lockedCenterContainer}>
                <View style={rm.lockedWaxSeal}>
                  <Text style={{ fontSize: 48 }}>🔒</Text>
                </View>
                {/* Seal crack sparkle particles */}
                <ParticleEmitter
                  trigger={sealBreakTrigger}
                  particles={['✨', '💫', '⭐', '🔓']}
                  count={12}
                  direction="radial"
                  distance={100}
                />
                <KamiText variant="title" bold style={{ marginTop: Space[4], color: '#4A3B32', fontFamily: FontFamily.display }}>
                  {letter.subject}
                </KamiText>
                <KamiText variant="caption" color={colors.primary} bold style={{ marginTop: Space[1] }}>
                  {'senderNickname' in letter ? `From: ${letter.senderNickname}` : 'For yourself'}
                </KamiText>

                <View style={[rm.lockedCountdownBox, { backgroundColor: colors.cardBg, borderColor: colors.primary + Opacity.muted }]}>
                  <KamiText variant="overline" color={colors.primary} bold style={{ letterSpacing: 1.5 }}>TIME CAPSULE LOCKED</KamiText>
                  <KamiText variant="title" bold color={colors.primary} style={rm.lockedCountdownTick}>
                    {countdownText || 'Calculating...'}
                  </KamiText>
                </View>

                {/* Metadata Details list */}
                <View style={rm.metadataBox}>
                  <KamiText variant="caption" color={colors.textMuted} style={rm.metaLine}>
                    Created: {formatTimestamp(letter.createdAt, user?.timezone)}
                  </KamiText>
                  <KamiText variant="caption" color={colors.textMuted} style={rm.metaLine}>
                    Scheduled Unlock: {formatTimestamp(letter.deliverAt, user?.timezone)}
                  </KamiText>
                </View>
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
                <ScrollView contentContainerStyle={rm.content} showsVerticalScrollIndicator={false}>
                  {/* Physical Paper Scroll card design — with unfold animation */}
                  <Animated.View style={{ transform: [{ scale: paperScale }], opacity: paperOpacity }}>
                  <View style={[rm.paperScroll, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <View style={[rm.envelope, { backgroundColor: colors.creamDeep }]}>
                      <Text style={rm.envelopeEmoji}>{letter.isFavorite ? '🎀' : '📄'}</Text>
                      <KamiText variant="overline" align="center" style={{ marginTop: Space[2], letterSpacing: 1 }}>
                        Written {new Date(letter.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: user?.timezone ?? 'UTC' })}
                      </KamiText>
                      {activeSpace === 'couple' && 'senderId' in letter && (
                        <KamiText variant="caption" align="center" color={colors.textMuted} style={{ marginTop: Space[1] }}>
                          {(letter as CoupleLetter).senderId === user?.id
                            ? 'From: You'
                            : `From: ${(letter as CoupleLetter).senderNickname || 'Partner'}`}
                        </KamiText>
                      )}
                    </View>
                    <KamiText variant="title" bold style={{ marginBottom: Space[4], fontFamily: FontFamily.display, color: '#3A2E2B' }}>
                      {letter.subject}
                    </KamiText>
                    <KamiText variant="body" style={{ lineHeight: 28, fontFamily: FontFamily.display, color: '#4A3B30' }}>
                      {content.body}
                    </KamiText>
                  </View>
                  </Animated.View>

                  {/* Polaroid Snaps for Attached Photos */}
                  {content.imageUrls.length > 0 && (
                    <View style={rm.photoSection}>
                      <KamiText variant="overline" style={{ marginBottom: Space[3], color: colors.textSecondary }}>Attached Memories</KamiText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={rm.photoScroll}>
                        <View style={rm.photoRow}>
                          {content.imageUrls.map((url, i) => (
                            <TouchableOpacity
                              key={i}
                              onPress={() => setZoomImageUri(url)}
                              activeOpacity={0.9}
                              style={[rm.polaroidCard, { transform: [{ rotate: `${(i % 2 === 0 ? -1.5 : 1.5)}deg` }] }]}
                            >
                              <Image source={{ uri: url }} style={rm.polaroidImage} />
                              <KamiText variant="caption" style={rm.polaroidText}>
                                Snap {i + 1}
                              </KamiText>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Metadata display */}
                  <View style={rm.metadataBox}>
                    <KamiText variant="caption" color={colors.textMuted} style={rm.metaLine}>
                      Created: {formatTimestamp(letter.createdAt, user?.timezone)}
                    </KamiText>
                    {new Date(letter.deliverAt).getFullYear() > 1970 && (
                      <KamiText variant="caption" color={colors.textMuted} style={rm.metaLine}>
                        Scheduled Unlock: {formatTimestamp(letter.deliverAt, user?.timezone)}
                      </KamiText>
                    )}
                    {'deliveredAt' in letter && letter.deliveredAt && (
                      <KamiText variant="caption" color={colors.textMuted} style={rm.metaLine}>
                        Delivered: {formatTimestamp(letter.deliveredAt, user?.timezone)}
                      </KamiText>
                    )}
                  </View>
                </ScrollView>
              )
            )}

            {activeSpace === 'couple' && (
              <View style={[rm.reactionBar, { borderTopColor: 'rgba(28,25,23,0.06)', backgroundColor: colors.creamDeep }]}>
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
                        <KamiText variant="caption" color={userReaction ? colors.primary : colors.textMuted} bold={!!userReaction} style={{ fontSize: 10 }}>
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

const getStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[4], paddingBottom: Space[4], borderBottomWidth: 1 },
  closeWrap: { paddingVertical: Space[2], paddingHorizontal: Space[3], backgroundColor: 'rgba(28,25,23,0.06)', borderRadius: Radii.full },
  content: { padding: Space[5], paddingBottom: Space[10] },
  
  paperEnvelope: { width: '100%', borderRadius: Radii.card, borderWidth: 1.5, padding: Space[5], ...Shadows.card },
  
  envelope: { alignItems: 'center', borderRadius: Radii.card, padding: Space[4], marginBottom: Space[4] },
  envelopeEmoji: { fontSize: 44 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Space[10] },
  
  paperScroll: { padding: Space[5], borderRadius: Radii.card, borderWidth: 1.5, ...Shadows.sm, marginBottom: Space[4] },
  
  photoSection: { marginTop: Space[4], borderTopWidth: 1, borderTopColor: 'rgba(28,25,23,0.06)', paddingTop: Space[4] },
  photoScroll: { marginHorizontal: -Space[5], paddingHorizontal: Space[5] },
  photoRow: { flexDirection: 'row', gap: Space[4], paddingVertical: Space[2] },
  
  polaroidCard: { backgroundColor: colors.cardBg, padding: Space[3], paddingBottom: Space[5], borderRadius: 8, borderWidth: 1, borderColor: colors.border + Opacity.ghost, ...Shadows.md },
  polaroidImage: { width: 130, height: 130, borderRadius: 4, backgroundColor: colors.inputBg },
  polaroidText: { marginTop: Space[2], fontFamily: FontFamily.display, fontSize: 10, color: '#8A7B72', textAlign: 'center' },
  
  favToggleBtn: { paddingVertical: Space[1], paddingHorizontal: Space[2], borderRadius: Radii.full, backgroundColor: 'rgba(28,25,23,0.04)', marginRight: Space[1] },
  reactionBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: Space[3], paddingHorizontal: Space[4], borderTopWidth: 1 },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Space[3], paddingVertical: Space[2], borderRadius: Radii.full, borderWidth: 1.5, borderColor: 'transparent' },
  reactionBtnActive: { borderColor: colors.primary },
  
  lockedCenterContainer: { alignItems: 'center', paddingVertical: Space[5] },
  lockedWaxSeal: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#991B1B',
    borderWidth: 4,
    borderColor: '#7F1D1D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    transform: [{ rotate: '4deg' }],
  },
  lockedCountdownBox: {
    marginTop: Space[5],
    paddingVertical: Space[4],
    paddingHorizontal: Space[6],
    borderRadius: Radii.card,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: Space[2],
    ...Shadows.sm,
  },
  lockedCountdownTick: {
    fontSize: 20,
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
