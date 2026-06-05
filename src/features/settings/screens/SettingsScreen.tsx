/**
 * SettingsScreen.tsx
 *
 * Full settings interface with sections:
 *  - Profile (avatar, nickname)
 *  - Appearance (theme hints for future)
 *  - Notifications (toggle rows)
 *  - Privacy
 *  - Account (email, sign out, delete)
 *
 * Fixes: updateProfileDetails → updateProfile (correct hook export name)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import KamiButton  from '@shared/ui/atoms/KamiButton';
import InputField  from '@shared/ui/atoms/InputField';
import KamiText    from '@shared/ui/atoms/KamiText';
import {
  Colors, FontSize, FontWeight, Radii, Shadows, Sizing, Space,
} from '@shared/constants';
import { useAuth }      from '@features/auth';
import { useAuthStore } from '@features/auth';
import { pickAvatarImage, uploadAvatar } from '@shared/lib/storage';
import type { MainTabScreenProps } from '@core/navigation/types';

type Props = MainTabScreenProps<'Settings'>;

// ─── helpers ────────────────────────────────────────────────────────────────

function initialsFor(name?: string, email?: string) {
  return (name?.trim() || email?.trim() || 'K').slice(0, 1).toUpperCase();
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** A single tappable row inside a settings group */
const SettingRow: React.FC<{
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
  rightEl?: React.ReactNode;
}> = ({ icon, label, value, onPress, showChevron = true, danger, rightEl }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }).start();

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      onPressIn={onPress ? onPressIn : undefined}
      onPressOut={onPress ? onPressOut : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
    >
      <Animated.View style={[rowStyles.row, { transform: [{ scale }] }]}>
        <View style={rowStyles.iconWrap}>
          <Text style={rowStyles.icon}>{icon}</Text>
        </View>
        <View style={rowStyles.middle}>
          <KamiText
            variant="body"
            color={danger ? Colors.error : Colors.textPrimary}
          >
            {label}
          </KamiText>
          {value ? (
            <KamiText variant="caption" color={Colors.textMuted}>{value}</KamiText>
          ) : null}
        </View>
        {rightEl ?? (
          showChevron && onPress
            ? <Text style={[rowStyles.chevron, danger && { color: Colors.error }]}>›</Text>
            : null
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space[3] + 2,
    paddingHorizontal: Space[4],
    gap: Space[3],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon:    { fontSize: FontSize.md },
  middle:  { flex: 1, gap: 1 },
  chevron: { fontSize: FontSize.xl, color: Colors.textMuted, marginTop: -2 },
});

/** A labeled card section wrapping multiple rows */
const SettingGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={groupStyles.wrap}>
    <KamiText variant="overline" style={groupStyles.title}>{title}</KamiText>
    <View style={groupStyles.card}>
      {React.Children.map(children, (child, i) => (
        <>
          {child}
          {i < React.Children.count(children) - 1 && <View style={groupStyles.divider} />}
        </>
      ))}
    </View>
  </View>
);

