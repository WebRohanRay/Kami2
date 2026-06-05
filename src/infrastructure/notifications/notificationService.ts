/**
 * notificationService.ts
 * Helper utility to manage push notification permissions and fetch device tokens.
 */
import type * as ExpoNotificationsType from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Dynamically require to avoid crash if native module is not compiled into the current binary
let Notifications: typeof ExpoNotificationsType | null = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('Expo Notifications native module is not available in this build.');
}

if (Notifications) {
  // Configure standard foreground notification behavior
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Registers device for push notifications, requesting permissions if necessary.
 * Returns the Expo Push Token, or null if registration is not possible or denied.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications) {
    console.warn('Push notification native module is not compiled into this app build.');
    return null;
  }

  if (Platform.OS === 'web') {
    console.log('Web environment is not supported for push notifications.');
    return null;
  }

  // Simulators cannot receive push notifications; log and skip
  if (!Device.isDevice) {
    console.log('Must use a physical device for Push Notifications.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token: permission not granted.');
      return null;
    }

    // EAS Project ID is required to retrieve the push token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      'f298b22a-0745-413d-bf90-5156a5d009ff';

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    // Set up default channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}
