import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import RatingStars from '@/components/RatingStars';
import { DetailField, DetailMissing, DetailScaffold } from '@/components/ui/DetailScaffold';
import { useDialog } from '@/components/ui/Dialog';
import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useDishById } from '@/features/dishes/hooks/useDishById';
import {
  canHardDeleteDish,
  hardDeleteDish,
  softDeleteDish,
} from '@/features/dishes/repositories/dishRepository';
import { ImageDisplay } from '@/features/images/components/ImageDisplay';
import Tag from '@/features/tags/components/Tag';
import { useTheme } from '@/lib/context/ThemeContext';
import { reportError } from '@/lib/helpers/report-error';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { exportDish } from '@/services/share/exportService';

const priceFormat = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

export default function DishDetailScreen() {
  const router = useRouter();
  const { id } = useGlobalSearchParams();
  const drizzleDb = useDatabase();
  const { colors } = useTheme();
  const dish = useDishById(Number(id));
  const [isSharing, setIsSharing] = useState(false);
  const { ask } = useDialog();

  async function handleShare() {
    try {
      setIsSharing(true);
      await exportDish(drizzleDb, Number(id));
    } catch (error) {
      reportError('No se pudo compartir el plato', error);
    } finally {
      setIsSharing(false);
    }
  }

  async function handleDelete() {
    try {
      const canDeletePermanently = await canHardDeleteDish(drizzleDb, Number(id));

      const confirmed = await ask({
        title: 'Eliminar plato',
        message: canDeletePermanently
          ? 'Se borrará definitivamente. Esta acción no se puede deshacer.'
          : 'Seguirá apareciendo en las visitas que ya lo referencian.',
        icon: 'trash-outline',
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        destructive: true,
      });
      if (!confirmed) return;

      if (canDeletePermanently) {
        await hardDeleteDish(drizzleDb, Number(id));
      } else {
        await softDeleteDish(drizzleDb, Number(id));
      }
      router.back();
    } catch (error) {
      reportError('No se pudo comprobar si el plato está en uso', error);
    }
  }

  if (!dish) {
    return <DetailMissing message="No se encontró el plato" />;
  }

  const notices = [
    ...(dish.deleted ? ['Este plato ha sido eliminado'] : []),
    ...(dish.restaurant.deleted ? ['El restaurante de este plato ha sido eliminado'] : []),
  ];

  return (
    <DetailScaffold
      media={<ImageDisplay images={dish.images} />}
      title={dish.name}
      {...(notices.length > 0 ? { notices } : {})}
      meta={
        <View className="gap-2.5">
          {dish.rating ? <RatingStars value={dish.rating} size={17} gap={2} readOnly /> : null}
          {dish.tags?.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {dish.tags.map((tag) => (
                <Tag key={tag.id} color={tag.color} name={tag.name} deleted={tag.deleted} />
              ))}
            </View>
          ) : null}
        </View>
      }
      actions={[
        {
          icon: 'share-outline',
          label: 'Compartir',
          onPress: () => void handleShare(),
          busy: isSharing,
        },
        {
          icon: 'create-outline',
          label: 'Editar',
          onPress: () => router.push({ pathname: '/dishes/[id]/edit', params: { id: String(id) } }),
        },
        {
          icon: 'trash-outline',
          label: 'Eliminar',
          onPress: () => void handleDelete(),
          danger: true,
        },
      ]}
    >
      {/* No segmented control here: a dish has one body, and v1 faked a single
          "Detalles" tab with a hand-drawn underline. */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <DetailField label="Dónde">
          <PressableScale
            accessibilityLabel={`Ver ${dish.restaurant.name}`}
            onPress={() =>
              router.push({
                pathname: '/restaurants/[id]/view',
                params: { id: String(dish.restaurant.id) },
              })
            }
            scaleTo={0.985}
            className="flex-row items-center gap-3 rounded-xl border border-line bg-surface p-3"
          >
            <View className="h-9 w-9 items-center justify-center rounded-pill bg-primary/12">
              <Ionicons name="location" size={16} color={colors.primary} />
            </View>
            <Txt variant="heading" weight="bold" serif={false} numberOfLines={1} className="flex-1">
              {dish.restaurant.name}
            </Txt>
            <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
          </PressableScale>
        </DetailField>

        {dish.price ? (
          <DetailField label="Precio">
            <Txt variant="title" tone="primary" serif>
              {priceFormat.format(dish.price)}
            </Txt>
          </DetailField>
        ) : null}

        <DetailField label="Comentarios" value={dish.comments} empty="Sin comentarios" />
      </ScrollView>
    </DetailScaffold>
  );
}
