import { Redirect } from 'expo-router';

import { useOnboarding } from '@/features/onboarding/useOnboarding';
import { useDatabase } from '@/lib/hooks/useDatabase';

/**
 * The app is local-first: there is no login gate. Accounts become an opt-in
 * layer on top (see docs/04-auth.md), never an entry barrier.
 *
 * This pointed at `/restaurants` until the tabs were restructured, which left
 * the app opening on "página no encontrada" — the route had become a segment of
 * Diario rather than a screen. Landing on the tab group instead of a specific
 * route means a future reshuffle cannot break the entry point the same way.
 *
 * La única desviación es la bienvenida, y solo la primera vez. Mientras no se
 * sabe si toca, no se pinta nada: son unos milisegundos de lectura en SQLite, y
 * enseñar el diario para taparlo medio segundo después con una bienvenida es
 * peor que esperar. Si la lectura falla, se entra al diario — una bienvenida que
 * no se pudo consultar no puede convertirse en una puerta cerrada.
 */
export default function Index() {
  const db = useDatabase();
  const { state } = useOnboarding(db);

  if (state === 'unknown') return null;
  if (state === 'pending') return <Redirect href="/(main)/welcome" />;
  return <Redirect href="/(main)/(tabs)" />;
}
