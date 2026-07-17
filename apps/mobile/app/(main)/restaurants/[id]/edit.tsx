import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { and, eq } from 'drizzle-orm/sql';
import { router, useGlobalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';

import FormInput from '@/components/FormInput';
import MapLocationPicker from '@/components/MapLocationPicker';
import RatingStars from '@/components/RatingStars';
import ImagesUploader, { ImageItem } from '@/features/images/components/ImagesUploader';
import { useRestaurantById } from '@/features/restaurants/hooks/useRestaurantById';
import { RestaurantFormData, restaurantSchema } from '@/features/restaurants/schemas/restaurant-schema';
import Tag from '@/features/tags/components/Tag';
import TagSelectorModal from '@/features/tags/components/TagSelectorModal';
import { TagDTO } from '@/features/tags/types/tag-dto';
import { useTheme } from '@/lib/context/ThemeContext';
import { uploadImages } from '@/lib/helpers/upload-images';
import * as schema from '@/services/db/schema';


export default function RestaurantEditScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { isDarkMode } = useTheme();

  const { control, handleSubmit, reset } = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: '',
      comments: '',
      rating: undefined,
      location: undefined,
    },
  });

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedTags, setSelectedTags] = useState<TagDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([]);
  const [removedImages, setRemovedImages] = useState<number[]>([]);
  const [isTagModalVisible, setTagModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const restaurant = useRestaurantById(Number(id));

  useEffect(() => {
    if (restaurant?.id) {
      const l = (restaurant.latitude && restaurant.longitude) ? {
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
      } : null;
      reset({
        name: restaurant.name,
        comments: restaurant.comments || "",
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
      await drizzleDb.update(schema.restaurants).set(payload).where(eq(schema.restaurants.id, Number(id)));

      const newImages = selectedImages.filter((image) => !image.id);
      if (newImages.length > 0) {
        await uploadImages(drizzleDb, newImages.map((img) => img.uri), "RESTAURANT", Number(id));
      }

      // Eliminar etiquetas
      const currentTags = restaurant?.tags.map((tag) => tag.id) || [];
      const removedTags = currentTags.filter((tagId) => !selectedTags.some((tag) => tag.id === tagId));
      const addedTags = selectedTags.filter((tag) => !currentTags.includes(tag.id)).map((tag) => tag.id);
      if (removedTags.length > 0) {
        await Promise.all(
          removedTags.map((tagId) => {
            return drizzleDb.delete(schema.restaurantTags).where(and(eq(schema.restaurantTags.restaurantId, Number(id)), (eq(schema.restaurantTags.tagId, tagId))));
          })
        );
      }

      // Agregar etiquetas
      if (addedTags.length > 0) {
        await Promise.all(
          addedTags.map((tagId) => {
            return drizzleDb.insert(schema.restaurantTags).values({ restaurantId: Number(id), tagId });
          })
        );
      }

      if (removedImages.length > 0) {
        await Promise.all(
          removedImages.map((imageId) => {
            return drizzleDb.delete(schema.images).where(eq(schema.images.id, imageId));
          })
        );
      }

      Alert.alert('Éxito', 'Restaurante actualizado correctamente.');
      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el restaurante');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-muted dark:bg-dark-muted justify-center items-center">
        <ActivityIndicator size="large" color={isDarkMode ? "#B27A4D" : "#905c36"} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-muted dark:bg-dark-muted p-4" keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
      <Text className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Editar restaurante</Text>

      <View className="bg-card dark:bg-dark-card p-4 rounded-md mb-8">
        <FormInput
          control={control}
          name="name"
          label="Nombre"
          placeholder="Ingresa el nombre"
        />

        <FormInput
          control={control}
          name="comments"
          label="Comentarios"
          placeholder="Ejemplo: Ambiente agradable, buena comida..."
          multiline
          inputClassName="h-auto"
          numberOfLines={4}
        />

        <Text className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Ubicación</Text>
        <MapLocationPicker location={location} onLocationChange={setLocation} />

        <Text className="text-xl font-semibold text-gray-800 dark:text-gray-200 my-2">Calificación</Text>
        <View className="flex justify-center items-center">
          <RatingStars control={control} name="rating" />
        </View>

        <View className="flex-row items-center justify-between mt-4">
          <Text className="text-xl font-semibold text-gray-800 dark:text-gray-200">Etiquetas</Text>
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => setTagModalVisible(true)}
          >
            <View className="bg-primary dark:bg-dark-primary rounded-full p-2">
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
          onRemoveExistingImage={(imageId) =>
            setRemovedImages((prev) => [...prev, imageId])
          }
        />

        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          className="mt-4 bg-primary dark:bg-dark-primary py-3 rounded-md items-center"
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-bold">Guardar</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
