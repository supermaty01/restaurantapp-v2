/**
 * "Something changed locally."
 *
 * Sync used to run on login and when the app came back to the foreground, and
 * that was it. Writing an entry and staying in the app left it on the device
 * indefinitely — which for a diary that is also a backup is the one thing it
 * must not do, and for tagging meant the person you tagged did not hear about
 * it until you happened to background the app.
 *
 * A signal rather than a call: `recordChange` runs inside repositories, which
 * have no account, no network and no business deciding when to talk to a
 * server. It says what happened; `useSync` decides what to do about it.
 *
 * No React, no database imports — this is loaded by every write path.
 */
const listeners = new Set<() => void>();

export function subscribeToLocalChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called after every local write that enters the outbox. */
export function notifyLocalChange(): void {
  for (const listener of listeners) listener();
}
