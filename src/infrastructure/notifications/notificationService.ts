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
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('EAS Project ID not configured. Push notifications unavailable.');
      return null;
    }

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

/**
 * Triggers a local native notification immediately.
 */
export async function triggerLocalNotificationAsync(
  title: string,
  body: string,
  data?: any
): Promise<void> {
  if (!Notifications) {
    console.warn('Push notification native module is not available.');
    return;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // null trigger means show immediately
    });
  } catch (error) {
    console.error('Error scheduling local notification:', error);
  }
}

/**
 * Schedules a daily reminder at 9:00 PM local time.
 */
export async function scheduleDailyReminderAsync(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    await cancelDailyReminderAsync();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Kami 🌸",
        body: "Time for your daily reflection. How was your day? ✨",
        sound: true,
      },
      trigger: {
        hour: 21,
        minute: 0,
        repeats: true,
      } as any,
    });
    return id;
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
    return null;
  }
}

/**
 * Cancels scheduled daily reminder.
 */
export async function cancelDailyReminderAsync(): Promise<void> {
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.title === "Kami 🌸" && notif.content.body?.includes("daily reflection")) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (error) {
    console.error('Error cancelling daily reminder:', error);
  }
}

/**
 * Schedules weekly digest notification for Sunday 8 PM.
 */
export async function scheduleWeeklyDigestAsync(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    await cancelWeeklyDigestAsync();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Kami Weekly Digest 📊",
        body: "Your weekly couple digest is ready! Revisit your highlights. 💖",
        sound: true,
      },
      trigger: {
        weekday: 1, // Sunday in Expo notifications
        hour: 20,
        minute: 0,
        repeats: true,
      } as any,
    });
    return id;
  } catch (error) {
    console.error('Error scheduling weekly digest:', error);
    return null;
  }
}

/**
 * Cancels weekly digest reminder.
 */
export async function cancelWeeklyDigestAsync(): Promise<void> {
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.title === "Kami Weekly Digest 📊") {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (error) {
    console.error('Error cancelling weekly digest:', error);
  }
}

/**
 * Schedules streak alert daily at 8:00 PM.
 */
export async function scheduleStreakAlertsAsync(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    await cancelStreakAlertsAsync();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Kami Streak Alert 🔥",
        body: "Don't lose your connection streak today! Log your mood or write a quick journal. 💕",
        sound: true,
      },
      trigger: {
        hour: 20,
        minute: 0,
        repeats: true,
      } as any,
    });
    return id;
  } catch (error) {
    console.error('Error scheduling streak alert:', error);
    return null;
  }
}

/**
 * Cancels streak alert reminder.
 */
export async function cancelStreakAlertsAsync(): Promise<void> {
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.title === "Kami Streak Alert 🔥") {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (error) {
    console.error('Error cancelling streak alert:', error);
  }
}

