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
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#F6E7CF', image: './assets/images/splash-icon.png', imageWidth: 76 }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
