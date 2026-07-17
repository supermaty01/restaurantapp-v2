/**
 * Import service for handling shared files
 */

import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';

import { IMAGES_DIR } from '@/lib/helpers/fs-paths';
import * as schema from '@/services/db/schema';

import { CURRENT_SHARE_VERSION } from './types';

import type {
  ShareFileData,
  ShareableRestaurant,
  ShareableDish,
  ShareableImage,
  ShareableTag,
  ConflictResult,
  ConflictResolution,
  ImportResult,
} from './types';
import type { drizzle } from 'drizzle-orm/expo-sqlite';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

// Copy content:// URI to a local file for reading
async function copyToLocalFile(uri: string): Promise<string | null> {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return null;

    const localPath = `${cacheDir}temp_import_${Date.now()}.restoshare`;

    // For content:// URIs, we need to use copyAsync (SAF - Storage Access Framework)
    await FileSystem.copyAsync({
      from: uri,
      to: localPath,
    });

    return localPath;
  } catch {
    return null;
  }
}

// Parse a share file
export async function parseShareFile(fileUri: string): Promise<ShareFileData | null> {
  try {
    let localUri = fileUri;

    // If it's a content:// URI, we need to copy it locally first
    if (fileUri.startsWith('content://')) {
      const copiedPath = await copyToLocalFile(fileUri);
      if (!copiedPath) {
        return null;
      }
      localUri = copiedPath;
    }

    const content = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const data = JSON.parse(content) as ShareFileData;

    // Validate version
    if (!data.version || data.version > CURRENT_SHARE_VERSION) {
      return null;
    }

    // Clean up temp file if we created one
    if (localUri !== fileUri) {
      FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    }

    return data;
  } catch {
    return null;
  }
}

// Find similar restaurants by name (case-insensitive)
export async function findSimilarRestaurants(
  db: DrizzleDb,
  name: string,
): Promise<{ id: number; name: string }[]> {
  try {
    const normalizedName = name.toLowerCase().trim();
    const allRestaurants = await db
      .select({ id: schema.restaurants.id, name: schema.restaurants.name })
      .from(schema.restaurants)
      .where(eq(schema.restaurants.deleted, false));

    return allRestaurants.filter((r) => r.name.toLowerCase().trim() === normalizedName);
  } catch {
    return [];
  }
}

// Find similar dishes by name (case-insensitive)
export async function findSimilarDishes(
  db: DrizzleDb,
  name: string,
  _restaurantId?: number,
): Promise<{ id: number; name: string }[]> {
  try {
    const normalizedName = name.toLowerCase().trim();
    let query = db
      .select({ id: schema.dishes.id, name: schema.dishes.name })
      .from(schema.dishes)
      .where(eq(schema.dishes.deleted, false));

    const allDishes = await query;
    return allDishes.filter((d) => d.name.toLowerCase().trim() === normalizedName);
  } catch {
    return [];
  }
}

// Check for restaurant conflicts
export async function checkRestaurantConflict(
  db: DrizzleDb,
  name: string,
): Promise<ConflictResult> {
  const similar = await findSimilarRestaurants(db, name);
  const existingEntity = similar[0];
  if (existingEntity) {
    return { hasConflict: true, existingEntity, incomingName: name };
  }
  return { hasConflict: false, incomingName: name };
}

// Save base64 image to file system
async function saveBase64Image(image: ShareableImage): Promise<string | null> {
  try {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });

    const uniqueFilename = `${Date.now()}_${image.filename}`;
    const filePath = `${IMAGES_DIR}${uniqueFilename}`;

    await FileSystem.writeAsStringAsync(filePath, image.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return filePath;
  } catch {
    return null;
  }
}

// Get or create tag
async function getOrCreateTag(db: DrizzleDb, tag: ShareableTag): Promise<number> {
  const existing = await db.select().from(schema.tags).where(eq(schema.tags.name, tag.name));

  const existingTag = existing[0];
  if (existingTag) return existingTag.id;

  const result = await db.insert(schema.tags).values({ name: tag.name, color: tag.color });
  return result.lastInsertRowId;
}

// Import a restaurant
export async function importRestaurant(
  db: DrizzleDb,
  restaurant: ShareableRestaurant,
  resolution?: ConflictResolution,
): Promise<number | null> {
  try {
    // If using existing, return its ID
    if (resolution?.type === 'use_existing') {
      return resolution.existingId;
    }

    // Create new restaurant
    const result = await db.insert(schema.restaurants).values({
      name: restaurant.name,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      comments: restaurant.comments,
      rating: restaurant.rating,
    });
    const restaurantId = result.lastInsertRowId;

    // Add tags
    for (const tag of restaurant.tags) {
      const tagId = await getOrCreateTag(db, tag);
      await db.insert(schema.restaurantTags).values({ restaurantId, tagId });
    }

    // Save images
    for (const image of restaurant.images) {
      const path = await saveBase64Image(image);
      if (path) {
        await db
          .insert(schema.images)
          .values({ path, restaurantId, uploadedAt: new Date().toISOString() });
      }
    }

    return restaurantId;
  } catch {
    return null;
  }
}

