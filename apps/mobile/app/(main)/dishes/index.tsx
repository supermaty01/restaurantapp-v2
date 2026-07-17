import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FlatList, TouchableOpacity, View, Text, useWindowDimensions, TextInput } from 'react-native';

import FilterSortModal, { FilterSortOptions, defaultFilterSortOptions } from '@/components/FilterSortModal';
import GridPeekItem from '@/components/GridPeekItem';
import RatingStars from '@/components/RatingStars';
import DishItem from '@/features/dishes/components/DishItem';
import { useDishList } from '@/features/dishes/hooks/useDishList';
import { DishListDTO } from '@/features/dishes/types/dish-dto';
import { usePeekState } from '@/lib/context/PeekContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useListPreferences } from '@/lib/hooks/useListPreferences';

const keyExtractor = (item: DishListDTO) => item.id.toString();

const buildPreviewData = (item: DishListDTO) => {
  return {
    type: 'dish',
    id: item.id,
    name: item.name,
    comments: item.comments,
    rating: item.rating,
    tags: item.tags || [],
    imageUrl: item.images && item.images.length > 0 ? item.images[0].uri : undefined,
  } as const;
};

export default function DishesScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { isPeeking } = usePeekState();

  const dishes = useDishList(false);
  const prefs = useListPreferences('dish');

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

  const hasActiveFilters = filterOptions.selectedTags.length > 0 ||
    filterOptions.minRating !== null ||
    filterOptions.sortField !== 'name' ||
    filterOptions.sortOrder !== 'asc';

  const filteredAndSortedDishes = useMemo(() => {
    let result = [...dishes];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(query));
    }

    if (filterOptions.selectedTags.length > 0) {
      result = result.filter((dish) =>
        filterOptions.selectedTags.some((filterTag) =>
          dish.tags?.some((tag) => tag.id === filterTag.id)
        )
      );
    }

    if (filterOptions.minRating !== null) {
      result = result.filter(
        (dish) => dish.rating !== null && dish.rating >= filterOptions.minRating!
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
  }, [dishes, filterOptions, searchQuery]);

  const navigateToDish = useCallback((id: number) => {
    router.push({ pathname: '/dishes/[id]/view', params: { id } });
  }, [router]);

  const renderListItem = useCallback(({ item }: { item: DishListDTO }) => {
    const previewData = buildPreviewData(item);

    return (
      <DishItem
        name={item.name}
        comments={item.comments}
        rating={item.rating}
        tags={item.tags}
        images={item.images}
        previewData={previewData}
        onPress={() => navigateToDish(item.id)}
      />
    );
  }, [navigateToDish]);

  const renderGridItem = useCallback(({ item }: { item: DishListDTO }) => {
    const imageUrl = item.images && item.images.length > 0 ? item.images[0].uri : undefined;
    const previewData = buildPreviewData(item);

    return (
      <GridPeekItem
        style={{ flex: 1 / numColumns }}
        previewData={previewData}
        onPress={() => navigateToDish(item.id)}
      >
        {imageUrl ? (
          <Image
            source={imageUrl}
            style={{ width: '100%', height: 100 }}
            contentFit="cover"
            recyclingKey={`grid-dish-${item.id}`}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={{ width: '100%', height: 100 }} className="bg-gray-200 dark:bg-gray-700" />
        )}
        <View className="p-2">
          <Text className="text-sm font-bold text-gray-800 dark:text-gray-200" numberOfLines={1}>{item.name}</Text>
          <View className="flex-row mt-1">
            <RatingStars value={item.rating} size={12} gap={1} readOnly />
          </View>
        </View>
      </GridPeekItem>
    );
  }, [navigateToDish, numColumns]);

  const listEmptyComponent = useMemo(() => (
    <View className="flex-1 justify-center items-center mt-10">
      <Text className="text-base text-gray-800 dark:text-gray-200">No se encontraron platos.</Text>
    </View>
  ), []);

  return (
    <View className="flex-1 bg-muted dark:bg-dark-muted px-4 pt-2 relative">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl font-bold text-gray-800 dark:text-gray-200">Platos</Text>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <TouchableOpacity onPress={() => setIsGridView(!isGridView)}>
            <Ionicons
              name={isGridView ? 'list' : 'grid'}
              size={22}
              color={isDarkMode ? '#ccc' : '#666'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilterModalVisible(true)}>
            <View className="relative">
              <Ionicons
                name="filter"
                size={24}
                color={hasActiveFilters ? (isDarkMode ? '#7A9455' : '#93AE72') : (isDarkMode ? '#ccc' : '#666')}
              />
              {hasActiveFilters && (
                <View className="absolute -top-1 -right-1 w-3 h-3 bg-primary dark:bg-dark-primary rounded-full" />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <View className="mb-3">
        <View className="flex-row items-center bg-card dark:bg-dark-card rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
          <Ionicons name="search" size={18} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
          <TextInput
            className="flex-1 ml-2 text-sm text-gray-800 dark:text-gray-200"
            placeholder="Buscar por nombre..."
            placeholderTextColor={isDarkMode ? '#6b7280' : '#9ca3af'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        key={isGridView ? `grid-${numColumns}` : 'list'}
        data={filteredAndSortedDishes}
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
      <TouchableOpacity
        onPress={() => router.push('/dishes/new')}
        className="absolute bottom-5 right-5 w-12 h-12 bg-primary dark:bg-dark-primary rounded-full items-center justify-center"
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <FilterSortModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        options={filterOptions}
        onApply={(opts) => {
          setFilterOptions(opts);
          prefs.setSortField(opts.sortField);
          prefs.setSortOrder(opts.sortOrder);
        }}
        entityType="dish"
      />
    </View>
  );
}
