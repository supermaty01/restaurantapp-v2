import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';

import Tag from '@/features/tags/components/Tag';
import { useTagsList } from '@/features/tags/hooks/useTagsList';
import { TagDTO } from '@/features/tags/types/tag-dto';
import { useTheme } from '@/lib/context/ThemeContext';

export type SortField = 'name' | 'rating' | 'date' | 'restaurant' | 'created';
export type SortOrder = 'asc' | 'desc';

export interface FilterSortOptions {
  selectedTags: TagDTO[];
  minRating: number | null;
  sortField: SortField;
  sortOrder: SortOrder;
  selectedRestaurantId: number | null;
  dateFrom: string | null;
  dateTo: string | null;
}

interface FilterSortModalProps {
  visible: boolean;
  onClose: () => void;
  options: FilterSortOptions;
  onApply: (options: FilterSortOptions) => void;
  entityType: 'restaurant' | 'dish' | 'visit';
  restaurants?: { id: number; name: string }[];
}

export const defaultFilterSortOptions: FilterSortOptions = {
  selectedTags: [],
  minRating: null,
  sortField: 'name',
  sortOrder: 'asc',
  selectedRestaurantId: null,
  dateFrom: null,
  dateTo: null,
};

export default function FilterSortModal({
  visible,
  onClose,
  options,
  onApply,
  entityType,
  restaurants = [],
}: FilterSortModalProps) {
  const tags = useTagsList();
  const { isDarkMode } = useTheme();

  const [localOptions, setLocalOptions] = useState<FilterSortOptions>(options);
  const translateY = useSharedValue(0);
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    if (visible) {
      setLocalOptions(options);
      cancelAnimation(translateY);
      translateY.value = 0;
    }
  }, [visible, options, translateY]);

  const dismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        translateY.value = withTiming(screenHeight, { duration: 200 }, () => {
          runOnJS(dismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleTagToggle = (tag: TagDTO) => {
    const isSelected = localOptions.selectedTags.some((t) => t.id === tag.id);
    if (isSelected) {
      setLocalOptions({
        ...localOptions,
        selectedTags: localOptions.selectedTags.filter((t) => t.id !== tag.id),
      });
    } else {
      setLocalOptions({
        ...localOptions,
        selectedTags: [...localOptions.selectedTags, tag],
      });
    }
  };

  const handleRatingFilter = (rating: number | null) => {
    setLocalOptions({ ...localOptions, minRating: localOptions.minRating === rating ? null : rating });
  };

  const handleSortFieldChange = (field: SortField) => {
    setLocalOptions({ ...localOptions, sortField: field });
  };

  const handleSortOrderToggle = () => {
    setLocalOptions({
      ...localOptions,
      sortOrder: localOptions.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  };

  const handleRestaurantSelect = (restaurantId: number | null) => {
    setLocalOptions({
      ...localOptions,
      selectedRestaurantId: localOptions.selectedRestaurantId === restaurantId ? null : restaurantId,
    });
  };

  const handleReset = () => {
    setLocalOptions(defaultFilterSortOptions);
  };

  const handleApply = () => {
    onApply(localOptions);
    onClose();
  };

  const getSortOptions = (): { field: SortField; label: string }[] => {
    if (entityType === 'visit') {
      return [
        { field: 'date', label: 'Fecha' },
        { field: 'restaurant', label: 'Restaurante' },
      ];
    }
    return [
      { field: 'name', label: 'Nombre' },
      { field: 'rating', label: 'Valoración' },
      { field: 'created', label: 'Fecha de creación' },
    ];
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 justify-end">
          <ReanimatedAnimated.View
            style={[animatedStyle, { maxHeight: '85%' }]}
            className="bg-white dark:bg-dark-card rounded-t-3xl"
          >
            <GestureDetector gesture={panGesture}>
              <ReanimatedAnimated.View
                style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: isDarkMode ? '#555' : '#ccc',
                  }}
                />
              </ReanimatedAnimated.View>
            </GestureDetector>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-lg font-bold text-gray-800 dark:text-gray-200">
                Filtros y Ordenación
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>

          <ScrollView className="p-4">
            {/* Tag Filter - Only for restaurants and dishes */}
            {(entityType === 'restaurant' || entityType === 'dish') && (
              <View className="mb-6">
                <Text className="text-base font-bold text-gray-800 dark:text-gray-200 mb-3">
                  Filtrar por etiquetas
                </Text>
                <View className="flex-row flex-wrap">
                  {tags.map((tag) => {
                    const isSelected = localOptions.selectedTags.some((t) => t.id === tag.id);
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        onPress={() => handleTagToggle(tag)}
                        className={`mr-2 mb-2 ${isSelected ? 'opacity-100' : 'opacity-50'}`}
                      >
                        <Tag name={tag.name} color={tag.color} />
                      </TouchableOpacity>
                    );
                  })}
                  {tags.length === 0 && (
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      No hay etiquetas disponibles
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Restaurant Filter - Only for visits */}
            {entityType === 'visit' && restaurants.length > 0 && (
              <View className="mb-6">
                <Text className="text-base font-bold text-gray-800 dark:text-gray-200 mb-3">
                  Filtrar por restaurante
                </Text>
                <View className="flex-row flex-wrap">
                  {restaurants.map((restaurant) => {
                    const isSelected = localOptions.selectedRestaurantId === restaurant.id;
                    return (
                      <TouchableOpacity
                        key={restaurant.id}
                        onPress={() => handleRestaurantSelect(restaurant.id)}
                        className={`px-3 py-2 mr-2 mb-2 rounded-lg ${isSelected
                          ? 'bg-primary dark:bg-dark-primary'
                          : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                      >
                        <Text className={`text-sm ${isSelected
                          ? 'text-white font-bold'
                          : 'text-gray-700 dark:text-gray-300'
                          }`}>
                          {restaurant.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Rating Filter - For restaurants and dishes */}
            {(entityType === 'restaurant' || entityType === 'dish') && (
              <View className="mb-6">
                <Text className="text-base font-bold text-gray-800 dark:text-gray-200 mb-3">
                  Valoración mínima
                </Text>
                <View className="flex-row items-center">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      onPress={() => handleRatingFilter(rating)}
                      className={`px-3 py-2 mr-2 rounded-lg ${localOptions.minRating === rating
                        ? 'bg-primary dark:bg-dark-primary'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                    >
                      <View className="flex-row items-center">
                        <Text className={`text-sm mr-1 ${localOptions.minRating === rating
                          ? 'text-white font-bold'
                          : 'text-gray-700 dark:text-gray-300'
                          }`}>
                          {rating}+
                        </Text>
                        <Ionicons
                          name="star"
                          size={14}
                          color={localOptions.minRating === rating ? '#fff' : '#FFD700'}
                        />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Sort Options */}
            <View className="mb-6">
              <Text className="text-base font-bold text-gray-800 dark:text-gray-200 mb-3">
                Ordenar por
              </Text>
              <View className="flex-row flex-wrap items-center">
                {getSortOptions().map((option) => (
                  <TouchableOpacity
                    key={option.field}
                    onPress={() => handleSortFieldChange(option.field)}
                    className={`px-3 py-2 mr-2 mb-2 rounded-lg ${localOptions.sortField === option.field
                      ? 'bg-primary dark:bg-dark-primary'
                      : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                  >
                    <Text className={`text-sm ${localOptions.sortField === option.field
                      ? 'text-white font-bold'
                      : 'text-gray-700 dark:text-gray-300'
                      }`}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Sort Order Toggle */}
                <TouchableOpacity
                  onPress={handleSortOrderToggle}
                  className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 flex-row items-center"
                >
                  <Ionicons
                    name={localOptions.sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                    size={16}
                    color={isDarkMode ? '#fff' : '#333'}
                  />
                  <Text className="text-sm text-gray-700 dark:text-gray-300 ml-1">
                    {localOptions.sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

            {/* Footer Buttons */}
            <View className="flex-row p-4 border-t border-gray-200 dark:border-gray-700">
              <TouchableOpacity
                onPress={handleReset}
                className="flex-1 py-3 mr-2 rounded-lg bg-gray-200 dark:bg-gray-700"
              >
                <Text className="text-center text-gray-700 dark:text-gray-300 font-bold">
                  Limpiar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApply}
                className="flex-1 py-3 ml-2 rounded-lg bg-primary dark:bg-dark-primary"
              >
                <Text className="text-center text-white font-bold">Aplicar</Text>
              </TouchableOpacity>
            </View>
          </ReanimatedAnimated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

