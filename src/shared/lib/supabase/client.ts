import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url: string     = Constants.expoConfig?.extra?.supabaseUrl     ?? '';
const anonKey: string = Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

if (__DEV__ && (!url || !anonKey)) {
  console.warn('[Kami] Missing Supabase env vars — check .env + app.config.js');
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

