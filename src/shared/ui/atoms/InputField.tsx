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
import { useTheme } from '@shared/hooks';

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
  const [visible,  setVisible]  = useState(false);
  const [focused,  setFocused]  = useState(false);

  const hasError = Boolean(error);
  const borderColor = hasError
    ? Colors.error
    : focused
    ? colors.primary
    : Colors.border;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.wrapper, { borderColor }, style as any]}>
        {icon ? (
          <Text style={styles.icon} accessibilityElementsHidden>
            {icon}
          </Text>
        ) : null}
        <TextInput
          {...rest}
          style={styles.input}
          secureTextEntry={isPassword && !visible}
          placeholderTextColor="rgba(84,66,69,0.40)"
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
            <Text style={styles.eyeIcon}>{visible ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {(error || hint) ? (
        <Text style={[styles.helper, hasError && { color: Colors.error }]}>
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
    color: Colors.textSecondary,
    marginLeft: Space[1],
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Sizing.inputHeight,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderRadius: Radii.input,
    paddingHorizontal: Space[4],
    gap: Space[2] + 2,
  },
  icon: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  eyeBtn: { padding: Space[1] },
  eyeIcon: { fontSize: FontSize.base, color: Colors.textMuted },
  helper: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginLeft: Space[1],
  },
});
