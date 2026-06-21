import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@shared/hooks';
import { Space, Radii, FontSize, FontFamily, FontWeight, Shadows } from '@shared/constants';
import type { GameSession } from '../types';

interface GameInviteCardProps {
  invite: GameSession;
  isIncoming: boolean;
  partnerName: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

const GameInviteCard: React.FC<GameInviteCardProps> = ({
  invite,
  isIncoming,
  partnerName,
  onAccept,
  onDecline,
  onCancel,
}) => {
  const { colors } = useTheme();

  const gameLabel = invite.gameType === 'tic_tac_toe' ? 'Tic Tac Toe' : invite.gameType;

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg, ...Shadows.card }]}>
      <View style={styles.header}>
        <Text style={[styles.emoji]}>🎮</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isIncoming ? 'Game Invite!' : 'Invite Sent'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isIncoming
              ? `${partnerName} wants to play ${gameLabel}`
              : `Waiting for ${partnerName} to accept…`
            }
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {isIncoming ? (
          <>
            <TouchableOpacity
              onPress={onAccept}
              style={[styles.button, styles.acceptButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, { color: '#FFF' }]}>Let's Play! ✨</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDecline}
              style={[styles.button, styles.declineButton, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>Not Now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={onCancel}
            style={[styles.button, styles.declineButton, { borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.card,
    padding: Space[4],
    marginHorizontal: Space[4],
    marginVertical: Space[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space[3],
  },
  emoji: {
    fontSize: 36,
    marginRight: Space[3],
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.lg,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: FontFamily.sansRegular,
    fontSize: FontSize.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Space[2],
  },
  button: {
    flex: 1,
    paddingVertical: Space[3],
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {},
  declineButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
  },
});

export default React.memo(GameInviteCard);
