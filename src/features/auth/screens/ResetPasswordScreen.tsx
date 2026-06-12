/**
 * ResetPasswordScreen.tsx
 *
 * Landing screen for the deep link: kami://auth/reset-password
 * Supabase auto-restores the session from the link token.
 * User enters + confirms new password → updateUser() called.
 *
 * Deep link setup is handled in Stage 7 (App.tsx + app.config.js).
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
import { useNetworkStatus } from '@shared/network/NetworkProvider';
import { resetPasswordSchema } from '@shared/lib/validation/schemas';

import { useAuthActions } from '../hooks';
import type { RootStackParamList } from '@core/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

const ResetPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);

  const { isConnected } = useNetworkStatus();
  const { resetPassword } = useAuthActions();

  // ── Password rules ────────────────────────────────────────────────────────
  const has8   = password.length >= 8;
  const hasUp  = /[A-Z]/.test(password);
  const hasNum = /[0-9!@#$%^&*]/.test(password);
  const matches = password === confirm && confirm.length > 0;
  const valid  = has8 && hasUp && hasNum && matches;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    Keyboard.dismiss();

    if (!isConnected) {
      Alert.alert('Kami', 'This action requires an internet connection.');
      return;
    }

    const validation = resetPasswordSchema.safeParse({ password, confirmPassword: confirm });
    if (!validation.success) {
      Alert.alert('Kami', validation.error.issues[0].message);
      return;
    }

    setLoading(true);
    const result = await resetPassword(password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Kami', result.error);
      return;
    }

    setSuccess(true);
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>✅</Text>

          <KamiText variant="display" align="center">
            Password updated!
          </KamiText>

          <KamiText
            variant="body"
            align="center"
            color={Colors.textMuted}
            style={styles.successSubtitle}
          >
            Your password has been changed successfully.{'\n'}
            You can now sign in with your new password.
          </KamiText>

          <KamiButton
            label="Back to Login"
            onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
            style={styles.successBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Default state ─────────────────────────────────────────────────────────
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🔒</Text>
            <KamiText variant="display" align="center">
              New password
            </KamiText>
            <KamiText
              variant="body"
              align="center"
              color={Colors.textMuted}
              style={styles.subtitle}
            >
              Choose a strong password for your Kami space.
            </KamiText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <InputField
              icon="🔒"
              label="New password"
              placeholder="Enter new password"
              isPassword
              value={password}
              onChangeText={setPassword}
              textContentType="newPassword"
              autoFocus
            />

            <InputField
              icon="🔒"
              label="Confirm password"
              placeholder="Re-enter new password"
              isPassword
              value={confirm}
              onChangeText={setConfirm}
              textContentType="newPassword"
            />

            {/* Checklist */}
            {password.length > 0 && (
              <View style={styles.checklist}>
                <CheckItem label="At least 8 characters"  met={has8}    />
                <CheckItem label="One uppercase letter"    met={hasUp}   />
                <CheckItem label="One number or symbol"    met={hasNum}  />
                <CheckItem label="Passwords match"         met={matches} />
              </View>
            )}

            <KamiButton
              label={isConnected ? "Update Password" : "Offline - Disabled"}
              loading={loading}
              onPress={isConnected ? handleReset : undefined}
              disabled={!isConnected}
              style={{ marginTop: Space[2] }}
            />
            {!isConnected && (
              <KamiText variant="caption" color="#f43f5e" align="center" style={{ marginTop: Space[2] }}>
                ⚠️ Internet connection required to update password.
              </KamiText>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Check Item ───────────────────────────────────────────────────────────────
const CheckItem: React.FC<{ label: string; met: boolean }> = ({ label, met }) => (
  <View style={styles.checkRow}>
    <Text style={[styles.checkIcon, met && styles.checkIconMet]}>
      {met ? '✓' : '○'}
    </Text>
    <KamiText variant="caption" color={met ? Colors.success : Colors.textMuted}>
      {label}
    </KamiText>
  </View>
);

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  kav:  { flex: 1 },

  content: {
    paddingHorizontal: Space[5],
    paddingBottom: Space[10],
    flexGrow: 1,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    gap: Space[2],
    marginTop: Space[10],
    marginBottom: Space[8],
  },
  headerEmoji: { fontSize: 48, marginBottom: Space[2] },
  subtitle:    { marginTop: Space[1] },

  // ── Form ──────────────────────────────────────────────────────────────────
  form: { gap: Space[4] },

  checklist: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.md,
    padding: Space[3],
    gap: Space[2],
    borderWidth: 1,
    borderColor: Colors.border + '44',
    marginTop: -Space[2],
  },
  checkRow:     { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  checkIcon:    { fontSize: 12, color: Colors.textMuted, width: 16 },
  checkIconMet: { color: Colors.success },

  // ── Success state ─────────────────────────────────────────────────────────
  successContainer: {
    flex: 1,
    paddingHorizontal: Space[5],
    paddingTop: Space[20],
    alignItems: 'center',
    gap: Space[4],
  },
  successEmoji:    { fontSize: 56 },
  successSubtitle: { marginTop: Space[1], lineHeight: 24 },
  successBtn:      { width: '100%', marginTop: Space[4] },
});