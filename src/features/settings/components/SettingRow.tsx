import React, { useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
  rightEl?: React.ReactNode;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
  danger,
  rightEl,
}) => {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      onPressIn={onPress ? onPressIn : undefined}
      onPressOut={onPress ? onPressOut : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
    >
      <Animated.View style={[rowStyles.row, { transform: [{ scale }] }]}>
        <View style={[rowStyles.iconWrap, { backgroundColor: colors.creamDeep }]}>
          <Text style={rowStyles.icon}>{icon}</Text>
        </View>
        <View style={rowStyles.middle}>
          <KamiText
            variant="body"
            color={danger ? Colors.error : Colors.textPrimary}
            bold={danger}
          >
            {label}
          </KamiText>
          {value ? (
            <KamiText variant="caption" color={Colors.textMuted}>{value}</KamiText>
          ) : null}
        </View>
        {rightEl ?? (
          showChevron && onPress ? (
            <Text style={[rowStyles.chevron, danger && { color: Colors.error }]}>›</Text>
          ) : null
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space[3] + 2,
    paddingHorizontal: Space[4],
    gap: Space[3],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: FontSize.md },
  middle: { flex: 1, gap: 1 },
  chevron: { fontSize: FontSize.xl, color: Colors.textMuted, marginTop: -2 },
});
