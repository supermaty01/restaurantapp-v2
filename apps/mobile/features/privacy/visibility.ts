import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

/**
 * What an entry can say about who sees it.
 *
 * `default` is a real stored value, not a placeholder that gets replaced on
 * save. It means "whatever my general setting says, now and later" — so
 * changing the general setting moves everything still on `default`, which is
 * the only way a setting called *default* can behave without lying. The other
 * three are deliberate overrides and never move.
 *
 * The distinction only exists because the alternative was tried first: copying
 * the setting at creation time made the setting a one-off suggestion, and left
 * every entry imported from v1 pinned to whatever it happened to get.
 */
export const VISIBILITIES = ['default', 'private', 'friends', 'public'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** The three an entry can be pinned to; `default` defers instead of deciding. */
export const EXPLICIT_VISIBILITIES = ['private', 'friends', 'public'] as const;
export type ExplicitVisibility = (typeof EXPLICIT_VISIBILITIES)[number];

export function isExplicit(value: Visibility): value is ExplicitVisibility {
  return value !== 'default';
}

export type ShareableEntity = 'restaurant' | 'dish' | 'visit';

export function isVisibility(value: string): value is Visibility {
  return (VISIBILITIES as readonly string[]).includes(value);
}

interface VisibilityMeta {
  label: string;
  /** What it means, in terms of who sees it — not in terms of the setting. */
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}

export const VISIBILITY_META: Record<Visibility, VisibilityMeta> = {
  default: {
    label: 'Como mis ajustes',
    description: 'Sigue tu configuración general, también si la cambias',
    icon: 'options-outline',
  },
  private: {
    label: 'Solo yo',
    description: 'No sale de tu diario',
    icon: 'lock-closed-outline',
  },
  friends: {
    label: 'Mis amigos',
    description: 'Aparece en el feed de quienes te siguen',
    icon: 'people-outline',
  },
  public: {
    label: 'Cualquiera',
    description: 'Visible también para quien no es tu amigo',
    icon: 'globe-outline',
  },
};

/** `app_settings` key holding the default for one kind of entry. */
export function defaultVisibilityKey(entity: ShareableEntity): string {
  return `defaultVisibility_${entity}`;
}

/**
 * What a new entry gets when you have not said otherwise.
 *
 * Private across the board. A diary that starts by sharing is a diary that
 * shares something you did not mean to share once, and there is no taking it
 * back — the default has to be the one whose mistake is recoverable.
 */
export const FALLBACK_VISIBILITY: ExplicitVisibility = 'private';

/**
 * What a new entry is stored as.
 *
 * `default`, not a copy of the current setting: an entry that defers keeps
 * deferring. Only touching the control on that specific entry pins it.
 */
export const NEW_ENTRY_VISIBILITY: Visibility = 'default';

/** What `stored` actually means, given the general settings. */
export function resolveVisibility(
  stored: Visibility,
  defaults: Record<ShareableEntity, ExplicitVisibility>,
  entity: ShareableEntity,
): ExplicitVisibility {
  return stored === 'default' ? defaults[entity] : stored;
}

export const ENTITY_LABEL: Record<ShareableEntity, string> = {
  restaurant: 'Lugares',
  dish: 'Platos',
  visit: 'Visitas',
};
