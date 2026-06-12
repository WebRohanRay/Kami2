import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Radii, Shadows, Space, FontSize, FontWeight } from '@shared/constants';
import { useTheme, useTextScale } from '@shared/hooks';

export interface TabItem {
  id:    string;
  icon:  string;
  label: string;
}

const DEFAULT_TABS: TabItem[] = [
  { id: 'home',    icon: '🏡', label: 'Home'    },
  { id: 'journal', icon: '📓', label: 'Journal' },
  { id: 'memories',icon: '📸', label: 'Memories'},
  { id: 'goals',   icon: '🌱', label: 'Goals'   },
  { id: 'future',  icon: '✨', label: 'Future'  },
];

interface TabBarProps {
  tabs?:      TabItem[];
  active:     string;
  onPress:    (id: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs = DEFAULT_TABS, active, onPress }) => {
  const { colors } = useTheme();
  const { scaleSize } = useTextScale();

  return (
    <View style={styles.bar}>
      {tabs.map(tab => {
        const isActive = tab.id === active;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.item}
            onPress={() => onPress(tab.id)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {isActive && <View style={[styles.pill, { backgroundColor: colors.primary }]} />}
            <Text style={[styles.icon, isActive && styles.iconActive, { fontSize: scaleSize(FontSize.xl) }]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && [styles.labelActive, { color: colors.primary }], { fontSize: scaleSize(FontSize.xs) }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default TabBar;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217,193,196,0.4)',
    paddingTop: Space[2],
    paddingBottom: Platform.OS === 'ios' ? Space[6] : Space[3],
    zIndex: 10,
    ...Shadows.md,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: -Space[2],
    width: 24,
    height: 3,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
  },
  icon: {
    fontSize: FontSize.xl,
    opacity: 0.45,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
});
