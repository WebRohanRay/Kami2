import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import TabBar from '../organisms/TabBar';
import { useTheme } from '@shared/hooks';

interface AppShellProps {
  children: React.ReactNode;
  /** Currently visible tab id */
  activeTab?: string;
  onTabChange?: (id: string) => void;
}

/**
 * AppShell wraps all post-auth screens.
 * Renders children above the persistent TabBar.
 * Uses a romantic gradient background that adapts to the active theme.
 */
const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab    = 'home',
  onTabChange,
}) => {
  const [tab, setTab] = useState(activeTab);
  const { colors, isDark, gradientBg } = useTheme();

  const handleTab = (id: string) => {
    setTab(id);
    onTabChange?.(id);
  };

  if (gradientBg) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={styles.root}
      >
        <SafeAreaView style={styles.root}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <View style={styles.content}>{children}</View>
          <TabBar active={tab} onPress={handleTab} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <SafeAreaView style={styles.root}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.content}>{children}</View>
        <TabBar active={tab} onPress={handleTab} />
      </SafeAreaView>
    </View>
  );

};

export default AppShell;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
