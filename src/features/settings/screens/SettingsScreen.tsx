/**
 * SettingsScreen.tsx
 *
 * Full settings interface with sections:
 *  - Profile (avatar, nickname)
 *  - Appearance (theme, text size synced to Supabase)
 *  - Notifications (daily reminders, weekly digests, streak alerts)
 *  - Privacy (data export, privacy statement sheet)
 *  - Terms of Service
 *  - Account (email, sign out, delete account)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import KamiButton  from '@shared/ui/atoms/KamiButton';
import InputField  from '@shared/ui/atoms/InputField';
import KamiText    from '@shared/ui/atoms/KamiText';
import {
  Colors, FontSize, FontWeight, Radii, Shadows, Sizing, Space, FontFamily
} from '@shared/constants';
import { useAuth }      from '@features/auth';
import { useAuthStore } from '@features/auth';
import { pickAvatarImage, uploadAvatar } from '@shared/lib/storage';
import type { MainTabScreenProps } from '@core/navigation/types';

type Props = MainTabScreenProps<'Settings'>;

// ─── Constants & Helpers ───────────────────────────────────────────────────

const THEMES = [
  { id: 'blush', label: 'Blush Pink', emoji: '🌸' },
  { id: 'indigo', label: 'Midnight Indigo', emoji: '🌙' },
  { id: 'slate', label: 'Slate Gray', emoji: '⛰️' },
] as const;

const TEXT_SIZES = [
  { id: 'small', label: 'Small', emoji: '▫️' },
  { id: 'medium', label: 'Medium', emoji: '◽' },
  { id: 'large', label: 'Large', emoji: '◻️' },
] as const;

function initialsFor(name?: string, email?: string) {
  return (name?.trim() || email?.trim() || 'K').slice(0, 1).toUpperCase();
}

// ─── Sub-components ─────────────────────────────────────────────────────────

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
            bold={danger}
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

const SettingGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={groupStyles.wrap}>
    <KamiText variant="overline" style={groupStyles.title}>{title}</KamiText>
    <View style={groupStyles.card}>
      {React.Children.map(children, (child, i) => (
        <React.Fragment key={i}>
          {child}
          {i < React.Children.count(children) - 1 && <View style={groupStyles.divider} />}
        </React.Fragment>
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

// ─── Text / Info Sheet Modal ───────────────────────────────────────────────

const InfoSheet: React.FC<{
  visible: boolean;
  title: string;
  content: string;
  onClose: () => void;
}> = ({ visible, title, content, onClose }) => (
  <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={sheetStyles.root}>
      <View style={sheetStyles.header}>
        <KamiText variant="title">{title}</KamiText>
        <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn}>
          <KamiText variant="label" color={Colors.primary} bold>Done</KamiText>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={sheetStyles.scroll}>
        <KamiText variant="body" style={sheetStyles.text}>{content}</KamiText>
      </ScrollView>
    </SafeAreaView>
  </Modal>
);

const sheetStyles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.pageBg },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingVertical: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  closeBtn: { padding: Space[2] },
  scroll:   { padding: Space[5] },
  text:     { lineHeight: 24, color: Colors.textSecondary },
});

// ─── Selection Selector Sheet Modal ───────────────────────────────────────

interface SelectOption {
  id: string;
  label: string;
  emoji: string;
}

const SelectorSheet: React.FC<{
  visible: boolean;
  title: string;
  options: readonly SelectOption[];
  selectedValue: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}> = ({ visible, title, options, selectedValue, onSelect, onClose }) => (
  <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={selectorStyles.root}>
      <View style={selectorStyles.header}>
        <KamiText variant="title">{title}</KamiText>
        <TouchableOpacity onPress={onClose} style={selectorStyles.closeBtn}>
          <KamiText variant="label" color={Colors.primary} bold>Cancel</KamiText>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={selectorStyles.scroll}>
        <View style={selectorStyles.list}>
          {options.map((opt) => {
            const active = opt.id === selectedValue;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[selectorStyles.item, active && selectorStyles.itemActive]}
                onPress={() => { onSelect(opt.id); onClose(); }}
              >
                <Text style={selectorStyles.emoji}>{opt.emoji}</Text>
                <KamiText variant="body" style={{ flex: 1 }} bold={active} color={active ? Colors.primary : Colors.textPrimary}>
                  {opt.label}
                </KamiText>
                {active && <KamiText variant="label" color={Colors.primary}>✓</KamiText>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>
);

const selectorStyles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.pageBg },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingVertical: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  closeBtn: { padding: Space[2] },
  scroll:   { padding: Space[5] },
  list:     { backgroundColor: Colors.cardBg, borderRadius: Radii.card, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border + '44' },
  item:     { flexDirection: 'row', alignItems: 'center', paddingVertical: Space[4], paddingHorizontal: Space[5], gap: Space[3], borderBottomWidth: 1, borderBottomColor: Colors.border + '11' },
  itemActive: { backgroundColor: Colors.primary + '0a' },
  emoji:    { fontSize: 18 },
});

// ─── Main Component ────────────────────────────────────────────────────────

export function SettingsScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const { signOut, deleteAccount, updateProfile, exportData } = useAuth();

  const [nickname,       setNickname]       = useState(user?.nickname ?? '');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [avatarLoading,  setAvatarLoading]  = useState(false);
  const [signingOut,     setSigningOut]     = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [exporting,      setExporting]      = useState(false);

  // Selector & Info Sheets
  const [activeSelector, setActiveSelector] = useState<'theme' | 'textSize' | null>(null);
  const [activeInfo,     setActiveInfo]     = useState<'privacy' | 'terms' | null>(null);

  useEffect(() => { setNickname(user?.nickname ?? ''); }, [user?.nickname]);

  // ── Action Handlers ──────────────────────────────────────────────────────

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
    Alert.alert('Kami', 'Display name updated! 🌸');
  };

  const handleAvatarPress = async () => {
    if (!user?.id) { Alert.alert('Kami', 'Please sign in again.'); return; }
    const picked = await pickAvatarImage();
    if (!picked.success) {
      if (!picked.cancelled) Alert.alert('Kami', picked.error);
      return;
    }
    setAvatarLoading(true);
    const uploaded = await uploadAvatar(user.id, picked.uri);
    if (!uploaded.success) { setAvatarLoading(false); Alert.alert('Kami', uploaded.error); return; }
    
    // Save relative path, profileRepo resolves fresh signed URL
    const saved = await updateProfile(user.id, { avatarUrl: uploaded.path });
    setAvatarLoading(false);
    if (!saved.success) { Alert.alert('Kami', saved.error); return; }
    Alert.alert('Kami', 'Display photo updated! 🌸');
  };

  const handleTogglePref = async (key: 'dailyReminder' | 'weeklyDigest' | 'streakAlerts', val: boolean) => {
    if (!user?.id) return;
    const r = await updateProfile(user.id, { [key]: val });
    if (!r.success) {
      Alert.alert('Kami', r.error);
    }
  };

  const handleThemeSelect = async (themeId: string) => {
    if (!user?.id) return;
    const r = await updateProfile(user.id, { theme: themeId });
    if (!r.success) Alert.alert('Kami', r.error);
  };

  const handleTextSizeSelect = async (sizeId: string) => {
    if (!user?.id) return;
    const r = await updateProfile(user.id, { textSize: sizeId });
    if (!r.success) Alert.alert('Kami', r.error);
  };

  const handleExportData = async () => {
    if (!user?.id) return;
    setExporting(true);
    const r = await exportData(user.id);
    setExporting(false);
    if (!r.success) { Alert.alert('Kami', r.error); return; }

    try {
      await Share.share({
        message: JSON.stringify(r.data, null, 2),
        title: 'Kami Data Export',
      });
    } catch (e) {
      Alert.alert('Kami', 'Could not open share prompt.');
    }
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
      'Delete Account ⚠️',
      'This will permanently delete your account and all of your data, including photos, notes, goals, and history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Double Confirmation 🚨',
              'Are you absolutely sure? Everything is wiped instantly from the cloud.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    const result = await deleteAccount();
                    setDeleting(false);
                    if (!result.success) Alert.alert('Kami', result.error);
                  }
                }
              ]
            );
          },
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const themeLabel = THEMES.find(t => t.id === (user?.theme ?? 'blush'))?.label ?? 'Blush Pink';
  const sizeLabel  = TEXT_SIZES.find(t => t.id === (user?.textSize ?? 'medium'))?.label ?? 'Medium';

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />

      {/* ── Top Bar ── */}
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
        {/* ── Profile Card ── */}
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

        {/* ── Nickname Editor ── */}
        {editingProfile && (
          <View style={styles.editCard}>
            <KamiText variant="subtitle">Edit display name</KamiText>
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
            value={themeLabel}
            onPress={() => setActiveSelector('theme')}
          />
          <SettingRow
            icon="🔤"
            label="Text Size"
            value={sizeLabel}
            onPress={() => setActiveSelector('textSize')}
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
                value={user?.dailyReminder ?? true}
                onValueChange={(val) => handleTogglePref('dailyReminder', val)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={Colors.primary}
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
                value={user?.weeklyDigest ?? false}
                onValueChange={(val) => handleTogglePref('weeklyDigest', val)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={Colors.primary}
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
                value={user?.streakAlerts ?? true}
                onValueChange={(val) => handleTogglePref('streakAlerts', val)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={Colors.primary}
              />
            }
          />
        </SettingGroup>

        {/* ── Privacy ── */}
        <SettingGroup title="Privacy & Data">
          <SettingRow
            icon="🔒"
            label="Data & Privacy Statement"
            onPress={() => setActiveInfo('privacy')}
          />
          <SettingRow
            icon="📤"
            label={exporting ? "Preparing file..." : "Export My Data"}
            onPress={exporting ? undefined : handleExportData}
            showChevron={!exporting}
            rightEl={exporting ? <ActivityIndicator size="small" color={Colors.primary} /> : undefined}
          />
        </SettingGroup>

        {/* ── About ── */}
        <SettingGroup title="About">
          <SettingRow
            icon="💌"
            label="Send Feedback"
            onPress={() => Alert.alert('Kami', 'Feedback & suggestions read daily at support@kami.app')}
          />
          <SettingRow
            icon="📋"
            label="Terms of Service"
            onPress={() => setActiveInfo('terms')}
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
            label={deleting ? 'Deleting account...' : 'Delete Account'}
            danger
            onPress={deleting ? undefined : handleDeleteAccount}
          />
        </SettingGroup>

        <View style={styles.footer}>
          <Text style={styles.footerHeart}>🌸</Text>
          <KamiText variant="caption" align="center" color={Colors.textMuted}>
            Made with love for your wellbeing
          </KamiText>
        </View>
      </ScrollView>

      {/* ── SELECTOR SHEETS ── */}
      <SelectorSheet
        visible={activeSelector === 'theme'}
        title="Theme Option"
        options={THEMES}
        selectedValue={user?.theme ?? 'blush'}
        onSelect={handleThemeSelect}
        onClose={() => setActiveSelector(null)}
      />

      <SelectorSheet
        visible={activeSelector === 'textSize'}
        title="Text Size"
        options={TEXT_SIZES}
        selectedValue={user?.textSize ?? 'medium'}
        onSelect={handleTextSizeSelect}
        onClose={() => setActiveSelector(null)}
      />

      {/* ── INFO SHEETS ── */}
      <InfoSheet
        visible={activeInfo === 'privacy'}
        title="Privacy Statement"
        content="At Kami, your privacy is our primary engineering metric.\n\nAll personal reflections, moods, goal progress logs, and letters are locked down using database Row Level Security (RLS) policies. Only your logged-in session can access your data.\n\nAll image uploads, memory photos, and profile pictures are hosted in secure, private Supabase Storage buckets. Access to these items requires freshly signed, temporary URLs that are generated client-side and automatically expire.\n\nWe do not monitor, parse, or sell your thoughts, nor do we run analytical telemetry on your journals. You can export your data at any time in raw JSON format using the Export tool."
        onClose={() => setActiveInfo(null)}
      />

      <InfoSheet
        visible={activeInfo === 'terms'}
        title="Terms of Service"
        content="Welcome to Kami. By using this software, you agree to the following conditions:\n\n1. Ownership of Content: You retain full ownership and intellectual copyright of all text, emojis, and photos you upload to the database. We claim zero rights over your entries.\n\n2. Acceptable Use: You must use the database storage responsibly. Refrain from attempting to bypass RLS policies, injecting malicious scripts via triggers, or flooding storage buckets with oversized uploads.\n\n3. Deletion Guarantee: Tapping 'Delete Account' triggers a cascading database query that removes all of your rows and storage objects. This deletion is absolute and cannot be recovered by the team."
        onClose={() => setActiveInfo(null)}
      />
    </SafeAreaView>
  );
}

export default SettingsScreen;

const AVATAR_SIZE = 72;

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.pageBg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    paddingHorizontal: Space[5],
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + Space[2] : Space[2],
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
  avatarInitial: { color: Colors.primary, fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: FontFamily.display },
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
});
