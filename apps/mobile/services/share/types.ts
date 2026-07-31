/**
 * Types for the share file format (.restoshare)
 * These types define the structure of data that can be shared between users
 */

// Type of entity being shared
export type ShareEntityType = 'restaurant' | 'dish' | 'visit';

// Tag data (without IDs since they need to be matched/created on import)
export interface ShareableTag {
  name: string;
  color: string;
}

// Image as base64 (since we can't share file paths)
export interface ShareableImage {
  base64: string;
  filename: string;
}

// Restaurant data for sharing
export interface ShareableRestaurant {
  name: string;
  latitude: number | null;
  longitude: number | null;
  comments: string | null;
  rating: number | null;
  tags: ShareableTag[];
  images: ShareableImage[];
}

// Dish data for sharing
export interface ShareableDish {
  name: string;
  price: number | null;
  /**
   * En qué moneda está el precio.
   *
   * Opcional porque los ficheros escritos antes de que la moneda existiera no
   * la traen: al importarlos se deduce del propio número, igual que hizo la
   * migración (`guessLegacyCurrency`). Un precio sin unidad en un fichero que
   * cruza de un móvil a otro es un número que el que lo recibe no puede leer.
   */
  currency?: string | null;
  rating: number | null;
  comments: string | null;
  tags: ShareableTag[];
  images: ShareableImage[];
}

// Visit data for sharing
export interface ShareableVisit {
  visitedAt: string;
  comments: string | null;
  images: ShareableImage[];
}

// Complete share file structure
export interface ShareFileData {
  version: number;
  type: ShareEntityType;
  createdAt: string;

  // Main entity data (only one will be present based on type)
  restaurant?: ShareableRestaurant | undefined;
  dish?: ShareableDish | undefined;
  visit?: ShareableVisit | undefined;

  // For dish: includes the restaurant
  // For visit: includes the restaurant and all dishes associated
  includedRestaurant?: ShareableRestaurant | undefined;
  includedDishes?: ShareableDish[] | undefined;
}

// Conflict detection result
export interface ConflictResult {
  hasConflict: boolean;
  existingEntity?:
    | {
        id: number;
        name: string;
      }
    | undefined;
  incomingName: string;
}

// Import options when conflict is found
export type ConflictResolution =
  { type: 'use_existing'; existingId: number } | { type: 'create_new' };

// Import result
export interface ImportResult {
  success: boolean;
  entityType: ShareEntityType;
  entityId?: number | undefined;
  entityName?: string | undefined;
  error?: string | undefined;
}

// File extension and MIME type
export const SHARE_FILE_EXTENSION = '.restoshare';
export const SHARE_FILE_MIME_TYPE = 'application/x-restoshare';
export const CURRENT_SHARE_VERSION = 1;
