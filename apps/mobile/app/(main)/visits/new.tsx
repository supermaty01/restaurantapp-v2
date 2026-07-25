import { zodResolver } from '@hookform/resolvers/zod';
import { router, useGlobalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from 'react-native';

import FormDatePicker from '@/components/FormDatePicker';
import FormInput from '@/components/FormInput';
import { FormScaffold, FormSection } from '@/components/ui/FormScaffold';
import DishPicker from '@/features/dishes/components/DishPicker';
import type { DishListDTO } from '@/features/dishes/types/dish-dto';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import { PeopleTagInput } from '@/features/people/components/PeopleTagInput';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import { createVisit } from '@/features/visits/repositories/visitRepository';
import type { VisitFormData } from '@/features/visits/schemas/visit-schema';
import { visitSchema } from '@/features/visits/schemas/visit-schema';
import { getTodayLocalDateString } from '@/lib/helpers/date';
import { reportError } from '@/lib/helpers/report-error';
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
      reportError('No se pudo crear la visita', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormScaffold
      submitLabel="Guardar visita"
      onSubmit={handleSubmit(onSubmit)}
      loading={isSubmitting}
    >
      <FormSection title="Dónde y cuándo">
        <RestaurantPicker
          control={control}
          setValue={setValue}
          name="restaurantId"
          fixedValue={!!routeRestaurantId}
          label="Restaurante"
          errors={errors}
        />
        <FormDatePicker control={control} name="visited_at" label="Fecha" />
      </FormSection>

      <FormSection title="Qué comiste" hint="Puedes añadir platos nuevos sobre la marcha">
        <DishPicker
          control={control}
          name="dishes"
          setValue={setValue}
          restaurantId={restaurantId}
          errors={errors}
          selectedDishes={selectedDishes}
          setSelectedDishes={setSelectedDishes}
        />
      </FormSection>

      <FormSection title="Con quién" hint="Opcional">
        <PeopleTagInput value={participants} onChange={setParticipants} />
      </FormSection>

      <FormSection title="Comentarios" hint="Opcional">
        <FormInput
          control={control}
          name="comments"
          placeholder="Qué tal estuvo…"
          multiline
          numberOfLines={4}
        />
      </FormSection>

      <FormSection title="Fotos" hint="Opcional">
        <ImagesUploader images={selectedImages} onChangeImages={setSelectedImages} />
      </FormSection>
    </FormScaffold>
  );
}
