import * as FileSystem from 'expo-file-system/legacy';

import { IMAGES_DIR, SQLITE_DIR } from '@/lib/helpers/fs-paths';

export async function ensureAppDirectories(): Promise<void> {
  try {
    // 1. images/
    const imgInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
    if (!imgInfo.exists) {
      await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
    }

    // 2. SQLite/
    const dbInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
    if (!dbInfo.exists) {
      await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
    }
  } catch {
    // Silently handle directory creation errors
  }
}
