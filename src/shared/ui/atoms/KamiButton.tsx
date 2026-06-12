import React, { useRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  Animated,
} from 'react-native';
import { Colors, Radii, Sizing, FontSize, FontWeight, Space } from '@shared/constants';
import { useTheme, useTextScale } from '@shared/hooks';

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
  const { scaleSize } = useTextScale();
  const h  = HEIGHT[size];
  const fs = scaleSize(FONT[size]);
  const w  = fullWidth ? '100%' : undefined;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    const targetScale = variant === 'danger' ? 0.95 : 0.97;
    const targetOpacity = variant === 'primary' ? 0.85 : 1.0;
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: targetScale, duration: 100, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: targetOpacity, duration: 100, useNativeDriver: true })
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 1.0, duration: 100, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1.0, duration: 100, useNativeDriver: true })
    ]).start();
  };

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.primary : '#fff'} size="small" />;
    }
    
    return (
      <View style={styles.row}>
        {icon ? (
          <Text style={[
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && [styles.secondaryLabel, { color: colors.primary }],
            variant === 'ghost' && [styles.ghostLabel, { color: colors.primary }],
            variant === 'danger' && styles.primaryLabel,
            { fontSize: fs + scaleSize(2) }
          ]}>{icon}</Text>
        ) : null}
        <Text style={[
          variant === 'primary' && styles.primaryLabel,
          variant === 'secondary' && [styles.secondaryLabel, { color: colors.primary }],
          variant === 'ghost' && [styles.ghostLabel, { color: colors.primary }],
          variant === 'danger' && styles.primaryLabel,
          { fontSize: fs }
        ]}>{label}</Text>
        {variant === 'primary' ? <Text style={[styles.arrow, { fontSize: scaleSize(FontSize.lg) }]}>›</Text> : null}
      </View>
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      disabled={disabled || loading}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.base,
        variant === 'primary' && [{ backgroundColor: colors.primary }, disabled && styles.primaryDisabled],
        variant === 'secondary' && { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: 'transparent' },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        variant === 'danger' && styles.danger,
        { height: h, width: w },
        style
      ]}
      accessibilityRole="button"
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}>
        {renderContent()}
      </Animated.View>
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
