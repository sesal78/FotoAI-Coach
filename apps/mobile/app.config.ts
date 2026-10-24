// Expo app config for FotoAI on Android. Only public values belong here: the APK is readable.
import type { ExpoConfig } from 'expo/config';

// The Android Maps SDK key: public in the APK, restricted in Google Cloud to this package and the
// EAS signing certificate. It comes from the EAS environment; with none, Explore is list-only.
const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

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
    ...(mapsKey ? { config: { googleMaps: { apiKey: mapsKey } } } : {}),
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
    // react-native-maps brings androidx.work 2.9.1 with Room 2.5. Room's own R8 rule keeps the
    // database class but not its constructor, so the release APK crashed at launch without this.
    ['expo-build-properties', { android: { extraProguardRules: '-keep class * extends androidx.room.RoomDatabase { <init>(); }' } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  // The EAS project (Expo account topues) that builds the APK. Public ids, not secrets.
  owner: 'topues',
  // mapsEnabled tells the app it has a Maps key: Expo leaves android.config out of the config the
  // app reads at run time. Only a true/false, never the key.
  extra: { eas: { projectId: 'da8a3077-a742-4365-b8cf-7392759e6210' }, mapsEnabled: Boolean(mapsKey) },
};

export default config;
