import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HeroSection from '../organisms/HeroSection';
import BottomSheet from '../molecules/BottomSheet';
import { useTheme } from '@shared/hooks';

interface AuthShellProps {
  children:           React.ReactNode;
  heroUri?:           string;
  heroHeightRatio?:   number;
}

/**
 * AuthShell wraps every auth screen (Login, SignUp, ForgotPassword).
 * It handles:
 *   - SafeAreaView
 *   - Hero image with falling petals + gradient
 *   - KeyboardAvoidingView
 *   - BottomSheet glass panel
 */
const AuthShell: React.FC<AuthShellProps> = ({
  children,
  heroUri,
  heroHeightRatio,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <HeroSection imageUri={heroUri} heightRatio={heroHeightRatio} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <BottomSheet>{children}</BottomSheet>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AuthShell;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scroll: {
    justifyContent: 'flex-end',
    flexGrow: 1,
  },
});
