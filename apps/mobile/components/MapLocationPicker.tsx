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
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  MapPressEvent,
  Region,
} from 'react-native-maps';

import { useTheme } from '@/lib/context/ThemeContext';

interface MapLocationPickerProps {
  location: { latitude: number; longitude: number } | null;
  onLocationChange?: (
    location: { latitude: number; longitude: number } | null
  ) => void;
  editable?: boolean;
}

interface PlaceSuggestion {
  place_id: string;
  description: string;
}

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

const openAppSettings = () => {
  Linking.openSettings().catch(() => {
    Alert.alert(
      'Error',
      'No se pudo abrir la configuración de la aplicación.'
    );
  });
};

const DEFAULT_REGION: Region = {
  latitude: 6.2442,
  longitude: -75.5812,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  location,
  onLocationChange,
  editable = true,
}) => {
  const { isDarkMode } = useTheme();
  const mapRef = useRef<MapView | null>(null);

  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: location?.latitude ?? DEFAULT_REGION.latitude,
    longitude: location?.longitude ?? DEFAULT_REGION.longitude,
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  });

  const [selectedLocation, setSelectedLocation] = useState(location);
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [gettingCurrentLocation, setGettingCurrentLocation] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [searchBiasLocation, setSearchBiasLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const colors = {
    card: isDarkMode ? '#1C1C1E' : '#FFFFFF',
    input: isDarkMode ? '#2A2A2D' : '#FFFFFF',
    border: isDarkMode ? '#3A3A3C' : '#E5E7EB',
    text: isDarkMode ? '#E5E7EB' : '#111827',
    mutedText: isDarkMode ? '#A1A1AA' : '#6B7280',
    suggestionPressed: isDarkMode ? '#2F2F33' : '#F3F4F6',
  };

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
      fetchAddress(location.latitude, location.longitude);
    } else {
      setSelectedLocation(null);
      setAddress('Ubicación no disponible');
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

    loadSearchBiasLocation();
  }, []);

  const fetchAddress = async (latitude: number, longitude: number) => {
    setLoadingAddress(true);

    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (geocode.length > 0) {
        const addressInfo = geocode[0];
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
        setAddress('Ubicación no disponible');
      }
    } catch {
      setAddress('Ubicación no disponible');
    } finally {
      setLoadingAddress(false);
    }
  };

  const searchPlaces = useCallback(async (input: string) => {
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
      const biasLocation =
        searchBiasLocation ||
        selectedLocation || {
          latitude: mapRegion.latitude,
          longitude: mapRegion.longitude,
        };

      const params = new URLSearchParams({
        input: trimmed,
        key: GOOGLE_PLACES_API_KEY,
        language: 'es',
        location: `${biasLocation.latitude},${biasLocation.longitude}`,
        radius: '50000',
      });

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        const mappedSuggestions: PlaceSuggestion[] = data.predictions.map(
          (item: any) => ({
            place_id: item.place_id,
            description: item.description,
          })
        );

        setSuggestions(mappedSuggestions.slice(0, 5));
      } else if (data.status === 'ZERO_RESULTS') {
        setSuggestions([]);
      } else {
        console.warn(
          'Places autocomplete error:',
          data.status,
          data.error_message
        );
        setSuggestions([]);
      }
    } catch (error) {
      console.warn('Error searching places:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [mapRegion, searchBiasLocation, selectedLocation]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchPlaces(searchQuery);
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
      const params = new URLSearchParams({
        place_id: placeId,
        fields: 'geometry,name,formatted_address',
        key: GOOGLE_PLACES_API_KEY,
        language: 'es',
      });

      const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        console.warn('Place details error:', data.status, data.error_message);
        Alert.alert('Error', 'No se pudo obtener la ubicación del lugar.');
        return;
      }

      const placeLocation = data.result.geometry.location;
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

      setAddress(data.result.formatted_address || description);
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
    fetchAddress(latitude, longitude);
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
          ]
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
      fetchAddress(coords.latitude, coords.longitude);
      setSuggestions([]);
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación actual.');
    } finally {
      setGettingCurrentLocation(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedLocation(null);
    setAddress('Ubicación no disponible');
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
              backgroundColor: colors.input,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              minHeight: 48,
            }}
          >
            <Ionicons
              name="search"
              size={18}
              color={colors.mutedText}
              style={{ marginRight: 8 }}
            />

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar un lugar"
              placeholderTextColor={colors.mutedText}
              style={{
                flex: 1,
                color: colors.text,
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
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.mutedText}
                />
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
              <ActivityIndicator
                size="small"
                color={isDarkMode ? '#fff' : '#000'}
              />
            </View>
          )}

          {suggestions.length > 0 && (
            <View
              style={{
                marginTop: 8,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {suggestions.map((item, index) => {
                const isLast = index === suggestions.length - 1;

                return (
                  <TouchableOpacity
                    key={item.place_id}
                    onPress={() =>
                      selectPlace(item.place_id, item.description)
                    }
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.border,
                      backgroundColor: colors.card,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
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
          borderRadius: 12,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ width: '100%', height: 250 }}
          region={mapRegion}
          onPress={handleMapPress}
          scrollEnabled={editable}
          zoomEnabled={editable}
        >
          {selectedLocation && <Marker coordinate={selectedLocation} />}
        </MapView>
      </View>

      <View style={{ paddingTop: 12, alignItems: 'center' }}>
        {loadingAddress ? (
          <ActivityIndicator
            size="small"
            color={isDarkMode ? '#fff' : '#000'}
          />
        ) : (
          <Text
            style={{
              textAlign: 'center',
              color: colors.text,
              marginBottom: 4,
            }}
          >
            {address ?? 'Ubicación no disponible'}
          </Text>
        )}

        {editable && !selectedLocation && (
          <TouchableOpacity
            className="bg-primary dark:bg-dark-primary"
            style={{
              flexDirection: 'row',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 8,
              marginTop: 8,
              alignItems: 'center',
            }}
            onPress={handleUseCurrentLocation}
            disabled={gettingCurrentLocation}
          >
            {gettingCurrentLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="location"
                  size={18}
                  color="white"
                  style={{ marginRight: 6 }}
                />
                <Text style={{ color: 'white', fontWeight: 'bold' }}>
                  Usar mi ubicación
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {editable && selectedLocation && (
          <TouchableOpacity
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 8,
              marginTop: 8,
            }}
            className="bg-destructive dark:bg-dark-destructive"
            onPress={handleClearSelection}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>
              Borrar selección
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default MapLocationPicker;