import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { FlatList, Text, View, useWindowDimensions } from 'react-native';

import type { FilterSortOptions } from '@/components/FilterSortModal';
import FilterSortModal, { defaultFilterSortOptions } from '@/components/FilterSortModal';
import GridPeekItem from '@/components/GridPeekItem';
import { Fab } from '@/components/ui/Fab';
import { ListHeader } from '@/components/ui/ListHeader';
import VisitItem from '@/features/visits/components/VisitItem';
import { useVisitList } from '@/features/visits/hooks/useVisitList';
import type { VisitListDTO } from '@/features/visits/types/visit-dto';
import { usePeekState } from '@/lib/context/PeekContext';
import { formatDate, formatVisitDate } from '@/lib/helpers/date';
import { useListPreferences } from '@/lib/hooks/useListPreferences';

const keyExtractor = (item: VisitListDTO) => item.id.toString();

export default function VisitsScreen() {
  const router = useRouter();
  const { isPeeking } = usePeekState();

  const visits = useVisitList(false);
  const prefs = useListPreferences('visit');

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

  const buildPreviewData = useCallback((item: VisitListDTO) => {
    return {
      type: 'visit',
      id: item.id,
      date: formatVisitDate(item.visited_at),
      restaurantName: item.restaurant.name,
      comments: item.comments,
      imageUrl: item.images?.[0]?.uri,
    } as const;
  }, []);

  const restaurantOptions = useMemo(() => {
    const uniqueRestaurants = new Map<number, { id: number; name: string }>();
    visits.forEach((visit) => {
      if (!uniqueRestaurants.has(visit.restaurant.id)) {
        uniqueRestaurants.set(visit.restaurant.id, {
          id: visit.restaurant.id,
          name: visit.restaurant.name,
        });
      }
    });
    return Array.from(uniqueRestaurants.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [visits]);

  const hasActiveFilters =
    filterOptions.selectedRestaurantId !== null ||
    filterOptions.sortField !== 'date' ||
    filterOptions.sortOrder !== 'desc';

  const filteredAndSortedVisits = useMemo(() => {
    let result = [...visits];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((v) => v.restaurant.name.toLowerCase().includes(query));
    }

    if (filterOptions.selectedRestaurantId !== null) {
      result = result.filter((visit) => visit.restaurant.id === filterOptions.selectedRestaurantId);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (filterOptions.sortField === 'date') {
        comparison = new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime();
      } else if (filterOptions.sortField === 'restaurant') {
        comparison = a.restaurant.name.localeCompare(b.restaurant.name);
      }
      return filterOptions.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [visits, filterOptions, searchQuery]);

  const navigateToVisit = useCallback(
    (id: number) => {
      router.push({ pathname: '/visits/[id]/view', params: { id } });
    },
    [router],
  );

  const renderListItem = useCallback(
    ({ item }: { item: VisitListDTO }) => {
      const imageUrl = item.images?.[0]?.uri ?? null;
      const previewData = buildPreviewData(item);
      const formattedVisitDate = formatDate(item.visited_at);

      return (
        <VisitItem
          imageUrl={imageUrl}
          date={formattedVisitDate}
          title={item.restaurant.name}
          comments={item.comments}
          deleted={item.deleted}
          restaurantDeleted={item.restaurant.deleted}
          previewData={previewData}
          onPress={() => navigateToVisit(item.id)}
        />
      );
    },
    [buildPreviewData, navigateToVisit],
  );

  const renderGridItem = useCallback(
    ({ item }: { item: VisitListDTO }) => {
      const imageUrl = item.images?.[0]?.uri ?? null;
      const previewData = buildPreviewData(item);
      const formattedVisitDate = formatDate(item.visited_at);

      return (
        <GridPeekItem
          style={{ flex: 1 / numColumns }}
          previewData={previewData}
          onPress={() => navigateToVisit(item.id)}
        >
          {imageUrl ? (
            <Image
              source={imageUrl}
              style={{ width: '100%', height: 100 }}
              contentFit="cover"
              recyclingKey={`grid-visit-${item.id}`}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={{ width: '100%', height: 100 }} className="bg-sunken" />
          )}
          <View className="p-2">
            <Text className="text-sm font-bold text-ink" numberOfLines={1}>
              {item.restaurant.name}
            </Text>
            <Text className="text-xs text-ink-subtle">{formattedVisitDate}</Text>
          </View>
        </GridPeekItem>
      );
    },
    [buildPreviewData, navigateToVisit, numColumns],
  );

  const listEmptyComponent = useMemo(
    () => (
      <View className="flex-1 justify-center items-center mt-10">
        <Text className="text-base text-ink">No se encontraron visitas.</Text>
      </View>
    ),
    [],
  );

  return (
    <View className="relative flex-1 bg-canvas px-5 pt-2">
      <ListHeader
        title="Visitas"
        count={filteredAndSortedVisits.length}
        countLabel="visitas"
        actions={[
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
          placeholder: 'Buscar una visita…',
        }}
      />
      <View className="h-4" />
      <FlatList
        key={isGridView ? `grid-${numColumns}` : 'list'}
        data={filteredAndSortedVisits}
        keyExtractor={keyExtractor}
        numColumns={isGridView ? numColumns : 1}
        columnWrapperStyle={isGridView ? { gap: 8 } : undefined}
        renderItem={isGridView ? renderGridItem : renderListItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={listEmptyComponent}
        scrollEnabled={!isPeeking}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
      />
      <Fab onPress={() => router.push('/visits/new')} accessibilityLabel="Nueva visita" />

      <FilterSortModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        options={filterOptions}
        onApply={(opts) => {
          setFilterOptions(opts);
          prefs.setSortField(opts.sortField);
          prefs.setSortOrder(opts.sortOrder);
        }}
        entityType="visit"
        restaurants={restaurantOptions}
      />
    </View>
  );
}
