import React from 'react';
import * as WebBrowser from 'expo-web-browser';
import { AppProviders } from './src/core/providers';
import { RootNavigator } from './src/core/navigation';

WebBrowser.maybeCompleteAuthSession();

export default function App() {

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
