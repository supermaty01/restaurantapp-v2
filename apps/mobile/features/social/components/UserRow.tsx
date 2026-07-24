import { Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, Chip } from '@/components/ui/Surface';

import type { UserSummary } from '../api';

/**
 * One person in a list, with the action that makes sense for the current
 * relationship — an incoming request needs two buttons, an existing friend
 * needs none.
 */
export function UserRow({
  user,
  onAdd,
  onAccept,
  onDecline,
  onRemove,
  onPress,
  busy = false,
}: {
  user: UserSummary;
  onAdd?: (id: string) => void;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRemove?: (id: string) => void;
  onPress?: (id: string) => void;
  busy?: boolean;
}) {
  const name = user.displayName ?? user.username;

  return (
    <Card
      onPress={onPress ? () => onPress(user.userId) : undefined}
      className="flex-row items-center gap-3"
    >
      <Avatar name={name} uri={user.avatarUrl} size={44} />

      <View className="flex-1">
        <Text className="font-bold text-[15px] text-ink" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-[12px] text-ink-subtle" numberOfLines={1}>
          @{user.username}
        </Text>
      </View>

      {user.state === 'request_received' && onAccept && onDecline ? (
        <View className="flex-row gap-2">
          <Button
            label="Rechazar"
            variant="secondary"
            size="sm"
            disabled={busy}
            onPress={() => onDecline(user.userId)}
          />
          <Button label="Aceptar" size="sm" disabled={busy} onPress={() => onAccept(user.userId)} />
        </View>
      ) : user.state === 'request_sent' ? (
        <Chip label="Pendiente" tone="accent" />
      ) : user.state === 'friends' ? (
        onRemove ? (
          <Button
            label="Quitar"
            variant="ghost"
            size="sm"
            disabled={busy}
            onPress={() => onRemove(user.userId)}
          />
        ) : (
          <Chip label="Amigos" tone="sage" />
        )
      ) : user.state === 'none' && onAdd ? (
        <Button
          label="Añadir"
          icon="person-add-outline"
          size="sm"
          disabled={busy}
          onPress={() => onAdd(user.userId)}
        />
      ) : null}
    </Card>
  );
}
