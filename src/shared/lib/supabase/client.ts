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
  getItem: async (key: string): Promise<string | null> => {
    try {
      const info = await SecureStore.getItemAsync(key);
      if (!info) return null;
      if (info.startsWith('chunked:')) {
        const count = parseInt(info.split(':')[1], 10);
        let val = '';
        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
          if (!chunk) return null;
          val += chunk;
        }
        return val;
      }
      return info;
    } catch (e) {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Clean up any old chunks first to be safe
      const oldInfo = await SecureStore.getItemAsync(key);
      if (oldInfo && oldInfo.startsWith('chunked:')) {
        const count = parseInt(oldInfo.split(':')[1], 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
      }

      const CHUNK_SIZE = 2000;
      if (value.length > CHUNK_SIZE) {
        const chunks = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          chunks.push(value.substring(i, i + CHUNK_SIZE));
        }
        // Save chunk header
        await SecureStore.setItemAsync(key, `chunked:${chunks.length}`);
        // Save chunks
        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
        }
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      console.error('secureStorage setItem error:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const oldInfo = await SecureStore.getItemAsync(key);
      if (oldInfo && oldInfo.startsWith('chunked:')) {
        const count = parseInt(oldInfo.split(':')[1], 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
      }
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error('secureStorage removeItem error:', e);
    }
  },
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
