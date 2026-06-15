/**
 * ForgotPasswordScreen.tsx
 *
 * User enters email → Supabase sends reset link to that email.
 * Deep link: kami://auth/reset-password
 * On success → shows confirmation state (no navigation needed).
 */

import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import KamiText   from '@shared/ui/atoms/KamiText';
import KamiButton from '@shared/ui/atoms/KamiButton';
import InputField from '@shared/ui/atoms/InputField';
import { Colors, Space, Radii } from '@shared/constants';
import { useTheme } from '@shared/hooks';
import { useNetworkStatus } from '@shared/network/NetworkProvider';
import { forgotPasswordSchema } from '@shared/lib/validation/schemas';

import { useAuthActions } from '../hooks';
import type { AuthScreenProps } from '@core/navigation/types';

type Props = AuthScreenProps<'ForgotPassword'>;

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false); // success state

  const { isConnected } = useNetworkStatus();
  const { forgotPassword } = useAuthActions();
  const { isDark } = useTheme();

  // ── Send Reset Email ──────────────────────────────────────────────────────
  const handleSend = async () => {
    Keyboard.dismiss();

    if (!isConnected) {
      Alert.alert('Kami', 'This action requires an internet connection.');
      return;
    }

    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      Alert.alert('Kami', validation.error.issues[0].message);
      return;
    }

    setLoading(true);
    const result = await forgotPassword(email.trim());
    setLoading(false);

    if (!result.success) {
      Alert.alert('Kami', result.error);
      return;
    }

    setSent(true);
  };

  // ── Sent Confirmation State ───────────────────────────────────────────────
  if (sent) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.sentContainer}>
          <Text style={styles.sentEmoji}>📩</Text>

          <KamiText variant="display" align="center">
            Check your inbox
          </KamiText>

          <KamiText
            variant="body"
            align="center"
            color={Colors.textMuted}
            style={styles.sentSubtitle}
          >
            We sent a password reset link to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </KamiText>

          <View style={styles.sentCard}>
            <SentStep number="1" text="Open the email from Kami" />
            <SentStep number="2" text="Tap the reset link" />
            <SentStep number="3" text="Create your new password" />
          </View>

          <KamiText
            variant="caption"
            align="center"
            color={Colors.textMuted}
            style={styles.expireNote}
          >
            The link expires in 1 hour. Check your spam folder if you don't see it.
          </KamiText>

          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
          >
            <KamiText variant="label" color={Colors.primary}>
              ← Back to Login
            </KamiText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Default State ─────────────────────────────────────────────────────────
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
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { Keyboard.dismiss(); navigation.goBack(); }}
            accessibilityRole="button"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🔑</Text>
            <KamiText variant="display" align="center">
              Forgot password?
            </KamiText>
            <KamiText
              variant="body"
              align="center"
              color={Colors.textMuted}
              style={styles.subtitle}
            >
              No worries — enter your email and we'll send you a reset link.
            </KamiText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <InputField
              icon="✉️"
              label="Email address"
              placeholder="you@example.com"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoFocus
            />

            <KamiButton
              label={isConnected ? "Send Reset Link" : "Offline - Disabled"}
              loading={loading}
              onPress={isConnected ? handleSend : undefined}
              disabled={!isConnected}
            />
            {!isConnected && (
              <KamiText variant="caption" color="#f43f5e" align="center" style={{ marginTop: Space[2] }}>
                ⚠️ Internet connection required to request a reset link.
              </KamiText>
            )}
          </View>

          {/* Back to login */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => { Keyboard.dismiss(); navigation.navigate('Login'); }}
            accessibilityRole="button"
          >
            <KamiText variant="caption" align="center" color={Colors.textMuted}>
              Remember your password?{' '}
              <Text style={styles.loginLinkText}>Sign in ›</Text>
            </KamiText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Sent Step ────────────────────────────────────────────────────────────────
const SentStep: React.FC<{ number: string; text: string }> = ({ number, text }) => (
  <View style={styles.stepRow}>
    <View style={styles.stepBadge}>
      <Text style={styles.stepBadgeText}>{number}</Text>
    </View>
    <KamiText variant="caption" style={{ flex: 1 }}>
      {text}
    </KamiText>
  </View>
);

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  kav:  { flex: 1 },

  content: {
    paddingHorizontal: Space[5],
    paddingBottom: Space[10],
    flexGrow: 1,
  },

  // ── Back button ───────────────────────────────────────────────────────────
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: Space[2],
    marginTop: Space[3],
    marginBottom: Space[6],
  },
  backArrow: { fontSize: 24, color: Colors.textSecondary },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    gap: Space[2],
    marginBottom: Space[8],
  },
  headerEmoji: { fontSize: 48, marginBottom: Space[2] },
  subtitle:    { marginTop: Space[1] },

  // ── Form ──────────────────────────────────────────────────────────────────
  form: { gap: Space[4] },

  // ── Login link ────────────────────────────────────────────────────────────
  loginLink:     { marginTop: Space[6], alignItems: 'center' },
  loginLinkText: { color: Colors.primary, fontWeight: '700' },

  // ── Sent state ────────────────────────────────────────────────────────────
  sentContainer: {
    flex: 1,
    paddingHorizontal: Space[5],
    paddingTop: Space[16],
    alignItems: 'center',
    gap: Space[4],
  },
  sentEmoji:       { fontSize: 56 },
  sentSubtitle:    { marginTop: Space[1], lineHeight: 24 },
  emailHighlight:  { color: Colors.primary, fontWeight: '700' },
  sentCard: {
    width: '100%',
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.card,
    padding: Space[5],
    gap: Space[4],
    borderWidth: 1,
    borderColor: Colors.border + '44',
    marginTop: Space[2],
  },
  stepRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: Space[3] },
  stepBadge: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText:  { color: '#fff', fontSize: 12, fontWeight: '700' },
  expireNote:     { paddingHorizontal: Space[4] },
  backToLoginBtn: { marginTop: Space[4], paddingVertical: Space[3] },
});