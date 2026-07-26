import { useCallback } from 'react';

import { useDialog } from '@/components/ui/Dialog';
import type { PersonTag } from '@/features/people/repositories/peopleRepository';
import { useAuth } from '@/lib/context/AuthContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { getSetting, setSetting } from '@/services/db/settings-repository';

import { pushPermissionGranted, registerPushIfAllowed, requestPushPermission } from './push';

/** Que ya se preguntó una vez. La respuesta la guarda el sistema, no nosotros. */
const ASKED_KEY = 'pushPromptAsked';

/**
 * Pedir el permiso de avisos en el único momento en que se entiende.
 *
 * Justo después de etiquetar a alguien por primera vez: ahí acabas de crear el
 * motivo por el que existiría un aviso, y la pregunta se contesta sola. Al
 * arrancar la app no —la respuesta rápida es "no", y en Android 13+ un no cierra
 * la puerta hasta que alguien vaya a los ajustes del sistema, así que la primera
 * pregunta es también la última.
 *
 * Por eso hay **dos** preguntas y no una: primero la nuestra, que se puede
 * volver a hacer, y solo si dice que sí la del sistema, que no. Rechazar la
 * nuestra no gasta el único intento que da Android.
 *
 * Y se pregunta una sola vez en la vida de la instalación, dijera lo que
 * dijera. Insistir cada vez que etiquetas a alguien convierte una buena
 * pregunta en una mala.
 */
export function usePushPrompt() {
  const db = useDatabase();
  const { accountUuid } = useAuth();
  const { ask } = useDialog();

  return useCallback(
    async (participants: PersonTag[]): Promise<void> => {
      // Sin cuenta no hay a quién registrar el token, y una etiqueta a alguien
      // que no usa la app no llega a ninguna parte: no hay nada que avisar.
      if (!accountUuid) return;
      if (!participants.some((tag) => tag.accountUuid)) return;

      try {
        // Si ya está concedido, no hay nada que preguntar — pero sí que
        // registrar: puede venir de una instalación anterior en la que se
        // concedió y el token no llegó a guardarse.
        if (await pushPermissionGranted()) {
          await registerPushIfAllowed();
          return;
        }

        if ((await getSetting(db, ASKED_KEY)) === 'true') return;
        // Antes de preguntar, no después: si la app se cierra a mitad del
        // diálogo, la pregunta se ha hecho igual y repetirla sería peor que
        // perderla.
        await setSetting(db, ASKED_KEY, 'true');

        const wants = await ask({
          title: '¿Te avisamos?',
          message:
            'Acabas de etiquetar a alguien. Podemos avisarte cuando alguien te etiquete a ti, ' +
            'aunque no tengas la app abierta. Sin esto seguirás viéndolo en Novedades.',
          icon: 'notifications-outline',
          confirmLabel: 'Sí, avísame',
          cancelLabel: 'Ahora no',
        });

        if (!wants) return;
        await requestPushPermission();
      } catch {
        // Quedarse sin push no es una avería: la campana y Novedades siguen
        // enteras. Un error aquí no puede estropear el guardado de una visita,
        // que es lo que la persona vino a hacer.
      }
    },
    [db, accountUuid, ask],
  );
}
