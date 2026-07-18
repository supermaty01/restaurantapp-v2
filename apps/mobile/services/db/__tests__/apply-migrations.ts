import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type Database from 'better-sqlite3';

const DRIZZLE_DIR = join(__dirname, '..', '..', '..', 'drizzle');

interface Journal {
  entries: { idx: number; tag: string }[];
}

/**
 * Applies the committed drizzle migrations (in journal order) to a
 * better-sqlite3 database, splitting each file on the drizzle statement
 * separator. Test-only: lets migrations run against a real SQLite in node.
 */
export function applyMigrations(
  db: Database.Database,
  range: { from?: number; to?: number } = {},
): void {
  const { from = 0, to } = range;
  const journal = JSON.parse(
    readFileSync(join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf-8'),
  ) as Journal;

  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  for (const entry of entries) {
    if (entry.idx < from) continue;
    if (to !== undefined && entry.idx > to) break;
    const sql = readFileSync(join(DRIZZLE_DIR, `${entry.tag}.sql`), 'utf-8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) db.exec(trimmed);
    }
  }
}
