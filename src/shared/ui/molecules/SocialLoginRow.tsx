import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Radii, FontSize, FontWeight, Space, Opacity } from '@shared/constants';
import { useTheme } from '@shared/hooks';

export interface SocialProvider {
  id: string;
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  emoji?: string;
}

// ─── Google "G" SVG-style drawn with Text layers ─────────────────────────────
// Uses the real Google brand colours in four text spans

const GoogleIcon: React.FC = () => (
  <View style={icon.wrap}>
    {/* Outer coloured ring segments approximated via a bold "G" with clipping */}
    <Text style={icon.g}>
      <Text style={{ color: '#4285F4' }}>G</Text>
    </Text>
    {/* colour dot row under the G — mimics the four-colour dot bar */}
    <View style={icon.dots}>
      <View style={[icon.dot, { backgroundColor: '#4285F4' }]} />
      <View style={[icon.dot, { backgroundColor: '#EA4335' }]} />
      <View style={[icon.dot, { backgroundColor: '#FBBC05' }]} />
      <View style={[icon.dot, { backgroundColor: '#34A853' }]} />
    </View>
  </View>
);

const icon = StyleSheet.create({
  wrap: { alignItems: 'center', width: 28 },
  g: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.5,
  },
  dots: { flexDirection: 'row', gap: 2, marginTop: 1 },
  dot:  { width: 4, height: 4, borderRadius: 2 },
});

// ─── Single Google button ─────────────────────────────────────────────────────

const GoogleButton: React.FC<{
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
}> = ({ label, onPress, loading, disabled }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${label}`}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      <Animated.View
        style={[
          styles.wrap,
          (disabled || loading) && styles.disabled,
          { transform: [{ scale }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <>
            {/* Left: white pill with the G icon */}
            <View style={styles.iconPill}>
              <GoogleIcon />
            </View>

            {/* Centre label */}
            <Text style={styles.label}>Continue with {label}</Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: Radii.button,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: Space[2],
    gap: 0,
    // subtle shadow so it pops off the cream background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  disabled: { opacity: 0.5 },
  iconPill: {
    width: 44,
    height: 38,
    borderRadius: Radii.sm,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space[2],
    borderWidth: 1,
    borderColor: colors.border + Opacity.medium,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: 0.1,
    // offset the icon width so text is visually centred across full button
    marginRight: 44 + Space[2],
  },
});

// ─── Row (public API unchanged) ───────────────────────────────────────────────

interface SocialLoginRowProps {
  providers?: SocialProvider[];
}

const SocialLoginRow: React.FC<SocialLoginRowProps> = ({ providers = [] }) => (
  <View style={{ gap: Space[3] }}>
    {providers.map((p) => (
      <GoogleButton
        key={p.id}
        label={p.label}
        onPress={p.onPress}
        loading={p.loading}
        disabled={p.disabled}
      />
    ))}
  </View>
);

export default SocialLoginRow;
