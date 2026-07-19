import { describe, expect, it } from 'vitest';

import { shareRoutes } from '../src/routes/share';
import { isLive, type ShareRecord, type ShareStore } from '../src/shareStore';

import type { Env } from '../src/types';

// In-memory store, so the share routes are tested without Supabase.
function fakeStore(): ShareStore & { records: Map<string, ShareRecord> } {
  const records = new Map<string, ShareRecord>();
  return {
    records,
    async create(r) {
      records.set(r.id, r);
    },
    async get(id) {
      return records.get(id) ?? null;
    },
    async revoke(id, ownerId) {
      const r = records.get(id);
      if (r && r.ownerId === ownerId) r.revoked = true;
    },
  };
}

const ENV = { PUBLIC_BASE_URL: 'https://x.app' } as Env;

// Wraps the share router with a middleware that injects an authenticated user,
// as the real auth middleware would, so routes can be exercised in isolation.
function request(store: ShareStore, method: string, path: string, body?: unknown) {
  const app = shareRoutes(() => store);
  const outer = new (app.constructor as typeof import('hono').Hono)<{
    Bindings: Env;
    Variables: { user: { id: string } };
  }>();
  outer.use('*', async (c, next) => {
    c.set('user', { id: 'user-1' });
    return next();
  });
  outer.route('/', app);
  return outer.request(
    path,
    {
      method,
      ...(body
        ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
        : {}),
    },
    ENV,
  );
}

describe('share routes', () => {
  it('creates a link and returns a url', async () => {
    const store = fakeStore();
    const res = await request(store, 'POST', '/share', {
      type: 'restaurant',
      content: { name: 'Guadalupe' },
      preview: { title: 'Guadalupe', type: 'restaurant' },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { id: string; url: string };
    expect(json.url).toBe(`https://x.app/s/${json.id}`);
    expect(store.records.size).toBe(1);
  });

  it('rejects a malformed create body', async () => {
    const res = await request(fakeStore(), 'POST', '/share', { type: 'restaurant' });
    expect(res.status).toBe(400);
  });

  it('serves the web preview for a live link', async () => {
    const store = fakeStore();
    const created = await (
      await request(store, 'POST', '/share', {
        type: 'restaurant',
        content: { name: 'Guadalupe' },
        preview: { title: 'Guadalupe', type: 'restaurant' },
      })
    ).json();
    const id = (created as { id: string }).id;

    const res = await request(store, 'GET', `/s/${id}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('og:title');
  });

  it('returns 404 for a revoked or expired link', async () => {
    const store = fakeStore();
    store.records.set('gone', {
      id: 'gone',
      ownerId: 'user-1',
      type: 'restaurant',
      content: {},
      preview: { id: 'gone', type: 'restaurant', title: 'x' },
      createdAt: new Date().toISOString(),
      expiresAt: null,
      revoked: true,
    });
    expect((await request(store, 'GET', '/s/gone')).status).toBe(404);
    expect((await request(store, 'GET', '/share/gone/data')).status).toBe(404);
  });

  it('serves import JSON for a live link', async () => {
    const store = fakeStore();
    const created = await (
      await request(store, 'POST', '/share', {
        type: 'dish',
        content: { name: 'Chihuahua' },
        preview: { title: 'Chihuahua', type: 'dish' },
      })
    ).json();
    const id = (created as { id: string }).id;

    const res = await request(store, 'GET', `/share/${id}/data`);
    const json = (await res.json()) as { type: string; content: { name: string } };
    expect(json.type).toBe('dish');
    expect(json.content.name).toBe('Chihuahua');
  });
});

describe('isLive', () => {
  const base: ShareRecord = {
    id: 'x',
    ownerId: 'u',
    type: 'restaurant',
    content: {},
    preview: { id: 'x', type: 'restaurant', title: 't' },
    createdAt: '2026-01-01',
    expiresAt: null,
    revoked: false,
  };
  it('is false when revoked or expired', () => {
    expect(isLive(base)).toBe(true);
    expect(isLive({ ...base, revoked: true })).toBe(false);
    expect(isLive({ ...base, expiresAt: '2000-01-01T00:00:00Z' })).toBe(false);
  });
});
