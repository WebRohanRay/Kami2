/**
 * MainNavigator.tsx
 *
 * Bottom tab navigator for all authenticated screens.
 * Only reachable if user is authenticated + email verified.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

import HomeScreen from '@features/home';
import SettingsScreen from '@features/settings';
import { Colors, FontSize } from '@shared/constants';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

// ─── Placeholder screens for tabs not built yet ───────────────────────────────
const PlaceholderScreen: React.FC<{ name: string }> = ({ name }) => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>{name} coming soon</Text>
  </View>
);

const JournalScreen  = () => <PlaceholderScreen name="Journal" />;
const MemoriesScreen = () => <PlaceholderScreen name="Memories" />;
const GoalsScreen    = () => <PlaceholderScreen name="Goals" />;
const FutureScreen   = () => <PlaceholderScreen name="Future" />;

// ─── Tab icon helper ──────────────────────────────────────────────────────────
const TAB_ICONS: Record<string, string> = {
  Home:     '🏠',
  Journal:  '📓',
  Memories: '📸',
  Goals:    '🌱',
  Future:   '💌',
};

const TabIcon: React.FC<{ name: string; focused: boolean }> = ({ name, focused }) => (
  <Text style={{ fontSize: FontSize.xl, opacity: focused ? 1 : 0.45 }}>
    {TAB_ICONS[name]}
  </Text>
);

// ─── Navigator ────────────────────────────────────────────────────────────────
const MainNavigator: React.FC = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused }) => (
        <TabIcon name={route.name} focused={focused} />
      ),
      tabBarLabel: route.name,
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.textMuted,
      tabBarStyle: {
        backgroundColor: Colors.cardBg,
        borderTopColor: 'rgba(217,193,196,0.3)',
        borderTopWidth: 1,
        paddingBottom: 6,
        paddingTop: 6,
        height: 64,
      },
      tabBarLabelStyle: {
        fontSize: FontSize.xs,
        fontWeight: '600',
        marginTop: 2,
      },
    })}
  >
    <Tab.Screen name="Home"     component={HomeScreen} />
    <Tab.Screen name="Journal"  component={JournalScreen} />
    <Tab.Screen name="Memories" component={MemoriesScreen} />
    <Tab.Screen name="Goals"    component={GoalsScreen} />
    <Tab.Screen name="Future"   component={FutureScreen} />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        tabBarButton: () => null,
        tabBarItemStyle: { display: 'none' },
      }}
    />
  </Tab.Navigator>
);

export { MainNavigator };
export default MainNavigator;

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF6F0',
  },
  placeholderText: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
  },
});
