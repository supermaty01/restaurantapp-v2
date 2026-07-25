import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { FadeInUp, PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, SectionHeader, Card } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { useHomeSummary } from '@/features/home/hooks/useHomeSummary';
import type { RecentVisit } from '@/features/home/hooks/useHomeSummary';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';
import { formatDate } from '@/lib/helpers/date';
import { imagePathToUri } from '@/lib/helpers/image-paths';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** The greeting follows the device clock. */
function greeting(hour: number): string {
  if (hour < 6) return 'Buenas noches';
  if (hour < 13) return 'Buenos días';
  if (hour < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

/** A question rather than a heading, so the screen invites instead of reporting. */
function prompt(hour: number): string {
  if (hour < 11) return '¿Desayunaste\nen algún sitio?';
  if (hour < 17) return '¿Qué comiste\nhoy?';
  return '¿Dónde has\ncenado?';
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const { restaurants, dishes, visits, recent } = useHomeSummary();

  const hour = new Date().getHours();
  const displayName =
    (session?.user.user_metadata?.['full_name'] as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    null;

  return (
    <Screen scroll tabBar contentClassName="pt-3">
      <FadeInUp index={0}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-pill bg-primary/12">
              <Ionicons name="restaurant" size={16} color={colors.primary} />
            </View>
            <Txt variant="heading" weight="semi">
              RestaurantApp
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tu perfil"
            onPress={() => router.push('/(main)/(tabs)/profile')}
          >
            <Avatar name={displayName ?? 'Tú'} size={38} />
          </Pressable>
        </View>
      </FadeInUp>

      <FadeInUp index={1}>
        <View className="mt-7">
          <Txt variant="overline" tone="primary" weight="bold" serif={false} uppercase>
            {greeting(hour)}
            {displayName ? ` · ${displayName}` : ''}
          </Txt>
          <Txt variant="hero" className="mt-2">
            {prompt(hour)}
          </Txt>
        </View>
      </FadeInUp>

      <FadeInUp index={2}>
        <PressableScale
          accessibilityLabel="Buscar lugares y platos"
          onPress={() => router.push('/(main)/(tabs)/restaurants')}
          scaleTo={0.985}
          className="mt-6 flex-row items-center gap-2.5 rounded-pill border border-line bg-surface px-4 py-3.5"
          style={elevation.low}
        >
          <Ionicons name="search" size={17} color={colors.inkSubtle} />
          <Txt variant="body" tone="subtle">
            Buscar lugares y platos
          </Txt>
        </PressableScale>
      </FadeInUp>

      <FadeInUp index={3}>
        <View className="mt-4 flex-row gap-2.5">
          <StatTile
            value={restaurants}
            label="Lugares"
            icon="location-outline"
            onPress={() => router.push('/(main)/(tabs)/restaurants')}
          />
          <StatTile
            value={dishes}
            label="Platos"
            icon="fast-food-outline"
            onPress={() => router.push('/(main)/(tabs)/dishes')}
          />
          <StatTile
            value={visits}
            label="Visitas"
            icon="calendar-outline"
            inverted
            onPress={() => router.push('/(main)/visits')}
          />
        </View>
      </FadeInUp>

      <FadeInUp index={4}>
        <View className="mt-4 flex-row gap-2.5">
          <QuickAction
            icon="add"
            label="Registrar visita"
            emphasis
            onPress={() => router.push('/(main)/visits/new')}
          />
          <QuickAction
            icon="location-outline"
            label="Nuevo lugar"
            onPress={() => router.push('/(main)/restaurants/new')}
          />
          <QuickAction icon="map-outline" label="Mapa" onPress={() => router.push('/(main)/map')} />
        </View>
      </FadeInUp>

      <FadeInUp index={5}>
        <SectionHeader
          title="Visitas recientes"
          actionLabel={visits > 0 ? 'Ver todas' : undefined}
          onAction={visits > 0 ? () => router.push('/(main)/visits') : undefined}
          className="mt-8"
        />
      </FadeInUp>

      <View className="mt-3 gap-3">
        {recent.length === 0 ? (
          <FadeInUp index={6}>
            <EmptyState
              icon="restaurant-outline"
              title="Aún no hay visitas"
              message="Cuando registres dónde has comido, aparecerá aquí."
            />
          </FadeInUp>
        ) : (
          recent.map((visit, index) => (
            <FadeInUp key={visit.id} index={6 + index}>
              <RecentVisitCard
                visit={visit}
                onPress={() => router.push(`/(main)/visits/${visit.id}/view`)}
              />
            </FadeInUp>
          ))
        )}
      </View>
    </Screen>
  );
}

function StatTile({
  value,
  label,
  icon,
  inverted = false,
  onPress,
}: {
  value: number;
  label: string;
  icon: IconName;
  inverted?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      className={`flex-1 rounded-xl px-3 py-3.5 ${
        inverted ? 'bg-inverse' : 'border border-line bg-surface'
      }`}
      style={elevation.low}
    >
      <Ionicons
        name={icon}
        size={15}
        color={inverted ? colors.onInverse : colors.inkSubtle}
        style={{ opacity: inverted ? 0.7 : 1 }}
      />
      <Txt variant="display" tone={inverted ? 'onInverse' : 'ink'} className="mt-1.5">
        {value}
      </Txt>
      <Txt
        variant="caption"
        weight="semi"
        serif={false}
        tone={inverted ? 'onInverse' : 'subtle'}
        style={inverted ? { opacity: 0.7 } : undefined}
      >
        {label}
      </Txt>
    </PressableScale>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  emphasis = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** The screen's primary action: filled rather than outlined. */
  emphasis?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      className={`flex-1 items-center gap-1.5 rounded-xl px-2 py-3.5 ${
        emphasis ? 'bg-primary' : 'border border-line bg-surface'
      }`}
      style={elevation.low}
    >
      <Ionicons name={icon} size={20} color={emphasis ? colors.onPrimary : colors.primary} />
      <Txt
        variant="overline"
        weight="bold"
        serif={false}
        tone={emphasis ? 'onPrimary' : 'muted'}
        numberOfLines={1}
        className="text-center"
        style={{ letterSpacing: 0.2 }}
      >
        {label}
      </Txt>
    </PressableScale>
  );
}

function RecentVisitCard({ visit, onPress }: { visit: RecentVisit; onPress: () => void }) {
  const { colors } = useTheme();
  const name = visit.restaurantName ?? 'Sin restaurante';
  const uri = visit.imagePath ? imagePathToUri(visit.imagePath) : undefined;

  return (
    <Card onPress={onPress} className="flex-row items-center gap-3.5">
      <Thumbnail name={name} uri={uri} size={64} icon="restaurant" />
      <View className="min-w-0 flex-1">
        <Txt variant="heading" weight="bold" serif={false} numberOfLines={1}>
          {name}
        </Txt>
        <Txt variant="caption" tone="subtle" numberOfLines={1} className="mt-0.5">
          {formatDate(visit.visitedAt)}
          {visit.comments ? ` · ${visit.comments}` : ''}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
    </Card>
  );
}
