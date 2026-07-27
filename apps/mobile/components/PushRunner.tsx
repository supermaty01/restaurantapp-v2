import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/context/AuthContext';
import {
  actorFromNotification,
  registerPushIfAllowed,
  visitFromNotification,
} from '@/services/push/push';

/**
 * El push, sin pintar nada.
 *
 * Dos trabajos que tienen que existir una sola vez en toda la app, y por eso no
 * viven en un hook: registrar el token cuando hay sesión, y abrir la visita
 * cuando alguien toca un aviso. Un `router.push` dentro de un hook montado en
 * dos pantallas abre la misma visita dos veces — ya pasó con la pantalla de dos
 * diarios (`SyncRunner`).
 */
export function PushRunner() {
  const { accountUuid } = useAuth();
  const router = useRouter();

  /*
   * El token se vuelve a registrar en cada arranque con sesión.
   *
   * No es redundante: cambia al reinstalar, al restaurar una copia del móvil y
   * a veces por su cuenta, y un token viejo no da error — entrega a nadie, que
   * es el fallo más difícil de ver. La RPC es idempotente, así que repetirlo no
   * cuesta nada.
   *
   * Sin permiso no hace nada y **no lo pide**: eso pasa después de etiquetar a
   * alguien, que es cuando el aviso ya significa algo (docs/15).
   */
  useEffect(() => {
    if (!accountUuid) return;
    void registerPushIfAllowed();
  }, [accountUuid]);

  /*
   * Tocar el aviso abre la comida de la que habla.
   *
   * `getLastNotificationResponseAsync` además del listener, porque los dos
   * casos son distintos y solo uno lo cubre el listener: si la app estaba
   * cerrada, el toque es lo que la ha abierto y el evento ya había pasado antes
   * de que existiera nada a lo que escuchar. Sin esto, abrir desde una
   * notificación con la app cerrada te deja en la pantalla de inicio, que es
   * indistinguible de que el aviso no llevara a ningún sitio.
   */
  useEffect(() => {
    let cancelled = false;

    const open = (data: unknown) => {
      if (cancelled) return;

      const visit = visitFromNotification(data);
      if (visit) {
        router.push({ pathname: '/(main)/shared/[visit]', params: { visit } });
        return;
      }

      // Las clases que no ocurren en una comida —solicitud, aceptación, un
      // amigo que ha publicado— abren el perfil de quien las provocó. Es el
      // mismo destino que en Novedades, y a propósito: el aviso y su fila de la
      // lista tienen que llevar al mismo sitio.
      const actor = actorFromNotification(data);
      if (actor) {
        router.push({ pathname: '/(main)/friends/[id]', params: { id: actor } });
      }
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) open(response.notification.request.content.data);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      open(response.notification.request.content.data);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [router]);

  return null;
}
