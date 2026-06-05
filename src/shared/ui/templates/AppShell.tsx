import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import TabBar from '../organisms/TabBar';
import { Colors } from '@shared/constants';

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

  const handleTab = (id: string) => {
    setTab(id);
    onTabChange?.(id);
  };

  return (
    <SafeAreaView style={styles.root}>
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
    backgroundColor: Colors.pageBg,
  },
  content: {
    flex: 1,
  },
});
