import type { AppDatabase } from '@/services/db/types';

import { toRemoteRecord, toTombstoneRecord } from '../records';

import type { SyncTableConfig } from '../tables';

/**
 * The push turns a local row into a record the mirror will accept. What is
 * worth pinning here is the reporting: importing a v1 backup replaces the
 * SQLite file wholesale, so rows can arrive missing fields the mirror requires,
 * and PostgREST names the constraint but never the row that broke it.
 */
const config = {
  name: 'restaurants',
  table: {} as SyncTableConfig['table'],
  scalars: [
    { local: 'name', remote: 'name', required: true },
    { local: 'comments', remote: 'comments' },
  ],
  foreignKeys: [],
} satisfies SyncTableConfig;

const db = {} as AppDatabase;

function localRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    uuid: 'row-uuid',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    deleted: false,
    name: 'Trattoria Bella',
    comments: null,
    ...overrides,
  };
}

describe('toRemoteRecord', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('maps local keys to the mirror column names', async () => {
    const record = await toRemoteRecord(db, config, localRow(), 'account-uuid');

    expect(record).toMatchObject({
      uuid: 'row-uuid',
      user_id: 'account-uuid',
      name: 'Trattoria Bella',
      deleted: false,
    });
  });

  it('sends an absent optional value as null', async () => {
    const record = await toRemoteRecord(db, config, localRow(), 'account-uuid');
    expect(record['comments']).toBeNull();
  });

  it('names the row when a required value is missing', async () => {
    await toRemoteRecord(db, config, localRow({ name: null }), 'account-uuid');

    const message = String(warn.mock.calls[0]?.[0] ?? '');
    // The id and uuid are the whole point: they are how you find the row.
    expect(message).toContain('#42');
    expect(message).toContain('row-uuid');
    expect(message).toContain('name');
  });

  it('says nothing when nothing is missing', async () => {
    await toRemoteRecord(db, config, localRow(), 'account-uuid');
    expect(warn).not.toHaveBeenCalled();
  });

  it('fills a missing value from its fallback instead of failing', async () => {
    // Visibility was added long after the first diaries were written, so rows
    // that predate it have none — and the mirror requires one.
    const withFallback = {
      ...config,
      scalars: [
        { local: 'visibility', remote: 'visibility', required: true, fallback: () => 'friends' },
      ],
    } satisfies SyncTableConfig;

    const record = await toRemoteRecord(
      db,
      withFallback,
      localRow({ visibility: null }),
      'account-uuid',
    );

    expect(record['visibility']).toBe('friends');
    // Filled in, so nothing is wrong and nothing needs reporting.
    expect(warn).not.toHaveBeenCalled();
  });

  it('uses the row own value in preference to the fallback', async () => {
    const withFallback = {
      ...config,
      scalars: [
        { local: 'visibility', remote: 'visibility', required: true, fallback: () => 'friends' },
      ],
    } satisfies SyncTableConfig;

    const record = await toRemoteRecord(
      db,
      withFallback,
      localRow({ visibility: 'private' }),
      'account-uuid',
    );

    expect(record['visibility']).toBe('private');
  });

  it('still builds the record, so one bad row does not hide the rest', async () => {
    // The push will fail on this row either way; refusing to build it would
    // just move the failure somewhere with less context.
    const record = await toRemoteRecord(db, config, localRow({ name: null }), 'account-uuid');
    expect(record['name']).toBeNull();
    expect(record['uuid']).toBe('row-uuid');
  });
});

describe('toTombstoneRecord', () => {
  const visits = {
    name: 'visits',
    table: {} as SyncTableConfig['table'],
    scalars: [
      { local: 'visitedAt', remote: 'visited_at' },
      { local: 'visibility', remote: 'visibility', required: true, fallback: () => 'private' },
      { local: 'name', remote: 'name', required: true },
    ],
    foreignKeys: [],
  } satisfies SyncTableConfig;

  it('marks the row deleted', () => {
    expect(toTombstoneRecord(visits, 'gone-uuid', 'account')).toMatchObject({
      uuid: 'gone-uuid',
      user_id: 'account',
      deleted: true,
    });
  });

  it('satisfies every column the mirror requires', () => {
    // Building a tombstone from scratch skipped these, so deleting a visit
    // failed the push with "violates not-null constraint" — the same error as
    // a row that had never been filled in, from a completely different cause.
    const record = toTombstoneRecord(visits, 'gone-uuid', 'account');

    expect(record['visibility']).toBe('private');
    expect(record['name']).not.toBeNull();
    expect(record['name']).not.toBeUndefined();
  });

  it('leaves optional columns out', () => {
    // Nothing reads them, and inventing a date for a deleted visit would be a
    // lie that outlives the row.
    expect(toTombstoneRecord(visits, 'gone-uuid', 'account')).not.toHaveProperty('visited_at');
  });
});
