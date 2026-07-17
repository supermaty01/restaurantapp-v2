import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { router, useGlobalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';

import FormInput from '@/components/FormInput';
import MapLocationPicker from '@/components/MapLocationPicker';
import RatingStars from '@/components/RatingStars';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import { useNewRestaurant } from '@/features/restaurants/hooks/useNewRestaurant';
import { RestaurantFormData, restaurantSchema } from '@/features/restaurants/schemas/restaurant-schema';
import Tag from '@/features/tags/components/Tag';
import TagSelectorModal from '@/features/tags/components/TagSelectorModal';
import { TagDTO } from '@/features/tags/types/tag-dto';
import { uploadImages } from '@/lib/helpers/upload-images';
import * as schema from '@/services/db/schema';

export default function RestaurantCreateScreen() {
  const { useBackRedirect, prefillName, prefillLatitude, prefillLongitude } = useGlobalSearchParams<{
    useBackRedirect?: string;
    prefillName?: string;
    prefillLatitude?: string;
    prefillLongitude?: string;
  }>();

  const prefillLocation = prefillLatitude && prefillLongitude
    ? { latitude: parseFloat(prefillLatitude as string), longitude: parseFloat(prefillLongitude as string) }
    : null;

  const {
    control,
    handleSubmit,
  } = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: (prefillName as string) || '',
      comments: '',
      rating: undefined,
      location: undefined,
    },
  });

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(prefillLocation);
  const [selectedTags, setSelectedTags] = useState<TagDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isTagModalVisible, setTagModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setNewRestaurantId } = useNewRestaurant();
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
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

      const response = await drizzleDb.insert(schema.restaurants).values(payload);
      const restaurantId = response.lastInsertRowId;

      // Asociar etiquetas
      for (const tag of selectedTags) {
        await drizzleDb.insert(schema.restaurantTags).values({ restaurantId, tagId: tag.id });
      }

      if (selectedImages.length > 0) {
        await uploadImages(drizzleDb, selectedImages, "RESTAURANT", restaurantId);
      }

      Alert.alert('Éxito', 'Restaurante creado correctamente.');
      if (useBackRedirect && useBackRedirect === 'true') {
        setNewRestaurantId(restaurantId);
        router.back();
      } else {
        router.replace({
          pathname: '/restaurants/[id]/view',
          params: { id: restaurantId },
        });
      }
    } catch {
      Alert.alert('Error', 'No se pudo crear el restaurante');
      // Error already shown via Alert
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-muted dark:bg-dark-muted p-4" keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
      <Text className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Añadir restaurante</Text>

      <View className="bg-card dark:bg-dark-card p-4 rounded-md mb-8">
        {/* Nombre */}
        <FormInput
          control={control}
          name="name"
          label="Nombre"
          placeholder="Ingresa el nombre"
        />

        {/* Comentarios (opcional) */}
        <FormInput
          control={control}
          name="comments"
          label="Comentarios"
          placeholder="Ejemplo: Ambiente agradable, buena comida..."
          multiline
          inputClassName="h-auto"
          numberOfLines={4}
        />

        {/* Ubicación (opcional) */}
        <Text className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Ubicación</Text>
        <MapLocationPicker location={location} onLocationChange={setLocation} />

        {/* Rating (opcional) */}
        <Text className="text-xl font-semibold text-gray-800 dark:text-gray-200 my-2">Calificación</Text>
        <View className="flex justify-center items-center">
          <RatingStars control={control} name="rating" />
        </View>

        {/* Tags */}
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

        {/* Imágenes (solo se seleccionan, no se suben aún) */}
        <ImagesUploader
          images={selectedImages}
          onChangeImages={setSelectedImages}
        />

        {/* Botón para crear restaurante */}
        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          className="mt-4 bg-primary dark:bg-dark-primary py-3 rounded-md items-center disabled:bg-primary/30 dark:disabled:bg-dark-primary/30"
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
