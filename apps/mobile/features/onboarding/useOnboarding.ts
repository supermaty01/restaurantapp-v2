import { useCallback, useEffect, useState } from 'react';

import { getSetting, setSetting } from '@/services/db/settings-repository';
import type { AppDatabase } from '@/services/db/types';

/**
 * Si esta instalación ya ha visto la bienvenida.
 *
 * Una sola marca en `app_settings`, no una versión ni un contador: la
 * bienvenida contesta una pregunta que solo se hace una vez —«¿qué es esto y
 * tengo que registrarme?»— y volver a enseñarla porque haya cambiado el texto
 * sería castigar a quien ya está dentro.
 *
 * Va en la base local y no en la nube a propósito: la pregunta es del
 * dispositivo. Entrar en una cuenta ya usada desde un móvil nuevo sigue
 * mereciendo la explicación de que el diario vive aquí.
 */
const SEEN_KEY = 'onboardingSeen';

export type OnboardingState = 'unknown' | 'pending' | 'done';

export function useOnboarding(db: AppDatabase) {
  const [state, setState] = useState<OnboardingState>('unknown');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const seen = await getSetting(db, SEEN_KEY);
        if (!cancelled) setState(seen === 'true' ? 'done' : 'pending');
      } catch {
        // Si no se puede leer, se da por vista. Una bienvenida que no se pudo
        // consultar no puede convertirse en una puerta cerrada delante del
        // diario: el peor caso de saltársela es no explicar algo, y el de
        // quedarse esperando es una app que no abre.
        if (!cancelled) setState('done');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db]);

  const complete = useCallback(async () => {
    setState('done');
    try {
      await setSetting(db, SEEN_KEY, 'true');
    } catch {
      // Se volverá a ver la próxima vez. Molesto, no roto.
    }
  }, [db]);

  return { state, complete };
}
