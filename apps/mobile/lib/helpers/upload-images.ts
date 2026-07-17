import * as FileSystem from 'expo-file-system/legacy';

import { IMAGES_DIR } from '@/lib/helpers/fs-paths';
import { images } from '@/services/db/schema';

import type { drizzle } from 'drizzle-orm/expo-sqlite';

export async function uploadImages(
  db: ReturnType<typeof drizzle>,
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

      const imageRecord: any = {
        path: newPath,
        uploadedAt: new Date().toISOString(),
      };
      if (classType === 'RESTAURANT') imageRecord.restaurantId = id;
      if (classType === 'VISIT') imageRecord.visitId = id;
      if (classType === 'DISH') imageRecord.dishId = id;

      await db.insert(images).values(imageRecord);
      return newPath;
    } catch (error) {
      console.error('Error al guardar la imagen localmente:', error);
      return null;
    }
  });

  const saved = await Promise.all(savePromises);
  return saved.filter((p): p is string => Boolean(p));
}
