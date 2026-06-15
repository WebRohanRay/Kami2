import React from 'react';
import { StyleSheet, TouchableOpacity, Text, ViewStyle } from 'react-native';
import { Colors, Radii, FontSize, FontWeight, Space, Opacity } from '@shared/constants';
import { useTheme } from '@shared/hooks';

interface SyncStatusBadgeProps {
  status: 'synced' | 'pending_insert' | 'pending_update' | 'conflict';
  onPressConflict?: () => void;
  style?: ViewStyle;
}

const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ status, onPressConflict, style }) => {
  const { colors } = useTheme();

  if (status === 'synced') return null;

  if (status === 'conflict') {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPressConflict}
        style={[
          styles.badge,
          { backgroundColor: colors.error + Opacity.subtle, borderColor: colors.error },
          style,
        ]}
      >
        <Text style={[styles.icon, { color: colors.error }]}>⚠️</Text>
        <Text style={[styles.text, { color: colors.error }]}>Sync Conflict</Text>
      </TouchableOpacity>
    );
  }

  // Pending insert or update
  return (
    <TouchableOpacity
      disabled={true}
      style={[
        styles.badge,
        { backgroundColor: colors.warning + Opacity.subtle, borderColor: colors.warning },
        style,
      ]}
    >
      <Text style={[styles.icon, { color: colors.warning }]}>⏳</Text>
      <Text style={[styles.text, { color: colors.warning }]}>Saving locally</Text>
    </TouchableOpacity>
  );
};

export default SyncStatusBadge;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    gap: 6,
  },
  icon: { fontSize: FontSize.xs },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
});
