import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, FlatList } from 'react-native';

import { useDishesByRestaurant } from '@/features/dishes/hooks/useDishesByRestaurant';
import { useNewDish } from '@/features/dishes/hooks/useNewDish';
import type { DishListDTO } from '@/features/dishes/types/dish-dto';
import { useTheme } from '@/lib/context/ThemeContext';

import type {
  Control,
  FieldErrors,
  FieldPathByValue,
  FieldValues,
  PathValue,
  UseFormSetValue,
} from 'react-hook-form';

// TName is constrained to fields holding a list of dish ids.
interface DishPickerProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, number[] | string[]>,
  TTransformed = TFieldValues,
> {
  control: Control<TFieldValues, unknown, TTransformed>;
  name: TName;
  setValue: UseFormSetValue<TFieldValues>;
  restaurantId: number | undefined;
  errors?: FieldErrors<TFieldValues> | undefined;
  selectedDishes: DishListDTO[];
  setSelectedDishes: (dishes: DishListDTO[]) => void;
}

function DishPicker<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, number[] | string[]>,
  TTransformed = TFieldValues,
>({
  name,
  setValue,
  restaurantId,
  errors,
  selectedDishes,
  setSelectedDishes,
}: DishPickerProps<TFieldValues, TName, TTransformed>) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { newDish, setNewDish } = useNewDish();
  const router = useRouter();
  const { isDarkMode } = useTheme();

  // Usar el hook para obtener los platos del restaurante
  const dishes = useDishesByRestaurant(restaurantId);
  const isLoading = false;

  const handleAddDish = useCallback(
    (dish: DishListDTO) => {
      if (!selectedDishes.some((d) => d.id === dish.id)) {
        const newSelectedDishes = [...selectedDishes, dish];
        setSelectedDishes(newSelectedDishes);
        setValue(name, newSelectedDishes.map((d) => d.id) as PathValue<TFieldValues, TName>, {
          shouldValidate: true,
        });
      }
    },
    [name, selectedDishes, setSelectedDishes, setValue],
  );

  useEffect(() => {
    if (newDish) {
      handleAddDish(newDish);
      setNewDish(null);
    }
  }, [handleAddDish, newDish, setNewDish]);

  const handleRemoveDish = (dishId: number) => {
    const updatedDishes = selectedDishes.filter((dish) => dish.id !== dishId);
    setSelectedDishes(updatedDishes);
    setValue(name, updatedDishes.map((d) => d.id) as PathValue<TFieldValues, TName>, {
      shouldValidate: true,
    });
  };

  return (
    <View>
      <Text className="text-xl font-semibold text-ink mt-2">Platos</Text>

      {selectedDishes.length > 0 && (
        <View className="mt-3">
          {selectedDishes.map((dish) => (
            <View key={dish.id} className="flex-row items-center w-full mb-3">
              <Text className="flex-1 py-2 px-4 border border-line text-ink rounded-lg">
                {dish.name}
              </Text>

              <TouchableOpacity
                onPress={() => handleRemoveDish(dish.id)}
                className="ml-3 p-2 bg-danger rounded-lg"
              >
                <Ionicons name="close" size={23} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row justify-between mt-3">
        <TouchableOpacity
          className={`bg-primary py-3 px-4 rounded-md ${!restaurantId ? 'opacity-50' : ''}`}
          onPress={() => setIsModalVisible(true)}
          disabled={!restaurantId}
        >
          <Text className="text-on-primary font-bold">Añadir existente</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`bg-primary py-3 px-4 rounded-md ${!restaurantId ? 'opacity-50' : ''}`}
          onPress={() =>
            router.push({
              pathname: '/dishes/new',
              params: { useBackRedirect: 'true', restaurantId },
            })
          }
          disabled={!restaurantId}
        >
          <Text className="text-on-primary font-bold">Crear nuevo plato</Text>
        </TouchableOpacity>
      </View>

      {errors?.[name] && (
        <Text className="text-danger dark:text-red-400 mt-1">
          {String(errors[name]?.message ?? '')}
        </Text>
      )}

      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View
          className="flex-1 justify-center items-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <View className="bg-surface w-4/5 p-4 rounded-md">
            <Text className="text-lg font-bold mb-3 text-ink">Seleccionar Platos</Text>

            {isLoading ? (
              <ActivityIndicator size="large" color={isDarkMode ? '#B27A4D' : '#905c36'} />
            ) : dishes.length === 0 ? (
              <Text className="text-ink-subtle text-center mt-4">No hay platos disponibles</Text>
            ) : (
              <FlatList
                data={dishes}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="flex-row justify-between items-center p-3 border-b border-line"
                    onPress={() => handleAddDish(item)}
                  >
                    <Text className="text-ink">{item.name}</Text>
                    {selectedDishes.some((d) => d.id === item.id) && (
                      <Ionicons name="checkmark-circle" size={19} color="green" />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              className="bg-primary py-3 px-4 rounded-md mt-4"
              onPress={() => setIsModalVisible(false)}
            >
              <Text className="text-on-primary text-center font-bold">Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default DishPicker;
