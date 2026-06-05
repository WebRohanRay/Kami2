import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import KamiButton from '@shared/ui/atoms/KamiButton';
import InputField from '@shared/ui/atoms/InputField';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, Radii, Shadows, Sizing, Space } from '@shared/constants';
import { useAuth } from '@features/auth';
import { pickAvatarImage, uploadAvatar } from '@shared/lib/storage';
import type { MainTabScreenProps } from '@core/navigation/types';
import { useAuthStore } from '@features/auth';

type Props = MainTabScreenProps<'Settings'>;

function initialsFor(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.trim() || 'K';
  return source.slice(0, 1).toUpperCase();
}

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore((state) => state.user);
  const { signOut, updateProfileDetails } = useAuth();

  const [nickname,       setNickname]       = useState(user?.nickname ?? '');
  const [savingNickname, setSavingNickname] = useState(false);
  const [avatarLoading,  setAvatarLoading]  = useState(false);
  const [signingOut,     setSigningOut]     = useState(false);

  useEffect(() => {
    setNickname(user?.nickname ?? '');
  }, [user?.nickname]);

  const isNicknameNew = !user?.nickname;

  const handleSaveNickname = async () => {
    Keyboard.dismiss();
    if (!user?.id) { Alert.alert('Kami', 'Please sign in again to update your profile.'); return; }
    const nextNickname = nickname.trim();
    if (!nextNickname) { Alert.alert('Kami', 'Nickname cannot be empty.'); return; }

    setSavingNickname(true);
    const result = await updateProfileDetails(user.id, { nickname: nextNickname });
    setSavingNickname(false);

    if (!result.success) { Alert.alert('Kami', result.error); return; }
    Alert.alert('Kami', 'Nickname saved! 🎉');
  };

  const handleAvatarPress = async () => {
    if (!user?.id) { Alert.alert('Kami', 'Please sign in again to update your profile.'); return; }

    const picked = await pickAvatarImage();
    if (!picked.success) {
      if (!picked.cancelled) Alert.alert('Kami', picked.error);
      return;
    }

    setAvatarLoading(true);
    const uploaded = await uploadAvatar(user.id, picked.uri);
    if (!uploaded.success) { setAvatarLoading(false); Alert.alert('Kami', uploaded.error); return; }

    const saved = await updateProfileDetails(user.id, { avatarUrl: uploaded.signedUrl });
    setAvatarLoading(false);
    if (!saved.success) { Alert.alert('Kami', saved.error); return; }
    Alert.alert('Kami', 'Profile photo updated.');
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    if (!result.success) Alert.alert('Kami', result.error);
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
          >
            <Text style={styles.iconButtonText}>‹</Text>
          </TouchableOpacity>
          <View>
            <KamiText variant="overline">Profile</KamiText>
            <KamiText variant="display">Settings</KamiText>
          </View>
        </View>

        {/* ── Welcome nudge for new users ── */}
        {isNicknameNew && (
          <View style={styles.nudgeCard}>
            <Text style={styles.nudgeEmoji}>👋</Text>
            <View style={styles.nudgeText}>
              <KamiText variant="subtitle">Welcome to Kami!</KamiText>
              <KamiText variant="caption" color={Colors.textMuted}>
                Set a nickname below so Kami feels personal.
              </KamiText>
            </View>
          </View>
        )}

        {/* ── Avatar ── */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={handleAvatarPress}
            disabled={avatarLoading}
            accessibilityRole="button"
            accessibilityLabel="Update profile photo"
          >
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>
                {initialsFor(user?.nickname, user?.email)}
              </Text>
            )}
          </TouchableOpacity>
          <KamiText variant="caption" align="center" color={Colors.textMuted}>
            {avatarLoading ? 'Uploading photo...' : 'Tap to update photo'}
          </KamiText>
        </View>

        {/* ── Nickname ── */}
        <View style={styles.section}>
          <KamiText variant="subtitle">
            {isNicknameNew ? '✦ Set your nickname' : 'Nickname'}
          </KamiText>
          <InputField
            label="Display name"
            placeholder="e.g. Sunshine"
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="words"
            icon="✦"
            hint="This is how Kami greets you every day."
          />
          <KamiButton
            label={isNicknameNew ? 'Save Nickname' : 'Update Nickname'}
            variant={isNicknameNew ? 'primary' : 'secondary'}
            loading={savingNickname}
            disabled={savingNickname}
            onPress={handleSaveNickname}
          />
        </View>

        {/* ── Account ── */}
        <View style={styles.section}>
          <KamiText variant="subtitle">Account</KamiText>
          <View style={styles.accountRow}>
            <KamiText variant="caption" color={Colors.textMuted}>Email</KamiText>
            <KamiText variant="body">{user?.email ?? 'Not available'}</KamiText>
          </View>
          <KamiButton
            label="Sign Out"
            variant="danger"
            loading={signingOut}
            disabled={signingOut}
            onPress={handleSignOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const AVATAR_SIZE = 104;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  content: {
    paddingHorizontal: Space[5],
    paddingTop: Space[6],
    paddingBottom: Space[12],
    gap: Space[6],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space[4] },
  iconButton: {
    width: Sizing.avatarSm,
    height: Sizing.avatarSm,
    borderRadius: Sizing.avatarSm / 2,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconButtonText: { color: Colors.textSecondary, fontSize: FontSize.xl, marginTop: -2 },
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    backgroundColor: Colors.rose100,
    borderRadius: Radii.card,
    padding: Space[4],
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  nudgeEmoji: { fontSize: 28 },
  nudgeText: { flex: 1, gap: Space[1] },
  profileCard: {
    alignItems: 'center',
    gap: Space[3],
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[6],
    borderWidth: 1,
    borderColor: Colors.border + '55',
    ...Shadows.card,
  },
  avatarButton: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { color: Colors.primary, fontSize: FontSize['2xl'], fontWeight: '800' },
  section: {
    gap: Space[4],
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[5],
    borderWidth: 1,
    borderColor: Colors.border + '55',
  },
  accountRow: {
    gap: Space[1],
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.md,
    padding: Space[4],
  },
});
