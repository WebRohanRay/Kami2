import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@shared/hooks';
import { Space, Radii, FontSize, FontFamily, FontWeight, Shadows } from '@shared/constants';

interface ReadyLobbyProps {
  partnerName: string;
  partnerOnScreen: boolean;
  myReady: boolean;
  partnerReady: boolean;
  onToggleReady: (ready: boolean) => void;
  onInviteInstead: () => void;
}

const ReadyLobby: React.FC<ReadyLobbyProps> = ({
  partnerName,
  partnerOnScreen,
  myReady,
  partnerReady,
  onToggleReady,
  onInviteInstead,
}) => {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation while waiting for partner
  useEffect(() => {
    if (myReady && !partnerReady) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [myReady, partnerReady]);

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, ...Shadows.card }]}>
      {/* Partner status */}
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: partnerOnScreen ? '#4CAF50' : colors.textMuted }]} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {partnerOnScreen
            ? `${partnerName} is here${partnerReady ? ' — Ready! ✨' : ''}`
            : `${partnerName} is not on this screen`
          }
        </Text>
      </View>

      {/* Ready button */}
      {partnerOnScreen ? (
        <Animated.View style={{ transform: [{ scale: myReady && !partnerReady ? pulseAnim : 1 }] }}>
          <TouchableOpacity
            onPress={() => onToggleReady(!myReady)}
            style={[
              styles.readyButton,
              myReady
                ? { backgroundColor: '#4CAF50' }
                : { backgroundColor: colors.primary },
            ]}
            activeOpacity={0.7}
          >
            <Text style={styles.readyButtonText}>
              {myReady ? '✓ Ready!' : 'Ready Up'}
            </Text>
          </TouchableOpacity>
          {myReady && !partnerReady && (
            <Text style={[styles.waitingText, { color: colors.textMuted }]}>
              Waiting for {partnerName} to ready up…
            </Text>
          )}
        </Animated.View>
      ) : (
        <View>
          <Text style={[styles.offlineHint, { color: colors.textMuted }]}>
            Send an invitation instead?
          </Text>
          <TouchableOpacity
            onPress={onInviteInstead}
            style={[styles.inviteButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
          >
            <Text style={styles.inviteButtonText}>Invite {partnerName} 💌</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.card,
    padding: Space[4],
    marginHorizontal: Space[4],
    marginVertical: Space[2],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space[4],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Space[2],
  },
  statusText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: FontSize.sm,
  },
  readyButton: {
    paddingVertical: Space[3] + 2,
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyButtonText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  waitingText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Space[2],
  },
  offlineHint: {
    fontFamily: FontFamily.sansRegular,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Space[3],
  },
  inviteButton: {
    paddingVertical: Space[3] + 2,
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
    color: '#FFF',
  },
});

export default React.memo(ReadyLobby);
