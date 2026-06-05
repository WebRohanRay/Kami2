/**
 * SignUpScreen.tsx
 *
 * Wired to Supabase via useAuth hook.
 * On success → navigates to EmailVerification screen.
 */

import React, { useState } from 'react';
import {
  Alert,
  Image,
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
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

import KamiText       from '@shared/ui/atoms/KamiText';
import KamiButton     from '@shared/ui/atoms/KamiButton';
import InputField     from '@shared/ui/atoms/InputField';
import SocialLoginRow from '@shared/ui/molecules/SocialLoginRow';
import {
  Colors, Space, Radii, Shadows, FontSize, FontWeight,
} from '@shared/constants';

import { useAuth }      from '../hooks';
import type { AuthScreenProps } from '@core/navigation/types';

// ─── Polaroid Fan ─────────────────────────────────────────────────────────────
const POLAROID_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCb5VaXwm3kXOFPVYp4q4N9bZGNpAaN4aRCPHw3j8Qjpz82Hoy7uBGa_Q9dzr5zaxryU3Oyf-X9gBSaRrauSarJlwX4XtstLLnoUXiuEoC16Fi1rtVZxcDzX9lQDu7AalPb3Wo3BJejL_n14Tj5bJm4GvYx-RwUwjydxVgu8IQRAgWhL7VIGHMKdBldN5vLGCKbcQtoHXst8HFMfmLNHW4ICXPXG7oxu-lX-QZSBBX3wT2yGlhkgOIWi1oPTg0kg4bA4RMp_YPt',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCKe_axF9ug75f8zy2lApYNpqVy9LAflzYXi9Yjxn3pZAdMJVk3xl8IKTm3VL66a0Z_Onupc5wpeSVpt3u7p1dQ7hUdTpT2KFWksSTqqOiTfeV0cy5pz_1AXaDmN8Zc5e_8vzCNMaN70zf8598H0Fd9vTj0o98OHEONozoy912c6TCnXUx1hufrOAIgULFzFriJ0Fsx2_eNYwAnWxiURNnAUgEGjZ7FbKlfOJ7yZFArBLJkDXUHHu5RYcsWM7YmOvHiWxR5TjzA',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBrxJvly3-AdMcrFDF4Xy-cIG1MEDcyi9NGpGd_wcRTf2r9x3k-HRYZ7DR0aBAJOIoZ4D_79ZGi5WDw6ScoB5gSfFefTGSiRqK-xs3EHEOgTsrU3VQWUNxudlswk-wH8bcEj6kucK4Ssg4P_3eLY0VG_FiAyYZVdDzaKFca1ET6Pn1AnMApZ4RrzTF-8i_Cw8bGLkdXySKj0f9cZXIj5WG4t_m0r9SAEanvt4gKwi98d4mtWli0NHNpkeWHBPKgNEKeMZOkisMK',
];

const PolaroidFan = () => (
  <View style={styles.fanWrap}>
    <View style={[styles.polaroid, styles.polaroidLeft]}>
      <Image source={{ uri: POLAROID_IMAGES[0] }} style={styles.polaroidImg} resizeMode="cover" />
    </View>
    <View style={[styles.polaroid, styles.polaroidRight]}>
      <Image source={{ uri: POLAROID_IMAGES[1] }} style={styles.polaroidImg} resizeMode="cover" />
    </View>
    <View style={[styles.polaroid, styles.polaroidCenter]}>
      <Image source={{ uri: POLAROID_IMAGES[2] }} style={styles.polaroidImg} resizeMode="cover" />
      <Text style={styles.polaroidHeart}>♥</Text>
    </View>
  </View>
);

// ─── Password Checklist ───────────────────────────────────────────────────────
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

