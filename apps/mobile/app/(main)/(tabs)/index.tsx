import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState, SectionHeader } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { useHomeSummary } from '@/features/home/hooks/useHomeSummary';
import type { RecentVisit } from '@/features/home/hooks/useHomeSummary';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { formatDate } from '@/lib/helpers/date';
import { imagePathToUri } from '@/lib/helpers/image-paths';

/** "Buenas tardes" — the greeting follows the device clock. */
function greeting(hour: number): string {
  if (hour < 6) return 'Buenas noches';
  if (hour < 13) return 'Buenos días';
  if (hour < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

function StatTile({
  value,
  label,
  inverted = false,
  onPress,
}: {
  value: number;
  label: string;
  inverted?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      className={`flex-1 rounded-xl px-3 py-3.5 active:opacity-80 ${
        inverted ? 'bg-inverse' : 'border border-line bg-surface'
      }`}
    >
      <Text className={`font-display text-[26px] ${inverted ? 'text-on-inverse' : 'text-ink'}`}>
        {value}
      </Text>
      <Text
        className={`font-semi text-[12px] ${inverted ? 'text-on-inverse/70' : 'text-ink-subtle'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RecentVisitCard({ visit, onPress }: { visit: RecentVisit; onPress: () => void }) {
  const name = visit.restaurantName ?? 'Sin restaurante';
  const uri = visit.imagePath ? imagePathToUri(visit.imagePath) : undefined;

  return (
    <Card onPress={onPress} className="flex-row gap-3.5">
      <Thumbnail name={name} uri={uri} size={66} icon="restaurant" />
      <View className="flex-1 justify-center">
        <Text className="font-bold text-[15px] text-ink" numberOfLines={1}>
          {name}
        </Text>
        <Text className="mt-0.5 text-[12px] text-ink-subtle" numberOfLines={1}>
          {formatDate(visit.visitedAt)}
          {visit.comments ? ` · ${visit.comments}` : ''}
        </Text>
      </View>
    </Card>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const { restaurants, dishes, visits, recent } = useHomeSummary();

  const displayName =
    (session?.user.user_metadata?.['full_name'] as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    null;

  return (
    <Screen scroll contentClassName="pt-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-display-semi text-[19px] text-ink">RestaurantApp</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tu perfil"
          onPress={() => router.push('/(main)/(tabs)/profile')}
        >
          <Avatar name={displayName ?? 'Tú'} size={38} />
        </Pressable>
      </View>

      <View className="mt-6">
        <Text className="font-semi text-[14px] text-ink-subtle">
          {greeting(new Date().getHours())}
          {displayName ? `, ${displayName}` : ''}
        </Text>
        <Text className="mt-1 font-display text-[30px] leading-9 text-ink">¿Qué comiste hoy?</Text>
      </View>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Buscar lugares y platos"
        onPress={() => router.push('/(main)/(tabs)/restaurants')}
        className="mt-5 flex-row items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-4 py-3.5 active:opacity-80"
      >
        <Ionicons name="search" size={18} color={colors.inkSubtle} />
        <Text className="text-[15px] text-ink-subtle">Buscar lugares y platos</Text>
      </Pressable>

      <View className="mt-5 flex-row gap-2.5">
        <StatTile
          value={restaurants}
          label="Lugares"
          onPress={() => router.push('/(main)/(tabs)/restaurants')}
        />
        <StatTile
          value={dishes}
          label="Platos"
          onPress={() => router.push('/(main)/(tabs)/dishes')}
        />
        <StatTile
          value={visits}
          label="Visitas"
          inverted
          onPress={() => router.push('/(main)/visits')}
        />
      </View>

      <SectionHeader
        title="Visitas recientes"
        actionLabel={visits > 0 ? 'Ver todas' : undefined}
        onAction={visits > 0 ? () => router.push('/(main)/visits') : undefined}
        className="mt-7"
      />

      <View className="mt-3 gap-3">
        {recent.length === 0 ? (
          <EmptyState
            icon="restaurant-outline"
            title="Aún no hay visitas"
            message="Cuando registres dónde has comido, aparecerá aquí."
          />
        ) : (
          recent.map((visit) => (
            <RecentVisitCard
              key={visit.id}
              visit={visit}
              onPress={() => router.push(`/(main)/visits/${visit.id}/view`)}
            />
          ))
        )}
      </View>

      <View className="mt-7 flex-row gap-2.5">
        <QuickAction
          icon="add-circle-outline"
          label="Nueva visita"
          onPress={() => router.push('/(main)/visits/new')}
        />
        <QuickAction
          icon="location-outline"
          label="Nuevo lugar"
          onPress={() => router.push('/(main)/restaurants/new')}
        />
        <QuickAction icon="map-outline" label="Mapa" onPress={() => router.push('/(main)/map')} />
      </View>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-3.5 active:opacity-80"
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text className="text-center font-semi text-[11px] text-ink-muted">{label}</Text>
    </Pressable>
  );
}
