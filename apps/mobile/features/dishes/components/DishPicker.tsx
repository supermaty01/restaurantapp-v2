import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
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
  const { newDish, setNewDish } = useNewDish();
  const router = useRouter();
  const { colors } = useTheme();

  // Usar el hook para obtener los platos del restaurante
  const dishes = useDishesByRestaurant(restaurantId);

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

  const message = errors?.[name] ? String(errors[name]?.message ?? '') : null;

  const available = dishes.filter(
    (dish) => !selectedDishes.some((selected) => selected.id === dish.id),
  );

  return (
    <View className="gap-2.5">
      {selectedDishes.length > 0 ? (
        <View className="gap-2">
          {selectedDishes.map((dish) => (
            <View
              key={dish.id}
              className="flex-row items-center gap-3 rounded-xl border border-line bg-surface p-2.5"
            >
              <Thumbnail
                name={dish.name}
                uri={dish.images?.[0]?.uri ?? null}
                size={40}
                radius={9}
                icon="fast-food"
              />
              <Txt variant="body" weight="semi" serif={false} numberOfLines={1} className="flex-1">
                {dish.name}
              </Txt>
              <Pressable
                onPress={() => handleRemoveDish(dish.id)}
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${dish.name}`}
                hitSlop={8}
                className="h-7 w-7 items-center justify-center rounded-pill bg-sunken"
              >
                <Ionicons name="close" size={15} color={colors.inkMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* The dishes this restaurant already has, one tap away. Most visits
          repeat something you have eaten there before, so the common case
          should not require opening anything. */}
      {restaurantId && available.length > 0 ? (
        <View className="gap-1.5">
          {selectedDishes.length > 0 ? (
            <Txt variant="caption" tone="subtle">
              De este restaurante
            </Txt>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {available.slice(0, 8).map((dish) => (
              <PressableScale
                key={dish.id}
                accessibilityLabel={`Añadir ${dish.name}`}
                onPress={() => handleAddDish(dish)}
                scaleTo={0.94}
                className="flex-row items-center gap-1.5 rounded-pill border border-line-strong bg-surface px-3 py-1.5"
              >
                <Ionicons name="add" size={13} color={colors.primary} />
                <Txt variant="caption" weight="semi" serif={false} numberOfLines={1}>
                  {dish.name}
                </Txt>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View className="flex-row gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Crear un plato nuevo"
          onPress={() => {
            if (!restaurantId) return;
            router.push(`/dishes/new?useBackRedirect=true&restaurantId=${restaurantId}`);
          }}
          disabled={!restaurantId}
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-pill border border-dashed px-3.5 py-2.5 ${
            restaurantId ? 'border-primary/40 bg-primary/8' : 'border-line-strong opacity-50'
          }`}
        >
          <Ionicons name="add" size={15} color={restaurantId ? colors.primary : colors.inkSubtle} />
          <Txt
            variant="caption"
            weight="bold"
            serif={false}
            tone={restaurantId ? 'primary' : 'subtle'}
          >
            Plato nuevo
          </Txt>
        </Pressable>
      </View>

      {!restaurantId ? (
        <Txt variant="caption" tone="subtle">
          Elige primero el restaurante.
        </Txt>
      ) : null}

      {message ? (
        <Txt variant="caption" tone="danger">
          {message}
        </Txt>
      ) : null}
    </View>
  );
}

export default DishPicker;
