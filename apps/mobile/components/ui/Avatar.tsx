import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';
import { gradientFor } from '@/lib/design/tokens';

/**
 * A person's picture, or their initials on a colour derived from their name —
 * so the same person is always the same colour, across the feed, their profile
 * and a participant list.
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
  /**
   * Todavía no se sabe de quién es.
   *
   * Un hueco liso en vez de unas iniciales provisionales. Sin esto, el avatar de
   * Inicio enseñaba las iniciales del correo mientras llegaba el perfil y las
   * cambiaba por la foto un instante después: dos caras distintas para la misma
   * persona en menos de un segundo, que se lee como un fallo de pintado.
   */
  pending?: boolean;
  className?: string;
}) {
  const { colors } = useTheme();
  const initials = getInitials(name);
  const [background] = gradientFor(name || initials);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={pending ? 'Cargando' : name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: pending && !uri ? colors.sunken : background,
      }}
      className={`items-center justify-center overflow-hidden ${className}`}
    >
      {pending && !uri ? null : uri ? (
        <Image
          source={uri}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={uri}
        />
      ) : (
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
