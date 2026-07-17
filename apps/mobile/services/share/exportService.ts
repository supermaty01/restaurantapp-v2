/**
 * Export service for creating shareable files
 */

import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { imagePathToUri } from '@/lib/helpers/image-paths';
import * as schema from '@/services/db/schema';

import { SHARE_FILE_EXTENSION, CURRENT_SHARE_VERSION } from './types';

import type {
  ShareFileData,
  ShareableRestaurant,
  ShareableDish,
  ShareableVisit,
  ShareableImage,
  ShareableTag,
} from './types';
import type { drizzle } from 'drizzle-orm/expo-sqlite';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

// Convert image file to base64
async function imageToBase64(imagePath: string): Promise<ShareableImage | null> {
  try {
    const uri = imagePathToUri(imagePath);
    const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      return null;
    }

    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const filename = imagePath.split('/').pop() || 'image.jpg';
    return { base64, filename };
  } catch {
    return null;
  }
}

// Fetch restaurant with all related data
async function fetchRestaurantData(
  db: DrizzleDb,
  restaurantId: number,
): Promise<ShareableRestaurant | null> {
  try {
    const restaurants = await db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.id, restaurantId));
    if (restaurants.length === 0) return null;
    const restaurant = restaurants[0];

    const tagRows = await db
      .select({ name: schema.tags.name, color: schema.tags.color })
      .from(schema.restaurantTags)
      .leftJoin(schema.tags, eq(schema.restaurantTags.tagId, schema.tags.id))
      .where(eq(schema.restaurantTags.restaurantId, restaurantId));

    const tags: ShareableTag[] = tagRows
      .filter((t) => t.name && t.color)
      .map((t) => ({ name: t.name!, color: t.color! }));

    const imageRows = await db
      .select()
      .from(schema.images)
      .where(eq(schema.images.restaurantId, restaurantId));
    const images: ShareableImage[] = [];
    for (const img of imageRows) {
      const shareableImg = await imageToBase64(img.path);
      if (shareableImg) images.push(shareableImg);
    }

    return {
      name: restaurant.name,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      comments: restaurant.comments,
      rating: restaurant.rating,
      tags,
      images,
    };
  } catch {
    return null;
  }
}

// Fetch dish with all related data
async function fetchDishData(db: DrizzleDb, dishId: number): Promise<ShareableDish | null> {
  try {
    const dishes = await db.select().from(schema.dishes).where(eq(schema.dishes.id, dishId));
    if (dishes.length === 0) return null;
    const dish = dishes[0];

    const tagRows = await db
      .select({ name: schema.tags.name, color: schema.tags.color })
      .from(schema.dishTags)
      .leftJoin(schema.tags, eq(schema.dishTags.tagId, schema.tags.id))
      .where(eq(schema.dishTags.dishId, dishId));

    const tags: ShareableTag[] = tagRows
      .filter((t) => t.name && t.color)
      .map((t) => ({ name: t.name!, color: t.color! }));

    const imageRows = await db.select().from(schema.images).where(eq(schema.images.dishId, dishId));
    const images: ShareableImage[] = [];
    for (const img of imageRows) {
      const shareableImg = await imageToBase64(img.path);
      if (shareableImg) images.push(shareableImg);
    }

    return {
      name: dish.name,
      price: dish.price,
      rating: dish.rating,
      comments: dish.comments,
      tags,
      images,
    };
  } catch {
    return null;
  }
}

// Fetch visit data
async function fetchVisitData(db: DrizzleDb, visitId: number): Promise<ShareableVisit | null> {
  try {
    const visits = await db.select().from(schema.visits).where(eq(schema.visits.id, visitId));
    if (visits.length === 0) return null;
    const visit = visits[0];

    const imageRows = await db
      .select()
      .from(schema.images)
      .where(eq(schema.images.visitId, visitId));
    const images: ShareableImage[] = [];
    for (const img of imageRows) {
      const shareableImg = await imageToBase64(img.path);
      if (shareableImg) images.push(shareableImg);
    }

    return { visitedAt: visit.visitedAt, comments: visit.comments, images };
  } catch {
    return null;
  }
}

