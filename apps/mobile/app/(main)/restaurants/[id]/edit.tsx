import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useGlobalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';

import FormInput from '@/components/FormInput';
import MapLocationPicker from '@/components/MapLocationPicker';
import RatingStars from '@/components/RatingStars';
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
    <ScrollView
      className="flex-1 bg-canvas p-4"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      <Text className="text-2xl font-bold mb-4 text-ink">Editar restaurante</Text>

      <View className="bg-surface p-4 rounded-md mb-8">
        <FormInput control={control} name="name" label="Nombre" placeholder="Ingresa el nombre" />

        <FormInput
          control={control}
          name="comments"
          label="Comentarios"
          placeholder="Ejemplo: Ambiente agradable, buena comida..."
          multiline
          inputClassName="h-auto"
          numberOfLines={4}
        />

        <Text className="text-xl font-semibold text-ink mb-2">Ubicación</Text>
        <MapLocationPicker location={location} onLocationChange={setLocation} />

        <Text className="text-xl font-semibold text-ink my-2">Calificación</Text>
        <View className="flex justify-center items-center">
          <RatingStars control={control} name="rating" />
        </View>

        <View className="flex-row items-center justify-between mt-4">
          <Text className="text-xl font-semibold text-ink">Etiquetas</Text>
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => setTagModalVisible(true)}
          >
            <View className="bg-primary rounded-full p-2">
              <Ionicons name="add" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
        {selectedTags.length > 0 && (
          <View className="flex-row flex-wrap mt-2">
            {selectedTags.map((tag) => (
              <Tag name={tag.name} color={tag.color} key={tag.id} />
            ))}
          </View>
        )}
        <TagSelectorModal
          visible={isTagModalVisible}
          onClose={() => setTagModalVisible(false)}
          selectedTags={selectedTags}
          onChangeSelected={setSelectedTags}
        />

        <ImagesUploader
          isEdit
          images={selectedImages}
          onChangeImages={setSelectedImages}
          onRemoveExistingImage={(imageId) => setRemovedImages((prev) => [...prev, imageId])}
        />

        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          className="mt-4 bg-primary py-3 rounded-md items-center"
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-on-primary font-bold">Guardar</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
