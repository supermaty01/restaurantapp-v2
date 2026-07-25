import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  Linking,
  Text,
  Animated,
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

import { RestaurantMarker } from '@/features/restaurants/components/RestaurantMarker';
import { useRestaurantMapList } from '@/features/restaurants/hooks/useRestaurantMapList';
import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';
import { FALLBACK_REGION, useCurrentRegion } from '@/lib/hooks/useCurrentRegion';
import { getPlaceDetails } from '@/services/places';

import type { PoiClickEvent } from 'react-native-maps';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

type PoiDetails = {
  name: string;
  coordinate: { latitude: number; longitude: number };
  address?: string | undefined;
  rating?: number | undefined;
  priceLevel?: number | undefined;
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
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<PoiDetails | null>(null);
  const [loadingPoi, setLoadingPoi] = useState(false);
  const drawerAnim = useRef(new Animated.Value(DRAWER_HEIGHT)).current;
  const panDrawerStart = useRef(0);

  const currentRegion = useCurrentRegion();

  const [query, setQuery] = useState('');
  const [focusedId, setFocusedId] = useState<number | null>(null);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return restaurants.filter((r) => r.name.toLowerCase().includes(term)).slice(0, 6);
  }, [restaurants, query]);

  /** Flies to a place and marks it, so you can see which one you picked. */
  const focusRestaurant = useCallback(
    (restaurant: { id: number; latitude: number; longitude: number }) => {
      setFocusedId(restaurant.id);
      setQuery('');
      mapRef.current?.animateToRegion(
        {
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        700,
      );
    },
    [],
  );

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
    // No places yet: open where the user is, not where v1 was written.
    return currentRegion ?? FALLBACK_REGION;
  }, [restaurants, currentRegion]);

  // initialRegion is only read on mount, so a fix that arrives later has to be
  // applied by hand — otherwise the map sits on the fallback for good.
  useEffect(() => {
    if (restaurants.length === 0 && currentRegion) {
      mapRef.current?.animateToRegion(currentRegion, 600);
    }
  }, [currentRegion, restaurants.length]);

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
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          drawerAnim.stopAnimation((v) => {
            panDrawerStart.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.min(DRAWER_HEIGHT, Math.max(0, panDrawerStart.current + g.dy));
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

  const fetchPlaceDetails = useCallback(
    async (placeId: string, name: string, coordinate: { latitude: number; longitude: number }) => {
      if (!GOOGLE_PLACES_API_KEY) {
        setSelectedPoi({ name, coordinate });
        setLoadingPoi(false);
        showDrawer();
        return;
      }

      try {
        const data = await getPlaceDetails(
          GOOGLE_PLACES_API_KEY,
          placeId,
          'formatted_address,rating,price_level,name',
        );

        if (data.status !== 'OK' || !data.result) {
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
    },
    [showDrawer],
  );

  const handlePoiClick = useCallback(
    (event: PoiClickEvent) => {
      const { placeId, name, coordinate } = event.nativeEvent;
      setSelectedPoi({ name, coordinate });
      setLoadingPoi(true);
      showDrawer();
      void fetchPlaceDetails(placeId, name, coordinate);
    },
    [fetchPlaceDetails, showDrawer],
  );

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
            { text: 'Abrir Configuración', onPress: () => void Linking.openSettings() },
          ],
        );
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800,
      );
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación actual.');
    }
    setLocating(false);
  };

  const drawerVisible = selectedPoi !== null;

  return (
    <View className="flex-1 bg-surface">
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
            <RestaurantMarker
              key={restaurant.id}
              latitude={restaurant.latitude}
              longitude={restaurant.longitude}
              name={restaurant.name}
              selected={focusedId === restaurant.id}
              onPress={() =>
                router.push({
                  pathname: '/restaurants/[id]/view',
                  params: { id: String(restaurant.id) },
                })
              }
            />
          ))}
        </MapView>

        {/* A map you cannot search is a map you can only pan. With a few
            hundred places, panning is not a way to find anything. */}
        <View
          className="absolute inset-x-0 top-0 px-5 pt-3"
          pointerEvents="box-none"
          style={{ gap: 8 }}
        >
          <View
            className="flex-row items-center gap-2.5 rounded-pill border border-line bg-surface px-4 py-3"
            style={elevation.medium}
          >
            <Ionicons name="search" size={17} color={colors.inkSubtle} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar en tus lugares…"
              placeholderTextColor={colors.inkSubtle}
              autoCorrect={false}
              returnKeyType="search"
              className="flex-1 text-ink"
              style={{ fontSize: 15, paddingVertical: 2 }}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Limpiar">
                <Ionicons name="close-circle" size={18} color={colors.inkSubtle} />
              </Pressable>
            ) : null}
          </View>

          {matches.length > 0 ? (
            <View
              className="overflow-hidden rounded-xl border border-line bg-surface"
              style={elevation.medium}
            >
              {matches.map((restaurant, index) => (
                <Pressable
                  key={restaurant.id}
                  accessibilityRole="button"
                  accessibilityLabel={restaurant.name}
                  onPress={() => focusRestaurant(restaurant)}
                  className={`flex-row items-center gap-2.5 px-4 py-3 active:bg-sunken ${
                    index > 0 ? 'border-t border-line' : ''
                  }`}
                >
                  <Ionicons name="location" size={15} color={colors.primary} />
                  <Text className="flex-1 text-ink" numberOfLines={1}>
                    {restaurant.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {loadingPoi && (
          <View
            style={{
              position: 'absolute',
              bottom: 24,
              alignSelf: 'center',
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              elevation: 4,
              shadowColor: '#2A211C',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
            }}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-ink-muted ml-2 text-sm">Verificando lugar...</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={centerOnUser}
          disabled={locating}
          style={{
            position: 'absolute',
            bottom: drawerVisible ? DRAWER_HEIGHT + 24 : 24,
            right: 16,
            backgroundColor: colors.surface,
            borderRadius: 28,
            width: 48,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
            shadowColor: '#2A211C',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
          }}
        >
          <Ionicons name="locate" size={24} color={colors.primary} />
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
            shadowColor: '#2A211C',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.2,
            shadowRadius: 6,
          }}
          className="bg-surface"
          pointerEvents={drawerVisible ? 'auto' : 'none'}
        >
          <View {...drawerPanResponder.panHandlers} style={styles.mapDrawerHandle}>
            <View style={[styles.mapDrawerNotch, { backgroundColor: colors.lineStrong }]} />
          </View>
          <View
            style={{
              flex: 1,
              paddingHorizontal: 20,
              paddingBottom: 20,
            }}
            className="bg-surface"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="restaurant" size={18} color={colors.primary} />
              <Text numberOfLines={1} className="text-ink text-lg font-semibold ml-2 flex-1">
                {selectedPoi?.name}
              </Text>
            </View>

            {selectedPoi?.address && (
              <Text numberOfLines={1} className="text-ink-subtle text-sm ml-7 mb-1">
                {selectedPoi.address}
              </Text>
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginLeft: 28,
                marginBottom: 12,
              }}
            >
              {selectedPoi?.rating != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text className="text-ink-muted text-sm ml-1">
                    {selectedPoi.rating.toFixed(1)}
                  </Text>
                </View>
              )}
              {selectedPoi?.priceLevel != null && (
                <Text className="text-ink-subtle text-sm">
                  {PRICE_LABELS[selectedPoi.priceLevel] ?? ''}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={handleCreateRestaurant}
              className="bg-primary py-3 rounded-md items-center flex-row justify-center"
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text className="text-on-primary font-bold">Crear restaurante</Text>
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
