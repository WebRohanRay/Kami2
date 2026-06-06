import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Radii, FontSize, FontWeight, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'muted' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: string;
  style?: ViewStyle;
}

const Badge: React.FC<BadgeProps> = ({ label, variant = 'primary', icon, style }) => {
  const { colors } = useTheme();

  const bgColors: Record<BadgeVariant, string> = {
    primary: colors.primary + '22',
    success: Colors.success + '22',
    warning: Colors.warning + '22',
    muted:   Colors.border + '55',
    accent:  colors.accent  + '22',
  };
  const textColors: Record<BadgeVariant, string> = {
    primary: colors.primary,
    success: Colors.success,
    warning: Colors.warning,
    muted:   Colors.textMuted,
    accent:  colors.accent,
  };

  return (
    <View style={[styles.badge, { backgroundColor: bgColors[variant] }, style]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.text, { color: textColors[variant] }]}>{label}</Text>
    </View>
  );
};

export default Badge;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radii.sm,
    gap: Space[1],
  },
  icon: { fontSize: FontSize.xs },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
});
