import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHUNK_SIZE = 2000;

/**
 * secureSessionStorage
 * Supabase-compatible storage adapter that uses expo-secure-store.
 * Encrypts key-value pairs (using iOS Keychain / Android Keystore).
 * Migrates existing sessions from AsyncStorage automatically.
 * Chunking logic is applied to bypass the 2048-byte limit on Android.
 */
export const secureSessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // 1. Check if there is a manifest for large values
      const manifestStr = await SecureStore.getItemAsync(`${key}_manifest`);
      if (manifestStr) {
        try {
          const manifest = JSON.parse(manifestStr);
          const chunkCount = manifest.chunks;
          const chunks: string[] = [];
          for (let i = 0; i < chunkCount; i++) {
            const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
            if (chunk === null) {
              // Missing chunk means corrupted session, return null
              return null;
            }
            chunks.push(chunk);
          }
          return chunks.join('');
        } catch (parseError) {
          console.error('[secureSessionStorage] Error parsing manifest.');
        }
      }

      // 2. Try to read directly from SecureStore (for small or legacy values)
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue !== null) {
        return secureValue;
      }

      // 3. Migration fallback: check AsyncStorage
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue !== null) {
        // Store in SecureStore (setItem will automatically handle chunking if needed)
        await secureSessionStorage.setItem(key, asyncValue);
        // Remove from AsyncStorage
        await AsyncStorage.removeItem(key);
        return asyncValue;
      }
    } catch (error) {
      // Never log key or value contents in logs (Rule 9)
      console.error('[secureSessionStorage] Error during getItem operation.');
    }
    return null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Always remove existing items first to clean up any old manifests or chunks
      await secureSessionStorage.removeItem(key);

      if (value.length <= CHUNK_SIZE) {
        // Small value: store directly
        await SecureStore.setItemAsync(key, value);
      } else {
        // Large value: chunk it
        const chunksCount = Math.ceil(value.length / CHUNK_SIZE);
        for (let i = 0; i < chunksCount; i++) {
          const chunk = value.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
        }
        // Save the manifest
        const manifest = JSON.stringify({ chunks: chunksCount });
        await SecureStore.setItemAsync(`${key}_manifest`, manifest);
      }
    } catch (error) {
      console.error('[secureSessionStorage] Error during setItem operation.');
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      // Delete manifest and chunks if they exist
      const manifestStr = await SecureStore.getItemAsync(`${key}_manifest`);
      if (manifestStr) {
        try {
          const manifest = JSON.parse(manifestStr);
          const chunkCount = manifest.chunks;
          for (let i = 0; i < chunkCount; i++) {
            await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
          }
          await SecureStore.deleteItemAsync(`${key}_manifest`);
        } catch (e) {
          // Ignore parse errors, just try to clean up
        }
      }

      // Delete direct key from SecureStore and AsyncStorage
      await SecureStore.deleteItemAsync(key);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[secureSessionStorage] Error during removeItem operation.');
    }
  },
};

