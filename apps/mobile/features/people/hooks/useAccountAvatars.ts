import { useMemo } from 'react';

import { useFriends } from '@/features/social/hooks/useFriends';

/**
 * La cara de cada cuenta que se puede etiquetar, por su uuid.
 *
 * Existe porque una etiqueta guarda un nombre y, como mucho, el uuid de la
 * cuenta (`PersonTag`): la foto no viaja con ella, y no debe — es un dato de la
 * otra persona que cambia cuando le apetece, y una copia en el diario sería una
 * foto vieja para siempre.
 *
 * Lo que se veía sin esto: etiquetar a alguien que sí tiene cuenta se dibujaba
 * exactamente igual que escribir su nombre a mano. Dos iniciales sobre un color,
 * en los dos casos, así que no había forma de saber si la etiqueta iba a llegarle
 * a alguien o se quedaba en una nota.
 *
 * Solo mira la lista de amistades, y con eso basta: solo se puede etiquetar a un
 * amigo (ver `PeopleTagInput`). Alguien a quien etiquetaste y ya no lo es cae a
 * las iniciales, que es lo correcto — su foto ya no es cosa nuestra.
 */
export function useAccountAvatars(): (accountUuid: string | null | undefined) => string | null {
  const { friends } = useFriends();

  const byAccount = useMemo(() => {
    const map = new Map<string, string>();
    for (const friend of friends) {
      if (friend.avatarUrl) map.set(friend.userId, friend.avatarUrl);
    }
    return map;
  }, [friends]);

  return useMemo(
    () => (accountUuid) => (accountUuid ? (byAccount.get(accountUuid) ?? null) : null),
    [byAccount],
  );
}
