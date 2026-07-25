import Database from 'better-sqlite3';

import { applyMigrations } from './apply-migrations';

/**
 * These tests are the safety net docs/12 mandates for schema migrations: they
 * run the real migration SQL against a real SQLite and assert the data survives.
 * The first version of migration 0007 would have crashed every existing user's
 * app ("Cannot add a column with non-constant default"); this suite catches
 * exactly that class of bug.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function seedV1(db: Database.Database) {
  // A v1 database (migrations 0000–0006), populated as a real user's would be.
  applyMigrations(db, { to: 6 });

  db.exec(`
    INSERT INTO restaurants (id, name, rating, deleted) VALUES
      (1, 'Guadalupe', 5, 0),
      (2, 'Roma Trattoria', 4, 0),
      (3, 'Sitio borrado', 3, 1);
    INSERT INTO dishes (id, name, price, rating, restaurant_id, deleted) VALUES
      (1, 'Chihuahua', 1200, 5, 1, 0),
      (2, 'Carbonara', 1500, 5, 2, 0);
    INSERT INTO visits (id, visited_at, restaurant_id, deleted) VALUES
      (1, '2026-03-01', 1, 0),
      (2, '2026-03-15', 2, 0);
    INSERT INTO tags (id, name, color, deleted) VALUES
      (1, 'Favorito', '#ff0000', 0);
    INSERT INTO images (id, path, uploaded_at) VALUES
      (1, 'images/a.jpg', '2026-03-01T00:00:00Z');
    INSERT INTO restaurant_tag (restaurant_id, tag_id) VALUES (1, 1);
    INSERT INTO dish_tag (dish_id, tag_id) VALUES (1, 1);
    INSERT INTO dish_visit (visit_id, dish_id) VALUES (1, 1), (2, 2);
  `);
}

describe('migration 0007 — sync columns', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => db.close());

  it('applies cleanly from scratch (fresh install)', () => {
    expect(() => applyMigrations(db)).not.toThrow();

    const cols = db.prepare(`PRAGMA table_info(restaurants)`).all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(['uuid', 'created_at', 'updated_at', 'visibility']),
    );
  });

  it('preserves every row when upgrading a populated v1 database', () => {
    seedV1(db);
    const before = {
      restaurants: (db.prepare('SELECT count(*) c FROM restaurants').get() as { c: number }).c,
      dishes: (db.prepare('SELECT count(*) c FROM dishes').get() as { c: number }).c,
      visits: (db.prepare('SELECT count(*) c FROM visits').get() as { c: number }).c,
      tags: (db.prepare('SELECT count(*) c FROM tags').get() as { c: number }).c,
      images: (db.prepare('SELECT count(*) c FROM images').get() as { c: number }).c,
    };

    applyMigrations(db, { from: 7 }); // applies 0007 on top

    for (const [table, count] of Object.entries(before)) {
      const after = (db.prepare(`SELECT count(*) c FROM ${table}`).get() as { c: number }).c;
      expect(after).toBe(count);
    }
  });

  it('backfills a distinct, valid v4 uuid for every existing row', () => {
    seedV1(db);
    applyMigrations(db, { from: 7 });

    for (const table of ['restaurants', 'dishes', 'visits', 'tags', 'images']) {
      const rows = db.prepare(`SELECT uuid FROM ${table}`).all() as { uuid: string }[];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.uuid).toMatch(UUID_V4);
      }
      const uuids = rows.map((r) => r.uuid);
      expect(new Set(uuids).size).toBe(uuids.length); // all distinct
    }
  });

  it('backfills timestamps and leaves visibility deferring to the setting', () => {
    seedV1(db);
    applyMigrations(db, { from: 7 });

    const r = db
      .prepare('SELECT created_at, updated_at, visibility FROM restaurants WHERE id = 1')
      .get() as { created_at: string; updated_at: string; visibility: string };

    expect(r.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.updated_at).toBe(r.created_at);
    expect(r.visibility).toBe('default');
  });

  it('preserves foreign-key relationships (dish → restaurant)', () => {
    seedV1(db);
    applyMigrations(db, { from: 7 });

    const dish = db.prepare('SELECT restaurant_id FROM dishes WHERE name = ?').get('Chihuahua') as {
      restaurant_id: number;
    };
    expect(dish.restaurant_id).toBe(1);

    const restaurant = db
      .prepare('SELECT name FROM restaurants WHERE id = ?')
      .get(dish.restaurant_id) as { name: string };
    expect(restaurant.name).toBe('Guadalupe');
  });

  it('enforces the uuid unique index', () => {
    seedV1(db);
    applyMigrations(db, { from: 7 });

    // Take row 1's uuid and try to force it onto row 2 (a different row, so
    // this is a genuine collision — not a no-op self-assignment).
    const row1 = db.prepare('SELECT uuid FROM restaurants WHERE id = 1').get() as { uuid: string };
    expect(() => db.prepare('UPDATE restaurants SET uuid = ? WHERE id = 2').run(row1.uuid)).toThrow(
      /UNIQUE/i,
    );
  });

  it('creates the new tables (people, visit_participant, change_log)', () => {
    applyMigrations(db);
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as {
      name: string;
    }[];
    const names = tables.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['people', 'visit_participant', 'change_log']));
  });
});
