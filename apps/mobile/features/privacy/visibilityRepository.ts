import { eq } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import { recordChange, touchedAt } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';

import type { ShareableEntity, Visibility } from './visibility';

/**
 * Changing who can see one entry, and nothing else.
 *
 * A one-column update rather than a trip through the entity's write path: the
 * detail screen has a badge you tap, and routing that through `updateVisit`
 * would mean assembling a whole visit payload from a DTO that was never meant
 * to round-trip, with every field it does not carry silently becoming null.
 *
 * The three tables share a shape here — `visibility`, `updated_at`, a change_log
 * entry — so they share the code. The mapping is explicit rather than computed
 * because drizzle tables are values, not names, and a typo in a name would be a
 * runtime failure while a typo here does not compile.
 */
const TABLES = {
  restaurant: { table: schema.restaurants, syncName: 'restaurants' },
  dish: { table: schema.dishes, syncName: 'dishes' },
  visit: { table: schema.visits, syncName: 'visits' },
} as const;

export async function setVisibility(
  db: AppDatabase,
  entity: ShareableEntity,
  id: number,
  visibility: Visibility,
): Promise<void> {
  const target = TABLES[entity];

  const [row] = await db
    .update(target.table)
    .set({ visibility, ...touchedAt() })
    .where(eq(target.table.id, id))
    .returning({ uuid: target.table.uuid });

  if (!row) throw new Error('No se encontró la entrada');

  // Without this the change stays on the device: the mirror would keep serving
  // the old visibility, which for a row being *unshared* is the failure that
  // matters — you would think you had taken something back and you had not.
  await recordChange(db, target.syncName, id, row.uuid, 'update');
}
