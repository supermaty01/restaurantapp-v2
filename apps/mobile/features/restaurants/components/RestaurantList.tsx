import { useRouter } from 'expo-router';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { FlatList, View, Text, useWindowDimensions } from 'react-native';

import type { FilterSortOptions } from '@/components/filters/FilterSheet';
import { FilterSheet, defaultFilterSortOptions } from '@/components/filters/FilterSheet';
import GridPeekItem from '@/components/GridPeekItem';
import RatingStars from '@/components/RatingStars';
import { ListHeader } from '@/components/ui/ListHeader';
import { Photo } from '@/components/ui/Photo';
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

export function RestaurantList() {
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
    filterOptions.visibilities.length > 0 ||
    filterOptions.minRating !== null ||
    filterOptions.sortField !== 'name' ||
    filterOptions.sortOrder !== 'asc';

  // Extracted so the filter sheet can count what a draft would leave without
  // applying it — the whole point of showing "Ver 12" on the button.
  const applyFilters = useCallback(
    (options: FilterSortOptions) => {
      let result = [...restaurants];

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        result = result.filter((r) => r.name.toLowerCase().includes(query));
      }

      if (options.selectedTags.length > 0) {
        result = result.filter((restaurant) =>
          options.selectedTags.some((filterTag) =>
            restaurant.tags?.some((tag) => tag.id === filterTag.id),
          ),
        );
      }

      if (options.minRating !== null) {
        result = result.filter(
          (restaurant) => restaurant.rating !== null && restaurant.rating >= options.minRating!,
        );
      }

      // Filtrar por el valor *guardado*, no por el resuelto: "cuáles dejé en
      // automático" es la pregunta que hay que poder responder para auditar lo
      // que compartes, porque son justo las que se moverán si cambias el
      // ajuste general.
      if (options.visibilities.length > 0) {
        result = result.filter((item) => options.visibilities.includes(item.visibility));
      }
      return result;
    },
    [restaurants, searchQuery],
  );

  const filteredAndSortedRestaurants = useMemo(() => {
    const result = applyFilters(filterOptions);

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
  }, [applyFilters, filterOptions]);

  const navigateToRestaurant = useCallback(
    (id: number) => {
      router.push({ pathname: '/restaurants/[id]/view', params: { id } });
    },
    [router],
  );

  const renderListItem = useCallback(
    ({ item }: { item: RestaurantListDTO }) => {
      const image = item.images?.[0];
      const previewData = buildPreviewData(item);

      return (
        <RestaurantItem
          name={item.name}
          comments={item.comments}
          rating={item.rating}
          tags={item.tags || []}
          imageUrl={image?.uri}
          imageRemoteKey={image?.remoteKey}
          previewData={previewData}
          onPress={() => navigateToRestaurant(item.id)}
        />
      );
    },
    [navigateToRestaurant],
  );

  const renderGridItem = useCallback(
    ({ item }: { item: RestaurantListDTO }) => {
      const image = item.images?.[0];
      const previewData = buildPreviewData(item);

      return (
        <GridPeekItem
          style={{ flex: 1 / numColumns }}
          previewData={previewData}
          onPress={() => navigateToRestaurant(item.id)}
        >
          {image ? (
            <Photo
              uri={image.uri}
              remoteKey={image.remoteKey}
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
    <View className="relative flex-1 px-5">
      <ListHeader
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

      <FilterSheet
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        options={filterOptions}
        onApply={(opts) => {
          setFilterOptions(opts);
          prefs.setSortField(opts.sortField);
          prefs.setSortOrder(opts.sortOrder);
        }}
        entityType="restaurant"
        countFor={(opts) => applyFilters(opts).length}
      />
    </View>
  );
}
