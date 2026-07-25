import { ScrollView, View } from 'react-native';

import MapLocationPicker from '@/components/MapLocationPicker';
import { DetailField } from '@/components/ui/DetailScaffold';
import { Txt } from '@/components/ui/Txt';
import { VisibilityControl } from '@/features/privacy/VisibilityControl';
import { setVisibility } from '@/features/privacy/visibilityRepository';
import type { RestaurantDetailsDTO } from '@/features/restaurants/types/restaurant-dto';
import { useDatabase } from '@/lib/hooks/useDatabase';

/**
 * The "Detalles" panel of a restaurant.
 *
 * Rating and tags used to be repeated here; they now live in the screen header,
 * where they are visible whichever tab you are on. What is left is what only
 * this panel can show.
 */
export default function RestaurantDetails({ restaurant }: { restaurant: RestaurantDetailsDTO }) {
  const db = useDatabase();
  const hasLocation = Boolean(restaurant.latitude && restaurant.longitude);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pb-8 pt-2 gap-5"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      {/* Where sharing is decided. On the detail screen rather than only in
          the form, because you find out a meal was worth sharing by having
          eaten it — after the entry already exists. */}
      <DetailField label="Quién lo ve">
        <VisibilityControl
          value={restaurant.visibility}
          entity="restaurant"
          onChange={(next) => setVisibility(db, 'restaurant', restaurant.id, next)}
        />
      </DetailField>

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
