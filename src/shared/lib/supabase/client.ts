import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const url: string     = Constants.expoConfig?.extra?.supabaseUrl     ?? '';
const anonKey: string = Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

if (__DEV__ && (!url || !anonKey)) {
  console.warn('[Kami] Missing Supabase env vars — check .env + app.config.js');
}

const secureStorage = {
  getItem:    (k: string) => SecureStore.getItemAsync(k),
  setItem:    (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
