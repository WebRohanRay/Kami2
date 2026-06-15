/**
 * MainNavigator — bottom tab navigator with custom tab bar
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '@features/home';
import { JournalScreen } from '@features/journal';
import { MemoriesScreen } from '@features/memories';
import { GoalsScreen } from '@features/goals';
import { FutureScreen } from '@features/future';
import { SettingsScreen } from '@features/settings';
import TimelineScreen from '@features/couple/screens/TimelineScreen';

import { useAuthStore } from '@features/auth';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TABS = [
  { name: 'Home', emoji: '✦', label: 'Home' },
  { name: 'Journal', emoji: '📓', label: 'Journal' },
  { name: 'Memories', emoji: '📸', label: 'Memories' },
  { name: 'Goals', emoji: '🌱', label: 'Goals' },
  { name: 'Future', emoji: '✨', label: 'Future' },
] as const;

// ─── Custom tab bar ───────────────────────────────────────────────────────────

function KamiTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  // Only render tabs that are in our TABS list (hides Settings)
  const visibleRoutes = state.routes.filter(r => TABS.some(t => t.name === r.name));
  const activeSpace = useAuthStore((s) => s.user?.activeSpace) ?? 'personal';

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const tab = TABS.find(t => t.name === route.name)!;
          const isFocused = state.routes[state.index].name === route.name;
          const descriptor = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const tabEmoji = route.name === 'Future'
            ? (activeSpace === 'couple' ? '✉️' : '✨')
            : tab.emoji;

          const tabLabel = route.name === 'Future'
            ? (activeSpace === 'couple' ? 'Letters' : 'Future')
            : tab.label;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={tabLabel}
              accessibilityState={{ selected: isFocused }}
              style={styles.item}
              activeOpacity={0.7}
            >
              {/* Pill indicator behind active item */}
              {isFocused && <View style={styles.pill} />}

              <Text style={[styles.emoji, { opacity: isFocused ? 1 : 0.4 }]}>
                {tabEmoji}
              </Text>
              <Text style={[styles.label, { color: isFocused ? colors.primary : colors.textMuted }]}>
                {tabLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: colors.cardBg,
      borderTopWidth: 1,
      borderTopColor: colors.border + '55',
      paddingBottom: Platform.OS === 'ios' ? 20 : 8,
      paddingTop: Space[2],
      paddingHorizontal: Space[2],
      ...Shadows.md,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: Space[2],
      position: 'relative',
    },
    pill: {
      position: 'absolute',
      top: 0,
      width: 44,
      height: '85%',
      borderRadius: Radii.xl,
      backgroundColor: colors.primary + '15',
    },
    emoji: {
      fontSize: FontSize.lg,
      lineHeight: FontSize.lg + 4,
    },
    label: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      letterSpacing: 0.2,
    },
  });

// ─── Navigator ────────────────────────────────────────────────────────────────

const MainNavigator: React.FC = () => (
  <Tab.Navigator
    tabBar={(props) => <KamiTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Journal" component={JournalScreen} />
    <Tab.Screen name="Memories" component={MemoriesScreen} />
    <Tab.Screen name="Goals" component={GoalsScreen} />
    <Tab.Screen name="Future" component={FutureScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
    <Tab.Screen name="Timeline" component={TimelineScreen} />
  </Tab.Navigator>
);

export { MainNavigator };
export default MainNavigator;
