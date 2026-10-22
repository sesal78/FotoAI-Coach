// Where Today looks: the home area from preferences, else the phone's location (foreground only,
// after the one permission ask Android allows), else nowhere: Today then asks for a home area and
// never invents a place.

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { usePreferences } from '../data/hooks';

export interface LatLng {
  lat: number;
  lng: number;
}

export type Where =
  | { state: 'loading' }
  | { state: 'ready'; at: LatLng; label: string; source: 'home' | 'phone' }
  | { state: 'none' };

/** The phone's location, or null when it is refused or unknown. Never throws. */
export async function phoneLocation(): Promise<LatLng | null> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position =
      (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
  } catch {
    return null;
  }
}

export function useWhere(): Where {
  const prefs = usePreferences();
  const home = prefs.data?.home ?? null;
  const needPhone = !home && (prefs.isSuccess || prefs.isError);
  const [phone, setPhone] = useState<'idle' | 'asking' | LatLng | 'none'>('idle');

  useEffect(() => {
    if (!needPhone || phone !== 'idle') return;
    setPhone('asking');
    void phoneLocation().then((at) => setPhone(at ?? 'none'));
  }, [needPhone, phone]);

  if (home) return { state: 'ready', at: { lat: home.lat, lng: home.lng }, label: home.label || 'Home area', source: 'home' };
  if (!needPhone || phone === 'idle' || phone === 'asking') return { state: 'loading' };
  if (phone === 'none') return { state: 'none' };
  return { state: 'ready', at: phone, label: 'Where you are', source: 'phone' };
}
