import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps }  from '@react-navigation/native-stack';
import type { BottomTabScreenProps }    from '@react-navigation/bottom-tabs';
import type { PartnerSpaceStackParamList } from './PartnerSpaceNavigator';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Main: undefined;
  ResetPassword: undefined;
  PartnerSpace: NavigatorScreenParams<PartnerSpaceStackParamList> | undefined;
};

export type AuthStackParamList = {
  Login:             undefined;
  SignUp:            undefined;
  EmailVerification: { email?: string } | undefined;
  ForgotPassword:    undefined;
};

export type MainTabParamList = {
  Home:     undefined;
  Journal:  undefined;
  Memories: undefined;
  Goals:    undefined;
  Future:   undefined;
  Settings: undefined;
  Timeline: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;
