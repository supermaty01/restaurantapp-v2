import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Medellín, where v1 was written. Only ever seen when location is unavailable
 * or refused — it is a last resort, not a default.
 */
export const FALLBACK_REGION: Region = {
  latitude: 6.2442,
  longitude: -75.5812,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

/**
 * The region a map should open on: where you are, if the app may know.
 *
 * v1 hard-coded Medellín, so anyone anywhere else opened the map on the wrong
 * continent and had to pan. Permission is *not* requested here — asking for
 * location just to centre a map is rude — so this only resolves when the user
 * has already granted it, typically from the "use my location" button.
 *
 * Returns null until it knows, so callers can hold off centring rather than
 * jump the map once the fix arrives.
 */
export function useCurrentRegion(enabled = true): Region | null {
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        // Balanced, not high: this centres a map, it does not navigate.
        const position = await Location.getLastKnownPositionAsync();
        const fix =
          position ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));
        if (cancelled || !fix) return;

        setRegion({
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch {
        // A map centred on the fallback is fine; a crash is not.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return region;
}
