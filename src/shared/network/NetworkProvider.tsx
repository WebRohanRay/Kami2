import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { processSyncQueue, updateStoreSyncState } from '@shared/db/sync';

interface NetworkContextType {
  isConnected: boolean;
}

const NetworkContext = createContext<NetworkContextType>({ isConnected: true });

export const useNetworkStatus = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const wasConnectedRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Hydrate store sync count on startup (both online and offline)
    updateStoreSyncState().catch(err => console.error('[NetworkProvider] Failed initial sync state hydration:', err));

    let syncTimeout: NodeJS.Timeout | null = null;
    const triggerSyncDebounced = () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        processSyncQueue().catch(err => console.error('Failed to sync outbox queue:', err));
      }, 1000); // 1-second debounce
    };

    NetInfo.fetch().then(state => {
      const online = state.isConnected ?? true;
      setIsConnected(online);
      wasConnectedRef.current = online;
      if (online) {
        triggerSyncDebounced();
      }
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected ?? true;
      const wasOnline = wasConnectedRef.current;
      setIsConnected(online);
      wasConnectedRef.current = online;

      // Trigger sync only on transition from offline to online
      if (online && wasOnline === false) {
        console.log('[NetworkProvider] Network transition detected: offline -> online. Triggering sync.');
        triggerSyncDebounced();
      }
    });
    return () => {
      unsubscribe();
      if (syncTimeout) clearTimeout(syncTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      processSyncQueue().catch(err => console.error('Failed periodic sync:', err));
    }, 30000); // every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isConnected ? 100 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isConnected]);

  return (
    <NetworkContext.Provider value={{ isConnected }}>
      <View style={styles.container}>
        {children}
        <Animated.View
          style={[
            styles.banner,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 12,
            },
          ]}
        >
          <Text style={styles.bannerText}>You are currently offline. Some features may be unavailable. ⚠️</Text>
        </Animated.View>
      </View>
    </NetworkContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    backgroundColor: '#f43f5e',
    paddingTop: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
