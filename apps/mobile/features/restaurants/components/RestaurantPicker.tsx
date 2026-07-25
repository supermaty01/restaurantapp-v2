import { Picker } from '@react-native-picker/picker';
import { clsx } from 'clsx';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { View, Text, TouchableOpacity } from 'react-native';

import { useNewRestaurant } from '@/features/restaurants/hooks/useNewRestaurant';
import { useTheme } from '@/lib/context/ThemeContext';

import { useRestaurantList } from '../hooks/useRestaurantList';

import type {
  Control,
  FieldErrors,
  FieldPathByValue,
  FieldValues,
  PathValue,
  UseFormSetValue,
} from 'react-hook-form';

// TName is constrained to fields that actually hold a number, so a form
// without a numeric restaurant field cannot be passed by mistake.
interface RestaurantPickerProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, number>,
  TTransformed = TFieldValues,
> {
  control: Control<TFieldValues, unknown, TTransformed>;
  setValue: UseFormSetValue<TFieldValues>;
  name: TName;
  label?: string | undefined;
  fixedValue?: boolean | undefined;
  errors?: FieldErrors<TFieldValues> | undefined;
}

function RestaurantPicker<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, number>,
  TTransformed = TFieldValues,
>({
  control,
  setValue,
  name,
  label,
  errors,
  fixedValue,
}: RestaurantPickerProps<TFieldValues, TName, TTransformed>) {
  const { newRestaurantId, setNewRestaurantId } = useNewRestaurant();
  const { colors } = useTheme();

  const unsortedRestaurants = useRestaurantList();
  const restaurants = [...unsortedRestaurants].sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (newRestaurantId) {
      setValue(name, newRestaurantId as PathValue<TFieldValues, TName>, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setNewRestaurantId(null);
    }
  }, [name, newRestaurantId, setNewRestaurantId, setValue]);

  return (
    <View>
      {label && (
        <Text
          className={clsx(
            'text-base text-ink mb-2',
            errors?.[name] ? 'text-danger dark:text-red-400' : '',
          )}
        >
          {label}
        </Text>
      )}
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <View className="border border-line rounded-md">
            <Picker
              selectedValue={value}
              onValueChange={(itemValue) => onChange(itemValue)}
              enabled={!fixedValue}
            >
              <Picker.Item
                label="Selecciona un restaurante"
                value={-1}
                style={{ color: colors.inkMuted, fontSize: 15 }}
              />
              {restaurants.map((restaurant) => (
                <Picker.Item
                  key={restaurant.id}
                  label={restaurant.name}
                  value={restaurant.id}
                  style={{ color: colors.inkMuted, fontSize: 15 }}
                />
              ))}
            </Picker>
          </View>
        )}
      />

      {errors?.[name] && (
        <Text className="text-danger dark:text-red-400 mt-1">
          {String(errors[name]?.message ?? '')}
        </Text>
      )}
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
          <Text className="text-primary">¿No lo encuentras? Añade uno nuevo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default RestaurantPicker;
