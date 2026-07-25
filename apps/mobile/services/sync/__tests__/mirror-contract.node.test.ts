import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { globSync } from '../../../components/__support__/glob';
import { SYNC_TABLES } from '../tables';

/**
 * Every NOT NULL column in the mirror must be one the push knows how to fill.
 *
 * Four separate sync failures came from the same gap: the mirror was written by
 * reading the local schema, but the rows on a real device come from importing a
 * v1 backup, which replaces the SQLite file wholesale. Columns added by later
 * migrations simply are not there, SQLite does not mind, and Postgres rejects
 * the whole push with a message that names the column and not the row.
 *
 * Rather than wait for the fifth, this compares the two directly: any column
 * the mirror requires has to be a bookkeeping field the push always writes, or
 * a scalar marked `required` so it gets a fallback and a warning.
 */

const MIGRATIONS = join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations');

/** Columns `toRemoteRecord` writes for every row, whatever the table. */
const ALWAYS_WRITTEN = new Set(['uuid', 'user_id', 'created_at', 'updated_at', 'deleted']);

/** Reads `create table X (...)` blocks and returns each table's NOT NULL columns. */
function notNullColumns(sql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();

  for (const match of sql.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)) {
    const [, name, body] = match as unknown as [string, string, string];
    const columns = new Set<string>();

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      // `primary key (...)`, `check (...)` and friends are constraints.
      const column = /^(\w+)\s+[\w ()]+/.exec(trimmed);
      if (!column) continue;
      if (/\bnot null\b/i.test(trimmed) || /\bprimary key\b/i.test(trimmed)) {
        columns.add(column[1] as string);
      }
    }

    tables.set(name, columns);
  }

  return tables;
}

/** Applies later `drop not null` migrations, so the picture is the current one. */
function applyRelaxations(sql: string, tables: Map<string, Set<string>>): void {
  for (const match of sql.matchAll(/alter table (\w+)\s+alter column (\w+) drop not null/gi)) {
    const [, table, column] = match as unknown as [string, string, string];
    tables.get(table)?.delete(column);
  }
}

describe('mirror contract', () => {
  const files = globSync(MIGRATIONS, /\.sql$/).sort();
  const combined = files.map((file) => readFileSync(file, 'utf8')).join('\n');

  const required = notNullColumns(combined);
  applyRelaxations(combined, required);

  it('reads the migrations', () => {
    // A guard on the guard: a changed migration style would silently empty this.
    expect(files.length).toBeGreaterThan(5);
    expect(required.get('visits')?.size).toBeGreaterThan(0);
  });

  it.each(SYNC_TABLES.map((cfg) => cfg.name))(
    '%s: the push fills every column the mirror requires',
    (name) => {
      const cfg = SYNC_TABLES.find((entry) => entry.name === name);
      const mirrorRequires = required.get(name) ?? new Set<string>();

      const covered = new Set([
        ...ALWAYS_WRITTEN,
        ...(cfg?.scalars ?? []).filter((s) => s.required).map((s) => s.remote),
        // A foreign key can legitimately be null; the mirror declares those
        // nullable, so anything required here would show up as a gap.
        ...(cfg?.foreignKeys ?? []).map((fk) => fk.remote),
      ]);

      const gaps = [...mirrorRequires].filter((column) => !covered.has(column));
      expect({ table: name, unfilled: gaps }).toEqual({ table: name, unfilled: [] });
    },
  );
});
