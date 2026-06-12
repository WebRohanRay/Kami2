import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { processSyncQueue } from '@shared/db/sync';

interface NetworkContextType {
  isConnected: boolean;
}

const NetworkContext = createContext<NetworkContextType>({ isConnected: true });

export const useNetworkStatus = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    NetInfo.fetch().then(state => {
      const online = state.isConnected ?? true;
      setIsConnected(online);
      if (online) {
        processSyncQueue().catch(err => console.error('Failed to sync outbox queue:', err));
      }
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected ?? true;
      setIsConnected(online);
      if (online) {
        processSyncQueue().catch(err => console.error('Failed to sync outbox queue:', err));
      }
    });
    return () => unsubscribe();
  }, []);

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
