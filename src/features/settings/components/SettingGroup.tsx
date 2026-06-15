import React from 'react';
import { StyleSheet, View } from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { Radii, Shadows, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';

interface SettingGroupProps {
  title: string;
  children: React.ReactNode;
}

export const SettingGroup: React.FC<SettingGroupProps> = ({ title, children }) => {
  const { colors } = useTheme();
  const groupStyles = getStyles(colors);

  return (
    <View style={groupStyles.wrap}>
      <KamiText variant="overline" style={groupStyles.title}>{title}</KamiText>
      <View style={groupStyles.card}>
        {React.Children.map(children, (child, i) => (
          <React.Fragment key={i}>
            {child}
            {i < React.Children.count(children) - 1 && <View style={groupStyles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  wrap: { gap: Space[2] },
  title: { paddingHorizontal: Space[1], marginBottom: Space[1] },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: colors.border + '55',
    overflow: 'hidden',
    ...Shadows.card,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border + '44',
    marginLeft: 36 + Space[3] + Space[4],
  },
});
