import { ScrollView, View } from 'react-native';

import MapLocationPicker from '@/components/MapLocationPicker';
import { DetailField } from '@/components/ui/DetailScaffold';
import { Txt } from '@/components/ui/Txt';
import type { RestaurantDetailsDTO } from '@/features/restaurants/types/restaurant-dto';

/**
 * The "Detalles" panel of a restaurant.
 *
 * Rating and tags used to be repeated here; they now live in the screen header,
 * where they are visible whichever tab you are on. What is left is what only
 * this panel can show.
 */
export default function RestaurantDetails({ restaurant }: { restaurant: RestaurantDetailsDTO }) {
  const hasLocation = Boolean(restaurant.latitude && restaurant.longitude);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pb-8 pt-2 gap-5"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <DetailField label="Comentarios" value={restaurant.comments} empty="Sin comentarios" />

      <DetailField label="Ubicación">
        {hasLocation ? (
          <View className="overflow-hidden rounded-xl border border-line">
            <MapLocationPicker
              location={{
                latitude: restaurant.latitude as number,
                longitude: restaurant.longitude as number,
              }}
              editable={false}
            />
          </View>
        ) : (
          <Txt variant="body" tone="subtle">
            Sin ubicación
          </Txt>
        )}
      </DetailField>
    </ScrollView>
  );
}
