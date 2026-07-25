import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { FlatList, View, Text, useWindowDimensions } from 'react-native';

import type { FilterSortOptions } from '@/components/FilterSortModal';
import FilterSortModal, { defaultFilterSortOptions } from '@/components/FilterSortModal';
import GridPeekItem from '@/components/GridPeekItem';
import RatingStars from '@/components/RatingStars';
import { Fab } from '@/components/ui/Fab';
import { ListHeader } from '@/components/ui/ListHeader';
import RestaurantItem from '@/features/restaurants/components/RestaurantItem';
import { useRestaurantList } from '@/features/restaurants/hooks/useRestaurantList';
import type { RestaurantListDTO } from '@/features/restaurants/types/restaurant-dto';
import { usePeekState } from '@/lib/context/PeekContext';
import { useListPreferences } from '@/lib/hooks/useListPreferences';

const keyExtractor = (item: RestaurantListDTO) => item.id.toString();

const buildPreviewData = (item: RestaurantListDTO) => {
  return {
    type: 'restaurant',
    id: item.id,
    name: item.name,
    comments: item.comments,
    rating: item.rating,
    tags: item.tags || [],
    imageUrl: item.images?.[0]?.uri,
  } as const;
};

export default function RestaurantsScreen() {
  const router = useRouter();
  const { isPeeking } = usePeekState();

  const restaurants = useRestaurantList(false);
  const prefs = useListPreferences('restaurant');

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterSortOptions>({
    ...defaultFilterSortOptions,
    sortField: prefs.sortField,
    sortOrder: prefs.sortOrder,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const { width } = useWindowDimensions();
  const numColumns = width >= 600 ? 3 : 2;

  const isGridView = prefs.isGridView;
  const setIsGridView = prefs.setIsGridView;

  useEffect(() => {
    if (prefs.loaded) {
      setFilterOptions((prev) => ({
        ...prev,
        sortField: prefs.sortField,
        sortOrder: prefs.sortOrder,
      }));
    }
  }, [prefs.loaded, prefs.sortField, prefs.sortOrder]);

  const hasActiveFilters =
    filterOptions.selectedTags.length > 0 ||
    filterOptions.minRating !== null ||
    filterOptions.sortField !== 'name' ||
    filterOptions.sortOrder !== 'asc';

  const filteredAndSortedRestaurants = useMemo(() => {
    let result = [...restaurants];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(query));
    }

    if (filterOptions.selectedTags.length > 0) {
      result = result.filter((restaurant) =>
        filterOptions.selectedTags.some((filterTag) =>
          restaurant.tags?.some((tag) => tag.id === filterTag.id),
        ),
      );
    }

    if (filterOptions.minRating !== null) {
      result = result.filter(
        (restaurant) => restaurant.rating !== null && restaurant.rating >= filterOptions.minRating!,
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (filterOptions.sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (filterOptions.sortField === 'rating') {
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        comparison = ratingA - ratingB;
      } else if (filterOptions.sortField === 'created') {
        comparison = a.id - b.id;
      }
      return filterOptions.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [restaurants, filterOptions, searchQuery]);

  const navigateToRestaurant = useCallback(
    (id: number) => {
      router.push({ pathname: '/restaurants/[id]/view', params: { id } });
    },
    [router],
  );

  const renderListItem = useCallback(
    ({ item }: { item: RestaurantListDTO }) => {
      const imageUrl = item.images?.[0]?.uri;
      const previewData = buildPreviewData(item);

      return (
        <RestaurantItem
          name={item.name}
          comments={item.comments}
          rating={item.rating}
          tags={item.tags || []}
          imageUrl={imageUrl}
          previewData={previewData}
          onPress={() => navigateToRestaurant(item.id)}
        />
      );
    },
    [navigateToRestaurant],
  );

  const renderGridItem = useCallback(
    ({ item }: { item: RestaurantListDTO }) => {
      const imageUrl = item.images?.[0]?.uri;
      const previewData = buildPreviewData(item);

      return (
        <GridPeekItem
          style={{ flex: 1 / numColumns }}
          previewData={previewData}
          onPress={() => navigateToRestaurant(item.id)}
        >
          {imageUrl ? (
            <Image
              source={imageUrl}
              style={{ width: '100%', height: 100 }}
              contentFit="cover"
              recyclingKey={`grid-rest-${item.id}`}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={{ width: '100%', height: 100 }} className="bg-sunken" />
          )}
          <View className="p-2">
            <Text className="text-sm font-bold text-ink" numberOfLines={1}>
              {item.name}
            </Text>
            <View className="flex-row mt-1">
              <RatingStars value={item.rating} size={12} gap={1} readOnly />
            </View>
          </View>
        </GridPeekItem>
      );
    },
    [navigateToRestaurant, numColumns],
  );

  const listEmptyComponent = useMemo(
    () => (
      <View className="flex-1 justify-center items-center mt-10">
        <Text className="text-base text-ink">No se encontraron restaurantes.</Text>
      </View>
    ),
    [],
  );

  return (
    <View className="relative flex-1 bg-canvas px-5 pt-2">
      <ListHeader
        title="Lugares"
        count={filteredAndSortedRestaurants.length}
        countLabel="lugares"
        actions={[
          { icon: 'map-outline', label: 'Ver en el mapa', onPress: () => router.push('/map') },
          {
            icon: isGridView ? 'list-outline' : 'grid-outline',
            label: isGridView ? 'Ver como lista' : 'Ver como cuadrícula',
            onPress: () => setIsGridView(!isGridView),
          },
          {
            icon: 'options-outline',
            label: 'Filtrar y ordenar',
            onPress: () => setFilterModalVisible(true),
            active: hasActiveFilters,
          },
        ]}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Buscar un lugar…',
        }}
      />
      <View className="h-4" />
      <FlatList
        key={isGridView ? `grid-${numColumns}` : 'list'}
        data={filteredAndSortedRestaurants}
        keyExtractor={keyExtractor}
        numColumns={isGridView ? numColumns : 1}
        columnWrapperStyle={isGridView ? { gap: 8 } : undefined}
        renderItem={isGridView ? renderGridItem : renderListItem}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-28"
        ListEmptyComponent={listEmptyComponent}
        scrollEnabled={!isPeeking}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
      />
      <Fab
        onPress={() => router.push('/restaurants/new')}
        accessibilityLabel="Nuevo lugar"
        aboveTabBar
      />

      <FilterSortModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        options={filterOptions}
        onApply={(opts) => {
          setFilterOptions(opts);
          prefs.setSortField(opts.sortField);
          prefs.setSortOrder(opts.sortOrder);
        }}
        entityType="restaurant"
      />
    </View>
  );
}