// Get dishes associated with a visit
async function fetchVisitDishes(db: DrizzleDb, visitId: number): Promise<ShareableDish[]> {
  try {
    const dishVisitRows = await db
      .select({ dishId: schema.dishVisits.dishId })
      .from(schema.dishVisits)
      .where(eq(schema.dishVisits.visitId, visitId));
    const dishes: ShareableDish[] = [];
    for (const row of dishVisitRows) {
      if (row.dishId) {
        const dish = await fetchDishData(db, row.dishId);
        if (dish) dishes.push(dish);
      }
    }
    return dishes;
  } catch {
    return [];
  }
}

// Helper to sanitize filename
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
}

// Create file and open share dialog
async function createAndShareFile(data: ShareFileData, filename: string): Promise<string | null> {
  try {
    const json = JSON.stringify(data);
    const filePath = `${FileSystem.cacheDirectory}${filename}${SHARE_FILE_EXTENSION}`;

    await FileSystem.writeAsStringAsync(filePath, json, { encoding: FileSystem.EncodingType.UTF8 });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) throw new Error('Sharing is not available on this device');

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Compartir',
    });
    return filePath;
  } catch {
    return null;
  }
}

// Export a restaurant
export async function exportRestaurant(
  db: DrizzleDb,
  restaurantId: number,
): Promise<string | null> {
  try {
    const restaurant = await fetchRestaurantData(db, restaurantId);
    if (!restaurant) throw new Error('Restaurant not found');

    const shareData: ShareFileData = {
      version: CURRENT_SHARE_VERSION,
      type: 'restaurant',
      createdAt: new Date().toISOString(),
      restaurant,
    };

    return await createAndShareFile(shareData, `restaurant_${sanitizeFilename(restaurant.name)}`);
  } catch {
    return null;
  }
}

// Export a dish (includes restaurant)
export async function exportDish(db: DrizzleDb, dishId: number): Promise<string | null> {
  try {
    const dishes = await db.select().from(schema.dishes).where(eq(schema.dishes.id, dishId));
    if (dishes.length === 0) throw new Error('Dish not found');

    const dish = await fetchDishData(db, dishId);
    if (!dish) throw new Error('Failed to fetch dish data');

    const includedRestaurant = await fetchRestaurantData(db, dishes[0].restaurantId!);

    const shareData: ShareFileData = {
      version: CURRENT_SHARE_VERSION,
      type: 'dish',
      createdAt: new Date().toISOString(),
      dish,
      includedRestaurant: includedRestaurant || undefined,
    };

    return await createAndShareFile(shareData, `dish_${sanitizeFilename(dish.name)}`);
  } catch {
    return null;
  }
}

// Export a visit (includes restaurant and dishes)
export async function exportVisit(db: DrizzleDb, visitId: number): Promise<string | null> {
  try {
    const visits = await db.select().from(schema.visits).where(eq(schema.visits.id, visitId));
    if (visits.length === 0) throw new Error('Visit not found');

    const visit = await fetchVisitData(db, visitId);
    if (!visit) throw new Error('Failed to fetch visit data');

    const includedRestaurant = await fetchRestaurantData(db, visits[0].restaurantId!);
    const includedDishes = await fetchVisitDishes(db, visitId);

    const shareData: ShareFileData = {
      version: CURRENT_SHARE_VERSION,
      type: 'visit',
      createdAt: new Date().toISOString(),
      visit,
      includedRestaurant: includedRestaurant || undefined,
      includedDishes: includedDishes.length > 0 ? includedDishes : undefined,
    };

    return await createAndShareFile(shareData, `visit_${visit.visitedAt}`);
  } catch {
    return null;
  }
}
