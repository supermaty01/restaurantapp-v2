import * as schema from '@/services/db/schema';

import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

/**
 * Sync registry (docs/03). Describes, per syncable entity table, how a local
 * row (integer PK, camelCase drizzle keys, FKs as local ids) maps to a remote
 * record (uuid PK, snake_case columns, FKs as uuids) and back.
 *
 * Tables are listed in dependency order: a table's FK targets always appear
 * before it, so on pull a parent is present by the time its children arrive.
 */

export interface ScalarColumn {
  /** drizzle key on the local row (camelCase). */
  local: string;
  /** column name in the remote record (snake_case). */
  remote: string;
  /**
   * The mirror rejects a null here.
   *
   * Worth declaring because importing a v1 backup replaces the SQLite file
   * wholesale, so the rows on the device are whatever v1 wrote — drizzle's
   * `notNull()` describes new writes, not data that arrived with the import.
   * A row that violates this is named in the log instead of failing the whole
   * push with a message that does not say which row.
   */
  required?: boolean;
}

export interface ForeignKey {
  /** drizzle key holding the local integer id. */
  local: string;
  /** remote column holding the referenced row's uuid. */
  remote: string;
  /** registry name of the referenced table. */
  references: string;
}

export interface SyncTableConfig {
  /** Remote (Postgres) table name; also the change_log table_name. */
  name: string;
  table: SQLiteTable;
  scalars: ScalarColumn[];
  foreignKeys: ForeignKey[];
}

/** Dynamic column access without leaking `any` (drizzle tables are column maps). */
export function column(table: SQLiteTable, key: string): SQLiteColumn {
  return (table as unknown as Record<string, SQLiteColumn>)[key] as SQLiteColumn;
}

export const SYNC_TABLES: SyncTableConfig[] = [
  {
    name: 'restaurants',
    table: schema.restaurants,
    scalars: [
      { local: 'name', remote: 'name', required: true },
      { local: 'latitude', remote: 'latitude' },
      { local: 'longitude', remote: 'longitude' },
      { local: 'comments', remote: 'comments' },
      { local: 'rating', remote: 'rating' },
      { local: 'visibility', remote: 'visibility' },
    ],
    foreignKeys: [],
  },
  {
    name: 'tags',
    table: schema.tags,
    scalars: [
      { local: 'name', remote: 'name', required: true },
      { local: 'color', remote: 'color', required: true },
    ],
    foreignKeys: [],
  },
  {
    name: 'dishes',
    table: schema.dishes,
    scalars: [
      { local: 'name', remote: 'name', required: true },
      { local: 'price', remote: 'price' },
      { local: 'rating', remote: 'rating' },
      { local: 'comments', remote: 'comments' },
      { local: 'visibility', remote: 'visibility' },
    ],
    foreignKeys: [{ local: 'restaurantId', remote: 'restaurant_uuid', references: 'restaurants' }],
  },
  {
    name: 'visits',
    table: schema.visits,
    scalars: [
      { local: 'visitedAt', remote: 'visited_at' },
      { local: 'comments', remote: 'comments' },
      { local: 'visibility', remote: 'visibility' },
    ],
    foreignKeys: [{ local: 'restaurantId', remote: 'restaurant_uuid', references: 'restaurants' }],
  },
  {
    name: 'people',
    table: schema.people,
    scalars: [{ local: 'name', remote: 'name', required: true }],
    foreignKeys: [],
  },
  {
    name: 'images',
    table: schema.images,
    scalars: [
      { local: 'remoteKey', remote: 'remote_key' },
      { local: 'description', remote: 'description' },
    ],
    foreignKeys: [
      { local: 'restaurantId', remote: 'restaurant_uuid', references: 'restaurants' },
      { local: 'dishId', remote: 'dish_uuid', references: 'dishes' },
      { local: 'visitId', remote: 'visit_uuid', references: 'visits' },
    ],
  },
];

export function findTable(name: string): SyncTableConfig | undefined {
  return SYNC_TABLES.find((t) => t.name === name);
}
