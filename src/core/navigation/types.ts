import type { NativeStackScreenProps }  from '@react-navigation/native-stack';
import type { BottomTabScreenProps }    from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login:             undefined;
  SignUp:            undefined;
  EmailVerification: { email?: string } | undefined;
  ForgotPassword:    undefined;
  ResetPassword:     undefined;
};

export type MainTabParamList = {
  Home:     undefined;
  Journal:  undefined;
  Memories: undefined;
  Goals:    undefined;
  Future:   undefined;
  Settings: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;
