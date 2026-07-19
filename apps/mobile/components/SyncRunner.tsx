import { useSync } from '@/lib/hooks/useSync';

/**
 * Headless: mounts the sync loop for the whole app. Rendered inside the auth +
 * database providers. Renders nothing.
 */
export function SyncRunner() {
  useSync();
  return null;
}
