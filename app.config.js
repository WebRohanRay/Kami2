import 'dotenv/config';

export default {
  expo: {
    name: 'Kami',
    slug: 'Kami',
    version: '1.0.0',

    scheme: 'kami',

    orientation: 'portrait',
    icon: './assets/icon.png',

    userInterfaceStyle: 'light',
    newArchEnabled: true,

    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },

    ios: {
      supportsTablet: true,

      infoPlist: {
        NSPhotoLibraryUsageDescription:
          'Kami needs access to your photos so you can upload profile pictures and memories.',

        NSPhotoLibraryAddUsageDescription:
          'Kami may save images to your photo library when requested.',

        NSCameraUsageDescription:
          'Kami needs camera access so you can take profile photos.',
      },
    },

    android: {
      package: 'com.rohanray12345.Kami',
      googleServicesFile: './google-services.json',

      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },

      softwareKeyboardLayoutMode: 'pan',
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,

      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.RECORD_AUDIO',
      ],
    },

    web: {
      favicon: './assets/favicon.png',
    },

    plugins: [
      'expo-notifications',
      'expo-secure-store',
      'expo-web-browser',
      'expo-image-picker',
      '@react-native-google-signin/google-signin',
      'expo-sqlite',
      'expo-file-system',
    ],

    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,

      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,

      eas: {
        projectId: 'f298b22a-0745-413d-bf90-5156a5d009ff',
      },
    },
  },
};
