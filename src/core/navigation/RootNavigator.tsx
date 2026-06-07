import React, { useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@features/auth';
import { useAuth }      from '@features/auth';
import { Colors }       from '@shared/constants';
import { AuthNavigator } from './AuthNavigator';
import MainNavigator     from './MainNavigator';
import { useDeepLink }   from './useDeepLink';
import type { RootStackParamList } from './types';
import { CoupleRealtimeListener } from '@features/couple/components/CoupleRealtimeListener';
import { navigationRef } from './navigationRef';

const Stack  = createNativeStackNavigator<RootStackParamList>();

const Splash: React.FC = () => (
  <View style={s.splash}>
    <Text style={s.emoji}>🌸</Text>
    <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 16 }} />
  </View>
);

export const RootNavigator: React.FC = () => {
  const navRef = useRef(navigationRef);
  useAuth();
  useDeepLink(navRef);

  const { status } = useAuthStore();
  if (status === 'loading') return <Splash />;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'authenticated' ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
      {status === 'authenticated' && <CoupleRealtimeListener />}
    </NavigationContainer>
  );
};

const s = StyleSheet.create({
  splash: { flex:1, backgroundColor:Colors.pageBg, alignItems:'center', justifyContent:'center' },
  emoji:  { fontSize: 48 },
});
