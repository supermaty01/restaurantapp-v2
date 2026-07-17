import { Picker } from '@react-native-picker/picker';
import { clsx } from 'clsx';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Controller, Control, UseFormSetValue } from 'react-hook-form';
import { View, Text, TouchableOpacity } from 'react-native';

import { useNewRestaurant } from '@/features/restaurants/hooks/useNewRestaurant';
import { useTheme } from '@/lib/context/ThemeContext';

import { useRestaurantList } from '../hooks/useRestaurantList';


interface RestaurantPickerProps {
  control: Control<any>;
  setValue: UseFormSetValue<any>;
  name: string;
  label?: string;
  fixedValue?: boolean;
  errors?: any;
}

const RestaurantPicker: React.FC<RestaurantPickerProps> = ({ control, setValue, name, label, errors, fixedValue }) => {
  const { newRestaurantId, setNewRestaurantId } = useNewRestaurant();
  const { isDarkMode } = useTheme();

  const unsortedRestaurants = useRestaurantList();
  const restaurants = [...unsortedRestaurants].sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (newRestaurantId) {
      setValue(name, newRestaurantId, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setNewRestaurantId(null);
    }
  }, [name, newRestaurantId, setNewRestaurantId, setValue]);

  return (
    <View>
      {label && <Text className={clsx("text-base text-gray-800 dark:text-gray-200 mb-2", errors?.[name] ? "text-red-600 dark:text-red-400" : "")}>{label}</Text>}
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <View className="border border-gray-200 dark:border-gray-700 rounded-md">
            <Picker
              selectedValue={value}
              onValueChange={(itemValue) => onChange(itemValue)}
              enabled={!fixedValue}
            >
              <Picker.Item
                label="Selecciona un restaurante"
                value={-1}
                style={{ color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 15 }}
              />
              {restaurants.map((restaurant) => (
                <Picker.Item
                  key={restaurant.id}
                  label={restaurant.name}
                  value={restaurant.id}
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 15 }}
                />
              ))}
            </Picker>
          </View>
        )}
      />

      {errors?.[name] && <Text className="text-red-600 dark:text-red-400 mt-1">{errors[name].message}</Text>}
      {!fixedValue && (
        <TouchableOpacity
          className="mt-2"
          onPress={() =>
            router.push({
              pathname: '/restaurants/new',
              params: { useBackRedirect: 'true' },
            })
          }
        >
          <Text className="text-primary dark:text-dark-primary">¿No lo encuentras? Añade uno nuevo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default RestaurantPicker;
