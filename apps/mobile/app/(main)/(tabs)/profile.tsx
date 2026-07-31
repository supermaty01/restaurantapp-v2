import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/Dialog';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { Card, SectionHeader } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import type { Profile } from '@/features/social/api';
import { useFriends } from '@/features/social/hooks/useFriends';
import { useMyProfile } from '@/features/social/myProfile';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { formatRelativeDate } from '@/lib/helpers/date';
import { useSync } from '@/lib/hooks/useSync';
import type { PhotoProgress } from '@/services/sync/photos';
import { photoProgressLabel, SYNC_LABEL, type SyncStatus } from '@/services/sync/syncStore';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function ProfileScreen() {
  const router = useRouter();
  const { session, isConfigured, signOut } = useAuth();
  const { status, lastOutcome, photos, syncNow } = useSync();
  const { tell } = useDialog();
  const { incoming } = useFriends();

  // Guardado entre arranques: antes esta tarjeta pedía el perfil en cada
  // montaje y enseñaba iniciales del correo, luego iniciales del nombre, luego
  // la foto.
  const { profile, known } = useMyProfile();

  return (
    <Screen scroll tabBar contentClassName="pt-3">
      <Text className="font-display text-[26px] text-ink">Perfil</Text>

      {session ? (
        <AccountCard
          profile={profile}
          profileKnown={known}
          email={session.user.email ?? ''}
          syncStatus={status}
          syncPhotos={photos}
          syncError={lastOutcome?.ok === false ? (lastOutcome.error ?? undefined) : undefined}
          syncedAt={lastOutcome?.ok === true ? lastOutcome.at : undefined}
          showSyncError={(detail) =>
            void tell({
              title: 'No se pudo sincronizar',
              message: detail,
              icon: 'cloud-offline-outline',
              destructive: true,
            })
          }
          onSync={syncNow}
          onEdit={() => router.push('/(main)/profile-edit')}
        />
      ) : (
        <SignedOutCard configured={isConfigured} onPress={() => router.push('/(main)/account')} />
      )}

      <SectionHeader title="Personas" className="mt-7" />
      <View className="mt-3 gap-2.5">
        <Row
          icon="people-outline"
          label="Amigos"
          badge={incoming.length || undefined}
          onPress={() => router.push('/(main)/friends')}
        />
      </View>

      {/* Tags stopped being a tab because they are a filter, not a collection —
          but managing them still needs a door, and cleaning up unused ones is
          not something you do from inside a form. */}
      <SectionHeader title="Tu diario" className="mt-7" />
      <View className="mt-3 gap-2.5">
        <Row
          icon="pricetag-outline"
          label="Etiquetas"
          onPress={() => router.push('/(main)/tags')}
        />
        <Row icon="map-outline" label="Mapa" onPress={() => router.push('/(main)/map')} />
      </View>

      <SectionHeader title="Aplicación" className="mt-7" />
      <View className="mt-3 gap-2.5">
        <Row
          icon="settings-outline"
          label="Ajustes y copias de seguridad"
          onPress={() => router.push('/(main)/settings')}
        />
        {session ? (
          <Row icon="log-out-outline" label="Cerrar sesión" danger onPress={signOut} />
        ) : null}
      </View>
    </Screen>
  );
}

function AccountCard({
  profile,
  profileKnown,
  email,
  syncStatus,
  syncPhotos,
  syncError,
  syncedAt,
  showSyncError,
  onSync,
  onEdit,
}: {
  profile: Profile | null;
  profileKnown: boolean;
  email: string;
  syncStatus: SyncStatus;
  syncPhotos: PhotoProgress | null;
  syncError?: string | undefined;
  syncedAt?: string | undefined;
  showSyncError: (detail: string) => void;
  onSync: () => void;
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  const name = profile?.displayName ?? profile?.username ?? email.split('@')[0] ?? 'Tú';

  return (
    <Card className="mt-4 gap-3.5">
      <View className="flex-row items-center gap-3">
        <Avatar name={name} uri={profile?.avatarUrl} pending={!profileKnown} size={54} />
        <View className="flex-1">
          <Text className="font-display text-[20px] text-ink" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-[13px] text-ink-subtle" numberOfLines={1}>
            {profile ? `@${profile.username}` : email}
          </Text>
        </View>
        <Button label="Editar" variant="secondary" size="sm" onPress={onEdit} />
      </View>

      <View className="flex-row items-center justify-between gap-2 border-t border-line pt-3">
        {/* The state in a word, the detail on demand: a raw driver error is
            what you need while something is broken and clutter once it is
            fixed, so it moves behind a tap instead of filling the card. */}
        <PressableScale
          accessibilityLabel={syncError ? 'Ver el detalle del error' : 'Estado de sincronización'}
          {...(syncError ? { onPress: () => void showSyncError(syncError) } : {})}
          scaleTo={0.97}
          className="min-w-0 flex-1 flex-row items-center gap-2"
        >
          <Ionicons
            name={
              syncStatus === 'error'
                ? 'alert-circle'
                : syncStatus === 'syncing'
                  ? 'sync'
                  : 'cloud-done'
            }
            size={16}
            color={syncStatus === 'error' ? colors.danger : colors.sage}
          />
          <Txt
            variant="caption"
            tone={syncStatus === 'error' ? 'danger' : 'muted'}
            numberOfLines={1}
            className="flex-1"
          >
            {/* Las fotos son lo lento, y la frase la escribe el store: aquí se
                escribía a mano y decía "Subiendo" también mientras bajaba. */}
            {syncStatus === 'syncing' && syncPhotos && syncPhotos.done < syncPhotos.total
              ? photoProgressLabel(syncPhotos)
              : syncStatus === 'ok' && syncedAt
                ? `Al día · ${formatRelativeDate(syncedAt)}`
                : SYNC_LABEL[syncStatus]}
          </Txt>
          {syncError ? (
            <Ionicons name="information-circle-outline" size={15} color={colors.inkSubtle} />
          ) : null}
        </PressableScale>

        <Button
          label={syncStatus === 'error' ? 'Reintentar' : 'Sincronizar'}
          variant="ghost"
          size="sm"
          disabled={syncStatus === 'syncing'}
          onPress={onSync}
        />
      </View>
    </Card>
  );
}

function SignedOutCard({ configured, onPress }: { configured: boolean; onPress: () => void }) {
  return (
    <Card className="mt-4 gap-3">
      <Text className="font-display text-[20px] text-ink">Estás en modo local</Text>
      <Text className="text-[14px] leading-5 text-ink-muted">
        {configured
          ? 'Todo lo que registras se guarda en este móvil. Si creas una cuenta podrás sincronizarlo y compartirlo con amigos, sin perder nada de lo que ya tienes.'
          : 'Esta copia no tiene la nube configurada, así que funciona íntegramente en el móvil.'}
      </Text>
      {configured ? <Button label="Crear cuenta o entrar" block onPress={onPress} /> : null}
    </Card>
  );
}

function Row({
  icon,
  label,
  onPress,
  badge,
  danger = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number | undefined;
  danger?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 active:opacity-80"
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.inkMuted} />
      <Text className={`flex-1 font-semi text-[15px] ${danger ? 'text-danger' : 'text-ink'}`}>
        {label}
      </Text>
      {badge ? (
        <View className="h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1.5">
          <Text className="font-bold text-[11px] text-on-primary">{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
    </Pressable>
  );
}
