// Whether this build carries an Android Maps key (from the EAS environment at build time).
// Without one, Explore is list-only. Read from extra.mapsEnabled: Expo drops android.config
// (where the key goes) from the config the app reads at run time.

import Constants from 'expo-constants';

export function mapsConfigured(): boolean {
  return Constants.expoConfig?.extra?.mapsEnabled === true;
}
