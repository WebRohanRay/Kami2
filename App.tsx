import React, { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { AppProviders } from './src/core/providers';
import { RootNavigator } from './src/core/navigation';
import { initDb } from './src/shared/db/client';
import { ActivityIndicator, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('Failed to init DB:', err);
        setReady(true); // proceed anyway as fallback
      });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#f43f5e" />
      </View>
    );
  }

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
