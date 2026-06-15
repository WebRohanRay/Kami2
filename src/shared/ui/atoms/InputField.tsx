import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { Colors, Radii, Sizing, FontSize, Space } from '@shared/constants';
import { useTheme, useTextScale } from '@shared/hooks';

interface InputFieldProps extends TextInputProps {
  icon?: string;
  label?: string;
  isPassword?: boolean;
  error?: string;
  hint?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  icon,
  label,
  isPassword = false,
  error,
  hint,
  style,
  ...rest
}) => {
  const { colors } = useTheme();
  const { scaleSize } = useTextScale();
  const [visible,  setVisible]  = useState(false);
  const [focused,  setFocused]  = useState(false);

  const hasError = Boolean(error);
  const borderColor = hasError
    ? colors.error
    : focused
    ? colors.primary
    : colors.border;

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { fontSize: scaleSize(FontSize.sm), color: colors.textSecondary }]}>{label}</Text> : null}
      <View style={[styles.wrapper, { borderColor, backgroundColor: colors.inputBg }, style as any]}>
        {icon ? (
          <Text style={[styles.icon, { fontSize: scaleSize(FontSize.md), color: colors.textMuted }]} accessibilityElementsHidden>
            {icon}
          </Text>
        ) : null}
        <TextInput
          {...rest}
          style={[styles.input, { fontSize: scaleSize(FontSize.base), color: colors.textPrimary }]}
          secureTextEntry={isPassword && !visible}
          placeholderTextColor={colors.textMuted}
          autoCapitalize={rest.autoCapitalize ?? 'none'}
          onFocus={e => { setFocused(true);  rest.onFocus?.(e);  }}
          onBlur={e  => { setFocused(false); rest.onBlur?.(e);   }}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setVisible(v => !v)}
            style={styles.eyeBtn}
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.eyeIcon, { fontSize: scaleSize(FontSize.base), color: colors.textMuted }]}>{visible ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {(error || hint) ? (
        <Text style={[styles.helper, { color: hasError ? colors.error : colors.textMuted, fontSize: scaleSize(FontSize.xs) }]}>
          {error ?? hint}
        </Text>
      ) : null}
    </View>
  );
};

export default InputField;

const styles = StyleSheet.create({
  container: { gap: Space[1] },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginLeft: Space[1],
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Sizing.inputHeight,
    borderWidth: 1.5,
    borderRadius: Radii.input,
    paddingHorizontal: Space[4],
    gap: Space[2] + 2,
  },
  icon: {
    fontSize: FontSize.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: FontSize.base,
  },
  eyeBtn: { padding: Space[1] },
  eyeIcon: { fontSize: FontSize.base },
  helper: {
    fontSize: FontSize.xs,
    marginLeft: Space[1],
  },
});
