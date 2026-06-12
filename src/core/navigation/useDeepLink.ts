import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { supabase } from '@shared/lib/supabase';

type NavRef = React.RefObject<NavigationContainerRef<RootStackParamList> | null>;

function extractTokens(url: string): { accessToken: string | null; refreshToken: string | null; type: string | null } {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let type: string | null = null;

  // Replace hash symbol with query separator to handle standard redirect fragments
  const cleanUrl = url.replace('#', '?');
  const queryIndex = cleanUrl.indexOf('?');
  if (queryIndex !== -1) {
    const queryString = cleanUrl.substring(queryIndex + 1);
    const pairs = queryString.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key === 'access_token') accessToken = decodeURIComponent(value);
      if (key === 'refresh_token') refreshToken = decodeURIComponent(value);
      if (key === 'type') type = decodeURIComponent(value);
    }
  }

  return { accessToken, refreshToken, type };
}

export function useDeepLink(ref: NavRef) {
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;

      const { accessToken, refreshToken, type } = extractTokens(url);

      if (accessToken && refreshToken) {
        try {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } catch (err) {
          console.error('[useDeepLink] Error setting session from deep link:', err);
        }
      }

      const isRecovery = url.includes('reset-password') || type === 'recovery';
      const isVerification = url.includes('verify') || type === 'signup';

      if (isRecovery) {
        const navigateToReset = () => {
          const nav = ref.current;
          if (nav?.isReady()) {
            nav.navigate('ResetPassword');
            return;
          }
          setTimeout(navigateToReset, 100);
        };
        navigateToReset();
      } else if (isVerification) {
        const navigateToVerify = () => {
          const nav = ref.current;
          if (nav?.isReady()) {
            nav.navigate('Auth', { screen: 'EmailVerification' });
            return;
          }
          setTimeout(navigateToVerify, 100);
        };
        navigateToVerify();
      }
    };

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
