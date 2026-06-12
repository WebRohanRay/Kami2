import React, { useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { useTheme } from '@shared/hooks';
import { Colors, Radii, Space, Shadows, FontSize, FontFamily } from '@shared/constants';
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
  const sc = useRef(new Animated.Value(1)).current;
  const isUnlocked = checkUnlocked(letter);

  const coupleLetter = 'coupleId' in letter ? (letter as CoupleLetter) : null;
  const isMe = coupleLetter ? coupleLetter.senderId === currentUser?.id : true;

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
          onPress={onOpen}
          onPressIn={() => Animated.spring(sc, { toValue: 0.98, useNativeDriver: true, speed: 60 }).start()}
          onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        >
          <Animated.View style={[
            styles.bubbleCard,
            isMe
              ? [styles.bubbleCardSent, { backgroundColor: colors.primary + '11', borderColor: colors.primary + '22' }]
              : [styles.bubbleCardReceived, { backgroundColor: '#FFFDFB', borderColor: 'rgba(0, 0, 0, 0.06)' }],
            !isUnlocked && styles.bubbleCardLocked,
            { transform: [{ scale: sc }] },
          ]}>
            {/* Header info */}
            <View style={styles.bubbleHeaderRow}>
              <KamiText variant="caption" color={Colors.textMuted} bold>
                {isMe ? 'You' : coupleLetter?.senderNickname || 'Partner'}
              </KamiText>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
                <TouchableOpacity onPress={() => onToggleFavorite?.(letter)} hitSlop={8} style={styles.favBtnMini}>
                  <Text style={{ fontSize: 13, color: letter.isFavorite ? colors.primary : '#cbd5e1' }}>
                    {letter.isFavorite ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.delBtnMini}>
                  <Text style={{ fontSize: 10, color: Colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Subject */}
            <KamiText variant="label" bold style={styles.bubbleSubject} color={isMe ? colors.primaryDark : '#4A3B32'}>
              {letter.subject}
            </KamiText>

            {/* Body preview / Sealed state */}
            {isUnlocked ? (
              <KamiText variant="body" color={Colors.textSecondary} numberOfLines={isReply ? 3 : 4} style={styles.bubbleExcerpt}>
                {letter.body || 'No content preview available.'}
              </KamiText>
            ) : (
              /* Sealed Envelope UI */
              <View style={[styles.bubbleLockedBox, { backgroundColor: 'rgba(153, 27, 27, 0.04)', borderColor: 'rgba(153, 27, 27, 0.12)' }]}>
                <View style={styles.bubbleWaxSeal}>
                  <Text style={{ fontSize: 13, color: '#fff' }}>⚜️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <KamiText variant="caption" color="#7f1d1d" bold style={{ fontSize: 9 }}>SEALED TIME CAPSULE</KamiText>
                  <CountdownText deliverAt={letter.deliverAt} />
                </View>
              </View>
            )}

            {/* Date timestamp */}
            <View style={styles.bubbleFooterRow}>
              <Text style={{ fontSize: 9, color: Colors.textMuted }}>
                {new Date(letter.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: currentUser?.timezone ?? 'UTC' })}
              </Text>
              {isUnlocked && !letter.isRead && !isMe && (
                <View style={[styles.newDot, { backgroundColor: colors.primary }]} />
              )}
            </View>

            {/* One Tap reactions (only if unlocked) */}
            {isUnlocked && activeSpace === 'couple' && (
              <View style={[styles.bubbleReactionsBar, { borderTopColor: Colors.border + '11' }]}>
                {['❤️', '🥹', '🥰', '😭', '🔥'].map(emoji => {
                  const reactions = coupleLetter?.reactions || [];
                  const userReaction = reactions.find(r => r.userId === currentUser?.id && r.emoji === emoji);
                  const count = reactions.filter(r => r.emoji === emoji).length;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.bubbleReactionChip,
                        userReaction && [styles.bubbleReactionChipActive, { backgroundColor: colors.primary + '18', borderColor: colors.primary }],
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
              <TouchableOpacity style={[styles.replyBtnBubble, { borderColor: colors.primary + '33' }]} onPress={onReply}>
                <KamiText variant="caption" color={colors.primary} bold>↩ Reply</KamiText>
              </TouchableOpacity>
            )}
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    borderColor: 'rgba(0,0,0,0.05)',
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#991b1b',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyBtnBubble: {
    alignSelf: 'flex-start',
    marginTop: Space[2],
    paddingVertical: Space[1],
    paddingHorizontal: Space[3],
    borderRadius: Radii.full,
    borderWidth: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Radii.full,
    paddingHorizontal: Space[2],
    paddingVertical: 1,
  },
  bubbleReactionChipActive: {
    borderWidth: 1,
  },
});
