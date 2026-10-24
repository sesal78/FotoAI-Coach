// Where Today looks: the home area from preferences, else the phone's location (foreground only,
// and only once the user has allowed it: the permission is asked from a tap, never by itself),
// else nowhere: Today then asks for a home area and never invents a place.

import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { usePreferences } from '../data/hooks';

export interface LatLng {
  lat: number;
  lng: number;
}

export type Where =
  | { state: 'loading' }
  | { state: 'ready'; at: LatLng; label: string; source: 'home' | 'phone' }
  | { state: 'none' };

/** About 100 m: enough for light and weather, without storing where exactly someone lives. */
export const roughly = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The phone's location, or null when it is refused or unknown. Never throws. With `ask`, the
 * permission is requested when Android still allows asking; without it, it is only checked.
 */
export async function phoneLocation({ ask = true }: { ask?: boolean } = {}): Promise<LatLng | null> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && ask && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 15 * 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return position ? { lat: roughly(position.coords.latitude), lng: roughly(position.coords.longitude) } : null;
  } catch {
    return null;
  }
}

/**
 * Where Today looks, and `ask` to request the location permission from a tap. With `preferPhone`
 * (Explore), the phone's location wins when it is already allowed, and the home area is the
 * fallback; it is still never asked for by itself.
 */
export function useWhere({ preferPhone = false }: { preferPhone?: boolean } = {}): { where: Where; ask: () => void } {
  const prefs = usePreferences();
  const home = prefs.data?.home ?? null;
  const prefsReady = prefs.isSuccess || prefs.isError;
  const needPhone = preferPhone || (!home && prefsReady);
  const [phone, setPhone] = useState<'idle' | 'checking' | LatLng | 'none'>('idle');

  useEffect(() => {
    if (!needPhone || phone !== 'idle') return;
    setPhone('checking');
    void phoneLocation({ ask: false }).then((at) => setPhone(at ?? 'none'));
  }, [needPhone, phone]);

  // Back from Android settings (or anywhere): check again, in case location was allowed there.
  // With preferPhone the check is silent: Explore keeps what it shows (and any pin being typed)
  // until the answer comes, then follows the phone, or the home area once location is off.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (preferPhone) void phoneLocation({ ask: false }).then((at) => setPhone(at ?? 'none'));
      else setPhone((p) => (p === 'none' ? 'idle' : p));
    });
    return () => sub.remove();
  }, [preferPhone]);

  const ask = useCallback(() => {
    setPhone('checking');
    void phoneLocation({ ask: true }).then((at) => setPhone(at ?? 'none'));
  }, []);

  const loading = { where: { state: 'loading' } as Where, ask };
  const fromPhone = typeof phone === 'object' ? { where: { state: 'ready', at: phone, label: 'Where you are', source: 'phone' } as Where, ask } : null;
  if (preferPhone && fromPhone) return fromPhone;
  if (preferPhone && (phone === 'idle' || phone === 'checking')) return loading;
  if (home) return { where: { state: 'ready', at: { lat: home.lat, lng: home.lng }, label: home.label || 'Home area', source: 'home' }, ask };
  if (!prefsReady || phone === 'idle' || phone === 'checking') return loading;
  if (phone === 'none') return { where: { state: 'none' }, ask };
  return fromPhone ?? loading;
}
