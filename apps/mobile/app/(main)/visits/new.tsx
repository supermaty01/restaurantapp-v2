import { zodResolver } from '@hookform/resolvers/zod';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { router, useGlobalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';

import FormDatePicker from '@/components/FormDatePicker';
import FormInput from '@/components/FormInput';
import DishPicker from '@/features/dishes/components/DishPicker';
import { DishListDTO } from '@/features/dishes/types/dish-dto';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import { VisitFormData, visitSchema } from '@/features/visits/schemas/visit-schema';
import { getTodayLocalDateString } from '@/lib/helpers/date';
import { uploadImages } from '@/lib/helpers/upload-images';
import * as schema from '@/services/db/schema';

export default function VisitCreateScreen() {
  const { restaurantId: routeRestaurantId } = useGlobalSearchParams();
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VisitFormData>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      visited_at: getTodayLocalDateString(),
      comments: '',
      restaurantId: routeRestaurantId ? Number(routeRestaurantId) : undefined,
      dishes: [],
    },
  });

  const [selectedDishes, setSelectedDishes] = useState<DishListDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const restaurantId = watch('restaurantId');

  useEffect(() => {
    setSelectedDishes([]);
  }, [restaurantId]);

  const onSubmit: SubmitHandler<VisitFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      const payload = {
        visitedAt: data.visited_at,
        comments: data.comments?.trim() || "",
        restaurantId: data.restaurantId,
      };

      // Insertar la visita
      const response = await drizzleDb.insert(schema.visits).values(payload);
      const visitId = response.lastInsertRowId;

      // Asociar platos a la visita
      if (data.dishes && data.dishes.length > 0) {
        await Promise.all(
          data.dishes.map((dishId) => {
            return drizzleDb.insert(schema.dishVisits).values({
              visitId,
              dishId: typeof dishId === 'string' ? parseInt(dishId) : dishId,
            });
          })
        );
      }

      // Subir imágenes
      if (selectedImages.length > 0) {
        await uploadImages(drizzleDb, selectedImages, "VISIT", visitId);
      }

      Alert.alert('Éxito', 'Visita creada correctamente.');

      router.back();
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo crear la visita');
      console.log(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-muted dark:bg-dark-muted p-4">
      <Text className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Añadir visita</Text>

      <View className="bg-card dark:bg-dark-card p-4 rounded-md mb-8">
        <FormDatePicker control={control} name="visited_at" label="Fecha" />

        <FormInput
          control={control}
          name="comments"
          label="Comentarios"
          placeholder="Escribe tus comentarios..."
          multiline
          inputClassName="h-auto"
          numberOfLines={4}
        />

        <RestaurantPicker
          control={control}
          setValue={setValue}
          name="restaurantId"
          fixedValue={!!routeRestaurantId}
          label="Restaurante"
          errors={errors}
        />

        <DishPicker
          control={control}
          name="dishes"
          setValue={setValue}
          restaurantId={restaurantId}
          errors={errors}
          selectedDishes={selectedDishes}
          setSelectedDishes={setSelectedDishes}
        />

        <ImagesUploader
          images={selectedImages}
          onChangeImages={setSelectedImages}
        />

        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          className={`mt-4 bg-primary dark:bg-dark-primary py-3 rounded-md items-center ${isSubmitting ? 'opacity-50' : ''}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-bold">Guardar</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
