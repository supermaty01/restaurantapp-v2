import { zodResolver } from '@hookform/resolvers/zod';
import { router, useGlobalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View, Alert, ActivityIndicator } from 'react-native';

import FormInput from '@/components/FormInput';
import MapLocationPicker from '@/components/MapLocationPicker';
import RatingStars from '@/components/RatingStars';
import { Button } from '@/components/ui/Button';
import { FormScaffold, FormSection } from '@/components/ui/FormScaffold';
import type { ImageItem } from '@/features/images/components/ImagesUploader';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import { useRestaurantById } from '@/features/restaurants/hooks/useRestaurantById';
import { updateRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import type { RestaurantFormData } from '@/features/restaurants/schemas/restaurant-schema';
import { restaurantSchema } from '@/features/restaurants/schemas/restaurant-schema';
import Tag from '@/features/tags/components/Tag';
import TagSelectorModal from '@/features/tags/components/TagSelectorModal';
import type { TagDTO } from '@/features/tags/types/tag-dto';
import { useTheme } from '@/lib/context/ThemeContext';
import { reportError } from '@/lib/helpers/report-error';
import { deleteImages, uploadImages } from '@/lib/helpers/upload-images';
import { useDatabase } from '@/lib/hooks/useDatabase';

import type { SubmitHandler } from 'react-hook-form';

export default function RestaurantEditScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  const { control, handleSubmit, reset } = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: '',
      comments: '',
    },
  });

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedTags, setSelectedTags] = useState<TagDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([]);
  const [removedImages, setRemovedImages] = useState<number[]>([]);
  const [isTagModalVisible, setTagModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const drizzleDb = useDatabase();
  const restaurant = useRestaurantById(Number(id));

  useEffect(() => {
    if (restaurant?.id) {
      const l =
        restaurant.latitude && restaurant.longitude
          ? {
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            }
          : null;
      reset({
        name: restaurant.name,
        comments: restaurant.comments || '',
        rating: restaurant.rating,
        location: l,
      });
      setSelectedTags(restaurant.tags);
      setSelectedImages(restaurant.images);
      setLocation(l);
    }
  }, [restaurant, reset]);

  const onSubmit: SubmitHandler<RestaurantFormData> = async (data) => {
    setLoading(true);
    try {
      const payload = {
        name: data.name.trim(),
        comments: data.comments?.trim() || '',
        rating: data.rating || null,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
      };
      // updateRestaurant replaces the whole tag set, so no add/remove diff.
      await updateRestaurant(
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
          'RESTAURANT',
          Number(id),
        );
      }

      await deleteImages(drizzleDb, removedImages);

      Alert.alert('Éxito', 'Restaurante actualizado correctamente.');
      router.back();
    } catch (error) {
      reportError('No se pudo actualizar el restaurante', error);
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
        <FormInput control={control} name="name" label="Nombre" placeholder="Trattoria Bella" />
        <FormInput
          control={control}
          name="comments"
          label="Comentarios"
          placeholder="Ambiente agradable, buena comida…"
          hint="Opcional"
          multiline
          numberOfLines={4}
        />
      </FormSection>

      <FormSection title="Valoración" hint="Opcional">
        <View className="items-center rounded-xl border border-line bg-surface py-4">
          <RatingStars control={control} name="rating" size={30} gap={6} />
        </View>
      </FormSection>

      <FormSection title="Ubicación" hint="Para verlo en el mapa y llegar hasta él">
        <View className="overflow-hidden rounded-xl border border-line">
          <MapLocationPicker location={location} onLocationChange={setLocation} />
        </View>
      </FormSection>

      <FormSection
        title="Etiquetas"
        hint={selectedTags.length > 0 ? `${selectedTags.length} elegidas` : 'Para agruparlo luego'}
        action={
          <Button
            label={selectedTags.length > 0 ? 'Cambiar' : 'Añadir'}
            icon="pricetag-outline"
            variant="secondary"
            size="sm"
            onPress={() => setTagModalVisible(true)}
          />
        }
      >
        {selectedTags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <Tag name={tag.name} color={tag.color} key={tag.id} />
            ))}
          </View>
        ) : null}
      </FormSection>

      <TagSelectorModal
        visible={isTagModalVisible}
        onClose={() => setTagModalVisible(false)}
        selectedTags={selectedTags}
        onChangeSelected={setSelectedTags}
      />

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