const groupStyles = StyleSheet.create({
  wrap:    { gap: Space[2] },
  title:   { paddingHorizontal: Space[1], marginBottom: Space[1] },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border + '55',
    overflow: 'hidden',
    ...Shadows.card,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border + '44',
    marginLeft: 36 + Space[3] + Space[4],
  },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const { signOut, updateProfile } = useAuth();

  const [nickname,       setNickname]       = useState(user?.nickname ?? '');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [avatarLoading,  setAvatarLoading]  = useState(false);
  const [signingOut,     setSigningOut]     = useState(false);

  // notification toggles (local state — wire to a store/API when ready)
  const [dailyReminder,  setDailyReminder]  = useState(true);
  const [weeklyDigest,   setWeeklyDigest]   = useState(false);
  const [streakAlerts,   setStreakAlerts]   = useState(true);

  useEffect(() => { setNickname(user?.nickname ?? ''); }, [user?.nickname]);

  // ── Profile actions ──────────────────────────────────────────────────────

  const handleSaveNickname = async () => {
    Keyboard.dismiss();
    if (!user?.id) { Alert.alert('Kami', 'Please sign in again.'); return; }
    const next = nickname.trim();
    if (!next) { Alert.alert('Kami', 'Nickname cannot be empty.'); return; }

    setSavingNickname(true);
    const result = await updateProfile(user.id, { nickname: next });
    setSavingNickname(false);
    if (!result.success) { Alert.alert('Kami', result.error); return; }
    setEditingProfile(false);
    Alert.alert('Kami', 'Nickname saved! 🎉');
  };

  const handleAvatarPress = async () => {
    if (!user?.id) { Alert.alert('Kami', 'Please sign in again.'); return; }
    const picked = await pickAvatarImage();
    if (!picked.success) {
      if (!(picked as any).cancelled) Alert.alert('Kami', (picked as any).error);
      return;
    }
    setAvatarLoading(true);
    const uploaded = await uploadAvatar(user.id, (picked as any).uri);
    if (!uploaded.success) { setAvatarLoading(false); Alert.alert('Kami', (uploaded as any).error); return; }
    const saved = await updateProfile(user.id, { avatarUrl: (uploaded as any).signedUrl });
    setAvatarLoading(false);
    if (!saved.success) { Alert.alert('Kami', saved.error); return; }
    Alert.alert('Kami', 'Profile photo updated 🌸');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            const result = await signOut();
            setSigningOut(false);
            if (!result.success) Alert.alert('Kami', result.error);
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => Alert.alert('Kami', 'Please contact support@kami.app to delete your account.'),
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Keyboard.dismiss(); navigation.navigate('Home'); }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.topBarTitle}>
          <KamiText variant="overline">Your space</KamiText>
          <KamiText variant="title">Settings</KamiText>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handleAvatarPress}
            disabled={avatarLoading}
            accessibilityRole="button"
            accessibilityLabel="Update profile photo"
          >
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarInitial}>
                {initialsFor(user?.nickname, user?.email)}
              </Text>
            )}
            <View style={styles.avatarBadge}>
              <Text style={{ fontSize: 11 }}>{avatarLoading ? '⏳' : '📷'}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <KamiText variant="subtitle">
              {user?.nickname ?? user?.email?.split('@')[0] ?? 'Kami User'}
            </KamiText>
            <KamiText variant="caption" color={Colors.textMuted}>
              {user?.email ?? ''}
            </KamiText>
          </View>

          <TouchableOpacity
            style={styles.editChip}
            onPress={() => setEditingProfile((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.editChipText}>
              {editingProfile ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Nickname editor (shown when editing) ── */}
        {editingProfile && (
          <View style={styles.editCard}>
            <KamiText variant="subtitle">Edit Nickname</KamiText>
            <InputField
              icon="✦"
              placeholder="Your display name"
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="words"
              hint="This is how Kami greets you every day."
            />
            <KamiButton
              label="Save Nickname"
              loading={savingNickname}
              disabled={savingNickname}
              onPress={handleSaveNickname}
            />
          </View>
        )}

        {/* ── Appearance ── */}
        <SettingGroup title="Appearance">
          <SettingRow
            icon="🌸"
            label="Theme"
            value="Blush (default)"
            onPress={() => Alert.alert('Kami', 'More themes coming soon!')}
          />
          <SettingRow
            icon="🔤"
            label="Text Size"
            value="Medium"
            onPress={() => Alert.alert('Kami', 'Text size settings coming soon!')}
          />
        </SettingGroup>

        {/* ── Notifications ── */}
        <SettingGroup title="Notifications">
          <SettingRow
            icon="🔔"
            label="Daily Reminder"
            value="Nudge to write each day"
            showChevron={false}
            rightEl={
              <Switch
                value={dailyReminder}
                onValueChange={setDailyReminder}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={dailyReminder ? Colors.primary : Colors.fog ?? '#ccc'}
              />
            }
          />
          <SettingRow
            icon="📅"
            label="Weekly Digest"
            value="Summary of your week"
            showChevron={false}
            rightEl={
              <Switch
                value={weeklyDigest}
                onValueChange={setWeeklyDigest}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={weeklyDigest ? Colors.primary : Colors.fog ?? '#ccc'}
              />
            }
          />
          <SettingRow
            icon="🔥"
            label="Streak Alerts"
            value="Don't lose your streak"
            showChevron={false}
            rightEl={
              <Switch
                value={streakAlerts}
                onValueChange={setStreakAlerts}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={streakAlerts ? Colors.primary : Colors.fog ?? '#ccc'}
              />
            }
          />
        </SettingGroup>

        {/* ── Privacy ── */}
        <SettingGroup title="Privacy">
          <SettingRow
            icon="🔒"
            label="Data & Privacy"
            onPress={() => Alert.alert('Kami', 'Your data is stored securely and never sold. Coming soon: full privacy controls.')}
          />
          <SettingRow
            icon="📤"
            label="Export My Data"
            onPress={() => Alert.alert('Kami', 'Data export coming soon!')}
          />
        </SettingGroup>

        {/* ── About ── */}
        <SettingGroup title="About">
          <SettingRow
            icon="💌"
            label="Send Feedback"
            onPress={() => Alert.alert('Kami', 'Email us at support@kami.app — we read every message!')}
          />
          <SettingRow
            icon="⭐"
            label="Rate Kami"
            onPress={() => Alert.alert('Kami', 'App store review coming soon!')}
          />
          <SettingRow
            icon="📋"
            label="Terms of Service"
            onPress={() => Alert.alert('Kami', 'Terms coming soon!')}
          />
          <SettingRow
            icon="🛡️"
            label="Privacy Policy"
            onPress={() => Alert.alert('Kami', 'Privacy policy coming soon!')}
          />
          <SettingRow
            icon="ℹ️"
            label="Version"
            value="1.0.0"
            showChevron={false}
          />
        </SettingGroup>

        {/* ── Account ── */}
        <SettingGroup title="Account">
          <SettingRow
            icon="🚪"
            label={signingOut ? 'Signing out…' : 'Sign Out'}
            onPress={signingOut ? undefined : handleSignOut}
          />
          <SettingRow
            icon="🗑️"
            label="Delete Account"
            danger
            onPress={handleDeleteAccount}
          />
        </SettingGroup>

        <View style={styles.footer}>
          <Text style={styles.footerHeart}>🌸</Text>
          <KamiText variant="caption" align="center" color={Colors.textMuted}>
            Made with love for your wellbeing
          </KamiText>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 72;

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.pageBg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    paddingHorizontal: Space[5],
    paddingTop: Platform.OS === 'android' ? Space[4] : Space[2],
    paddingBottom: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '44',
    backgroundColor: Colors.pageBg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backArrow:   { color: Colors.textSecondary, fontSize: FontSize.xl, marginTop: -2 },
  topBarTitle: { gap: 0 },
  scroll: {
    paddingHorizontal: Space[5],
    paddingTop: Space[5],
    paddingBottom: Space[14],
    gap: Space[5],
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    borderWidth: 1,
    borderColor: Colors.border + '55',
    ...Shadows.card,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  avatar:        { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarInitial: { color: Colors.primary, fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  profileInfo: { flex: 1, gap: 2 },
  editChip: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[1] + 2,
    borderRadius: Radii.full,
    backgroundColor: Colors.creamDeep,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },

  // Nickname editor
  editCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[5],
    gap: Space[4],
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    ...Shadows.md,
  },

  // Footer
  footer:      { alignItems: 'center', gap: Space[2], paddingTop: Space[4] },
  footerHeart: { fontSize: FontSize.xl },

  // Misc
  fog: Colors.fog,
});
