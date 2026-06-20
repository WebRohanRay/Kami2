import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Image, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Space, Radii, Shadows, FontFamily } from '@shared/constants';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';
import { SPACE_THEMES, WIDGET_SIZES, getSpaceThemeConfig } from '../types';
import type { WidgetSize } from '../types';

/**
 * Screen 8 — Space Settings
 * Widget nickname, partner info, theme, mood toggle, haptics, disconnect.
 */
const SpaceSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const space = usePartnerSpaceStore((s) => s.space);
  const setSpace = usePartnerSpaceStore((s) => s.setSpace);
  const couple = useCoupleStore((s) => s.couple);
  const partner = useCoupleStore((s) => s.partner);
  const spaceLoading = usePartnerSpaceStore((s) => s.spaceLoading);

  const [nickname, setNickname] = useState(space?.nickname || 'Our Wall');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const themeOptions = useMemo(
    () => SPACE_THEMES.map((theme) => getSpaceThemeConfig(theme.id, colors)),
    [colors]
  );

  useEffect(() => {
    if (space?.nickname && !isEditingNickname) {
      setNickname(space.nickname);
    }
  }, [space?.nickname, isEditingNickname]);

  const saveNickname = useCallback(async () => {
    if (!space) return;
    const res = await SpaceService.updateSpace(space.id, { nickname });
    if (res.success) {
      setSpace(res.data);
    }
    setIsEditingNickname(false);
  }, [space, nickname, setSpace]);

  const toggleTimeMood = useCallback(async (value: boolean) => {
    if (!space) return;
    const res = await SpaceService.updateSpace(space.id, { timeMoodEnabled: value });
    if (res.success) {
      setSpace(res.data);
    }
  }, [space, setSpace]);

  const selectTheme = useCallback(async (themeId: string) => {
    if (!space) return;
    const res = await SpaceService.updateSpace(space.id, { theme: themeId as any });
    if (res.success) {
      setSpace(res.data);
    }
  }, [space, setSpace]);

  const selectWidgetSize = useCallback(async (size: WidgetSize) => {
    if (!space) return;
    const res = await SpaceService.updateSpace(space.id, { widgetSize: size });
    if (res.success) {
      setSpace(res.data);
    }
  }, [space, setSpace]);

  if (!space) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.pageBg }]}>
        {spaceLoading === 'error' ? null : <ActivityIndicator color={colors.primary} />}
        <Text style={[styles.centerStateText, { color: colors.textMuted }]}>
          {spaceLoading === 'error' ? 'Unable to load partner space.' : 'Loading partner space...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Settings ⚙️</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Widget Nickname */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Widget Name</Text>
          <View style={[styles.card, { backgroundColor: colors.cardBg, ...Shadows.sm }]}>
            {isEditingNickname ? (
              <View style={styles.nicknameEditRow}>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  style={[styles.nicknameInput, { color: colors.textPrimary, borderColor: colors.primary }]}
                  maxLength={30}
                  autoFocus
                  placeholder="e.g. Our Little Corner"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity onPress={saveNickname} style={[styles.saveNicknameBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.saveNicknameBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setIsEditingNickname(true)} style={styles.nicknameRow}>
                <Text style={[styles.nicknameText, { color: colors.textPrimary }]}>
                  {space?.nickname || 'Our Wall'}
                </Text>
                <Text style={[styles.editLabel, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Partner Info */}
        {partner && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Partner</Text>
            <View style={[styles.card, { backgroundColor: colors.cardBg, ...Shadows.sm }]}>
              <View style={styles.partnerRow}>
                {partner.avatarUrl ? (
                  <Image source={{ uri: partner.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={styles.avatarEmoji}>💕</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.partnerName, { color: colors.textPrimary }]}>{partner.nickname}</Text>
                  <Text style={[styles.connectedSince, { color: colors.textMuted }]}>
                    Connected since {couple?.createdAt ? new Date(couple.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'recently'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Theme Picker */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Theme</Text>
          <View style={styles.themeRow}>
            {themeOptions.map((theme) => (
              <TouchableOpacity
                key={theme.id}
                onPress={() => selectTheme(theme.id)}
                style={[
                  styles.themeOption,
                  { backgroundColor: theme.background, borderColor: theme.borderColor },
                  space?.theme === theme.id && styles.themeOptionSelected,
                ]}
              >
                <Text style={[styles.themeOptionLabel, { color: theme.textColor }]}>
                  {theme.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Widget Size */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Widget Size</Text>
          <View style={styles.sizeRow}>
            {(Object.keys(WIDGET_SIZES) as WidgetSize[]).map((size) => {
              const active = space.widgetSize === size;
              return (
                <TouchableOpacity
                  key={size}
                  onPress={() => selectWidgetSize(size)}
                  style={[
                    styles.sizeOption,
                    { backgroundColor: active ? colors.primary : colors.cardBg, borderColor: active ? colors.primary : colors.border },
                  ]}
                >
                  <Text style={[styles.sizeLabel, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                    {WIDGET_SIZES[size].label}
                  </Text>
                  <Text style={[styles.sizeMeta, { color: active ? 'rgba(255,255,255,0.75)' : colors.textMuted }]}>
                    {WIDGET_SIZES[size].maxVisibleItems} items
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Toggles */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Preferences</Text>
          <View style={[styles.card, { backgroundColor: colors.cardBg, ...Shadows.sm }]}>
            <View style={[styles.toggleRow, { borderBottomColor: colors.divider }]}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleEmoji}>🌅</Text>
                <View>
                  <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Time-Based Moods</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>Auto-shift widget colors by time of day</Text>
                </View>
              </View>
              <Switch
                value={space?.timeMoodEnabled ?? true}
                onValueChange={toggleTimeMood}
                trackColor={{ false: colors.divider, true: colors.primary + '60' }}
                thumbColor={space?.timeMoodEnabled ? colors.primary : '#CCC'}
              />
            </View>
          </View>
        </View>

        {/* Scheduled Drops link */}
        <View>
          <TouchableOpacity
            onPress={() => navigation.navigate('ScheduledDrops')}
            style={[styles.linkCard, { backgroundColor: colors.cardBg, ...Shadows.sm }]}
          >
            <Text style={styles.linkEmoji}>⏰</Text>
            <Text style={[styles.linkText, { color: colors.textPrimary }]}>Manage Scheduled Drops</Text>
            <Text style={[styles.linkArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

export default SpaceSettingsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Space[12], paddingBottom: Space[3], paddingHorizontal: Space[4], borderBottomWidth: 1,
  },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space[3] },
  centerStateText: { fontSize: FontSize.sm },
  backButton: { padding: Space[2] },
  backText: { fontSize: FontSize.base },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  content: { padding: Space[4] },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Space[3], marginTop: Space[4] },
  card: { borderRadius: Radii.card, padding: Space[4] },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nicknameText: { fontSize: FontSize.lg, fontFamily: FontFamily.display },
  editLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  nicknameEditRow: { flexDirection: 'row', gap: Space[3], alignItems: 'center' },
  nicknameInput: {
    flex: 1, fontSize: FontSize.base, borderWidth: 1, borderRadius: Radii.input,
    paddingHorizontal: Space[3], paddingVertical: Space[2],
  },
  saveNicknameBtn: { paddingHorizontal: Space[4], paddingVertical: Space[2], borderRadius: Radii.button },
  saveNicknameBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 22 },
  partnerName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  connectedSince: { fontSize: FontSize.xs, marginTop: 2 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] },
  themeOption: {
    width: '30%', aspectRatio: 1.2, borderRadius: Radii.lg, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', padding: Space[2],
  },
  themeOptionSelected: { borderWidth: 3 },
  themeOptionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, textAlign: 'center' },
  sizeRow: { flexDirection: 'row', gap: Space[3] },
  sizeOption: {
    flex: 1,
    borderRadius: Radii.lg,
    borderWidth: 1,
    paddingVertical: Space[3],
    alignItems: 'center',
  },
  sizeLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  sizeMeta: { fontSize: FontSize.xs, marginTop: 2 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Space[2],
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Space[3] },
  toggleEmoji: { fontSize: 22 },
  toggleLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  toggleDesc: { fontSize: FontSize.xs, marginTop: 1 },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: Radii.card, padding: Space[4],
    marginTop: Space[4], gap: Space[3],
  },
  linkEmoji: { fontSize: 22 },
  linkText: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.medium },
  linkArrow: { fontSize: FontSize.lg },
});
