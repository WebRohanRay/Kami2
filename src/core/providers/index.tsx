import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AuthProvider } from '@features/auth';

/**
 * AppProviders — wraps the entire app with required context providers.
 * Add new providers here (ThemeProvider, QueryClientProvider, etc.)
 * Never add business logic here.
 */
export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <GestureHandlerRootView style={s.root}>
    <SafeAreaProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

const s = StyleSheet.create({ root: { flex: 1 } });
