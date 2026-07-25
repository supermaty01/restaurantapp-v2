import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import FormDatePicker from '@/components/FormDatePicker';
import FormInput from '@/components/FormInput';
import { FormScaffold, FormSection } from '@/components/ui/FormScaffold';
import { useToast } from '@/components/ui/Toast';
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
import { getTodayLocalDateString } from '@/lib/helpers/date';
import { reportError } from '@/lib/helpers/report-error';
import { deleteImages, uploadImages } from '@/lib/helpers/upload-images';
import { useDatabase } from '@/lib/hooks/useDatabase';

import type { SubmitHandler } from 'react-hook-form';

export default function VisitEditScreen() {
  const { notify } = useToast();
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
        // The form requires a date even where the stored visit lacks one:
        // editing is the moment to give it the date it never had.
        visited_at: visit.visited_at ?? getTodayLocalDateString(),
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

      notify('Cambios guardados');
      router.replace({
        pathname: '/visits/[id]/view',
        params: { id },
      });
    } catch (error) {
      reportError('No se pudo actualizar la visita.', error);
    }
  };

  return (
    <FormScaffold
      submitLabel="Guardar cambios"
      onSubmit={handleSubmit(onSubmit)}
      loading={isSubmitting}
    >
      <FormSection title="Dónde y cuándo">
        <RestaurantPicker
          control={control}
          setValue={setValue}
          name="restaurantId"
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
        <ImagesUploader
          isEdit
          images={selectedImages}
          onChangeImages={setSelectedImages}
          onRemoveExistingImage={(imageId) => setRemovedImages((prev) => [...prev, imageId])}
        />
      </FormSection>
    </FormScaffold>
  );
}
