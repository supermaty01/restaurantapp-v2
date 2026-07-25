import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { BurgerGlyph } from '@/components/ui/BurgerGlyph';
import { Button } from '@/components/ui/Button';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { FALLBACK_REGION, useCurrentRegion } from '@/lib/hooks/useCurrentRegion';
import { getAutocomplete, getPlaceDetails } from '@/services/places';

import type { MapPressEvent, Region } from 'react-native-maps';

interface MapLocationPickerProps {
  location: { latitude: number; longitude: number } | null;
  onLocationChange?:
    ((location: { latitude: number; longitude: number } | null) => void) | undefined;
  editable?: boolean | undefined;
}

interface PlaceSuggestion {
  place_id: string;
  description: string;
}

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

const openAppSettings = () => {
  Linking.openSettings().catch(() => {
    Alert.alert('Error', 'No se pudo abrir la configuración de la aplicación.');
  });
};

// Only reached when the app has no location permission and the entity has no
// coordinates yet. See lib/hooks/useCurrentRegion.
const DEFAULT_REGION: Region = FALLBACK_REGION;

/** Identity for a coordinate pair, rounded to ~1 m. */
function coordKey({ latitude, longitude }: { latitude: number; longitude: number }): string {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  location,
  onLocationChange,
  editable = true,
}) => {
  const { colors } = useTheme();
  const mapRef = useRef<MapView | null>(null);

  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: location?.latitude ?? DEFAULT_REGION.latitude,
    longitude: location?.longitude ?? DEFAULT_REGION.longitude,
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  });

  // Only when the entity has no coordinates of its own: an existing place must
  // never drift towards wherever you happen to be standing.
  const currentRegion = useCurrentRegion(!location);

  useEffect(() => {
    if (!location && currentRegion) {
      setMapRegion(currentRegion);
      mapRef.current?.animateToRegion(currentRegion, 600);
    }
  }, [currentRegion, location]);

  const [selectedLocation, setSelectedLocation] = useState(location);
  const [address, setAddress] = useState<string | null>(null);
  // Coordinates whose address we already know. Picking a place from search
  // gives us its formatted address for free; without this the `location`
  // effect below immediately re-geocoded and overwrote it — usually with the
  // failure text, since reverse geocoding needs a permission we do not ask for.
  const resolvedFor = useRef<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [gettingCurrentLocation, setGettingCurrentLocation] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [searchBiasLocation, setSearchBiasLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    if (location) {
      const newRegion: Region = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: DEFAULT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_REGION.longitudeDelta,
      };

      setMapRegion(newRegion);
      setSelectedLocation(location);
      mapRef.current?.animateToRegion(newRegion, 500);

      if (resolvedFor.current !== coordKey(location)) {
        void fetchAddress(location.latitude, location.longitude);
      }
    } else {
      setSelectedLocation(null);
      setAddress(null);
    }
  }, [location]);

  useEffect(() => {
    const loadSearchBiasLocation = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();

        if (permission.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({});
          setSearchBiasLocation({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
        }
      } catch {
        // Silent fail, autocomplete can still work without location bias
      }
    };

    void loadSearchBiasLocation();
  }, []);

  const fetchAddress = async (latitude: number, longitude: number) => {
    setLoadingAddress(true);

    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      resolvedFor.current = coordKey({ latitude, longitude });
      const addressInfo = geocode[0];
      if (addressInfo) {
        const formattedAddress = [
          addressInfo.name || '',
          addressInfo.street || '',
          addressInfo.city || '',
          addressInfo.region || '',
          addressInfo.country || '',
        ]
          .filter(Boolean)
          .join(', ');

        setAddress(formattedAddress || 'Ubicación no disponible');
      } else {
        setAddress(null);
      }
    } catch {
      setAddress(null);
    } finally {
      setLoadingAddress(false);
    }
  };

  const searchPlaces = useCallback(
    async (input: string) => {
      const trimmed = input.trim();

      if (!trimmed || trimmed.length < 2) {
        setSuggestions([]);
        return;
      }

      if (!GOOGLE_PLACES_API_KEY) {
        console.warn('Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY');
        setSuggestions([]);
        return;
      }

      setLoadingSuggestions(true);

      try {
        const biasLocation = searchBiasLocation ||
          selectedLocation || {
            latitude: mapRegion.latitude,
            longitude: mapRegion.longitude,
          };

        const data = await getAutocomplete(GOOGLE_PLACES_API_KEY, trimmed, biasLocation, 50000);

        if (data.status === 'OK') {
          const mappedSuggestions: PlaceSuggestion[] = data.predictions.map((item) => ({
            place_id: item.place_id,
            description: item.description,
          }));

          setSuggestions(mappedSuggestions.slice(0, 5));
        } else if (data.status === 'ZERO_RESULTS') {
          setSuggestions([]);
        } else {
          console.warn('Places autocomplete error:', data.status, data.error_message);
          setSuggestions([]);
        }
      } catch (error) {
        console.warn('Error searching places:', error);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [mapRegion, searchBiasLocation, selectedLocation],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      void searchPlaces(searchQuery);
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchPlaces, searchQuery]);

  const selectPlace = async (placeId: string, description: string) => {
    if (!GOOGLE_PLACES_API_KEY) {
      console.warn('Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY');
      Alert.alert('Error', 'No se encontró la configuración de Google Places.');
      return;
    }

    try {
      const data = await getPlaceDetails(
        GOOGLE_PLACES_API_KEY,
        placeId,
        'geometry,name,formatted_address',
      );

      const placeLocation = data.result?.geometry?.location;
      if (data.status !== 'OK' || !placeLocation) {
        console.warn('Place details error:', data.status, data.error_message);
        Alert.alert('Error', 'No se pudo obtener la ubicación del lugar.');
        return;
      }

      const coords = {
        latitude: placeLocation.lat,
        longitude: placeLocation.lng,
      };

      const newRegion: Region = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: DEFAULT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_REGION.longitudeDelta,
      };

      setMapRegion(newRegion);
      setSelectedLocation(coords);
      setSearchBiasLocation(coords);
      onLocationChange?.(coords);

      mapRef.current?.animateToRegion(newRegion, 500);

      resolvedFor.current = coordKey(coords);
      setAddress(data.result?.formatted_address || description);
      setSearchQuery(description);
      setSuggestions([]);
    } catch (error) {
      console.warn('Error selecting place:', error);
      Alert.alert('Error', 'No se pudo seleccionar el lugar.');
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    if (!editable) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;
    const coords = { latitude, longitude };

    const newRegion: Region = {
      ...mapRegion,
      latitude,
      longitude,
    };

    setMapRegion(newRegion);
    setSelectedLocation(coords);
    setSearchBiasLocation(coords);
    onLocationChange?.(coords);
    void fetchAddress(latitude, longitude);
    setSuggestions([]);
  };

  const handleUseCurrentLocation = async () => {
    setGettingCurrentLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado',
          'Se requieren permisos para acceder a la ubicación. ¿Deseas ir a la configuración para habilitarlos?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Configuración', onPress: openAppSettings },
          ],
        );
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      const newRegion: Region = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: DEFAULT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_REGION.longitudeDelta,
      };

      setMapRegion(newRegion);
      setSelectedLocation(coords);
      setSearchBiasLocation(coords);
      onLocationChange?.(coords);

      mapRef.current?.animateToRegion(newRegion, 500);
      void fetchAddress(coords.latitude, coords.longitude);
      setSuggestions([]);
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación actual.');
    } finally {
      setGettingCurrentLocation(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedLocation(null);
    setAddress(null);
    setSearchQuery('');
    setSuggestions([]);
    onLocationChange?.(null);
  };

  return (
    <View style={{ width: '100%' }}>
      {editable && (
        <View style={{ marginBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 10,
              paddingHorizontal: 12,
              minHeight: 48,
            }}
          >
            <Ionicons name="search" size={18} color={colors.inkMuted} style={{ marginRight: 8 }} />

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar un lugar"
              placeholderTextColor={colors.inkMuted}
              style={{
                flex: 1,
                color: colors.ink,
                paddingVertical: 12,
              }}
            />

            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                }}
                hitSlop={10}
              >
                <Ionicons name="close-circle" size={18} color={colors.inkMuted} />
              </TouchableOpacity>
            )}
          </View>

          {loadingSuggestions && (
            <View
              style={{
                paddingTop: 8,
                alignItems: 'center',
              }}
            >
              <ActivityIndicator size="small" color={colors.ink} />
            </View>
          )}

          {suggestions.length > 0 && (
            <View
              style={{
                marginTop: 8,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {suggestions.map((item, index) => {
                const isLast = index === suggestions.length - 1;

                return (
                  <TouchableOpacity
                    key={item.place_id}
                    onPress={() => selectPlace(item.place_id, item.description)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.line,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.ink,
                        fontSize: 14,
                      }}
                    >
                      {item.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      <View
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface,
        }}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ width: '100%', height: 200 }}
          region={mapRegion}
          onPress={handleMapPress}
          scrollEnabled={editable}
          zoomEnabled={editable}
        >
          {selectedLocation ? (
            <Marker coordinate={selectedLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View
                style={{ backgroundColor: colors.primary }}
                className="h-8 w-8 items-center justify-center rounded-pill"
              >
                <BurgerGlyph size={16} color={colors.onPrimary} />
              </View>
            </Marker>
          ) : null}
        </MapView>

        {/* The address belongs to the map, so it lives in the same card: it was
            floating underneath, which read as a caption for the whole form. */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.line,
            paddingVertical: 10,
            paddingHorizontal: 14,
            alignItems: 'center',
          }}
        >
          {loadingAddress ? (
            <ActivityIndicator size="small" color={colors.inkMuted} />
          ) : (
            <Txt variant="caption" tone={address ? 'muted' : 'subtle'} className="text-center">
              {/* A failed address lookup is not a missing location. Falling back
                to the coordinates says "this is set, we just cannot name it";
                "Ubicación no disponible" said the opposite, and said it even
                when a pin was clearly sitting on the map. */}
              {address ??
                (selectedLocation
                  ? `${selectedLocation.latitude.toFixed(5)}, ${selectedLocation.longitude.toFixed(5)}`
                  : 'Toca el mapa para elegir un punto')}
            </Txt>
          )}

          {editable ? (
            <View className="mt-2.5 flex-row gap-2">
              {selectedLocation ? (
                <Button
                  label="Quitar"
                  variant="ghost"
                  size="sm"
                  icon="close"
                  onPress={handleClearSelection}
                />
              ) : (
                <Button
                  label="Usar mi ubicación"
                  variant="secondary"
                  size="sm"
                  icon="locate"
                  loading={gettingCurrentLocation}
                  onPress={handleUseCurrentLocation}
                />
              )}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default MapLocationPicker;
