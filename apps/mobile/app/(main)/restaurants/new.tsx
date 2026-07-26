import { zodResolver } from '@hookform/resolvers/zod';
import { router, useGlobalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import FormInput from '@/components/FormInput';
import MapLocationPicker from '@/components/MapLocationPicker';
import RatingStars from '@/components/RatingStars';
import { FormScaffold, FormSection } from '@/components/ui/FormScaffold';
import { useToast } from '@/components/ui/Toast';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import { useDefaultVisibility } from '@/features/privacy/useDefaultVisibility';
import { useSharingAvailable } from '@/features/privacy/useSharingAvailable';
import { NEW_ENTRY_VISIBILITY, type Visibility } from '@/features/privacy/visibility';
import { VisibilityField } from '@/features/privacy/VisibilityField';
import { useNewRestaurant } from '@/features/restaurants/hooks/useNewRestaurant';
import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import type { RestaurantFormData } from '@/features/restaurants/schemas/restaurant-schema';
import { restaurantSchema } from '@/features/restaurants/schemas/restaurant-schema';
import { TagField } from '@/features/tags/components/TagField';
import type { TagDTO } from '@/features/tags/types/tag-dto';
import { reportError } from '@/lib/helpers/report-error';
import { uploadImages } from '@/lib/helpers/upload-images';
import { useDatabase } from '@/lib/hooks/useDatabase';

import type { SubmitHandler } from 'react-hook-form';

export default function RestaurantCreateScreen() {
  // Sin cuenta no hay a quién mostrárselo: la sección entera sobra.
  const sharing = useSharingAvailable();
  // La entrada nace difiriendo al ajuste, no copiándolo: si el ajuste
  // cambia mañana, esta entrada cambia con él. Solo tocar el control aquí
  // la fija.
  const { value: defaultVisibility } = useDefaultVisibility('restaurant');
  const [visibility, setVisibility] = useState<Visibility>(NEW_ENTRY_VISIBILITY);

  const { notify } = useToast();
  const { useBackRedirect, prefillName, prefillLatitude, prefillLongitude } =
    useGlobalSearchParams<{
      useBackRedirect?: string;
      prefillName?: string;
      prefillLatitude?: string;
      prefillLongitude?: string;
    }>();

  const prefillLocation =
    prefillLatitude && prefillLongitude
      ? {
          latitude: parseFloat(prefillLatitude as string),
          longitude: parseFloat(prefillLongitude as string),
        }
      : null;

  const { control, handleSubmit } = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: (prefillName as string) || '',
      comments: '',
    },
  });

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(
    prefillLocation,
  );
  const [selectedTags, setSelectedTags] = useState<TagDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { setNewRestaurantId } = useNewRestaurant();
  const drizzleDb = useDatabase();
  const onSubmit: SubmitHandler<RestaurantFormData> = async (data) => {
    setLoading(true);
    try {
      const restaurantId = await createRestaurant(
        drizzleDb,
        {
          name: data.name.trim(),
          comments: data.comments?.trim() || '',
          rating: data.rating || null,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          visibility,
        },
        selectedTags.map((tag) => tag.id),
      );

      if (selectedImages.length > 0) {
        await uploadImages(drizzleDb, selectedImages, 'RESTAURANT', restaurantId);
      }

      notify('Restaurante guardado');
      if (useBackRedirect && useBackRedirect === 'true') {
        setNewRestaurantId(restaurantId);
        router.back();
      } else {
        router.replace({
          pathname: '/restaurants/[id]/view',
          params: { id: restaurantId },
        });
      }
    } catch (error) {
      reportError('No se pudo crear el restaurante', error);
      // Error already shown via Alert
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScaffold
      submitLabel="Guardar restaurante"
      onSubmit={handleSubmit(onSubmit)}
      loading={loading}
    >
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
        <MapLocationPicker location={location} onLocationChange={setLocation} />
      </FormSection>

      <FormSection title="Etiquetas" hint="Para agruparlo y filtrarlo luego">
        <TagField selected={selectedTags} onChange={setSelectedTags} />
      </FormSection>

      {sharing ? (
        <FormSection title="Quién ve este lugar">
          <VisibilityField
            value={visibility}
            onChange={setVisibility}
            resolvesTo={defaultVisibility}
          />
        </FormSection>
      ) : null}

      <FormSection title="Fotos" hint="Opcional">
        <ImagesUploader images={selectedImages} onChangeImages={setSelectedImages} />
      </FormSection>
    </FormScaffold>
  );
}
