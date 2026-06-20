import React, { useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore, ResetPasswordScreen } from '@features/auth';
import { useTheme } from '@shared/hooks';
import { AuthNavigator } from './AuthNavigator';
import MainNavigator from './MainNavigator';
import PartnerSpaceNavigator from './PartnerSpaceNavigator';
import { useDeepLink } from './useDeepLink';
import type { RootStackParamList } from './types';
import { CoupleRealtimeListener } from '@features/couple/components/CoupleRealtimeListener';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

const Splash: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={[s.splash, { backgroundColor: colors.pageBg }]}>
      <Text style={s.emoji}>🌸</Text>
      <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
    </View>
  );
};

export const RootNavigator: React.FC = () => {
  const navRef = useRef(navigationRef);
  useDeepLink(navRef);

  const { status } = useAuthStore();
  const isLoading = status === 'loading' || status === 'restoring';
  const isAuthenticated = status === 'authenticated_online' || status === 'authenticated_offline';

  if (isLoading) return <Splash />;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen
          name="PartnerSpace"
          component={PartnerSpaceNavigator}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
      {isAuthenticated && <CoupleRealtimeListener />}
    </NavigationContainer>
  );
};

const s = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 48 },
});
