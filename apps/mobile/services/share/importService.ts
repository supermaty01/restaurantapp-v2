/**
 * Importar un fichero compartido (.restoshare) al diario local.
 *
 * La lectura pasa por el esquema zod de `@restaurantapp/shared`: es la única
 * entrada de la app que llega de fuera y no la escribe un formulario propio.
 */

import { parseShareFile as parseShareFileContents } from '@restaurantapp/shared';
import { and, eq, sql } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';

import { IMAGES_DIR } from '@/lib/helpers/fs-paths';
import * as schema from '@/services/db/schema';
import { newSyncValues, recordChange } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';

import type {
  ShareFileData,
  ShareableRestaurant,
  ShareableDish,
  ShareableImage,
  ShareableTag,
} from '@restaurantapp/shared';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

import type { ConflictResult, ConflictResolution, ImportResult } from './types';

type DrizzleDb = AppDatabase;

/**
 * Inserts an image row with sync columns (uuid/timestamps) + change_log.
 * Every import insert must set these so imported rows are valid sync rows and
 * never leave a NULL uuid (docs/02, docs/09).
 */
async function insertImageRow(
  db: DrizzleDb,
  path: string,
  target: { restaurantId?: number; dishId?: number; visitId?: number },
): Promise<void> {
  const sync = newSyncValues();
  const [row] = await db
    .insert(schema.images)
    .values({ path, uploadedAt: new Date().toISOString(), ...sync, ...target })
    .returning({ id: schema.images.id });
  if (row) await recordChange(db, 'images', row.id, sync.uuid, 'insert');
}

/**
 * Copia un `content://` a un fichero que se pueda leer.
 *
 * Android entrega los adjuntos por el Storage Access Framework, y esas URIs no
 * se abren directamente.
 */
async function copyToLocalFile(uri: string): Promise<string | null> {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return null;

    const localPath = `${cacheDir}temp_import_${Date.now()}.restoshare`;
    await FileSystem.copyAsync({ from: uri, to: localPath });
    return localPath;
  } catch {
    return null;
  }
}

/**
 * Lee y **valida** un `.restoshare`.
 *
 * Antes esto era `JSON.parse(content) as ShareFileData`. El `as` no comprueba
 * nada: afirma. Un fichero con `rating: "cinco"` o con `tags: 5` pasaba de largo
 * y sus campos entraban derechos a un `insert()`. Y es la única entrada de la
 * app que viene de fuera de verdad — la abre el sistema desde un adjunto o una
 * descarga— mientras cada formulario de la app sí pasa por zod.
 *
 * El esquema vive en `@restaurantapp/shared` porque el Worker guarda este mismo
 * payload como contenido de un enlace compartido.
 *
 * Devuelve el motivo además del fallo: «no se pudo abrir» no distingue un
 * fichero corrupto de uno escrito por una versión más nueva de la app, y son
 * dos cosas distintas para quien lo está intentando.
 */
export async function readShareFile(
  fileUri: string,
): Promise<{ ok: true; data: ShareFileData } | { ok: false; reason: string }> {
  let localUri = fileUri;
  let temporary = false;

  try {
    if (fileUri.startsWith('content://')) {
      const copiedPath = await copyToLocalFile(fileUri);
      if (!copiedPath) return { ok: false, reason: 'No se pudo leer el fichero' };
      localUri = copiedPath;
      temporary = true;
    }

    const content = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      return { ok: false, reason: 'El fichero no es un .restoshare válido' };
    }

    return parseShareFileContents(raw);
  } catch {
    return { ok: false, reason: 'No se pudo leer el fichero' };
  } finally {
    // En `finally` y no en el camino feliz: antes la copia temporal solo se
    // borraba cuando todo iba bien, así que cada fichero que fallaba dejaba su
    // basura en la caché para siempre — y los que fallan traen fotos dentro.
    if (temporary) {
      void FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {
        // Un temporal que no se borra no puede tumbar una importación correcta.
      });
    }
  }
}

/**
 * El mismo nombre, ignorando mayúsculas y espacios de sobra.
 *
 * En SQL y no filtrando en JavaScript. Las dos búsquedas se traían la tabla
 * **entera** a memoria y comparaban una a una — y se llaman una vez por cada
 * elemento importado, así que un diario grande recorrido para cada plato de un
 * fichero es O(n·m) sin que nadie lo pidiera.
 *
 * `trim` va también en SQL: sin él, un nombre guardado con un espacio final
 * dejaba de parecerse a sí mismo y la importación creaba un duplicado.
 */
