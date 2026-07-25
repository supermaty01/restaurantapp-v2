import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export const VISIBILITIES = ['private', 'friends', 'public'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

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
export const FALLBACK_VISIBILITY: Visibility = 'private';

export const ENTITY_LABEL: Record<ShareableEntity, string> = {
  restaurant: 'Lugares',
  dish: 'Platos',
  visit: 'Visitas',
};
