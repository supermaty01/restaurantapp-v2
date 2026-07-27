import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { ScrollView, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { FieldLabel } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');

  const unsortedRestaurants = useRestaurantList();
  const restaurants = useMemo(
    () => [...unsortedRestaurants].sort((a, b) => a.name.localeCompare(b.name)),
    [unsortedRestaurants],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? restaurants.filter((r) => r.name.toLowerCase().includes(term)) : restaurants;
  }, [restaurants, query]);

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
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => {
        const selected = restaurants.find((restaurant) => restaurant.id === value);
        const message = errors?.[name] ? String(errors[name]?.message ?? '') : null;

        return (
          <View className="gap-2">
            {label ? <FieldLabel>{label}</FieldLabel> : null}

            <PressableScale
              accessibilityLabel={selected ? `Restaurante: ${selected.name}` : 'Elegir restaurante'}
              onPress={() => setSheetOpen(true)}
              disabled={fixedValue}
              scaleTo={0.985}
              className={`flex-row items-center gap-3 rounded-lg border bg-surface p-2.5 ${
                message ? 'border-danger' : 'border-line-strong'
              } ${fixedValue ? 'opacity-60' : ''}`}
            >
              {selected ? (
                <>
                  <Thumbnail
                    name={selected.name}
                    uri={selected.images?.[0]?.uri ?? null}
                    remoteKey={selected.images?.[0]?.remoteKey}
                    size={40}
                    radius={9}
                    icon="restaurant"
                  />
                  <Txt
                    variant="body"
                    weight="semi"
                    serif={false}
                    numberOfLines={1}
                    className="flex-1"
                  >
                    {selected.name}
                  </Txt>
                </>
              ) : (
                <>
                  <View className="h-10 w-10 items-center justify-center rounded-[9px] bg-sunken">
                    <Ionicons name="restaurant-outline" size={18} color={colors.inkSubtle} />
                  </View>
                  <Txt variant="body" tone="subtle" className="flex-1">
                    Elegir un restaurante
                  </Txt>
                </>
              )}
              {!fixedValue ? (
                <Ionicons name="chevron-down" size={17} color={colors.inkSubtle} />
              ) : null}
            </PressableScale>

            {message ? (
              <Txt variant="caption" tone="danger">
                {message}
              </Txt>
            ) : null}

            <Sheet
              visible={sheetOpen}
              onClose={() => setSheetOpen(false)}
              title="Restaurante"
              subtitle={`${restaurants.length} en tu diario`}
            >
              <View className="px-5 pb-2">
                <View className="flex-row items-center gap-2.5 rounded-pill border border-line bg-surface px-4 py-2.5">
                  <Ionicons name="search" size={16} color={colors.inkSubtle} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Buscar..."
                    placeholderTextColor={colors.inkSubtle}
                    autoCorrect={false}
                    className="flex-1 text-ink"
                    style={{ fontSize: 15, paddingVertical: 2 }}
                  />
                </View>
              </View>

              <ScrollView
                className="px-5"
                contentContainerStyle={{ paddingBottom: 12, paddingTop: 6, gap: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Creating from here is the point: you are logging a visit to a
                    place you just discovered, not curating a database. */}
                <PressableScale
                  accessibilityLabel="Crear un restaurante nuevo"
                  onPress={() => {
                    setSheetOpen(false);
                    router.push('/restaurants/new?useBackRedirect=true');
                  }}
                  scaleTo={0.985}
                  className="flex-row items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/8 p-3"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-pill bg-primary">
                    <Ionicons name="add" size={20} color={colors.onPrimary} />
                  </View>
                  <Txt variant="body" weight="bold" serif={false} tone="primary" className="flex-1">
                    Crear uno nuevo
                  </Txt>
                </PressableScale>

                {filtered.map((restaurant) => (
                  <PressableScale
                    key={restaurant.id}
                    accessibilityLabel={restaurant.name}
                    onPress={() => {
                      onChange(restaurant.id);
                      setSheetOpen(false);
                      setQuery('');
                    }}
                    scaleTo={0.985}
                    className={`flex-row items-center gap-3 rounded-xl border p-2.5 ${
                      restaurant.id === value
                        ? 'border-primary bg-primary/8'
                        : 'border-line bg-surface'
                    }`}
                  >
                    <Thumbnail
                      name={restaurant.name}
                      uri={restaurant.images?.[0]?.uri ?? null}
                      remoteKey={restaurant.images?.[0]?.remoteKey}
                      size={44}
                      radius={10}
                      icon="restaurant"
                    />
                    <Txt
                      variant="body"
                      weight="semi"
                      serif={false}
                      numberOfLines={1}
                      className="flex-1"
                    >
                      {restaurant.name}
                    </Txt>
                    {restaurant.id === value ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </PressableScale>
                ))}

                {filtered.length === 0 ? (
                  <Txt variant="callout" tone="subtle" className="py-6 text-center">
                    Nada con ese nombre.
                  </Txt>
                ) : null}
              </ScrollView>
            </Sheet>
          </View>
        );
      }}
    />
  );
}

export default RestaurantPicker;
