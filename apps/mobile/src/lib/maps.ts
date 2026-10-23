// Whether this build carries an Android Maps key (from the EAS environment at build time).
// Without one, Explore is list-only.

import Constants from 'expo-constants';

export function mapsConfigured(): boolean {
  return Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey);
}
