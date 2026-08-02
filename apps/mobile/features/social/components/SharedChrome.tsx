import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import type { SharedAuthor } from '../api';

/**
 * Lo que llevan igual las tres pantallas de contenido ajeno: la visita, el
 * plato y el sitio.
 *
 * Estaba escrito una vez, en el detalle de la visita, y al añadir las otras dos
 * iba a estar escrito tres. Son la barra de volver —que además **dice qué es
 * esto**, porque una pantalla de solo lectura que se parece a las tuyas invita
 * a tocar cosas que no existen— y la fila de quién lo publicó.
 */

/** La barra superior: volver, y de qué se está mirando. */
export function SharedBackBar({ label }: { label: string }) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View className="flex-row items-center gap-3">
      <PressableScale
        accessibilityLabel="Volver"
        onPress={() => router.back()}
        scaleTo={0.9}
        className="h-9 w-9 items-center justify-center rounded-pill bg-sunken"
      >
        <Ionicons name="chevron-back" size={19} color={colors.ink} />
      </PressableScale>
      <Txt variant="caption" tone="subtle" className="flex-1">
        {label}
      </Txt>
    </View>
  );
}

/** Quién lo publicó, y el atajo a su perfil. */
export function SharedAuthorRow({ author }: { author: SharedAuthor }) {
  const router = useRouter();
  const { colors } = useTheme();
  const name = author.displayName ?? author.username;

  return (
    <PressableScale
      accessibilityLabel={`Ver el perfil de ${name}`}
      onPress={() =>
        router.push({ pathname: '/(main)/friends/[id]', params: { id: author.userId } })
      }
      scaleTo={0.985}
      className="flex-row items-center gap-3 rounded-xl border border-line bg-surface p-3"
    >
      <Avatar name={name} uri={author.avatarUrl} size={38} />
      <View className="flex-1">
        <Txt variant="body" weight="semi" serif={false} numberOfLines={1}>
          {name}
        </Txt>
        <Txt variant="caption" tone="subtle">
          @{author.username}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
    </PressableScale>
  );
}
