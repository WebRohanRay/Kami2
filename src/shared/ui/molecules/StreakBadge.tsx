import React from 'react';
import { StyleSheet, View } from 'react-native';
import KamiText from '../atoms/KamiText';
import { Colors, Radii, Shadows, Space, FontSize, FontWeight } from '@shared/constants';

interface StreakBadgeProps {
  count: number;
  label?: string;
}

const StreakBadge: React.FC<StreakBadgeProps> = ({ count, label = 'day streak' }) => (
  <View style={styles.badge}>
    <KamiText style={styles.flame}>🔥</KamiText>
    <View>
      <KamiText style={styles.count}>{count}</KamiText>
      <KamiText variant="caption">{label}</KamiText>
    </View>
  </View>
);

export default StreakBadge;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '18',
    borderRadius: Radii.lg,
    paddingHorizontal: Space[4],
    paddingVertical: Space[2],
    gap: Space[2],
    alignSelf: 'flex-start',
    ...Shadows.sm,
  },
  flame: { fontSize: FontSize.xl },
  count: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.warning,
  },
});
