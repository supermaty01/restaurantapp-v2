import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as Application from 'expo-application';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { BackupService } from '@/services/backup/backupService';
import * as schema from '@/services/db/schema';

/**
 * Solo el servicio de copia, sin lo demás.
 *
 * `useAppSettings` ya construye uno, pero arrastra el estado de la pantalla de
 * ajustes entera —progresos de importación, tamaño en disco, última copia— y
 * mide el almacenamiento en un efecto. Quien únicamente quiere guardar una copia
 * antes de hacer algo irreversible no debería pagar nada de eso.
 *
 * Vive en `features/` y no en la pantalla porque montar el driver de la base de
 * datos es exactamente lo que la frontera de `no-restricted-imports` prohíbe
 * hacer en una pantalla, y con razón: es la regla que ha mantenido la capa de
 * repositorios en su sitio.
 */
export function useBackupService(): BackupService {
  const sqlite = useSQLiteContext();

  return useMemo(() => {
    const drizzleDb = drizzle(sqlite, { schema });
    const version = Application.nativeApplicationVersion ?? '2.0.0';
    return new BackupService(drizzleDb, version);
  }, [sqlite]);
}
