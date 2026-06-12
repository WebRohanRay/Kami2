import React from 'react';
import { StyleSheet, View } from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, Radii, Shadows, Space } from '@shared/constants';

interface SettingGroupProps {
  title: string;
  children: React.ReactNode;
}

export const SettingGroup: React.FC<SettingGroupProps> = ({ title, children }) => (
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

const groupStyles = StyleSheet.create({
  wrap: { gap: Space[2] },
  title: { paddingHorizontal: Space[1], marginBottom: Space[1] },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border + '55',
    overflow: 'hidden',
    ...Shadows.card,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border + '44',
    marginLeft: 36 + Space[3] + Space[4],
  },
});
