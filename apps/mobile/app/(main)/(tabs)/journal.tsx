import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Txt } from '@/components/ui/Txt';
import { DishList } from '@/features/dishes/components/DishList';
import { RestaurantList } from '@/features/restaurants/components/RestaurantList';
import { VisitList } from '@/features/visits/components/VisitList';

/**
 * Everything you have logged, in one place.
 *
 * Visits, places and dishes were three separate destinations — two tabs and a
 * menu row — even though they are the same machinery over the same diary and
 * you switch between them constantly. As peers behind a segmented control the
 * switch costs one tap instead of a trip through the tab bar, and the app stops
 * pretending they are unrelated.
 *
 * Visits lead: they are the entries you actually make. Places and dishes are
 * the catalogue those entries point at.
 */
export default function JournalScreen() {
  // `?tab=` lets the home screen deep-link straight to a section.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [active, setActive] = useState('visits');

  /**
   * Aplicar el parámetro cada vez que se entra, no solo al montar.
   *
   * Esta pantalla vive en una pestaña que no se desmonta nunca, así que pasarle
   * el parámetro como valor inicial solo funcionaba la primera vez: después,
   * las tarjetas de inicio llevaban siempre a la última pestaña que hubieras
   * dejado abierta.
   *
   * Y se limpia al aplicarlo. Si se quedara puesto, volver de ver un plato
   * reaplicaría el parámetro y desharía la pestaña que acabas de elegir a mano.
   */
  useFocusEffect(
    useCallback(() => {
      if (!tab) return;
      setActive(tab);
      router.setParams({ tab: undefined });
    }, [tab]),
  );

  const tabs = useMemo(
    () => [
      { key: 'visits', label: 'Visitas', render: () => <VisitList /> },
      { key: 'places', label: 'Lugares', render: () => <RestaurantList /> },
      { key: 'dishes', label: 'Platos', render: () => <DishList /> },
    ],
    [],
  );

  return (
    <View className="flex-1 bg-canvas">
      <View className="px-5 pb-1 pt-3">
        <Txt variant="display">Diario</Txt>
      </View>
      {/* Solo aquí: son tres caras del mismo diario y se recorren constantemente. */}
      <SegmentedTabs tabs={tabs} selectedKey={active} onSelect={setActive} swipeable />
    </View>
  );
}
