import { useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/Dialog';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, SectionHeader } from '@/components/ui/Surface';
import type { UserSummary } from '@/features/social/api';
import { UserRow } from '@/features/social/components/UserRow';
import { cancelRequestDialog, removeFriendDialog } from '@/features/social/confirmations';
import { useFriends } from '@/features/social/hooks/useFriends';
import { useTheme } from '@/lib/context/ThemeContext';

export default function FriendsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { ask } = useDialog();
  const { friends, incoming, outgoing, loading, error, reload, enabled, accept, decline, remove } =
    useFriends();

  const openProfile = (userId: string) => router.push(`/(main)/friends/${userId}`);

  /*
   * "Quitar" está a un dedo de "Aceptar" y de abrir el perfil, y no se deshace
   * solo: volver a ser amigos exige una solicitud nueva y que la acepte la otra
   * persona. La pregunta lleva el nombre de quien se va, que es lo que evita
   * confirmar a la persona equivocada.
   */
  const confirmRemove = (users: UserSummary[], cancelling: boolean) => async (userId: string) => {
    const user = users.find((candidate) => candidate.userId === userId);
    const name = user?.displayName ?? user?.username ?? 'esta persona';
    const confirmed = await ask(cancelling ? cancelRequestDialog(name) : removeFriendDialog(name));
    if (confirmed) await remove(userId);
  };

  if (!enabled) {
    return (
      <Screen>
        <EmptyState
          icon="person-circle-outline"
          title="Inicia sesión para tener amigos"
          message="Los amigos y el feed viven en tu cuenta; tu diario sigue guardándose en el móvil."
          action={<Button label="Iniciar sesión" onPress={() => router.push('/(main)/account')} />}
        />
      </Screen>
    );
  }

  if (loading && friends.length === 0 && incoming.length === 0) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  const nothingAtAll = friends.length + incoming.length + outgoing.length === 0;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="px-5 pb-8"
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />
      }
    >
      <Button
        label="Buscar personas"
        icon="search"
        block
        onPress={() => router.push('/(main)/friends/search')}
        className="mt-2"
      />

      {error ? (
        <View className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <Text className="text-[13px] text-danger">{error}</Text>
        </View>
      ) : null}

      {nothingAtAll ? (
        <EmptyState
          icon="people-outline"
          title="Aún no tienes amigos aquí"
          message="Busca a alguien por su nombre de usuario para empezar."
          className="mt-6"
        />
      ) : null}

      <Group
        title="Solicitudes recibidas"
        users={incoming}
        onAccept={accept}
        onDecline={decline}
        onOpen={openProfile}
      />
      <Group
        title="Amigos"
        users={friends}
        onRemove={(id) => void confirmRemove(friends, false)(id)}
        onOpen={openProfile}
      />
      <Group
        title="Solicitudes enviadas"
        users={outgoing}
        onRemove={(id) => void confirmRemove(outgoing, true)(id)}
        onOpen={openProfile}
      />
    </ScrollView>
  );
}

function Group({
  title,
  users,
  onAccept,
  onDecline,
  onRemove,
  onOpen,
}: {
  title: string;
  users: UserSummary[];
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRemove?: (id: string) => void;
  onOpen?: (id: string) => void;
}) {
  if (users.length === 0) return null;

  return (
    <View className="mt-6">
      <SectionHeader title={`${title} (${users.length})`} />
      <View className="mt-3 gap-2.5">
        {users.map((user) => (
          <UserRow
            key={user.userId}
            user={user}
            {...(onAccept ? { onAccept } : {})}
            {...(onDecline ? { onDecline } : {})}
            {...(onRemove ? { onRemove } : {})}
            {...(onOpen ? { onPress: onOpen } : {})}
          />
        ))}
      </View>
    </View>
  );
}
