import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { gradientFor } from '@/lib/design/tokens';

/**
 * A person's picture, or their initials on a colour derived from their name —
 * so the same person is always the same colour, across the feed, their profile
 * and a participant list.
 *
 * `pending` es lo que evita el desfile de avatares: mientras no se sabe si hay
 * foto, se dibuja el disco y nada más. Sin él, una pantalla que carga el perfil
 * enseña iniciales durante medio segundo y las cambia por la foto, que es un
 * parpadeo en el sitio donde más se nota — y con el nombre llegando también por
 * la red, hasta el color del disco cambiaba por el camino.
 */
export function Avatar({
  name,
  uri,
  size = 38,
  pending = false,
  className = '',
}: {
  name: string;
  uri?: string | null | undefined;
  size?: number;
  /** Todavía no se sabe si esta persona tiene foto. */
  pending?: boolean;
  className?: string;
}) {
  const initials = getInitials(name);
  const [background] = gradientFor(name || initials);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: background }}
      className={`items-center justify-center overflow-hidden ${className}`}
    >
      {uri ? (
        <Image
          source={uri}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={uri}
          // Sin fundido: la foto sustituye al disco del mismo tamaño y en el
          // mismo sitio, así que animarlo solo añade un parpadeo más.
          transition={0}
        />
      ) : pending ? null : (
        <Text
          className="font-bold text-white"
          style={{ fontSize: Math.round(size * 0.4) }}
          allowFontScaling={false}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

/** "Mateo Álvarez" → "MA"; a single word gives one letter. */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0] as string).charAt(0).toUpperCase();
  return (
    (words[0] as string).charAt(0) + (words[words.length - 1] as string).charAt(0)
  ).toUpperCase();
}
