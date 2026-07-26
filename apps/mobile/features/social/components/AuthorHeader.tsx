import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';

import type { ReactNode } from 'react';

/**
 * La foto y el nombre de quien escribió algo, y llevan a su perfil.
 *
 * Tocar a alguien para ver quién es no es una función que haya que buscar en un
 * menú: es lo primero que se intenta, en esta app y en cualquier otra, y hasta
 * ahora no pasaba nada. Peor que nada, en realidad — la pulsación la recogía la
 * tarjeta entera y te llevaba a la comida, así que parecía que el toque había
 * ido a parar al sitio equivocado.
 *
 * Un `Pressable` dentro del de la tarjeta, y no un tercer botón a un lado: en
 * React Native el más profundo se queda con el gesto, así que la cabecera abre
 * el perfil y todo lo demás sigue abriendo la entrada. Sin esto habría que
 * partir la tarjeta en dos zonas pulsables y perder que se hunda entera al
 * tocarla.
 *
 * Vive aparte porque son tres sitios con la misma cabecera —el feed, "Contigo"
 * y Novedades— y la primera versión de esto se hizo en uno solo. Un componente
 * es lo que impide que el siguiente se olvide.
 */
export function AuthorHeader({
  userId,
  name,
  avatarUrl,
  size = 34,
  trailing,
  children,
}: {
  /** A quién se abre. Nulo para un aviso del sistema, que no tiene perfil. */
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  size?: number;
  /** El icono de la esquina, fuera de la zona que abre el perfil. */
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();

  const openProfile = () => {
    if (!userId) return;
    router.push({ pathname: '/(main)/friends/[id]', params: { id: userId } });
  };

  return (
    <View className="flex-row items-center gap-2.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver el perfil de ${name}`}
        disabled={!userId}
        onPress={openProfile}
        // Generoso a propósito: el objetivo real es una foto de 34 píxeles y una
        // línea de texto, que es menos de lo que un dedo acierta con soltura.
        hitSlop={6}
        className="min-w-0 flex-1 flex-row items-center gap-2.5"
      >
        <Avatar name={name} uri={avatarUrl} size={size} />
        <View className="min-w-0 flex-1">{children}</View>
      </Pressable>

      {trailing}
    </View>
  );
}
