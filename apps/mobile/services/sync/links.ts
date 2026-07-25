import { eq, inArray } from 'drizzle-orm';

import type { AppDatabase } from '@/services/db/types';
import { localIdForUuid, uuidForLocalId } from '@/services/sync/records';
import { column, findTable, type LinkTableConfig } from '@/services/sync/tables';
import type { LinkRow } from '@/services/sync/transport';

/**
 * Moving junction rows between the device and the mirror.
 *
 * The unit of work is one parent, not one link: `restaurant #4 now has exactly
 * these tags`. A link has no identity to reconcile — no uuid, no updated_at —
 * so last-write-wins has nothing to compare and the change_log has nothing to
 * point at. Replacing the whole set is the only operation that is both
 * expressible and idempotent, and it handles removals without tombstones.
 *
 * It also means a link can never outlive an edit: if the app rewrites a visit's
 * dishes, the next push says what the visit's dishes *are*, not what changed.
 */

/** Reads one parent's links and translates the local ids to uuids. */
export async function collectLinks(
  db: AppDatabase,
  cfg: LinkTableConfig,
  parentId: number,
  parentUuid: string,
  accountUuid: string,
): Promise<LinkRow[]> {
  const childCfg = findTable(cfg.child.references);
  if (!childCfg) return [];

  const rows = (await db
    .select()
    .from(cfg.table)
    .where(eq(column(cfg.table, cfg.parent.local), parentId))) as Record<string, unknown>[];

  const links: LinkRow[] = [];

  for (const row of rows) {
    const childId = row[cfg.child.local];
    if (typeof childId !== 'number') continue;

    const childUuid = await uuidForLocalId(db, childCfg, childId);
    // A link to a row that is not in the local table any more points at nothing
    // the server can resolve; the FK would reject the whole batch.
    if (!childUuid) continue;

    const link: LinkRow = {
      user_id: accountUuid,
      [cfg.parent.remote]: parentUuid,
      [cfg.child.remote]: childUuid,
    };
    for (const extra of cfg.extras ?? []) {
      link[extra.remote] = row[extra.local] ?? null;
    }
    links.push(link);
  }

  return links;
}

/**
 * Replaces one parent's links locally from what the server holds.
 *
 * Mirrors the push: delete the parent's rows, insert what came back. Links
 * whose child has not arrived yet are dropped rather than queued — the next
 * pull brings the parent again once anything about it changes, and a dangling
 * local FK is worse than a link that reappears a minute later.
 */
export async function applyLinks(
  db: AppDatabase,
  cfg: LinkTableConfig,
  parentId: number,
  remote: LinkRow[],
): Promise<void> {
  const childCfg = findTable(cfg.child.references);
  if (!childCfg) return;

  await db.delete(cfg.table).where(eq(column(cfg.table, cfg.parent.local), parentId));

  for (const link of remote) {
    const childUuid = link[cfg.child.remote];
    if (typeof childUuid !== 'string') continue;

    const childId = await localIdForUuid(db, childCfg, childUuid);
    if (childId === null) continue;

    const values: Record<string, unknown> = {
      [cfg.parent.local]: parentId,
      [cfg.child.local]: childId,
    };
    for (const extra of cfg.extras ?? []) {
      const value = link[extra.remote];
      if (value !== null && value !== undefined) values[extra.local] = value;
    }

    await db.insert(cfg.table).values(values).onConflictDoNothing();
  }
}

/** Local ids for a set of parent uuids, so a pull can address its own rows. */
export async function parentIdsByUuid(
  db: AppDatabase,
  parentTable: string,
  uuids: string[],
): Promise<Map<string, number>> {
  const cfg = findTable(parentTable);
  if (!cfg || uuids.length === 0) return new Map();

  const rows = (await db
    .select({ id: column(cfg.table, 'id'), uuid: column(cfg.table, 'uuid') })
    .from(cfg.table)
    .where(inArray(column(cfg.table, 'uuid'), uuids))) as { id: number; uuid: string }[];

  return new Map(rows.map((row) => [row.uuid, row.id]));
}
