import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { FadeInUp, PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, SectionHeader, Card } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { useHomeSummary } from '@/features/home/hooks/useHomeSummary';
import type { RecentEntry } from '@/features/home/hooks/useHomeSummary';
import { useMyProfile } from '@/features/social/context/MyProfileContext';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';
import { imagePathToUri } from '@/lib/helpers/image-paths';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

// tsc cannot resolve image modules through the path alias. expo-image takes
// the packager's numeric asset id directly, which is what require yields.
const appIcon = require('@/assets/burger-logo.png') as number;

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
  const { profile } = useMyProfile();
  const { restaurants, dishes, visits, recent } = useHomeSummary();

  const hour = new Date().getHours();

  /*
   * El perfil manda sobre la sesión.
   *
   * La sesión trae lo que dijo el proveedor de identidad al entrar —o nada, si
   * fue por correo—; el perfil es lo que la persona ha escrito en la app y lo
   * que ve todo el mundo. Cuando no hay perfil todavía (sin cuenta, o la
   * primera carga), se cae a la sesión antes que a «Tú», que al menos acierta
   * las iniciales.
   */
  const displayName =
    profile?.displayName ??
    profile?.username ??
    (session?.user.user_metadata?.['full_name'] as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    null;

  /*
   * Con sesión pero sin perfil todavía, el avatar no enseña nada.
   *
   * Es el último paso del desfile que se veía al arrancar: hueco → iniciales del
   * correo → foto. Los dos primeros ya no ocurren casi nunca —el perfil se
   * guarda entre arranques, ver `myProfile.ts`— pero la primera vez tras entrar
   * no hay copia que leer, y ahí es mejor un hueco liso que unas iniciales que
   * van a cambiar. El saludo sí usa el nombre de la sesión: un nombre
   * aproximado se lee bien, dos caras distintas no.
   */
  const resolvingAvatar = Boolean(session) && !profile;

  return (
    <Screen scroll tabBar contentClassName="pt-3">
      <FadeInUp index={0}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Image
              source={appIcon}
              style={{ width: 32, height: 32 }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
            <Txt variant="heading" weight="semi">
              RestaurantApp
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tu perfil"
            onPress={() => router.push('/(main)/(tabs)/profile')}
          >
            <Avatar
              name={displayName ?? 'Tú'}
              uri={profile?.avatarUrl ?? null}
              pending={resolvingAvatar}
              size={38}
            />
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
        <View className="mt-6 flex-row gap-2.5">
          <PressableScale
            accessibilityLabel="Buscar en tu diario"
            onPress={() => router.push('/(main)/search')}
            scaleTo={0.985}
            className="flex-1 flex-row items-center gap-2.5 rounded-pill border border-line bg-surface px-4 py-3.5"
            style={elevation.low}
          >
            <Ionicons name="search" size={17} color={colors.inkSubtle} />
            <Txt variant="body" tone="subtle">
              Buscar en tu diario…
            </Txt>
          </PressableScale>

          {/* The map is a way of browsing the diary, not a setting: it belongs
              next to search rather than buried in a menu. */}
          <PressableScale
            accessibilityLabel="Ver el mapa"
            onPress={() => router.push('/(main)/map')}
            scaleTo={0.92}
            className="h-[50px] w-[50px] items-center justify-center rounded-pill border border-line bg-surface"
            style={elevation.low}
          >
            <Ionicons name="map-outline" size={19} color={colors.primary} />
          </PressableScale>
        </View>
      </FadeInUp>

      <FadeInUp index={3}>
        <View className="mt-4 flex-row gap-2.5">
          <StatTile
            value={restaurants}
            label="Lugares"
            icon="location-outline"
            onPress={() => router.push('/(main)/(tabs)/journal?tab=places')}
          />
          <StatTile
            value={dishes}
            label="Platos"
            icon="fast-food-outline"
            onPress={() => router.push('/(main)/(tabs)/journal?tab=dishes')}
          />
          <StatTile
            value={visits}
            label="Visitas"
            icon="calendar-outline"
            onPress={() => router.push('/(main)/(tabs)/journal?tab=visits')}
          />
        </View>
      </FadeInUp>

      <FadeInUp index={4}>
        {/* "Lo último" y no "visitas recientes": quien no registra visitas veía
            una sección permanentemente vacía, y no registrar visitas es una
            forma legítima de usar la app — cada quien apunta lo que le sirve. */}
        <SectionHeader
          title="Lo último que añadiste"
          actionLabel={visits + dishes + restaurants > 0 ? 'Ver diario' : undefined}
          onAction={
            visits + dishes + restaurants > 0
              ? () => router.push('/(main)/(tabs)/journal')
              : undefined
          }
          className="mt-8"
        />
      </FadeInUp>

      <View className="mt-3 gap-3">
        {recent.length === 0 ? (
          <FadeInUp index={6}>
            <EmptyState
              icon="restaurant-outline"
              title="Tu diario está vacío"
              message="Registra un sitio, un plato o una comida entera y aparecerá aquí."
            />
          </FadeInUp>
        ) : (
          recent.map((entry, index) => (
            <FadeInUp key={`${entry.kind}:${entry.id}`} index={6 + index}>
              <RecentEntryCard
                entry={entry}
                onPress={() => router.push(ROUTE_FOR[entry.kind](entry.id))}
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

/** A dónde lleva cada clase de entrada. */
const ROUTE_FOR: Record<RecentEntry['kind'], (id: number) => string> = {
  visit: (id) => `/(main)/visits/${id}/view`,
  dish: (id) => `/(main)/dishes/${id}/view`,
  restaurant: (id) => `/(main)/restaurants/${id}/view`,
};

const ICON_FOR: Record<RecentEntry['kind'], IconName> = {
  visit: 'restaurant',
  dish: 'fast-food',
  restaurant: 'location',
};

function RecentEntryCard({ entry, onPress }: { entry: RecentEntry; onPress: () => void }) {
  const { colors } = useTheme();
  const uri = entry.imagePath ? imagePathToUri(entry.imagePath) : undefined;

  return (
    <Card onPress={onPress} className="flex-row items-center gap-3.5">
      <Thumbnail
        name={entry.title}
        uri={uri}
        remoteKey={entry.imageRemoteKey}
        size={64}
        icon={ICON_FOR[entry.kind]}
      />
      <View className="min-w-0 flex-1">
        <Txt variant="heading" weight="bold" serif={false} numberOfLines={1}>
          {entry.title}
        </Txt>
        {entry.detail ? (
          <Txt variant="caption" tone="subtle" numberOfLines={1} className="mt-0.5">
            {entry.detail}
          </Txt>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
    </Card>
  );
}
