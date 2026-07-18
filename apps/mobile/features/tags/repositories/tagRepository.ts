import { eq } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import { newSyncValues, recordChange, touchedAt } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';

export interface TagWriteInput {
  name: string;
  color: string;
}

export async function createTag(db: AppDatabase, input: TagWriteInput): Promise<number> {
  const [row] = await db
    .insert(schema.tags)
    .values({ ...input, ...newSyncValues() })
    .returning({ id: schema.tags.id, uuid: schema.tags.uuid });

  if (!row) throw new Error('No se pudo crear la etiqueta');

  await recordChange(db, 'tags', row.id, row.uuid, 'insert');
  return row.id;
}

export async function updateTag(db: AppDatabase, id: number, input: TagWriteInput): Promise<void> {
  const [row] = await db
    .update(schema.tags)
    .set({ ...input, ...touchedAt() })
    .where(eq(schema.tags.id, id))
    .returning({ uuid: schema.tags.uuid });

  if (!row) throw new Error('Etiqueta no encontrada');
  await recordChange(db, 'tags', id, row.uuid, 'update');
}

/** Tags are only soft-deleted: they may still be referenced by junction rows. */
export async function softDeleteTag(db: AppDatabase, id: number): Promise<void> {
  const [row] = await db
    .update(schema.tags)
    .set({ deleted: true, ...touchedAt() })
    .where(eq(schema.tags.id, id))
    .returning({ uuid: schema.tags.uuid });

  if (row) await recordChange(db, 'tags', id, row.uuid, 'delete');
}
