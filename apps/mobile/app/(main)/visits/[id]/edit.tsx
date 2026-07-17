import { zodResolver } from '@hookform/resolvers/zod';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm/sql';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';

import FormDatePicker from '@/components/FormDatePicker';
import FormInput from '@/components/FormInput';
import DishPicker from '@/features/dishes/components/DishPicker';
import { DishListDTO } from '@/features/dishes/types/dish-dto';
import ImagesUploader, { ImageItem } from '@/features/images/components/ImagesUploader';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import { useVisitById } from '@/features/visits/hooks/useVisitById';
import { VisitFormData, visitSchema } from '@/features/visits/schemas/visit-schema';
import { uploadImages } from '@/lib/helpers/upload-images';
import * as schema from '@/services/db/schema';



export default function VisitEditScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VisitFormData>({
    resolver: zodResolver(visitSchema),
  });

  const [selectedDishes, setSelectedDishes] = useState<DishListDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([]);
  const [removedImages, setRemovedImages] = useState<number[]>([]);

  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const visit = useVisitById(Number(id));

  const restaurantId = watch('restaurantId');

  useEffect(() => {
    if (visit?.id) {
      reset({
        visited_at: visit.visited_at,
        comments: visit.comments || "",
        restaurantId: visit.restaurant.id,
        dishes: visit.dishes.map(dish => dish.id),
      });

      setSelectedImages(visit.images);
      setSelectedDishes(visit.dishes.map(dish => ({
        id: dish.id,
        name: dish.name,
        comments: null,
        rating: null,
        tags: [],
        images: [],
      })));
    }
  }, [visit, reset]);

  useEffect(() => {
    if (restaurantId && visit && (restaurantId !== visit?.restaurant.id)) {
      setSelectedDishes([]);
      setValue("dishes", []);
    }
  }, [restaurantId, setValue, visit]);

  const onSubmit: SubmitHandler<VisitFormData> = async (data) => {
    try {
      const payload = {
        visitedAt: data.visited_at,
        comments: data.comments?.trim() || '',
        restaurantId: data.restaurantId,
      };

      // Actualizar la visita
      await drizzleDb.update(schema.visits).set(payload).where(eq(schema.visits.id, Number(id)));

      // Manejar imágenes nuevas
      const newImages = selectedImages.filter((image) => !image.id);
      if (newImages.length > 0) {
        await uploadImages(drizzleDb, newImages.map((img) => img.uri), "VISIT", Number(id));
      }

      // Manejar imágenes eliminadas
      if (removedImages.length > 0) {
        await Promise.all(
          removedImages.map((imageId) => {
            return drizzleDb.delete(schema.images).where(eq(schema.images.id, imageId));
          })
        );
      }

      // Manejar platos
      // Primero eliminar todas las relaciones existentes
      await drizzleDb.delete(schema.dishVisits).where(eq(schema.dishVisits.visitId, Number(id)));

      // Luego agregar las nuevas relaciones
      if (data.dishes && data.dishes.length > 0) {
        await Promise.all(
          data.dishes.map((dishId) => {
            return drizzleDb.insert(schema.dishVisits).values({
              visitId: Number(id),
              dishId: typeof dishId === 'string' ? parseInt(dishId) : dishId,
            });
          })
        );
      }

      Alert.alert('Éxito', 'Visita actualizada correctamente.');
      router.replace({
        pathname: '/visits/[id]/view',
        params: { id },
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar la visita.');
      console.log(error);
    }
  };

  return (
    <ScrollView className="flex-1 bg-muted dark:bg-dark-muted p-4">
      <Text className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Editar visita</Text>

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
          isEdit
          images={selectedImages}
          onChangeImages={setSelectedImages}
          onRemoveExistingImage={(imageId) =>
            setRemovedImages((prev) => [...prev, imageId])
          }
        />

        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          className={`mt-4 bg-primary dark:bg-dark-primary py-3 rounded-md items-center ${isSubmitting ? 'opacity-50' : ''}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-bold">Actualizar</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
