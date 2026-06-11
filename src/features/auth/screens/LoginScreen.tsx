/**
 * LoginScreen.tsx
 *
 * Wired to Supabase via useAuth hook.
 * Handles: email/password login, Google OAuth, navigate to SignUp, ForgotPassword.
 */

import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AuthShell      from '@shared/ui/templates/AuthShell';
import KamiText       from '@shared/ui/atoms/KamiText';
import KamiButton     from '@shared/ui/atoms/KamiButton';
import InputField     from '@shared/ui/atoms/InputField';
import SocialLoginRow from '@shared/ui/molecules/SocialLoginRow';
import { Colors, Space } from '@shared/constants';

import { useAuthActions }      from '../hooks';
import { useAuthStore } from '../store';
import type { AuthScreenProps } from '@core/navigation/types';

// ─── OR Divider ───────────────────────────────────────────────────────────────
const OrDivider = () => (
  <View style={styles.dividerRow}>
    <View style={styles.dividerLine} />
    <KamiText variant="overline">or continue with</KamiText>
    <View style={styles.dividerLine} />
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
type Props = AuthScreenProps<'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, loginWithGoogle } = useAuthActions();
  const error = useAuthStore(s => s.error);

  // ── Email / Password Login ────────────────────────────────────────────────
  const handleLogin = async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      Alert.alert('Kami', 'Please enter your email address.');
      return;
    }
    if (!password) {
      Alert.alert('Kami', 'Please enter your password.');
      return;
    }

    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Kami', result.error);
      return;
    }

    // Navigation handled automatically by AppNavigator
    // based on auth status change in useAuthStore
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    Keyboard.dismiss();
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    setGoogleLoading(false);

    if (!result.success) {
      Alert.alert('Kami', result.error);
    }
    // On success: onAuthStateChange in useAuth handles routing
  };

  // ── Navigate ──────────────────────────────────────────────────────────────
  const handleForgotPassword = () => {
    Keyboard.dismiss();
    navigation.navigate('ForgotPassword');
  };

  const handleSignUp = () => {
    Keyboard.dismiss();
    navigation.navigate('SignUp');
  };

  return (
    <AuthShell>
      <View style={styles.content}>
        <View style={styles.header}>
          <KamiText variant="display" align="center">Welcome back 🤍</KamiText>
          <KamiText variant="body" align="center" style={styles.subtitle}>
            Sign in to your Kami space
          </KamiText>
        </View>

        <View style={styles.form}>
          <InputField
            icon="✉️"
            placeholder="Email address"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
          />

          <InputField
            icon="🔒"
            placeholder="Password"
            isPassword
            value={password}
            onChangeText={setPassword}
            textContentType="password"
            autoComplete="password"
          />

          <TouchableOpacity
            style={styles.forgotBtn}
            accessibilityRole="button"
            onPress={handleForgotPassword}
          >
            <KamiText variant="caption" bold color={Colors.primary}>
              Forgot password?
            </KamiText>
          </TouchableOpacity>

          <KamiButton
            label="Sign In"
            loading={loading}
            onPress={handleLogin}
          />
        </View>

        <OrDivider />

        <SocialLoginRow
          providers={[
            {
              id: 'google',
              label: 'Google',
              emoji: '🌐',
              onPress: handleGoogleLogin,
              loading: googleLoading,
            },
          ]}
        />

        <View style={styles.footer}>
          <KamiText variant="caption" align="center">
            New to Kami?{' '}
            <Text style={styles.signupLink} onPress={handleSignUp}>
              Create an account ›
            </Text>
          </KamiText>
        </View>
      </View>
    </AuthShell>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  content: { gap: Space[3] },
  header: { alignItems: 'center', marginBottom: Space[4] },
  subtitle: { marginTop: Space[1] },
  form: { gap: Space[3] },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -Space[1] },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Space[5],
    gap: Space[2] + 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(217,193,196,0.4)',
  },
  footer: { alignItems: 'center', marginTop: Space[4] },
  signupLink: { color: Colors.primary, fontWeight: '700' },
});