import { getDefaultVisibility } from '@/features/privacy/defaultsStore';
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
  /**
   * Supplies a value when the row has none.
   *
   * For columns the mirror requires but older rows predate — visibility was
   * added long after the first diaries were written. Falling back beats both
   * alternatives: refusing the row hides it from the cloud, and rewriting the
   * local database during a sync edits data the user did not ask to change.
   */
  fallback?: () => unknown;
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
      {
        local: 'visibility',
        remote: 'visibility',
        required: true,
        fallback: () => getDefaultVisibility('restaurant'),
      },
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
      {
        local: 'visibility',
        remote: 'visibility',
        required: true,
        fallback: () => getDefaultVisibility('dish'),
      },
    ],
    foreignKeys: [{ local: 'restaurantId', remote: 'restaurant_uuid', references: 'restaurants' }],
  },
  {
    name: 'visits',
    table: schema.visits,
    scalars: [
      { local: 'visitedAt', remote: 'visited_at' },
      { local: 'comments', remote: 'comments' },
      {
        local: 'visibility',
        remote: 'visibility',
        required: true,
        fallback: () => getDefaultVisibility('visit'),
      },
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

/**
 * A junction table: the links between two synced rows.
 *
 * These were in the Postgres mirror from the first migration and nothing ever
 * sent them, so a diary reached the cloud with its tags, its dishes-per-visit
 * and its tagged people all stripped off. Nobody noticed because the app reads
 * those from the device, where they were still there.
 *
 * They do not fit `SyncTableConfig`: a link has no uuid, no timestamps and no
 * identity of its own — it *is* the pair of uuids. So it cannot be logged in
 * `change_log` or reconciled last-write-wins. Instead the links of a row travel
 * with the row: whenever a parent is pushed, its complete set of links replaces
 * whatever the server held. Idempotent, and a removed link disappears without
 * needing a tombstone.
 */
export interface LinkSide {
  /** drizzle key on the local junction row (holds a local integer id). */
  local: string;
  /** column in the remote junction row (holds a uuid). */
  remote: string;
  /** registry name of the table it points at. */
  references: string;
}

export interface LinkTableConfig {
  /** Remote (Postgres) junction table name. */
  name: string;
  table: SQLiteTable;
  /** The side that owns the link; replacing is scoped by this. */
  parent: LinkSide;
  child: LinkSide;
  /** Columns carried on the link itself, copied verbatim. */
  extras?: { local: string; remote: string }[];
}

export const LINK_TABLES: LinkTableConfig[] = [
  {
    name: 'restaurant_tag',
    table: schema.restaurantTags,
    parent: { local: 'restaurantId', remote: 'restaurant_uuid', references: 'restaurants' },
    child: { local: 'tagId', remote: 'tag_uuid', references: 'tags' },
  },
  {
    name: 'dish_tag',
    table: schema.dishTags,
    parent: { local: 'dishId', remote: 'dish_uuid', references: 'dishes' },
    child: { local: 'tagId', remote: 'tag_uuid', references: 'tags' },
  },
  {
    name: 'dish_visit',
    table: schema.dishVisits,
    parent: { local: 'visitId', remote: 'visit_uuid', references: 'visits' },
    child: { local: 'dishId', remote: 'dish_uuid', references: 'dishes' },
  },
  {
    name: 'visit_participant',
    table: schema.visitParticipants,
    parent: { local: 'visitId', remote: 'visit_uuid', references: 'visits' },
    child: { local: 'personId', remote: 'person_uuid', references: 'people' },
    extras: [{ local: 'tagStatus', remote: 'tag_status' }],
  },
];

/** The junctions owned by a given entity table. */
export function linksOf(parentTable: string): LinkTableConfig[] {
  return LINK_TABLES.filter((link) => link.parent.references === parentTable);
}
