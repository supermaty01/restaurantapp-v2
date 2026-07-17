import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  Linking,
  Text,
  Animated,
  ActivityIndicator,
  PanResponder,
  StyleSheet,
} from 'react-native';
import MapView, { Marker, PoiClickEvent, PROVIDER_GOOGLE } from 'react-native-maps';

import { useRestaurantMapList } from '@/features/restaurants/hooks/useRestaurantMapList';
import { useTheme } from '@/lib/context/ThemeContext';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

type PoiDetails = {
  name: string;
  coordinate: { latitude: number; longitude: number };
  address?: string;
  rating?: number;
  priceLevel?: number;
};

const DRAWER_HEIGHT = 190;
const SHEET_TOP_RADIUS = 24;

const PRICE_LABELS: Record<number, string> = {
  0: 'Gratis',
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

export default function MapScreen() {
  const restaurants = useRestaurantMapList();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<PoiDetails | null>(null);
  const [loadingPoi, setLoadingPoi] = useState(false);
  const drawerAnim = useRef(new Animated.Value(DRAWER_HEIGHT)).current;
  const panDrawerStart = useRef(0);

  const initialRegion = useMemo(() => {
    if (restaurants.length > 0) {
      const lats = restaurants.map((r) => r.latitude);
      const lngs = restaurants.map((r) => r.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(maxLat - minLat, 0.01) * 1.5,
        longitudeDelta: Math.max(maxLng - minLng, 0.01) * 1.5,
      };
    }
    return {
      latitude: 6.2442,
      longitude: -75.5812,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [restaurants]);

  const showDrawer = useCallback(() => {
    Animated.spring(drawerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [drawerAnim]);

  const hideDrawer = useCallback(() => {
    Animated.timing(drawerAnim, {
      toValue: DRAWER_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSelectedPoi(null);
      setLoadingPoi(false);
    });
  }, [drawerAnim]);

  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          drawerAnim.stopAnimation((v) => {
            panDrawerStart.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.min(
            DRAWER_HEIGHT,
            Math.max(0, panDrawerStart.current + g.dy),
          );
          drawerAnim.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          const mid = DRAWER_HEIGHT / 2;
          drawerAnim.stopAnimation((v) => {
            if (v > mid || g.vy > 0.85) {
              hideDrawer();
            } else {
              Animated.spring(drawerAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
              }).start();
            }
          });
        },
      }),
    [drawerAnim, hideDrawer],
  );

  const fetchPlaceDetails = useCallback(async (
    placeId: string,
    name: string,
    coordinate: { latitude: number; longitude: number },
  ) => {
    if (!GOOGLE_PLACES_API_KEY) {
      setSelectedPoi({ name, coordinate });
      setLoadingPoi(false);
      showDrawer();
      return;
    }

    try {
      const params = new URLSearchParams({
        place_id: placeId,
        fields: 'formatted_address,rating,price_level,name',
        key: GOOGLE_PLACES_API_KEY,
        language: 'es',
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
      );
      const data = await response.json();

      if (data.status !== 'OK') {
        setSelectedPoi({ name, coordinate });
        setLoadingPoi(false);
        showDrawer();
        return;
      }

      setSelectedPoi({
        name: data.result.name ?? name,
        coordinate,
        address: data.result.formatted_address,
        rating: data.result.rating,
        priceLevel: data.result.price_level,
      });
      setLoadingPoi(false);
      showDrawer();
    } catch {
      setSelectedPoi({ name, coordinate });
      setLoadingPoi(false);
      showDrawer();
    }
  }, [showDrawer]);

  const handlePoiClick = useCallback((event: PoiClickEvent) => {
    const { placeId, name, coordinate } = event.nativeEvent;
    setSelectedPoi({ name, coordinate });
    setLoadingPoi(true);
    showDrawer();
    fetchPlaceDetails(placeId, name, coordinate);
  }, [fetchPlaceDetails, showDrawer]);

  const handleCreateRestaurant = useCallback(() => {
    if (!selectedPoi) return;
    const poi = selectedPoi;
    hideDrawer();
    router.push({
      pathname: '/restaurants/new',
      params: {
        prefillName: poi.name,
        prefillLatitude: String(poi.coordinate.latitude),
        prefillLongitude: String(poi.coordinate.longitude),
      },
    });
  }, [selectedPoi, hideDrawer, router]);

  const handleMapPress = useCallback(() => {
    if (selectedPoi) hideDrawer();
  }, [selectedPoi, hideDrawer]);

  const centerOnUser = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado',
          'Se requieren permisos para acceder a la ubicación. ¿Deseas ir a la configuración para habilitarlos?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Configuración', onPress: () => Linking.openSettings() },
          ]
        );
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 800);
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación actual.');
    }
    setLocating(false);
  };

  const drawerVisible = selectedPoi !== null;

  return (
    <View className="flex-1 bg-card dark:bg-dark-card">
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onPoiClick={handlePoiClick}
          onPress={handleMapPress}
        >
          {restaurants.map((restaurant) => (
            <Marker
              key={restaurant.id}
              coordinate={{
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
              }}
              title={restaurant.name}
              description={
                restaurant.rating ? `⭐ ${restaurant.rating}/5` : undefined
              }
              onCalloutPress={() =>
                router.push({
                  pathname: '/restaurants/[id]/view',
                  params: { id: restaurant.id },
                })
              }
            />
          ))}
        </MapView>

        {loadingPoi && (
          <View
            style={{
              position: 'absolute',
              bottom: 24,
              alignSelf: 'center',
              backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              elevation: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
            }}
          >
            <ActivityIndicator size="small" color={isDarkMode ? '#B27A4D' : '#905c36'} />
            <Text className="text-gray-600 dark:text-gray-400 ml-2 text-sm">
              Verificando lugar...
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={centerOnUser}
          disabled={locating}
          style={{
            position: 'absolute',
            bottom: drawerVisible ? DRAWER_HEIGHT + 24 : 24,
            right: 16,
            backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
            borderRadius: 28,
            width: 48,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
          }}
        >
          <Ionicons
            name="locate"
            size={24}
            color={isDarkMode ? '#B27A4D' : '#905c36'}
          />
        </TouchableOpacity>

        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: DRAWER_HEIGHT,
            transform: [{ translateY: drawerAnim }],
            borderTopLeftRadius: SHEET_TOP_RADIUS,
            borderTopRightRadius: SHEET_TOP_RADIUS,
            overflow: 'hidden',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.2,
            shadowRadius: 6,
          }}
          className="bg-card dark:bg-dark-card"
          pointerEvents={drawerVisible ? 'auto' : 'none'}
        >
          <View
            {...drawerPanResponder.panHandlers}
            style={styles.mapDrawerHandle}
          >
            <View
              style={[
                styles.mapDrawerNotch,
                { backgroundColor: isDarkMode ? '#555' : '#ccc' },
              ]}
            />
          </View>
          <View
            style={{
              flex: 1,
              paddingHorizontal: 20,
              paddingBottom: 20,
            }}
            className="bg-card dark:bg-dark-card"
          >

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="restaurant" size={18} color={isDarkMode ? '#B27A4D' : '#905c36'} />
              <Text
                numberOfLines={1}
                className="text-gray-800 dark:text-gray-200 text-lg font-semibold ml-2 flex-1"
              >
                {selectedPoi?.name}
              </Text>
            </View>

            {selectedPoi?.address && (
              <Text numberOfLines={1} className="text-gray-500 dark:text-gray-400 text-sm ml-7 mb-1">
                {selectedPoi.address}
              </Text>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 28, marginBottom: 12 }}>
              {selectedPoi?.rating != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text className="text-gray-600 dark:text-gray-300 text-sm ml-1">
                    {selectedPoi.rating.toFixed(1)}
                  </Text>
                </View>
              )}
              {selectedPoi?.priceLevel != null && (
                <Text className="text-gray-500 dark:text-gray-400 text-sm">
                  {PRICE_LABELS[selectedPoi.priceLevel] ?? ''}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={handleCreateRestaurant}
              className="bg-primary dark:bg-dark-primary py-3 rounded-md items-center flex-row justify-center"
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text className="text-white font-bold">Crear restaurante</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapDrawerHandle: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  mapDrawerNotch: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
