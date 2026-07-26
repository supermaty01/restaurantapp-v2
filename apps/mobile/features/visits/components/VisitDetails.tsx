import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { DetailField } from '@/components/ui/DetailScaffold';
import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useSharingAvailable } from '@/features/privacy/useSharingAvailable';
import { VisibilityControl } from '@/features/privacy/VisibilityControl';
import { setVisibility } from '@/features/privacy/visibilityRepository';
import type { VisitDetailsDTO } from '@/features/visits/types/visit-dto';
import { useTheme } from '@/lib/context/ThemeContext';
import { useDatabase } from '@/lib/hooks/useDatabase';

/** The "Detalles" panel of a visit: where it was, and what you wrote about it. */
export default function VisitDetails({ visit }: { visit: VisitDetailsDTO }) {
  const sharing = useSharingAvailable();
  const db = useDatabase();
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

      {/* Only when there is someone. An empty "Con quién" on every solo meal
          would make eating alone look like a field you forgot to fill in. */}
      {visit.people.length > 0 ? (
        <DetailField label="Con quién">
          <View className="flex-row flex-wrap gap-2">
            {visit.people.map((person) => (
              <View
                key={person.accountUuid ?? person.name}
                className="flex-row items-center gap-2 rounded-pill border border-line bg-surface py-1.5 pl-1.5 pr-3.5"
              >
                <Avatar name={person.name} size={26} />
                <View>
                  <Txt variant="caption" weight="semi" serif={false}>
                    {person.name}
                  </Txt>
                  {person.username && person.username !== person.name ? (
                    <Txt variant="caption" tone="subtle">
                      @{person.username}
                    </Txt>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </DetailField>
      ) : null}

      {/* Where sharing is decided. On the detail screen rather than only in
          the form, because you find out a meal was worth sharing by having
          eaten it — after the entry already exists. */}
      {sharing ? (
        <DetailField label="Quién lo ve">
          <VisibilityControl
            value={visit.visibility}
            entity="visit"
            onChange={(next) => setVisibility(db, 'visit', visit.id, next)}
          />
        </DetailField>
      ) : null}

      <DetailField label="Comentarios" value={visit.comments} empty="Sin comentarios" />
    </ScrollView>
  );
}
