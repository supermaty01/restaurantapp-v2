import { zodResolver } from '@hookform/resolvers/zod';
import { router, useGlobalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import FormInput from '@/components/FormInput';
import RatingStars from '@/components/RatingStars';
import { FormScaffold, FormSection } from '@/components/ui/FormScaffold';
import { useToast } from '@/components/ui/Toast';
import { PriceField } from '@/features/dishes/components/PriceField';
import { useNewDish } from '@/features/dishes/hooks/useNewDish';
import { createDish } from '@/features/dishes/repositories/dishRepository';
import type { DishFormData } from '@/features/dishes/schemas/dish-schema';
import { dishSchema, dishWriteValues } from '@/features/dishes/schemas/dish-schema';
import ImagesUploader from '@/features/images/components/ImagesUploader';
import { useDefaultVisibility } from '@/features/privacy/useDefaultVisibility';
import { useSharingAvailable } from '@/features/privacy/useSharingAvailable';
import { NEW_ENTRY_VISIBILITY, type Visibility } from '@/features/privacy/visibility';
import { VisibilityField } from '@/features/privacy/VisibilityField';
import RestaurantPicker from '@/features/restaurants/components/RestaurantPicker';
import { useCurrency } from '@/features/settings/useCurrency';
import { TagField } from '@/features/tags/components/TagField';
import type { TagDTO } from '@/features/tags/types/tag-dto';
import { reportError } from '@/lib/helpers/report-error';
import { uploadImages } from '@/lib/helpers/upload-images';
import { useDatabase } from '@/lib/hooks/useDatabase';

import type { SubmitHandler } from 'react-hook-form';

export default function DishCreateScreen() {
  // Sin cuenta no hay a quién mostrárselo: la sección entera sobra.
  const sharing = useSharingAvailable();
  // La entrada nace difiriendo al ajuste, no copiándolo: si el ajuste
  // cambia mañana, esta entrada cambia con él. Solo tocar el control aquí
  // la fija.
  const { value: defaultVisibility } = useDefaultVisibility('dish');
  const [visibility, setVisibility] = useState<Visibility>(NEW_ENTRY_VISIBILITY);

  const { notify } = useToast();
  const { useBackRedirect, restaurantId } = useGlobalSearchParams();
  /*
   * El ajuste de Ajustes es el **punto de partida** de lo nuevo, no la respuesta
   * para todo el diario. Estando en Europa se deja en euros y lo que se apunte
   * nace en euros; al volver a Colombia se cambia y lo nuevo nace en pesos. Lo
   * ya escrito no se mueve — es la diferencia con la visibilidad por defecto,
   * que sí se resuelve en vivo (ver `visibility.ts`).
   */
  const { currency: startingCurrency } = useCurrency();
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DishFormData>({
    resolver: zodResolver(dishSchema),
    defaultValues: {
      name: '',
      ...(restaurantId ? { restaurantId: Number(restaurantId) } : {}),
      comments: '',
      currency: startingCurrency,
    },
  });

  const [selectedTags, setSelectedTags] = useState<TagDTO[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const { setNewDish } = useNewDish();
  const [loading, setLoading] = useState(false);
  const drizzleDb = useDatabase();
  const onSubmit: SubmitHandler<DishFormData> = async (data) => {
    setLoading(true);
    try {
      const payload = {
        visibility,
        name: data.name.trim(),
        restaurantId: data.restaurantId,
        comments: data.comments?.trim() || '',
        ...dishWriteValues(data),
        rating: data.rating || null,
      };

      const dishId = await createDish(
        drizzleDb,
        payload,
        selectedTags.map((tag) => tag.id),
      );

      if (selectedImages.length > 0) {
        await uploadImages(drizzleDb, selectedImages, 'DISH', dishId);
      }

      notify('Plato guardado');
      if (useBackRedirect && useBackRedirect === 'true') {
        setNewDish({
          id: dishId,
          name: payload.name,
          comments: payload.comments,
          rating: payload.rating,
          deleted: false,
          visibility: 'default' as const, // recien creado
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
    } catch (error) {
      reportError('No se pudo crear el plato', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScaffold submitLabel="Guardar plato" onSubmit={handleSubmit(onSubmit)} loading={loading}>
      <FormSection title="Lo básico">
        <FormInput control={control} name="name" label="Nombre" placeholder="Carbonara" />
        <RestaurantPicker
          control={control}
          setValue={setValue}
          name="restaurantId"
          fixedValue={!!restaurantId}
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
        <PriceField
          control={control}
          priceName="price"
          currency={watch('currency')}
          onCurrencyChange={(next) => setValue('currency', next)}
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

      {sharing ? (
        <FormSection title="Quién ve este plato">
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
