import { FALLBACK_VISIBILITY, type ShareableEntity, type Visibility } from './visibility';

/**
 * The default visibilities, held in memory and shared by everything.
 *
 * Deliberately free of React and of the database: the sync push reads this from
 * a plain function, and pulling it out of the hook module means `tables.ts`
 * no longer drags expo-sqlite into a node test that has no business loading it.
 *
 * Module level rather than per-component state, because the same preference is
 * on screen in more than one place at once — the settings row and the sheet
 * that edits it. With separate copies, changing it in the sheet left the row
 * showing the old value, which reads as "the setting did not save".
 *
 * Persistence belongs to `useDefaultVisibility`, which reads it in at mount and
 * writes it back on change. This is the cache the UI renders from.
 */
type Defaults = Record<ShareableEntity, Visibility>;

function blank(): Defaults {
  return {
    restaurant: FALLBACK_VISIBILITY,
    dish: FALLBACK_VISIBILITY,
    visit: FALLBACK_VISIBILITY,
  };
}

let defaults: Defaults = blank();
const listeners = new Set<() => void>();

/** Entities already read from disk, so each is loaded once per launch. */
const loaded = new Set<ShareableEntity>();

export function subscribeToDefaults(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDefaults(): Defaults {
  return defaults;
}

/**
 * The current default for one kind, outside React.
 *
 * The sync push needs it to fill in rows written before the setting existed,
 * and it runs from a plain function rather than a component.
 */
export function getDefaultVisibility(entity: ShareableEntity): Visibility {
  return defaults[entity];
}

export function setDefaults(next: Defaults): void {
  defaults = next;
  for (const listener of listeners) listener();
}

export function markLoaded(entity: ShareableEntity): void {
  loaded.add(entity);
}

export function unmarkLoaded(entity: ShareableEntity): void {
  loaded.delete(entity);
}

export function isLoaded(entity: ShareableEntity): boolean {
  return loaded.has(entity);
}

/** Test-only: forgets everything between cases. */
export function resetDefaultVisibility(): void {
  loaded.clear();
  setDefaults(blank());
}
