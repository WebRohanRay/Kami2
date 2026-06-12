import React from 'react';
import { StyleSheet, TouchableOpacity, Text, ViewStyle } from 'react-native';
import { Colors, Radii, FontSize, FontWeight, Space } from '@shared/constants';
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
          { backgroundColor: '#ffe4e6', borderColor: '#f43f5e' },
          style,
        ]}
      >
        <Text style={[styles.icon, { color: '#e11d48' }]}>⚠️</Text>
        <Text style={[styles.text, { color: '#e11d48' }]}>Sync Conflict</Text>
      </TouchableOpacity>
    );
  }

  // Pending insert or update
  return (
    <TouchableOpacity
      disabled={true}
      style={[
        styles.badge,
        { backgroundColor: '#fef3c7', borderColor: '#d97706' },
        style,
      ]}
    >
      <Text style={[styles.icon, { color: '#d97706' }]}>⏳</Text>
      <Text style={[styles.text, { color: '#d97706' }]}>Saving locally</Text>
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