// ─── OR Divider ───────────────────────────────────────────────────────────────
const OrDivider = () => (
  <View style={styles.dividerRow}>
    <View style={styles.dividerLine} />
    <KamiText variant="overline">or</KamiText>
    <View style={styles.dividerLine} />
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
type Props = AuthScreenProps<'SignUp'>;

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signUp, loginWithGoogle } = useAuth();

  const has8   = password.length >= 8;
  const hasUp  = /[A-Z]/.test(password);
  const hasNum = /[0-9!@#$%^&*]/.test(password);
  const valid  = name.trim().length > 0 &&
                 email.trim().length > 0 &&
                 has8 && hasUp && hasNum;

  // ── Create Account ────────────────────────────────────────────────────────
  const handleCreate = async () => {
    Keyboard.dismiss();

    if (!valid) {
      Alert.alert('Kami', 'Please fill in all fields and meet password requirements.');
      return;
    }

    setLoading(true);
    const result = await signUp(name.trim(), email.trim(), password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Kami', result.error);
      return;
    }

    // Navigate to email verification — pass email so screen can display it
    navigation.navigate('EmailVerification', { email: email.trim() });
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogleSignUp = async () => {
    Keyboard.dismiss();
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    setGoogleLoading(false);

    if (!result.success) {
      Alert.alert('Kami', result.error);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => { Keyboard.dismiss(); navigation.goBack(); }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <PolaroidFan />

          <View style={styles.headline}>
            <KamiText variant="title" align="center" color={Colors.primary} style={styles.headlineTitle}>
              Create your Kami space
            </KamiText>
            <KamiText variant="body" align="center" style={{ marginTop: Space[1] }}>
              Your sanctuary for self-love and memories
            </KamiText>
          </View>

          <View style={styles.card}>
            <InputField
              label="Your Name"
              icon="👤"
              placeholder="How should we call you?"
              value={name}
              onChangeText={setName}
              textContentType="name"
              autoComplete="name"
              autoCapitalize="words"
            />
            <InputField
              label="Email Address"
              icon="✉️"
              placeholder="you@example.com"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
            />
            <InputField
              label="Password"
              icon="🔒"
              placeholder="Create a secure password"
              isPassword
              value={password}
              onChangeText={setPassword}
              textContentType="newPassword"
            />

            {password.length > 0 && (
              <View style={styles.checklist}>
                <CheckItem label="At least 8 characters" met={has8}   />
                <CheckItem label="One uppercase letter"   met={hasUp}  />
                <CheckItem label="One number or symbol"   met={hasNum} />
              </View>
            )}

            <KamiButton
              label="Create Account"
              icon="✨"
              loading={loading}
              onPress={handleCreate}
              style={{ marginTop: Space[2] }}
            />
          </View>

          <OrDivider />

          <SocialLoginRow
            providers={[
              {
                id: 'google',
                label: 'Google',
                emoji: '🌐',
                onPress: handleGoogleSignUp,
                loading: googleLoading,
              },
            ]}
          />

          <KamiText variant="caption" align="center" style={styles.legal}>
            By creating an account you agree to our{' '}
            <Text style={styles.legalLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </KamiText>

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => { Keyboard.dismiss(); navigation.navigate('Login'); }}
            accessibilityRole="button"
          >
            <KamiText variant="label" color={Colors.primary}>
              Already have an account? Log in ›
            </KamiText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUpScreen;

const POLAROID_W   = 110;
const POLAROID_H   = 130;
const POLAROID_PAD = 8;

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.pageBg },
  kav:           { flex: 1 },
  scrollContent: { paddingHorizontal: Space[5], paddingBottom: Space[10] },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 16,
    left: Space[4],
    zIndex: 10,
    padding: Space[2],
  },
  backArrow: { fontSize: FontSize.xl, color: Colors.textSecondary },
  fanWrap: {
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space[10],
    marginBottom: Space[4],
  },
  polaroid: {
    position: 'absolute',
    width: POLAROID_W,
    height: POLAROID_H,
    backgroundColor: Colors.cardBg,
    padding: POLAROID_PAD,
    paddingBottom: POLAROID_PAD * 3,
    borderRadius: 4,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.rose100,
  },
  polaroidLeft:   { transform: [{ rotate: '-12deg' }, { translateX: -44 }, { translateY: 8 }], zIndex: 1 },
  polaroidRight:  { transform: [{ rotate: '12deg'  }, { translateX:  44 }, { translateY: 8 }], zIndex: 1 },
  polaroidCenter: { width: POLAROID_W + 16, height: POLAROID_H + 16, transform: [{ rotate: '-2deg' }], zIndex: 2 },
  polaroidImg:    { flex: 1, borderRadius: 2, backgroundColor: Colors.creamMid },
  polaroidHeart: {
    position: 'absolute', bottom: 6,
    alignSelf: 'center', left: 0, right: 0,
    textAlign: 'center',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  headline:      { alignItems: 'center', marginBottom: Space[5] },
  headlineTitle: { fontFamily: 'Georgia', fontSize: FontSize['2xl'] - 2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: Radii['xl'],
    padding: Space[5],
    gap: Space[4],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    ...Shadows.md,
    marginBottom: Space[5],
  },
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
  checkIcon:    { fontSize: FontSize.sm, color: Colors.textMuted, width: 16 },
  checkIconMet: { color: Colors.success },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Space[3],
    gap: Space[3],
  },
  dividerLine:  { flex: 1, height: 1, backgroundColor: Colors.border + '55' },
  legal:        { marginBottom: Space[2], paddingHorizontal: Space[3] },
  legalLink:    { color: Colors.primary, fontWeight: FontWeight.bold },
  loginBtn:     { alignItems: 'center', paddingVertical: Space[3] },
});