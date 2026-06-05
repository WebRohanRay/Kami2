import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

type NavRef = React.RefObject<NavigationContainerRef<RootStackParamList> | null>;

export function useDeepLink(ref: NavRef) {
  useEffect(() => {
    const navigate = () => {
      const nav = ref.current;
      if (nav?.isReady()) { nav.navigate('Auth'); return; }
      setTimeout(navigate, 100);
    };

    const handle = (url: string | null) => {
      if (!url) return;
      if (url.includes('reset-password') || url.includes('type=recovery')) navigate();
    };

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
