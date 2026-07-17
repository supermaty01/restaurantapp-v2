import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { router, useGlobalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';

import FormInput from '@/components/FormInput';
import RatingStars from '@/components/RatingStars';
import { useNewDish } from '@/features/dishes/hooks/useNewDish';
import { DishFormData, dishSchema } from '@/features/dishes/schemas/dish-schema';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import Tag from '@/features/tags/components/Tag';
import TagSelectorModal from '@/features/tags/components/TagSelectorModal';
import { TagDTO } from '@/features/tags/types/tag-dto';
import { uploadImages } from '@/lib/helpers/upload-images';
import * as schema from '@/services/db/schema';

export default function DishCreateScreen() {
  const { useBackRedirect, restaurantId } = useGlobalSearchParams();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<DishFormData>({
    resolver: zodResolver(dishSchema),
    defaultValues: {
      name: '',
      restaurantId: restaurantId ? Number(restaurantId) : undefined,
      comments: '',
      price: undefined,
      rating: undefined,
    },
  });

  const [selectedTags, setSelectedTags] = useState<TagDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isTagModalVisible, setTagModalVisible] = useState(false);
  const { setNewDish } = useNewDish();
  const [loading, setLoading] = useState(false);
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
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

      const response = await drizzleDb.insert(schema.dishes).values(payload);
      const dishId = response.lastInsertRowId;

      // Asociar etiquetas
      for (const tag of selectedTags) {
        await drizzleDb.insert(schema.dishTags).values({ dishId, tagId: tag.id });
      }

      if (selectedImages.length > 0) {
        await uploadImages(drizzleDb, selectedImages, "DISH", dishId);
      }

      Alert.alert('Éxito', 'Plato creado correctamente.');
      if (useBackRedirect && useBackRedirect === 'true') {
        setNewDish({
          id: dishId,
          name: payload.name,
          comments: payload.comments,
          rating: payload.rating,
          tags: [], // No se necesitan
          images: [], // No se necesitan
        });
        router.back();
      } else {
        router.replace({
          pathname: '/dishes/[id]/view',
          params: { id: dishId },
        });
      }
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo crear el plato');
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-muted dark:bg-dark-muted p-4">
      <Text className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Añadir plato</Text>

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
          fixedValue={!!restaurantId}
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

        {/* Imágenes (solo se seleccionan, no se suben aún) */}
        <ImagesUploader
          images={selectedImages}
          onChangeImages={setSelectedImages}
        />

        {/* Botón para crear plato */}
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
