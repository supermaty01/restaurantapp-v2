import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import RatingStars from '@/components/RatingStars';
import { DetailMissing, DetailScaffold } from '@/components/ui/DetailScaffold';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ImageDisplay } from '@/features/images/components/ImageDisplay';
import RestaurantDetails from '@/features/restaurants/components/RestaurantDetails';
import RestaurantDishes from '@/features/restaurants/components/RestaurantDishes';
import RestaurantVisits from '@/features/restaurants/components/RestaurantVisits';
import { useRestaurantById } from '@/features/restaurants/hooks/useRestaurantById';
import {
  canHardDeleteRestaurant,
  hardDeleteRestaurant,
  softDeleteRestaurant,
} from '@/features/restaurants/repositories/restaurantRepository';
import Tag from '@/features/tags/components/Tag';
import { reportError } from '@/lib/helpers/report-error';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { exportRestaurant } from '@/services/share/exportService';

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const { id } = useGlobalSearchParams();
  const drizzleDb = useDatabase();
  const restaurant = useRestaurantById(Number(id));
  const [isSharing, setIsSharing] = useState(false);

  async function handleShare() {
    try {
      setIsSharing(true);
      await exportRestaurant(drizzleDb, Number(id));
    } catch (error) {
      reportError('No se pudo compartir el restaurante', error);
    } finally {
      setIsSharing(false);
    }
  }

  async function handleDelete() {
    try {
      // A restaurant referenced by dishes or visits can only be soft-deleted,
      // and the warning has to say so: "deleted" meaning two different things
      // is exactly the kind of surprise that loses data in the user's head.
      const canDeletePermanently = await canHardDeleteRestaurant(drizzleDb, Number(id));

      Alert.alert(
        'Eliminar restaurante',
        canDeletePermanently
          ? 'Se borrará definitivamente. Esta acción no se puede deshacer.'
          : 'Seguirá apareciendo en los platos y visitas que ya lo referencian.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  if (canDeletePermanently) {
                    await hardDeleteRestaurant(drizzleDb, Number(id));
                  } else {
                    await softDeleteRestaurant(drizzleDb, Number(id));
                  }
                  router.back();
                } catch (error) {
                  reportError('No se pudo eliminar el restaurante', error);
                }
              })();
            },
          },
        ],
        { cancelable: true },
      );
    } catch (error) {
      reportError('No se pudo comprobar si el restaurante está en uso', error);
    }
  }

  if (!restaurant) {
    return <DetailMissing message="No se encontró el restaurante" />;
  }

  return (
    <DetailScaffold
      media={<ImageDisplay images={restaurant.images} />}
      title={restaurant.name}
      {...(restaurant.deleted ? { notices: ['Este restaurante ha sido eliminado'] } : {})}
      meta={
        restaurant.rating || restaurant.tags.length > 0 ? (
          <View className="gap-2.5">
            {restaurant.rating ? (
              <RatingStars value={restaurant.rating} size={17} gap={2} readOnly />
            ) : null}
            {restaurant.tags.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5">
                {restaurant.tags.map((tag) => (
                  <Tag key={tag.id} name={tag.name} color={tag.color} deleted={tag.deleted} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null
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
          onPress: () =>
            router.push({ pathname: '/restaurants/[id]/edit', params: { id: String(id) } }),
        },
        {
          icon: 'trash-outline',
          label: 'Eliminar',
          onPress: () => void handleDelete(),
          danger: true,
        },
      ]}
    >
      <SegmentedTabs
        tabs={[
          {
            key: 'details',
            label: 'Detalles',
            render: () => <RestaurantDetails restaurant={restaurant} />,
          },
          {
            key: 'visits',
            label: 'Visitas',
            render: () => <RestaurantVisits restaurant={restaurant} />,
          },
          {
            key: 'dishes',
            label: 'Platos',
            render: () => <RestaurantDishes restaurant={restaurant} />,
          },
        ]}
      />
    </DetailScaffold>
  );
}
