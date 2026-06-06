import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
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
 */
const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab    = 'home',
  onTabChange,
}) => {
  const [tab, setTab] = useState(activeTab);
  const { colors } = useTheme();

  const handleTab = (id: string) => {
    setTab(id);
    onTabChange?.(id);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />
      <View style={styles.content}>{children}</View>
      <TabBar active={tab} onPress={handleTab} />
    </SafeAreaView>
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
