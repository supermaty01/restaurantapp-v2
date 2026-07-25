import { zodResolver } from '@hookform/resolvers/zod';
import { router, useGlobalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View, ActivityIndicator } from 'react-native';

import FormInput from '@/components/FormInput';
import RatingStars from '@/components/RatingStars';
import { FormScaffold, FormSection } from '@/components/ui/FormScaffold';
import { useToast } from '@/components/ui/Toast';
import { useDishById } from '@/features/dishes/hooks/useDishById';
import { updateDish } from '@/features/dishes/repositories/dishRepository';
import type { DishFormData } from '@/features/dishes/schemas/dish-schema';
import { dishSchema } from '@/features/dishes/schemas/dish-schema';
import type { ImageItem } from '@/features/images/components/ImagesUploader';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import { VisibilityControl } from '@/features/privacy/VisibilityControl';
import { setVisibility } from '@/features/privacy/visibilityRepository';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import { TagField } from '@/features/tags/components/TagField';
import type { TagDTO } from '@/features/tags/types/tag-dto';
import { useTheme } from '@/lib/context/ThemeContext';
import { reportError } from '@/lib/helpers/report-error';
import { deleteImages, uploadImages } from '@/lib/helpers/upload-images';
import { useDatabase } from '@/lib/hooks/useDatabase';

import type { SubmitHandler } from 'react-hook-form';

export default function DishEditScreen() {
  const { notify } = useToast();
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DishFormData>({
    resolver: zodResolver(dishSchema),
    defaultValues: {
      name: '',
      comments: '',
    },
  });

  const [selectedTags, setSelectedTags] = useState<TagDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([]);
  const [removedImages, setRemovedImages] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const drizzleDb = useDatabase();
  const dish = useDishById(Number(id));

  // Load dish data from local database
  useEffect(() => {
    if (dish?.id) {
      reset({
        name: dish.name,
        restaurantId: dish.restaurant.id,
        comments: dish.comments || '',
        rating: dish.rating !== null ? dish.rating : undefined,
        price: dish.price !== null ? dish.price : undefined,
      });
      setSelectedTags(dish.tags);
      setSelectedImages(dish.images);
    }
  }, [dish, reset]);

  const onSubmit: SubmitHandler<DishFormData> = async (data) => {
    setLoading(true);
    try {
      const payload = {
        name: data.name.trim(),
        restaurantId: data.restaurantId,
        comments: data.comments?.trim() || '',
        price: data.price || null,
        rating: data.rating || null,
      };

      // updateDish replaces the whole tag set, so no add/remove diff.
      await updateDish(
        drizzleDb,
        Number(id),
        payload,
        selectedTags.map((tag) => tag.id),
      );

      const newImages = selectedImages.filter((image) => !image.id);
      if (newImages.length > 0) {
        await uploadImages(
          drizzleDb,
          newImages.map((img) => img.uri),
          'DISH',
          Number(id),
        );
      }

      await deleteImages(drizzleDb, removedImages);

      notify('Cambios guardados');
      router.back();
    } catch (error) {
      reportError('No se pudo actualizar el plato', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-canvas justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FormScaffold submitLabel="Guardar cambios" onSubmit={handleSubmit(onSubmit)} loading={loading}>
      <FormSection title="Lo básico">
        <FormInput control={control} name="name" label="Nombre" placeholder="Carbonara" />
        <RestaurantPicker
          control={control}
          setValue={setValue}
          name="restaurantId"
          label="Restaurante"
          errors={errors}
        />
      </FormSection>

      <FormSection title="Valoración" hint="Opcional">
        <View className="items-center rounded-xl border border-line bg-surface py-4">
          <RatingStars control={control} name="rating" size={30} gap={6} />
        </View>
      </FormSection>

      <FormSection title="Detalles" hint="Opcional">
        <FormInput
          control={control}
          name="price"
          label="Precio"
          placeholder="0"
          keyboardType="numeric"
        />
        <FormInput
          control={control}
          name="comments"
          label="Comentarios"
          placeholder="Bastante cantidad, buen sabor…"
          multiline
          numberOfLines={4}
        />
      </FormSection>

      <FormSection title="Etiquetas" hint="Para agruparlo y filtrarlo luego">
        <TagField selected={selectedTags} onChange={setSelectedTags} />
      </FormSection>

      <FormSection title="Quién lo ve">
        {/* The same control as the detail screen, applied on the spot rather
            than on Save: it is one decision with nothing to validate, and
            making it wait for the form's Save would be the only field here
            that behaves differently from the badge you just tapped. */}
        {dish ? (
          <VisibilityControl
            value={dish.visibility}
            entity="dish"
            onChange={(next) => setVisibility(drizzleDb, 'dish', dish.id, next)}
          />
        ) : null}
      </FormSection>

      <FormSection title="Fotos" hint="Opcional">
        <ImagesUploader
          isEdit
          images={selectedImages}
          onChangeImages={setSelectedImages}
          onRemoveExistingImage={(imageId) => setRemovedImages((prev) => [...prev, imageId])}
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
