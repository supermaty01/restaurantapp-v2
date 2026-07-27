import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useSync } from '@/lib/hooks/useSync';

/**
 * Headless: mounts the sync loop for the whole app. Rendered inside the auth +
 * database providers. Renders nothing.
 *
 * También es quien manda a elegir cuando hay dos diarios. Va aquí y no en
 * `useSync` porque ese hook se monta en dos sitios y abriría la pantalla dos
 * veces; este componente existe una sola vez.
 */
export function SyncRunner() {
  const { needsChoice } = useSync();
  const router = useRouter();

  useEffect(() => {
    if (needsChoice) router.push('/(main)/sync-choice');
  }, [needsChoice, router]);

  return null;
}
