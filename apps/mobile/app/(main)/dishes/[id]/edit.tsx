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
import RatingStars from '@/components/RatingStars';
import { useDishById } from '@/features/dishes/hooks/useDishById';
import { DishFormData, dishSchema } from '@/features/dishes/schemas/dish-schema';
import ImagesUploader, { ImageItem } from '@/features/images/components/ImagesUploader';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import Tag from '@/features/tags/components/Tag';
import TagSelectorModal from '@/features/tags/components/TagSelectorModal';
import { TagDTO } from '@/features/tags/types/tag-dto';
import { useTheme } from '@/lib/context/ThemeContext';
import { uploadImages } from '@/lib/helpers/upload-images';
import * as schema from '@/services/db/schema';

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
      restaurantId: undefined,
      comments: '',
      price: undefined,
      rating: undefined,
    },
  });

  const [selectedTags, setSelectedTags] = useState<TagDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([]);
  const [removedImages, setRemovedImages] = useState<number[]>([]);
  const [isTagModalVisible, setTagModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const dish = useDishById(Number(id));

  // Load dish data from local database
  useEffect(() => {
    if (dish?.id) {
      reset({
        name: dish.name,
        restaurantId: dish.restaurant.id,
        comments: dish.comments || "",
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
        comments: data.comments?.trim() || "",
        price: data.price || null,
        rating: data.rating || null,
      };

      // Update dish record
      await drizzleDb.update(schema.dishes).set(payload).where(eq(schema.dishes.id, Number(id)));

      // Handle new images upload
      const newImages = selectedImages.filter((image) => !image.id);
      if (newImages.length > 0) {
        await uploadImages(drizzleDb, newImages.map((img) => img.uri), "DISH", Number(id));
      }

      // Handle removed images
      if (removedImages.length > 0) {
        await Promise.all(
          removedImages.map((imageId) => {
            return drizzleDb.delete(schema.images).where(eq(schema.images.id, imageId));
          })
        );
      }

      // Handle tags
      // First, get current tags
      const currentTags = dish?.tags.map((tag) => tag.id) || [];
      const removedTags = currentTags.filter((tagId) => !selectedTags.some((tag) => tag.id === tagId));
      const addedTags = selectedTags.filter((tag) => !currentTags.includes(tag.id)).map((tag) => tag.id);

      // Remove tags that were unselected
      if (removedTags.length > 0) {
        await Promise.all(
          removedTags.map((tagId) => {
            return drizzleDb.delete(schema.dishTags).where(
              and(eq(schema.dishTags.dishId, Number(id)), eq(schema.dishTags.tagId, tagId))
            );
          })
        );
      }

      // Add new tags
      if (addedTags.length > 0) {
        await Promise.all(
          addedTags.map((tagId) => {
            return drizzleDb.insert(schema.dishTags).values({ dishId: Number(id), tagId });
          })
        );
      }

      Alert.alert('Éxito', 'Plato actualizado correctamente.');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo actualizar el plato');
      console.log(error);
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
    <ScrollView className="flex-1 bg-muted dark:bg-dark-muted p-4">
      <Text className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Editar plato</Text>

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
        <Text className="text-xl font-semibold text-gray-800 dark:text-gray-200 my-2">Calificación</Text>
        <View className="flex justify-center items-center">
          <RatingStars
            control={control}
            name="rating"
          />
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

        {/* Images */}
        <ImagesUploader
          isEdit
          images={selectedImages}
          onChangeImages={setSelectedImages}
          onRemoveExistingImage={(imageId) =>
            setRemovedImages((prev) => [...prev, imageId])
          }
        />

        {/* Submit button */}
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