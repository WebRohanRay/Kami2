import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
  Animated,
  Alert,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import { LinearGradient } from 'expo-linear-gradient';
import KamiText from '@shared/ui/atoms/KamiText';
import { Space, Radii, FontSize, FontWeight, Shadows, Sizing, FontFamily, Opacity } from '@shared/constants';

interface HomeHeaderProps {
  user: any;
  partner: any;
  partnerName: string;
  isPartnerOnline: boolean;
  name: string;
  navigation: any;
  homeAlerts: any[];
  removeHomeAlert: (id: string) => void;
  streak: any;
  greetingTime: (timezone?: string) => string;
  initial: (name: string) => string;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  user,
  partner,
  partnerName,
  isPartnerOnline,
  name,
  navigation,
  homeAlerts,
  removeHomeAlert,
  streak,
  greetingTime,
  initial,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  if (user?.activeSpace === 'couple') {
    return (
      <View style={styles.floatingHeaderContainer} pointerEvents="box-none">
        {/* Alerts Stack Overlay */}
        <View style={styles.alertsContainer} pointerEvents="box-none">
          {homeAlerts.map(alert => (
            <AlertPopup
              key={alert.id}
              alert={alert}
              onDismiss={removeHomeAlert}
              navigation={navigation}
              colors={colors}
            />
          ))}
        </View>

        {/* Floating Header */}
        <View style={styles.floatingHeader}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerAvatarGroup}
          >
            {/* User Avatar */}
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.headerUserAvatar} />
            ) : (
              <View style={[styles.headerUserAvatarPlaceholder, { backgroundColor: colors.creamDeep }]}>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: 'bold' }}>{initial(name)}</Text>
              </View>
            )}

            {/* Partner Avatar overlapping */}
            {partner?.avatarUrl ? (
              <Image source={{ uri: partner.avatarUrl }} style={styles.headerPartnerAvatar} />
            ) : (
              <View style={[styles.headerPartnerAvatarPlaceholder, { backgroundColor: colors.creamDeep }]}>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: 'bold' }}>{initial(partnerName)}</Text>
              </View>
            )}

            {/* Status dot on the partner avatar */}
            <View style={[styles.headerOnlineBadge, { backgroundColor: isPartnerOnline ? '#22c55e' : '#94a3b8' }]} />
          </TouchableOpacity>

          <View style={styles.headerBrand}>
            <KamiText style={[styles.headerBrandLogo, { color: colors.primary }]} bold>Kami</KamiText>
            <View style={styles.headerMetaRow}>
              <Text style={[styles.headerMetaText, { color: colors.primaryDark }]}>
                You {user?.currentMoodEmoji || '❓'} • {partnerName} {partner?.currentMoodEmoji || '❓'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActionsRow}>
            <TouchableOpacity
              style={styles.headerActionCircle}
              onPress={() => Alert.alert('Search', 'Search couple space...')}
            >
              <Text style={{ fontSize: 15 }}>🔍</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerActionCircle}
              onPress={() => {
                if (homeAlerts.length > 0) {
                  Alert.alert('Notifications', homeAlerts.map(a => `${a.title}: ${a.message}`).join('\n'));
                } else {
                  Alert.alert('Notifications', 'No new alerts today.');
                }
              }}
            >
              <Text style={{ fontSize: 15 }}>🔔</Text>
              {homeAlerts.length > 0 && (
                <View style={[styles.headerActionBadgeDot, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Personal Header
  return (
    <LinearGradient
      colors={[colors.primary + '1a', colors.primary + '02']}
      style={styles.singlesHero}
    >
      <View style={styles.singlesHeaderRow}>
        <View style={{ flex: 1 }}>
          <KamiText style={[styles.kamiLogo, { color: colors.primary }]} bold>Kami</KamiText>
          <KamiText variant="body" color={colors.textSecondary} style={{ fontWeight: '500', marginTop: 2 }}>
            {greetingTime(user?.timezone)}, {name} 🌸
          </KamiText>
        </View>
        <TouchableOpacity
          style={[styles.avatarWrap, { borderColor: colors.primary, backgroundColor: colors.cardBg }]}
          onPress={() => navigation.navigate('Settings')}
        >
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarLetter, { color: colors.primary }]}>{initial(name)}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Dashboard Quick Stats Card */}
      <View style={styles.singlesStatsRow}>
        <View style={styles.singlesStatCard}>
          <Text style={{ fontSize: 22 }}>🔥</Text>
          <View>
            <KamiText style={[styles.singlesStatNum, { color: '#D97706' }]} bold>{streak?.currentStreak ?? 0}</KamiText>
            <KamiText variant="caption" color={colors.textMuted}>Day Streak</KamiText>
          </View>
        </View>
        <View style={styles.singlesStatCard}>
          <Text style={{ fontSize: 22 }}>🌸</Text>
          <View>
            <KamiText style={[styles.singlesStatNum, { color: colors.textPrimary }]} bold>{streak?.totalCheckins ?? 0}</KamiText>
            <KamiText variant="caption" color={colors.textMuted}>Check-ins</KamiText>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

const AlertPopup: React.FC<{
  alert: { id: string; type: string; title: string; message: string; targetScreen: string };
  onDismiss: (id: string) => void;
  navigation: any;
  colors: any;
}> = ({ alert, onDismiss, navigation, colors }) => {
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const transX = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(transX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();

    const timer = setTimeout(() => {
      dismiss();
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(transX, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      onDismiss(alert.id);
    });
  };

  const handlePress = () => {
    if (alert.targetScreen) {
      navigation.navigate(alert.targetScreen);
    }
    dismiss();
  };

  const getEmoji = (type: string) => {
    switch (type) {
      case 'letter': return '💌';
      case 'goal': return '🎯';
      case 'memory': return '📝';
      case 'reaction': return '❤️';
      case 'completed_goal': return '🎉';
      default: return '✨';
    }
  };

  return (
    <Animated.View style={{ transform: [{ translateX: transX }], opacity, marginBottom: 8 }}>
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={styles.alertCard}>
        <Text style={styles.alertEmoji}>{getEmoji(alert.type)}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.alertTitle}>{alert.title}</Text>
          <Text style={styles.alertMsg} numberOfLines={2}>{alert.message}</Text>
        </View>
        <TouchableOpacity onPress={dismiss} style={styles.alertClose}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  // 1. Floating Island Header Styles
  floatingHeaderContainer: {
    width: '100%',
    zIndex: 9999,
  },
  alertsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    right: 20,
    left: 20,
    zIndex: 9999,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: Radii.card,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.muted,
    ...Shadows.md,
    gap: Space[3],
  },
  alertEmoji: {
    fontSize: 24,
  },
  alertTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  alertMsg: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  alertClose: {
    padding: Space[1],
  },
  floatingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Space[5],
    marginTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[3],
    marginBottom: Space[3],
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border + Opacity.subtle,
    ...Shadows.md,
    elevation: 3,
  },
  headerAvatarGroup: {
    flexDirection: 'row',
    position: 'relative',
    width: 58,
    height: 38,
    alignItems: 'center',
  },
  headerUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.cardBg,
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  headerUserAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  headerPartnerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    position: 'absolute',
    left: 18,
    zIndex: 2,
  },
  headerPartnerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 18,
    zIndex: 2,
  },
  headerOnlineBadge: {
    position: 'absolute',
    bottom: 1,
    right: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 3,
  },
  headerBrand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandLogo: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FontFamily.display,
    letterSpacing: 1,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  headerMetaText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  headerActionsRow: {
    flexDirection: 'row',
    gap: Space[2],
  },
  headerActionCircle: {
    position: 'relative',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border + Opacity.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    elevation: 2,
  },
  headerActionBadgeDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.cardBg,
  },

  // Singles Header Styles
  singlesHero: {
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[3] : Space[3],
    paddingBottom: Space[5],
    paddingHorizontal: Space[5],
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Shadows.md,
    elevation: 3,
  },
  singlesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[4],
  },
  kamiLogo: {
    fontFamily: FontFamily.display,
    fontSize: 34,
    fontWeight: 'bold',
  },
  avatarWrap: {
    width: Sizing.avatarSm,
    height: Sizing.avatarSm,
    borderRadius: Sizing.avatarSm / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    ...Shadows.sm,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  singlesStatsRow: {
    flexDirection: 'row',
    gap: Space[4],
  },
  singlesStatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    ...Shadows.sm,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border + Opacity.ghost,
  },
  singlesStatNum: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: FontSize.xl,
    fontWeight: '600',
    lineHeight: 32,
  },
});
