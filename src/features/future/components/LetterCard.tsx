import React, { useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { useTheme } from '@shared/hooks';
import { Radii, Space, Shadows, FontSize, FontFamily, Opacity } from '@shared/constants';
import type { Letter } from '@features/home/types';
import type { CoupleLetter } from '@features/couple/types';
import { checkUnlocked } from './utils';
import { CountdownText } from './CountdownText';

interface LetterCardProps {
  letter: Letter | CoupleLetter;
  onOpen: () => void;
  onDelete: () => void;
  onToggleFavorite?: (l: Letter | CoupleLetter) => void;
  onReact?: (letterId: string, emoji: string) => void;
  onReply?: () => void;
  activeSpace: 'personal' | 'couple';
  currentUser: any;
  isReply?: boolean;
}

export const LetterCard: React.FC<LetterCardProps> = ({
  letter,
  onOpen,
  onDelete,
  onToggleFavorite,
  onReact,
  onReply,
  activeSpace,
  currentUser,
  isReply,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const sc = useRef(new Animated.Value(1)).current;
  const isUnlocked = checkUnlocked(letter);

  const coupleLetter = 'coupleId' in letter ? (letter as CoupleLetter) : null;
  const isMe = coupleLetter ? coupleLetter.senderId === currentUser?.id : true;

  // Urgency animations for sealed letters
  const glowAnim = useRef(new Animated.Value(0.1)).current;
  const wobbleAnim = useRef(new Animated.Value(0)).current;
  const sealScale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isUnlocked) return;
    const msUntilUnlock = new Date(letter.deliverAt).getTime() - Date.now();
    if (msUntilUnlock <= 0) return;

    const animations: Animated.CompositeAnimation[] = [];

    if (msUntilUnlock < 86400000) {
      // < 24 hours: glow pulse on border
      animations.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.1, duration: 1500, useNativeDriver: true }),
          ])
        )
      );
    }

    if (msUntilUnlock < 3600000) {
      // < 1 hour: wobble
      animations.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(wobbleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(wobbleAnim, { toValue: -1, duration: 200, useNativeDriver: true }),
            Animated.timing(wobbleAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.delay(2000),
          ])
        )
      );
    }

    // Gentle seal breathing
    animations.push(
      Animated.loop(
        Animated.sequence([
          Animated.timing(sealScale, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
          Animated.timing(sealScale, { toValue: 0.97, duration: 2000, useNativeDriver: true }),
        ])
      )
    );

    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [isUnlocked, letter.deliverAt]);

  const wobbleRotate = wobbleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-1deg', '0deg', '1deg'],
  });

  return (
    <View style={[
      styles.bubbleRow,
      isMe ? styles.bubbleRowRight : styles.bubbleRowLeft,
      isReply && { paddingLeft: Space[2] },
    ]}>
      {/* Sender photo if received */}
      {!isMe && coupleLetter && !isReply && (
        <View style={[styles.bubbleAvatar, { backgroundColor: colors.primary + '18' }]}>
          <KamiText variant="caption" color={colors.primary} bold>
            {coupleLetter.senderNickname ? coupleLetter.senderNickname.substring(0, 1).toUpperCase() : 'P'}
          </KamiText>
        </View>
      )}

      <View style={{ flex: 1, maxWidth: '85%' }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (!isUnlocked) {
              // Quick double pulse representing "locked" physical capsule
              Vibration.vibrate([0, 10, 50, 10]);
            }
            onOpen();
          }}
          onPressIn={() => Animated.spring(sc, { toValue: 0.98, useNativeDriver: true, speed: 60 }).start()}
          onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        >
          <Animated.View style={[
            styles.bubbleCard,
            isMe
              ? [styles.bubbleCardSent, { backgroundColor: colors.primary + Opacity.subtle, borderColor: colors.primary + Opacity.muted }]
              : [styles.bubbleCardReceived, { backgroundColor: colors.cardBg, borderColor: colors.border + Opacity.ghost }],
            !isUnlocked && styles.bubbleCardLocked,
            !isUnlocked && { opacity: glowAnim.interpolate({ inputRange: [0.1, 0.4], outputRange: [1, 1] }) },
            { transform: [{ scale: sc }, { rotate: !isUnlocked ? wobbleRotate : '0deg' }] },
          ]}>
            {/* Header info */}
            <View style={styles.bubbleHeaderRow}>
              <KamiText variant="caption" color={colors.textMuted} bold>
                {isMe ? 'You' : coupleLetter?.senderNickname || 'Partner'}
              </KamiText>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
                <TouchableOpacity onPress={() => onToggleFavorite?.(letter)} hitSlop={8} style={styles.favBtnMini}>
                  <Text style={{ fontSize: 13, color: letter.isFavorite ? colors.primary : colors.textMuted }}>
                    {letter.isFavorite ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.delBtnMini}>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Subject */}
            <KamiText variant="label" bold style={styles.bubbleSubject} color={isMe ? colors.primaryDark : colors.textPrimary}>
              {letter.subject}
            </KamiText>

            {/* Body preview / Sealed state */}
            {isUnlocked ? (
              <KamiText variant="body" color={colors.textSecondary} numberOfLines={isReply ? 3 : 4} style={styles.bubbleExcerpt}>
                {letter.body || 'No content preview available.'}
              </KamiText>
            ) : (
              /* Sealed Envelope UI */
              <View style={[styles.bubbleLockedBox, { backgroundColor: colors.error + Opacity.ghost, borderColor: colors.error + Opacity.subtle }]}>
                <Animated.View style={[styles.bubbleWaxSeal, { transform: [{ scale: sealScale }] }]}>
                  <Text style={{ fontSize: 13, color: '#fff' }}>⚔️</Text>
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <KamiText variant="caption" color={colors.error} bold style={{ fontSize: 9 }}>SEALED TIME CAPSULE</KamiText>
                  <CountdownText deliverAt={letter.deliverAt} />
                </View>
              </View>
            )}

            {/* Date timestamp */}
            <View style={styles.bubbleFooterRow}>
              <Text style={{ fontSize: 9, color: colors.textMuted }}>
                {new Date(letter.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: currentUser?.timezone ?? 'UTC' })}
              </Text>
              {isUnlocked && !letter.isRead && !isMe && (
                <View style={[styles.newDot, { backgroundColor: colors.primary }]} />
              )}
            </View>

            {/* One Tap reactions (only if unlocked) */}
            {isUnlocked && activeSpace === 'couple' && (
              <View style={[styles.bubbleReactionsBar, { borderTopColor: colors.border + Opacity.ghost }]}>
                {['❤️', '🥹', '🥰', '😭', '🔥'].map(emoji => {
                  const reactions = coupleLetter?.reactions || [];
                  const userReaction = reactions.find(r => r.userId === currentUser?.id && r.emoji === emoji);
                  const count = reactions.filter(r => r.emoji === emoji).length;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.bubbleReactionChip,
                        userReaction && [styles.bubbleReactionChipActive, { backgroundColor: colors.primary + Opacity.light, borderColor: colors.primary }],
                      ]}
                      onPress={() => onReact?.(letter.id, emoji)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 13 }}>{emoji}</Text>
                      {count > 0 && (
                        <Text style={{ fontSize: 9, color: userReaction ? colors.primary : colors.textMuted, fontWeight: 'bold' }}>{count}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Reply thread button */}
            {isUnlocked && !isMe && activeSpace === 'couple' && onReply && (
              <TouchableOpacity style={[styles.replyBtnBubble, { borderColor: colors.primary + Opacity.medium }]} onPress={onReply}>
                <KamiText variant="caption" color={colors.primary} bold>↩ Reply</KamiText>
              </TouchableOpacity>
            )}
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: Space[1],
    gap: Space[2],
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
    borderColor: colors.border + Opacity.ghost,
  },
  bubbleCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: Space[4],
    ...Shadows.sm,
    gap: 6,
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
    width: '100%',
  },
  favBtnMini: {
    padding: 2,
  },
  delBtnMini: {
    padding: 2,
  },
  bubbleSubject: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.display,
  },
  bubbleExcerpt: {
    lineHeight: 20,
    fontSize: FontSize.sm,
  },
  bubbleFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bubbleLockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Space[2],
  },
  bubbleWaxSeal: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#991b1b',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#991B1B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  replyBtnBubble: {
    alignSelf: 'flex-start',
    marginTop: Space[2],
    paddingVertical: Space[1],
    paddingHorizontal: Space[3],
    borderRadius: Radii.full,
    borderWidth: 1,
    backgroundColor: colors.cardBg,
  },
  bubbleReactionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingTop: Space[2],
    borderTopWidth: 1,
    marginTop: Space[2],
  },
  bubbleReactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border + Opacity.ghost,
    borderRadius: Radii.full,
    paddingHorizontal: Space[2],
    paddingVertical: 1,
  },
  bubbleReactionChipActive: {
    borderWidth: 1,
  },
});
