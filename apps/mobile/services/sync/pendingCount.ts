import { eq, isNull, sql } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';

/**
 * Cuántos cambios locales no han llegado todavía al servidor.
 *
 * Existe para poder decirlo *antes* de cerrar sesión. Sin este número la
 * pregunta sería «¿seguro?», que no aporta nada porque no dice qué se está
 * arriesgando; con él es «quedan 12 cambios sin subir», que es información con
 * la que se puede decidir.
 *
 * Cuenta las filas de la bandeja de salida y las fotos sin subir por separado y
 * las suma: para quien va a cerrar sesión son lo mismo —cosas suyas que solo
 * están aquí— y distinguirlas en ese momento solo añade ruido.
 */
export async function countPendingChanges(db: AppDatabase): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.changeLog)
    .where(eq(schema.changeLog.synced, false));

  const photos = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.images)
    // `images` no tiene borrado suave: una foto quitada de una entrada se borra
    // de verdad, porque el fichero también se va.
    .where(isNull(schema.images.remoteKey));

  return Number(rows[0]?.n ?? 0) + Number(photos[0]?.n ?? 0);
}
