import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Card, SectionHeader } from '@/components/ui/Surface';
import { fetchMyProfile } from '@/features/social/api';
import type { Profile } from '@/features/social/api';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { useFriends } from '@/features/social/hooks/useFriends';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useSync } from '@/lib/hooks/useSync';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

const SYNC_LABEL: Record<string, string> = {
  idle: 'Al día',
  syncing: 'Sincronizando…',
  error: 'Error al sincronizar',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { session, isConfigured, signOut } = useAuth();
  const { status, syncNow } = useSync();
  const { incoming } = useFriends();

  const { data: profile } = useAsyncResource<Profile>(fetchMyProfile, {
    enabled: Boolean(session),
    deps: [session?.user.id],
  });

  return (
    <Screen scroll tabBar contentClassName="pt-3">
      <Text className="font-display text-[26px] text-ink">Perfil</Text>

      {session ? (
        <AccountCard
          profile={profile}
          email={session.user.email ?? ''}
          syncStatus={status}
          onSync={syncNow}
          onEdit={() => router.push('/(main)/profile-edit')}
        />
      ) : (
        <SignedOutCard configured={isConfigured} onPress={() => router.push('/(main)/account')} />
      )}

      <SectionHeader title="Tu diario" className="mt-7" />
      <View className="mt-3 gap-2.5">
        <Row
          icon="calendar-outline"
          label="Visitas"
          onPress={() => router.push('/(main)/visits')}
        />
        <Row
          icon="pricetag-outline"
          label="Etiquetas"
          onPress={() => router.push('/(main)/tags')}
        />
        <Row icon="map-outline" label="Mapa" onPress={() => router.push('/(main)/map')} />
      </View>

      <SectionHeader title="Personas" className="mt-7" />
      <View className="mt-3 gap-2.5">
        <Row
          icon="people-outline"
          label="Amigos"
          badge={incoming.length || undefined}
          onPress={() => router.push('/(main)/friends')}
        />
        <Row
          icon="person-add-outline"
          label="Buscar personas"
          onPress={() => router.push('/(main)/friends/search')}
        />
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
  email,
  syncStatus,
  onSync,
  onEdit,
}: {
  profile: Profile | null;
  email: string;
  syncStatus: string;
  onSync: () => void;
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  const name = profile?.displayName ?? profile?.username ?? email.split('@')[0] ?? 'Tú';

  return (
    <Card className="mt-4 gap-3.5">
      <View className="flex-row items-center gap-3">
        <Avatar name={name} uri={profile?.avatarUrl} size={54} />
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

      <View className="flex-row items-center justify-between border-t border-line pt-3">
        <View className="flex-row items-center gap-2">
          <Ionicons
            name={syncStatus === 'error' ? 'alert-circle-outline' : 'cloud-done-outline'}
            size={16}
            color={syncStatus === 'error' ? colors.danger : colors.sage}
          />
          <Text className="text-[13px] text-ink-muted">{SYNC_LABEL[syncStatus] ?? syncStatus}</Text>
        </View>
        <Button label="Sincronizar" variant="ghost" size="sm" onPress={onSync} />
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
