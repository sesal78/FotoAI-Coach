// Expo app config for FotoAI on Android. Only public values belong here: the APK is readable.
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'FotoAI',
  slug: 'fotoai-coach',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'fotoai',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'com.topues.fotoai',
    adaptiveIcon: {
      backgroundColor: '#F6E7CF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Coarse location is enough for light, weather and a home area; precise is never asked for.
    blockedPermissions: ['android.permission.ACCESS_FINE_LOCATION'],
    // Saved reads (email, home area, gear) stay on this phone: not copied to Google backups.
    allowBackup: false,
    // The password-reset email link opens the app (Android App Link), verified through
    // https://myfoto.topues.com/.well-known/assetlinks.json (live since 3B).
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'myfoto.topues.com', pathPrefix: '/reset-password' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#F6E7CF', image: './assets/images/splash-icon.png', imageWidth: 76 }],
    'expo-secure-store',
    'expo-sqlite',
    // Foreground only: Today's light and weather, and setting the home area. Never in the background.
    ['expo-location', { locationWhenInUsePermission: 'FotoAI uses your location to show the light and weather where you are, and to set your home area.', isAndroidBackgroundLocationEnabled: false }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  // The EAS project (Expo account topues) that builds the APK. Public ids, not secrets.
  owner: 'topues',
  extra: { eas: { projectId: 'da8a3077-a742-4365-b8cf-7392759e6210' } },
};

export default config;
