import { useMemo } from 'react';

import { useFriends } from '@/features/social/hooks/useFriends';
import { useMyProfile } from '@/features/social/myProfile';

/**
 * La foto de las personas etiquetadas que sí tienen cuenta.
 *
 * Una etiqueta se dibujaba siempre con iniciales, incluso apuntando a una cuenta
 * con foto: en una lista de tres personas donde dos son amigas con foto y una es
 * un nombre escrito a mano, las tres se veían igual. La cara es lo que distingue
 * «etiqueté a Caro» de «escribí Caro».
 *
 * Sale de la lista de amistades, que es la única fuente que la app tiene y
 * además la correcta: solo se puede etiquetar a una cuenta eligiéndola de esa
 * lista (features/people/components/PeopleTagInput.tsx), así que quien tiene
 * cuenta en una etiqueta está aquí. La propia cuenta se añade porque uno mismo
 * aparece en las visitas ajenas donde le etiquetaron, y no es amigo de sí mismo.
 *
 * La foto no se guarda en la fila local a propósito: cambia cuando su dueño
 * quiere, y una copia en el diario sería una cara desactualizada para siempre.
 */
export function useAccountAvatars(): (accountUuid: string | null | undefined) => string | null {
  const { friends } = useFriends();
  const { profile } = useMyProfile();

  const byAccount = useMemo(() => {
    const map = new Map<string, string>();
    for (const friend of friends) {
      if (friend.avatarUrl) map.set(friend.userId, friend.avatarUrl);
    }
    if (profile?.avatarUrl) map.set(profile.userId, profile.avatarUrl);
    return map;
  }, [friends, profile]);

  return useMemo(
    () => (accountUuid) => (accountUuid ? (byAccount.get(accountUuid) ?? null) : null),
    [byAccount],
  );
}
