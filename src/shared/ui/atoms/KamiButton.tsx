import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { Colors, Radii, Sizing, FontSize, FontWeight, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize    = 'sm' | 'md' | 'lg';

interface KamiButtonProps extends TouchableOpacityProps {
  label: string;
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  icon?:      string;
  fullWidth?: boolean;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: Sizing.buttonHeight, lg: 60 };
const FONT:   Record<ButtonSize, number> = { sm: FontSize.sm, md: FontSize.base, lg: FontSize.md };

const KamiButton: React.FC<KamiButtonProps> = ({
  label,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  icon,
  fullWidth = true,
  style,
  disabled,
  ...rest
}) => {
  const { colors } = useTheme();
  const h  = HEIGHT[size];
  const fs = FONT[size];
  const w  = fullWidth ? '100%' : undefined;

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        disabled={disabled || loading}
        style={[styles.base, { backgroundColor: colors.primary }, { height: h, width: w }, disabled && styles.primaryDisabled, style]}
        accessibilityRole="button"
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <View style={styles.row}>
            {icon ? <Text style={[styles.primaryLabel, { fontSize: fs + 2 }]}>{icon}</Text> : null}
            <Text style={[styles.primaryLabel, { fontSize: fs }]}>{label}</Text>
            <Text style={styles.arrow}>›</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        activeOpacity={0.78}
        disabled={disabled || loading}
        style={[styles.base, { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: 'transparent' }, { height: h, width: w }, style]}
        accessibilityRole="button"
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <View style={styles.row}>
            {icon ? <Text style={[styles.secondaryLabel, { color: colors.primary }, { fontSize: fs + 2 }]}>{icon}</Text> : null}
            <Text style={[styles.secondaryLabel, { color: colors.primary }, { fontSize: fs }]}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'ghost') {
    return (
      <TouchableOpacity
        activeOpacity={0.6}
        disabled={disabled}
        style={[{ height: h, justifyContent: 'center', alignItems: 'center' }, style]}
        accessibilityRole="button"
        {...rest}
      >
        <View style={styles.row}>
          {icon ? <Text style={[styles.ghostLabel, { color: colors.primary }, { fontSize: fs + 2 }]}>{icon}</Text> : null}
          <Text style={[styles.ghostLabel, { color: colors.primary }, { fontSize: fs }]}>{label}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // danger
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={disabled || loading}
      style={[styles.base, styles.danger, { height: h, width: w }, style]}
      accessibilityRole="button"
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={[styles.primaryLabel, { fontSize: fs }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

export default KamiButton;

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.button,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  primaryDisabled: {
    backgroundColor: Colors.border,
  },
  secondary: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.error,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
  },
  primaryLabel: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  secondaryLabel: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
  ghostLabel: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
    textDecorationLine: 'underline',
  },
  arrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.regular,
    marginTop: -1,
  },
});
