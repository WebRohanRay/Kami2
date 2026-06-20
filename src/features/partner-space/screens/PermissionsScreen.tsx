import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Space, Radii, Shadows, FontFamily } from '@shared/constants';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';

/**
 * Screen 5 — Permissions (Owner Only)
 * Content and behavior toggles, Clear Widget button.
 */
const PermissionsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const permissions = usePartnerSpaceStore((s) => s.permissions);
  const space = usePartnerSpaceStore((s) => s.space);
  const setPermissions = usePartnerSpaceStore((s) => s.setPermissions);
  const setItems = usePartnerSpaceStore((s) => s.setItems);
  const permissionsLoading = usePartnerSpaceStore((s) => s.permissionsLoading);

  const [isClearing, setIsClearing] = useState(false);

  const togglePermission = useCallback(async (key: string, value: boolean) => {
    if (!permissions?.spaceId) return;
    const updates = { [key]: value };
    const res = await SpaceService.updatePermissions(permissions.spaceId, updates);
    if (res.success) {
      setPermissions(res.data);
    }
  }, [permissions?.spaceId, setPermissions]);

  const handleClearWidget = useCallback(() => {
    Alert.alert(
      'Clear everything? 🧹',
      'This will remove all items from the widget. Your partner won\'t be notified. Items will still be in history.',
      [
        { text: 'Keep them 💕', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            if (!space?.id) return;
            setIsClearing(true);
            const res = await SpaceService.clearAllItems(space.id);
            if (res.success) {
              setItems([]);
            }
            setIsClearing(false);
          },
        },
      ]
    );
  }, [space?.id, setItems]);

  const ToggleRow: React.FC<{ emoji: string; label: string; description: string; value: boolean; permKey: string }> = ({
    emoji, label, description, value, permKey,
  }) => (
    <View style={[styles.toggleRow, { borderBottomColor: colors.divider }]}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleEmoji}>{emoji}</Text>
        <View style={styles.toggleTextContainer}>
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{label}</Text>
          <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => togglePermission(permKey, v)}
        trackColor={{ false: colors.divider, true: colors.primary + '60' }}
        thumbColor={value ? colors.primary : '#CCC'}
      />
    </View>
  );

  if (!permissions) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.pageBg }]}>
        {permissionsLoading === 'error' ? null : <ActivityIndicator color={colors.primary} />}
        <Text style={[styles.centerStateText, { color: colors.textMuted }]}>
          {permissionsLoading === 'error' ? 'Unable to load partner permissions.' : 'Loading partner permissions...'}
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
        <Text style={[styles.title, { color: colors.textPrimary }]}>Permissions 🔒</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Content permissions */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            What your partner can add
          </Text>
          <View style={[styles.card, { backgroundColor: colors.cardBg, ...Shadows.sm }]}>
            <ToggleRow emoji="📸" label="Photos" description="Allow partner to add photos" value={permissions.allowPhotos} permKey="allowPhotos" />
            <ToggleRow emoji="💌" label="Notes" description="Allow partner to leave notes" value={permissions.allowNotes} permKey="allowNotes" />
            <ToggleRow emoji="😊" label="Stickers" description="Allow partner to place stickers" value={permissions.allowStickers} permKey="allowStickers" />
            <ToggleRow emoji="🎁" label="Gifts" description="Allow partner to leave surprises" value={permissions.allowGifts} permKey="allowGifts" />
            <ToggleRow emoji="⏰" label="Scheduled Drops" description="Allow timed content" value={permissions.allowScheduledDrops} permKey="allowScheduledDrops" />
            <ToggleRow emoji="🫧" label="Disappearing Items" description="Items that fade away" value={permissions.allowDisappearing} permKey="allowDisappearing" />
          </View>
        </View>

        {/* Behavior permissions */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            What your partner can do
          </Text>
          <View style={[styles.card, { backgroundColor: colors.cardBg, ...Shadows.sm }]}>
            <ToggleRow emoji="↔️" label="Move & Resize" description="Allow partner to rearrange items" value={permissions.allowPartnerMove} permKey="allowPartnerMove" />
            <ToggleRow emoji="🗑️" label="Delete Items" description="Allow partner to remove items" value={permissions.allowPartnerDelete} permKey="allowPartnerDelete" />
          </View>
        </View>

        {/* Blocked content notice */}
        <View>
          <View style={[styles.infoCard, { backgroundColor: colors.creamDeep }]}>
            <Text style={styles.infoEmoji}>💕</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              When you turn something off, your partner will see a sweet message explaining why they can't add it right now. Nothing harsh — always kind.
            </Text>
          </View>
        </View>

        {/* Clear Widget */}
        <View>
          <TouchableOpacity
            onPress={handleClearWidget}
            disabled={isClearing}
            style={[styles.clearBtn, { borderColor: colors.error }]}
          >
            <Text style={[styles.clearBtnText, { color: colors.error }]}>
              {isClearing ? 'Clearing...' : '🧹 Clear Widget'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

export default PermissionsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Space[12], paddingBottom: Space[3], paddingHorizontal: Space[4], borderBottomWidth: 1,
  },
  backButton: { padding: Space[2] },
  backText: { fontSize: FontSize.base },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  content: { padding: Space[4] },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Space[3], marginTop: Space[4] },
  card: { borderRadius: Radii.card, overflow: 'hidden' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Space[3], paddingHorizontal: Space[4], borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Space[3] },
  toggleEmoji: { fontSize: 22 },
  toggleTextContainer: { flex: 1 },
  toggleLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  toggleDesc: { fontSize: FontSize.xs, marginTop: 1 },
  infoCard: { borderRadius: Radii.card, padding: Space[4], flexDirection: 'row', gap: Space[3], marginTop: Space[4], alignItems: 'center' },
  infoEmoji: { fontSize: 24 },
  infoText: { fontSize: FontSize.sm, lineHeight: 20, flex: 1 },
  clearBtn: {
    marginTop: Space[6], borderWidth: 2, borderRadius: Radii.button,
    paddingVertical: Space[3], alignItems: 'center',
  },
  clearBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space[3] },
  centerStateText: { fontSize: FontSize.sm },
});
