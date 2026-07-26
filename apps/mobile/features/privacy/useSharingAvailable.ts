import { useAuth } from '@/lib/context/AuthContext';

/**
 * Whether «quién lo ve» is a question with more than one answer.
 *
 * Without an account nothing leaves the device, so every entry is private and
 * the only setting available says so. Offering the control anyway is worse than
 * useless: it implies there is something to decide, and a privacy control that
 * does not change anything is exactly the kind that teaches people to stop
 * reading privacy controls.
 *
 * Two ways to be offline, and both count. `isConfigured` false means this build
 * has no cloud at all — a purely local install, which is a supported way to run
 * the app and not a misconfiguration. `session` null means the cloud exists but
 * nobody has signed in yet.
 *
 * What is *stored* does not change: entries are written as `default` either
 * way, so signing in later applies the settings retroactively to everything
 * already written, without a migration and without asking.
 */
export function useSharingAvailable(): boolean {
  const { session, isConfigured } = useAuth();
  return isConfigured && Boolean(session);
}
