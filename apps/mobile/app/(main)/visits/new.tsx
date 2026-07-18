import { zodResolver } from '@hookform/resolvers/zod';
import { router, useGlobalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';

import FormDatePicker from '@/components/FormDatePicker';
import FormInput from '@/components/FormInput';
import DishPicker from '@/features/dishes/components/DishPicker';
import type { DishListDTO } from '@/features/dishes/types/dish-dto';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import { PeopleTagInput } from '@/features/people/components/PeopleTagInput';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import { createVisit } from '@/features/visits/repositories/visitRepository';
import type { VisitFormData } from '@/features/visits/schemas/visit-schema';
import { visitSchema } from '@/features/visits/schemas/visit-schema';
import { getTodayLocalDateString } from '@/lib/helpers/date';
import { uploadImages } from '@/lib/helpers/upload-images';
import { useDatabase } from '@/lib/hooks/useDatabase';

import type { SubmitHandler } from 'react-hook-form';

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
      ...(routeRestaurantId ? { restaurantId: Number(routeRestaurantId) } : {}),
      dishes: [],
    },
  });

  const [selectedDishes, setSelectedDishes] = useState<DishListDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const drizzleDb = useDatabase();
  const restaurantId = watch('restaurantId');

  useEffect(() => {
    setSelectedDishes([]);
  }, [restaurantId]);

  const onSubmit: SubmitHandler<VisitFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      const payload = {
        visitedAt: data.visited_at,
        comments: data.comments?.trim() || '',
        restaurantId: data.restaurantId,
      };

      const dishIds = (data.dishes ?? []).map((d) => (typeof d === 'string' ? parseInt(d) : d));
      const visitId = await createVisit(drizzleDb, payload, dishIds, participants);

      if (selectedImages.length > 0) {
        await uploadImages(drizzleDb, selectedImages, 'VISIT', visitId);
      }

      Alert.alert('Éxito', 'Visita creada correctamente.');

      router.back();
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear la visita');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-muted dark:bg-dark-muted p-4">
      <Text className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        Añadir visita
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

        <PeopleTagInput value={participants} onChange={setParticipants} />

        <ImagesUploader images={selectedImages} onChangeImages={setSelectedImages} />

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
