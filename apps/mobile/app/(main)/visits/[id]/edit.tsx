import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';

import FormDatePicker from '@/components/FormDatePicker';
import FormInput from '@/components/FormInput';
import DishPicker from '@/features/dishes/components/DishPicker';
import type { DishListDTO } from '@/features/dishes/types/dish-dto';
import type { ImageItem } from '@/features/images/components/ImagesUploader';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import { PeopleTagInput } from '@/features/people/components/PeopleTagInput';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import { useVisitById } from '@/features/visits/hooks/useVisitById';
import {
  getVisitParticipantNames,
  updateVisit,
} from '@/features/visits/repositories/visitRepository';
import type { VisitFormData } from '@/features/visits/schemas/visit-schema';
import { visitSchema } from '@/features/visits/schemas/visit-schema';
import { deleteImages, uploadImages } from '@/lib/helpers/upload-images';
import { useDatabase } from '@/lib/hooks/useDatabase';

import type { SubmitHandler } from 'react-hook-form';

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
  const [participants, setParticipants] = useState<string[]>([]);

  const drizzleDb = useDatabase();
  const visit = useVisitById(Number(id));

  const restaurantId = watch('restaurantId');

  useEffect(() => {
    if (visit?.id) {
      reset({
        visited_at: visit.visited_at,
        comments: visit.comments || '',
        restaurantId: visit.restaurant.id,
        dishes: visit.dishes.map((dish) => dish.id),
      });

      setSelectedImages(visit.images);
      void getVisitParticipantNames(drizzleDb, Number(id)).then(setParticipants);
      setSelectedDishes(
        visit.dishes.map((dish) => ({
          id: dish.id,
          name: dish.name,
          comments: null,
          rating: null,
          deleted: false,
          tags: [],
          images: [],
        })),
      );
    }
  }, [visit, reset, drizzleDb, id]);

  useEffect(() => {
    if (restaurantId && visit && restaurantId !== visit?.restaurant.id) {
      setSelectedDishes([]);
      setValue('dishes', []);
    }
  }, [restaurantId, setValue, visit]);

  const onSubmit: SubmitHandler<VisitFormData> = async (data) => {
    try {
      const payload = {
        visitedAt: data.visited_at,
        comments: data.comments?.trim() || '',
        restaurantId: data.restaurantId,
      };

      const dishIds = (data.dishes ?? []).map((d) => (typeof d === 'string' ? parseInt(d) : d));
      await updateVisit(drizzleDb, Number(id), payload, dishIds, participants);

      const newImages = selectedImages.filter((image) => !image.id);
      if (newImages.length > 0) {
        await uploadImages(
          drizzleDb,
          newImages.map((img) => img.uri),
          'VISIT',
          Number(id),
        );
      }

      await deleteImages(drizzleDb, removedImages);

      Alert.alert('Éxito', 'Visita actualizada correctamente.');
      router.replace({
        pathname: '/visits/[id]/view',
        params: { id },
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar la visita.');
      console.error(error);
    }
  };

  return (
    <ScrollView className="flex-1 bg-muted dark:bg-dark-muted p-4">
      <Text className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        Editar visita
      </Text>

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

        <PeopleTagInput value={participants} onChange={setParticipants} />

        <ImagesUploader
          isEdit
          images={selectedImages}
          onChangeImages={setSelectedImages}
          onRemoveExistingImage={(imageId) => setRemovedImages((prev) => [...prev, imageId])}
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