// Import a dish
export async function importDish(
  db: DrizzleDb,
  dish: ShareableDish,
  restaurantId: number,
): Promise<number | null> {
  try {
    const result = await db.insert(schema.dishes).values({
      name: dish.name,
      price: dish.price,
      rating: dish.rating,
      comments: dish.comments,
      restaurantId,
    });
    const dishId = result.lastInsertRowId;

    // Add tags
    for (const tag of dish.tags) {
      const tagId = await getOrCreateTag(db, tag);
      await db.insert(schema.dishTags).values({ dishId, tagId });
    }

    // Save images
    for (const image of dish.images) {
      const path = await saveBase64Image(image);
      if (path) {
        await db
          .insert(schema.images)
          .values({ path, dishId, uploadedAt: new Date().toISOString() });
      }
    }

    return dishId;
  } catch {
    return null;
  }
}

// Import a visit
export async function importVisit(
  db: DrizzleDb,
  visitedAt: string,
  comments: string | null,
  images: ShareableImage[],
  restaurantId: number,
  dishIds: number[],
): Promise<number | null> {
  try {
    const result = await db.insert(schema.visits).values({ visitedAt, comments, restaurantId });
    const visitId = result.lastInsertRowId;

    // Associate dishes
    for (const dishId of dishIds) {
      await db.insert(schema.dishVisits).values({ visitId, dishId });
    }

    // Save images
    for (const image of images) {
      const path = await saveBase64Image(image);
      if (path) {
        await db
          .insert(schema.images)
          .values({ path, visitId, uploadedAt: new Date().toISOString() });
      }
    }

    return visitId;
  } catch {
    return null;
  }
}

// Full import workflow for restaurant type
export async function importRestaurantFile(
  db: DrizzleDb,
  data: ShareFileData,
  restaurantResolution?: ConflictResolution,
): Promise<ImportResult> {
  if (!data.restaurant) {
    return { success: false, entityType: 'restaurant', error: 'No restaurant data found' };
  }

  const restaurantId = await importRestaurant(db, data.restaurant, restaurantResolution);
  if (!restaurantId) {
    return { success: false, entityType: 'restaurant', error: 'Failed to import restaurant' };
  }

  return {
    success: true,
    entityType: 'restaurant',
    entityId: restaurantId,
    entityName: data.restaurant.name,
  };
}

// Full import workflow for dish type
export async function importDishFile(
  db: DrizzleDb,
  data: ShareFileData,
  restaurantResolution?: ConflictResolution,
): Promise<ImportResult> {
  if (!data.dish) {
    return { success: false, entityType: 'dish', error: 'No dish data found' };
  }

  // Handle restaurant first
  let restaurantId: number;
  if (restaurantResolution?.type === 'use_existing') {
    restaurantId = restaurantResolution.existingId;
  } else if (data.includedRestaurant) {
    const id = await importRestaurant(db, data.includedRestaurant);
    if (!id) return { success: false, entityType: 'dish', error: 'Failed to import restaurant' };
    restaurantId = id;
  } else {
    return { success: false, entityType: 'dish', error: 'No restaurant data for dish' };
  }

  const dishId = await importDish(db, data.dish, restaurantId);
  if (!dishId) {
    return { success: false, entityType: 'dish', error: 'Failed to import dish' };
  }

  return { success: true, entityType: 'dish', entityId: dishId, entityName: data.dish.name };
}

// Full import workflow for visit type
export async function importVisitFile(
  db: DrizzleDb,
  data: ShareFileData,
  restaurantResolution?: ConflictResolution,
): Promise<ImportResult> {
  if (!data.visit) {
    return { success: false, entityType: 'visit', error: 'No visit data found' };
  }

  // Handle restaurant first
  let restaurantId: number;
  if (restaurantResolution?.type === 'use_existing') {
    restaurantId = restaurantResolution.existingId;
  } else if (data.includedRestaurant) {
    const id = await importRestaurant(db, data.includedRestaurant);
    if (!id) return { success: false, entityType: 'visit', error: 'Failed to import restaurant' };
    restaurantId = id;
  } else {
    return { success: false, entityType: 'visit', error: 'No restaurant data for visit' };
  }

  // Import dishes
  const dishIds: number[] = [];
  if (data.includedDishes) {
    for (const dish of data.includedDishes) {
      const dishId = await importDish(db, dish, restaurantId);
      if (dishId) dishIds.push(dishId);
    }
  }

  const visitId = await importVisit(
    db,
    data.visit.visitedAt,
    data.visit.comments,
    data.visit.images,
    restaurantId,
    dishIds,
  );
  if (!visitId) {
    return { success: false, entityType: 'visit', error: 'Failed to import visit' };
  }

  return {
    success: true,
    entityType: 'visit',
    entityId: visitId,
    entityName: data.visit.visitedAt,
  };
}