const sameName = (column: SQLiteColumn, name: string) =>
  sql`lower(trim(${column})) = ${name.toLowerCase().trim()}`;

export async function findSimilarRestaurants(
  db: DrizzleDb,
  name: string,
): Promise<{ id: number; name: string }[]> {
  return db
    .select({ id: schema.restaurants.id, name: schema.restaurants.name })
    .from(schema.restaurants)
    .where(and(eq(schema.restaurants.deleted, false), sameName(schema.restaurants.name, name)));
}

/**
 * Igual, pero acotado al restaurante cuando se sabe cuál es.
 *
 * El parámetro existía, se llamaba `_restaurantId` y **no se usaba**: la función
 * comparaba solo por nombre. Dos restaurantes con un «Ramen» cada uno se
 * detectaban como el mismo plato, así que importar el segundo ofrecía reutilizar
 * el del primero. Un plato pertenece a su restaurante; el nombre solo no lo
 * identifica.
 */
export async function findSimilarDishes(
  db: DrizzleDb,
  name: string,
  restaurantId?: number,
): Promise<{ id: number; name: string }[]> {
  const conditions = [eq(schema.dishes.deleted, false), sameName(schema.dishes.name, name)];
  if (restaurantId !== undefined) {
    conditions.push(eq(schema.dishes.restaurantId, restaurantId));
  }

  return db
    .select({ id: schema.dishes.id, name: schema.dishes.name })
    .from(schema.dishes)
    .where(and(...conditions));
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

  const sync = newSyncValues();
  const [row] = await db
    .insert(schema.tags)
    .values({ name: tag.name, color: tag.color, ...sync })
    .returning({ id: schema.tags.id });
  if (!row) throw new Error('No se pudo crear la etiqueta');
  await recordChange(db, 'tags', row.id, sync.uuid, 'insert');
  return row.id;
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
    const sync = newSyncValues();
    const [row] = await db
      .insert(schema.restaurants)
      .values({
        name: restaurant.name,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        comments: restaurant.comments,
        rating: restaurant.rating,
        ...sync,
      })
      .returning({ id: schema.restaurants.id });
    if (!row) return null;
    const restaurantId = row.id;
    await recordChange(db, 'restaurants', restaurantId, sync.uuid, 'insert');

    // Add tags
    for (const tag of restaurant.tags) {
      const tagId = await getOrCreateTag(db, tag);
      await db.insert(schema.restaurantTags).values({ restaurantId, tagId });
    }

    // Save images
    for (const image of restaurant.images) {
      const path = await saveBase64Image(image);
      if (path) await insertImageRow(db, path, { restaurantId });
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
    const sync = newSyncValues();
    const [row] = await db
      .insert(schema.dishes)
      .values({
        name: dish.name,
        price: dish.price,
        rating: dish.rating,
        comments: dish.comments,
        restaurantId,
        ...sync,
      })
      .returning({ id: schema.dishes.id });
    if (!row) return null;
    const dishId = row.id;
    await recordChange(db, 'dishes', dishId, sync.uuid, 'insert');

    // Add tags
    for (const tag of dish.tags) {
      const tagId = await getOrCreateTag(db, tag);
      await db.insert(schema.dishTags).values({ dishId, tagId });
    }

    // Save images
    for (const image of dish.images) {
      const path = await saveBase64Image(image);
      if (path) await insertImageRow(db, path, { dishId });
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
    const sync = newSyncValues();
    const [row] = await db
      .insert(schema.visits)
      .values({ visitedAt, comments, restaurantId, ...sync })
      .returning({ id: schema.visits.id });
    if (!row) return null;
    const visitId = row.id;
    await recordChange(db, 'visits', visitId, sync.uuid, 'insert');

    // Associate dishes
    for (const dishId of dishIds) {
      await db.insert(schema.dishVisits).values({ visitId, dishId });
    }

    // Save images
    for (const image of images) {
      const path = await saveBase64Image(image);
      if (path) await insertImageRow(db, path, { visitId });
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
