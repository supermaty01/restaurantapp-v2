import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useGlobalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';

import FormInput from '@/components/FormInput';
import RatingStars from '@/components/RatingStars';
import { useDishById } from '@/features/dishes/hooks/useDishById';
import { updateDish } from '@/features/dishes/repositories/dishRepository';
import type { DishFormData } from '@/features/dishes/schemas/dish-schema';
import { dishSchema } from '@/features/dishes/schemas/dish-schema';
import type { ImageItem } from '@/features/images/components/ImagesUploader';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import Tag from '@/features/tags/components/Tag';
import TagSelectorModal from '@/features/tags/components/TagSelectorModal';
import type { TagDTO } from '@/features/tags/types/tag-dto';
import { useTheme } from '@/lib/context/ThemeContext';
import { reportError } from '@/lib/helpers/report-error';
import { deleteImages, uploadImages } from '@/lib/helpers/upload-images';
import { useDatabase } from '@/lib/hooks/useDatabase';

import type { SubmitHandler } from 'react-hook-form';

export default function DishEditScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { isDarkMode } = useTheme();

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
  const [isTagModalVisible, setTagModalVisible] = useState(false);
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

      Alert.alert('Éxito', 'Plato actualizado correctamente.');
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
        <ActivityIndicator size="large" color={isDarkMode ? '#B27A4D' : '#905c36'} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-canvas p-4">
      <Text className="text-2xl font-bold mb-4 text-ink">Editar plato</Text>

      <View className="bg-surface p-4 rounded-md mb-8">
        {/* Nombre */}
        <FormInput control={control} name="name" label="Nombre" placeholder="Ingresa el nombre" />

        {/* Comentarios (opcional) */}
        <FormInput
          control={control}
          name="comments"
          label="Comentarios"
          placeholder="Ejemplo: Bastante cantidad, buen sabor..."
          multiline
          inputClassName="h-auto"
          numberOfLines={4}
        />

        {/* Precio */}
        <FormInput
          control={control}
          name="price"
          label="Precio"
          placeholder="Ingresa el precio"
          keyboardType="numeric"
        />

        {/* Restaurante */}
        <RestaurantPicker
          control={control}
          setValue={setValue}
          name="restaurantId"
          label="Restaurante"
          errors={errors}
        />

        {/* Rating (opcional) */}
        <Text className="text-xl font-semibold text-ink my-2">Calificación</Text>
        <View className="flex justify-center items-center">
          <RatingStars control={control} name="rating" />
        </View>

        {/* Tags */}
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

        {/* Images */}
        <ImagesUploader
          isEdit
          images={selectedImages}
          onChangeImages={setSelectedImages}
          onRemoveExistingImage={(imageId) => setRemovedImages((prev) => [...prev, imageId])}
        />

        {/* Submit button */}
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
