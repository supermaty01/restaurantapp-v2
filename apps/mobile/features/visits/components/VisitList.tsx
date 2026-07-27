import { useRouter } from 'expo-router';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { FlatList, Text, View } from 'react-native';

import type { FilterSortOptions } from '@/components/filters/FilterSheet';
import { FilterSheet, defaultFilterSortOptions } from '@/components/filters/FilterSheet';
import { ListHeader } from '@/components/ui/ListHeader';
import VisitItem from '@/features/visits/components/VisitItem';
import { useVisitList } from '@/features/visits/hooks/useVisitList';
import type { VisitListDTO } from '@/features/visits/types/visit-dto';
import { formatDate } from '@/lib/helpers/date';
import { useListPreferences } from '@/lib/hooks/useListPreferences';

import { VisitTimeline } from './VisitTimeline';

const keyExtractor = (item: VisitListDTO) => item.id.toString();

export function VisitList() {
  const router = useRouter();

  const visits = useVisitList(false);
  const prefs = useListPreferences('visit');

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterSortOptions>({
    ...defaultFilterSortOptions,
    sortField: prefs.sortField,
    sortOrder: prefs.sortOrder,
  });
  const [searchQuery, setSearchQuery] = useState('');

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

  // Extracted so the filter sheet can count what a draft would leave without
  // applying it, which is what puts a number on the apply button.
  const applyFilters = useCallback(
    (options: FilterSortOptions) => {
      let result = [...visits];

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        result = result.filter((v) => v.restaurant.name.toLowerCase().includes(query));
      }

      if (options.selectedRestaurantId !== null) {
        result = result.filter((visit) => visit.restaurant.id === options.selectedRestaurantId);
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
    [visits, searchQuery],
  );

  const filteredAndSortedVisits = useMemo(() => {
    const result = applyFilters(filterOptions);

    result.sort((a, b) => {
      let comparison = 0;
      if (filterOptions.sortField === 'date') {
        // Undated visits sort last whichever way the rest runs, rather than
        // landing at the epoch and pretending to be the oldest thing you ate.
        const aTime = a.visited_at ? new Date(a.visited_at).getTime() : null;
        const bTime = b.visited_at ? new Date(b.visited_at).getTime() : null;
        if (aTime === null || bTime === null) {
          comparison = aTime === bTime ? 0 : aTime === null ? 1 : -1;
        } else {
          comparison = aTime - bTime;
        }
      } else if (filterOptions.sortField === 'restaurant') {
        comparison = a.restaurant.name.localeCompare(b.restaurant.name);
      }
      return filterOptions.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [applyFilters, filterOptions]);

  const navigateToVisit = useCallback(
    (id: number) => {
      router.push({ pathname: '/visits/[id]/view', params: { id } });
    },
    [router],
  );

  const renderListItem = useCallback(
    ({ item }: { item: VisitListDTO }) => {
      const image = item.images?.[0];
      const formattedVisitDate = formatDate(item.visited_at);

      return (
        <VisitItem
          imageUrl={image?.uri ?? null}
          imageRemoteKey={image?.remoteKey}
          date={formattedVisitDate}
          title={item.restaurant.name}
          comments={item.comments}
          deleted={item.deleted}
          restaurantDeleted={item.restaurant.deleted}
          onPress={() => navigateToVisit(item.id)}
        />
      );
    },
    [navigateToVisit],
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
    <View className="relative flex-1 px-5">
      <ListHeader
        count={filteredAndSortedVisits.length}
        countLabel="visitas"
        actions={[
          {
            icon: isGridView ? 'list-outline' : 'calendar-outline',
            label: isGridView ? 'Ver como lista' : 'Ver por meses',
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
      {isGridView ? (
        <VisitTimeline
          visits={filteredAndSortedVisits}
          onPressVisit={navigateToVisit}
          order={filterOptions.sortOrder}
        />
      ) : (
        <FlatList
          data={filteredAndSortedVisits}
          keyExtractor={keyExtractor}
          renderItem={renderListItem}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
          ListEmptyComponent={listEmptyComponent}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
        />
      )}

      <FilterSheet
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        options={filterOptions}
        onApply={(opts) => {
          setFilterOptions(opts);
          prefs.setSortField(opts.sortField);
          prefs.setSortOrder(opts.sortOrder);
        }}
        entityType="visit"
        countFor={(opts) => applyFilters(opts).length}
        restaurants={restaurantOptions}
      />
    </View>
  );
}
