import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@features/auth';
import {
  LoginScreen, SignUpScreen, EmailVerificationScreen,
  ForgotPasswordScreen,
} from '@features/auth';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  const { status, user } = useAuthStore();

  const initial: keyof AuthStackParamList =
    status === 'unverified' ? 'EmailVerification' : 'Login';

  return (
    <Stack.Navigator
      initialRouteName={initial}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FFF8F8' },
      }}
    >
      <Stack.Screen name="Login"            component={LoginScreen} />
      <Stack.Screen name="SignUp"           component={SignUpScreen} />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        initialParams={{ email: user?.email }}
      />
      <Stack.Screen name="ForgotPassword"   component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
};
