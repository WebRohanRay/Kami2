import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radii, Sizing, FontSize, FontWeight, Space } from '@shared/constants';

export interface SocialProvider {
  id: string;
  label: string;
  emoji: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const DEFAULT_PROVIDERS: SocialProvider[] = [
  { id: 'google', label: 'Google', emoji: '🌐' },
  { id: 'apple', label: 'Apple', emoji: '🍎' },
];

interface SocialLoginRowProps {
  providers?: SocialProvider[];
}

const SocialLoginRow: React.FC<SocialLoginRowProps> = ({ providers = DEFAULT_PROVIDERS }) => (
  <View style={styles.row}>
    {providers.map(({ id, label, emoji, onPress, loading, disabled }) => (
      <TouchableOpacity
        key={id}
        style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
        activeOpacity={0.78}
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={`Continue with ${label}`}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="small" />
        ) : (
          <>
            <Text style={styles.emoji}>{emoji}</Text>
            <Text style={styles.label}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    ))}
  </View>
);

export default SocialLoginRow;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Space[3] },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: Sizing.socialHeight,
    backgroundColor: Colors.cardBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.button,
    gap: Space[2],
  },
  btnDisabled: { opacity: 0.55 },
  emoji: { fontSize: FontSize.md },
  label: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
});
