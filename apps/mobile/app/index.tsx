import { Redirect, useRouter } from 'expo-router';

import { Onboarding } from '@/features/onboarding/Onboarding';
import { useFirstRun } from '@/features/onboarding/useFirstRun';

/**
 * The app is local-first: there is no login gate. Accounts become an opt-in
 * layer on top (see docs/04-auth.md), never an entry barrier.
 *
 * This pointed at `/restaurants` until the tabs were restructured, which left
 * the app opening on "página no encontrada" — the route had become a segment of
 * Diario rather than a screen. Landing on the tab group instead of a specific
 * route means a future reshuffle cannot break the entry point the same way.
 *
 * El onboarding entra **solo en la primera ejecución** y no cambia nada de lo
 * anterior: quien ya usaba la app sigue cayendo directo en las pestañas, y
 * quien la abre por primera vez pasa por dos pantallas. El razonamiento de cada
 * una está en `WelcomeScreen` y `PermissionsScreen`.
 */
export default function Index() {
  const router = useRouter();
  const { firstRun, markSeen } = useFirstRun();

  // Mientras se lee la marca no se pinta nada: un fotograma de bienvenida en
  // cada arranque sería peor que un instante en blanco.
  if (firstRun === null) return null;
  if (!firstRun) return <Redirect href="/(main)/(tabs)" />;

  return (
    <Onboarding
      onDone={({ account }) => {
        // Marcar primero: si la persona vuelve atrás desde la pantalla de
        // cuenta sin registrarse, ha entrado igual y el onboarding ya cumplió.
        void markSeen();
        if (!account) return;

        /*
         * El diario debajo, y la cuenta encima.
         *
         * Con un `push` a secas, la pantalla de cuenta quedaba sobre el
         * onboarding —que ya no existe— así que no había ni «atrás» hacia
         * ningún sitio ni forma de llegar al diario: se entraba, empezaba a
         * sincronizar, y ahí se acababa el camino. Es lo que se vivía como «no
         * hay opción para entrar directo al Inicio».
         *
         * Con `replace` primero, detrás de la pantalla de cuenta ya está el
         * diario. `?welcome=1` es lo que hace que además lo diga con un botón,
         * porque un gesto de volver atrás no se le ocurre a nadie en una
         * pantalla a la que acaba de llegar.
         */
        router.replace('/(main)/(tabs)');
        router.push('/(main)/account?welcome=1');
      }}
    />
  );
}
