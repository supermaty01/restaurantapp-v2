import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { DetailField } from '@/components/ui/DetailScaffold';
import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import type { VisitDetailsDTO } from '@/features/visits/types/visit-dto';
import { useTheme } from '@/lib/context/ThemeContext';

/** The "Detalles" panel of a visit: where it was, and what you wrote about it. */
export default function VisitDetails({ visit }: { visit: VisitDetailsDTO }) {
  const { colors } = useTheme();

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pb-8 pt-2 gap-5"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <DetailField label="Dónde">
        <PressableScale
          accessibilityLabel={`Ver ${visit.restaurant.name}`}
          onPress={() =>
            router.push({
              pathname: '/restaurants/[id]/view',
              params: { id: String(visit.restaurant.id) },
            })
          }
          scaleTo={0.985}
          className="flex-row items-center gap-3 rounded-xl border border-line bg-surface p-3"
        >
          <View className="h-9 w-9 items-center justify-center rounded-pill bg-primary/12">
            <Ionicons name="location" size={16} color={colors.primary} />
          </View>
          <Txt variant="heading" weight="bold" serif={false} numberOfLines={1} className="flex-1">
            {visit.restaurant.name}
          </Txt>
          <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
        </PressableScale>
      </DetailField>

      <DetailField label="Comentarios" value={visit.comments} empty="Sin comentarios" />
    </ScrollView>
  );
}
