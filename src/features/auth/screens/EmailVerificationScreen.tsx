import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import KamiButton from '@shared/ui/atoms/KamiButton';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, Radii, Space } from '@shared/constants';
import { useAuth } from '../hooks';
import { useAuthStore } from '../store';
import type { AuthScreenProps } from '@core/navigation/types';

type Props = AuthScreenProps<'EmailVerification'>;

const POLL_INTERVAL_MS = 5000;
const RESEND_COOLDOWN_SECONDS = 60;

const EmailVerificationScreen: React.FC<Props> = ({ route, navigation }) => {
  const storeEmail = useAuthStore((state) => state.user?.email);
  const email = route.params?.email ?? storeEmail ?? '';

  // Get stable function refs — don't put the whole useAuth() object in deps
  const auth = useAuth();
  const refreshUserRef = useRef(auth.refreshUser);
  const resendRef      = useRef(auth.resendVerificationEmail);
  const signOutRef     = useRef(auth.signOut);
  refreshUserRef.current = auth.refreshUser;
  resendRef.current      = auth.resendVerificationEmail;
  signOutRef.current     = auth.signOut;

  const [resendLoading, setResendLoading] = useState(false);
  const [checking,      setChecking]      = useState(false);
  const [backLoading,   setBackLoading]   = useState(false);
  const [cooldown,      setCooldown]      = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable polling — interval never resets because deps are stable refs
  useEffect(() => {
    const id = setInterval(async () => {
      setChecking(true);
      await refreshUserRef.current();
      setChecking(false);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, []); // ← empty deps: intentional

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  const handleSendAgain = async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      Alert.alert('Kami', 'Please go back and sign in again so we know which email to verify.');
      return;
    }

    if (cooldown > 0) return;

    setResendLoading(true);
    const result = await resendRef.current(email);
    setResendLoading(false);

    if (!result.success) {
      Alert.alert('Kami', result.error);
      return;
    }

    startCooldown();
    Alert.alert('Kami', 'A new verification email was sent.');
  };

  const handleBackToLogin = async () => {
    Keyboard.dismiss();
    setBackLoading(true);
    await signOutRef.current();
    setBackLoading(false);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <Text style={styles.emoji}>✉</Text>
            <KamiText variant="display" align="center">Check your email</KamiText>
            <KamiText variant="body" align="center" style={styles.subtitle}>
              We sent a verification link to{'\n'}
              <Text style={styles.emailText}>{email || 'your email address'}</Text>
            </KamiText>
          </View>

          <View style={styles.checkingRow}>
            {checking ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={styles.pulseIndicator} />
            )}
            <KamiText variant="caption" color={Colors.textMuted}>
              {checking ? 'Checking verification...' : 'Waiting for verification'}
            </KamiText>
          </View>

          <View style={styles.stepsCard}>
            <Step number="1" text="Open the email from Kami." />
            <Step number="2" text="Tap the verification link." />
            <Step number="3" text="Come back here and Kami will continue automatically." />
          </View>

          <View style={styles.actions}>
            <KamiButton
              label={cooldown > 0 ? `Send again in ${cooldown}s` : 'Send again'}
              variant="secondary"
              loading={resendLoading}
              disabled={resendLoading || cooldown > 0}
              onPress={handleSendAgain}
            />
            <KamiButton
              label="Back to Login"
              variant="ghost"
              loading={backLoading}
              disabled={backLoading}
              onPress={handleBackToLogin}
            />
          </View>

          <KamiText variant="caption" align="center" color={Colors.textMuted} style={styles.note}>
            You cannot access Kami until your email is verified.
          </KamiText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Step: React.FC<{ number: string; text: string }> = ({ number, text }) => (
  <View style={styles.stepRow}>
    <View style={styles.stepNumber}>
      <Text style={styles.stepNumberText}>{number}</Text>
    </View>
    <KamiText variant="caption" style={styles.stepText}>{text}</KamiText>
  </View>
);

export default EmailVerificationScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  kav: { flex: 1 },
  content: {
    paddingHorizontal: Space[5],
    paddingBottom: Space[10],
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: { alignItems: 'center', gap: Space[2], marginBottom: Space[6] },
  emoji: { fontSize: 48, marginBottom: Space[2], color: Colors.primary },
  subtitle: { marginTop: Space[1], lineHeight: 22 },
  emailText: { color: Colors.primary, fontWeight: '700' },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    marginBottom: Space[5],
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary + '55',
  },
  stepsCard: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.lg,
    padding: Space[5],
    gap: Space[4],
    marginBottom: Space[6],
    borderWidth: 1,
    borderColor: Colors.border + '44',
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Space[3] },
  stepNumber: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: { color: Colors.textOnPrimary, fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1 },
  actions: { gap: Space[3] },
  note: { marginTop: Space[6] },
});
