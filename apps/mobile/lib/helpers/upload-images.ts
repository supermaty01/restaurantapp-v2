import { inArray } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';

import { IMAGES_DIR } from '@/lib/helpers/fs-paths';
import { images } from '@/services/db/schema';
import { newSyncValues, recordChange } from '@/services/db/sync-write';

import type { AppDatabase } from '@/services/db/types';

export async function uploadImages(
  db: AppDatabase,
  selectedImages: string[],
  classType: 'RESTAURANT' | 'VISIT' | 'DISH',
  id: number,
): Promise<string[]> {
  const savePromises = selectedImages.map(async (uri) => {
    try {
      const filename = uri.split('/').pop();
      if (!filename) throw new Error('URI inválida, sin nombre de fichero');

      const newPath = `${IMAGES_DIR}${filename}`;

      // Asegurarnos de que images/ existe (por si arrancó sin llamar a ensureAppDirectories)
      await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });

      await FileSystem.copyAsync({ from: uri, to: newPath });

      const sync = newSyncValues();
      const imageRecord: typeof images.$inferInsert = {
        path: newPath,
        uploadedAt: new Date().toISOString(),
        ...sync,
        ...(classType === 'RESTAURANT' && { restaurantId: id }),
        ...(classType === 'VISIT' && { visitId: id }),
        ...(classType === 'DISH' && { dishId: id }),
      };

      const [row] = await db.insert(images).values(imageRecord).returning({ id: images.id });
      if (row) await recordChange(db, 'images', row.id, sync.uuid, 'insert');
      return newPath;
    } catch (error) {
      console.error('Error al guardar la imagen localmente:', error);
      return null;
    }
  });

  const saved = await Promise.all(savePromises);
  return saved.filter((p): p is string => Boolean(p));
}

/** Removes image rows (and logs deletes) for the given ids. */
export async function deleteImages(db: AppDatabase, imageIds: number[]): Promise<void> {
  if (imageIds.length === 0) return;

  const rows = await db
    .select({ id: images.id, uuid: images.uuid })
    .from(images)
    .where(inArray(images.id, imageIds));

  await db.delete(images).where(inArray(images.id, imageIds));

  for (const row of rows) {
    await recordChange(db, 'images', row.id, row.uuid, 'delete');
  }
}
