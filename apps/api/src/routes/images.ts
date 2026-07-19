import { Hono } from 'hono';

import type { AppContext } from '../types';

/**
 * Image storage on R2 (docs/05): photos live here, not in Supabase Storage
 * (10 GB free, no egress). Uploads are proxied through the Worker (R2 bindings
 * don't presign), namespaced by user so one account can't touch another's keys.
 *
 * Needs the R2 binding to run (verify per docs/13).
 */
export function imageRoutes() {
  const app = new Hono<AppContext>();

  // Upload (or replace) an image. Body is the raw bytes.
  app.put('/images/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const key = `${user.id}/${id}`;

    const body = await c.req.arrayBuffer();
    if (body.byteLength === 0) return c.json({ error: 'empty' }, 400);

    await c.env.IMAGES.put(key, body, {
      httpMetadata: { contentType: c.req.header('content-type') ?? 'image/jpeg' },
    });
    return c.json({ key });
  });

  // Read an image. Keys are `${userId}/${imageId}`; the owner segment is the
  // capability, so this is unauthenticated to allow share-link previews.
  app.get('/images/:userId/:id', async (c) => {
    const key = `${c.req.param('userId')}/${c.req.param('id')}`;
    const object = await c.env.IMAGES.get(key);
    if (!object) return c.text('No encontrado', 404);

    return new Response(object.body, {
      headers: {
        'content-type': object.httpMetadata?.contentType ?? 'image/jpeg',
        'cache-control': 'public, max-age=31536000, immutable',
        etag: object.httpEtag,
      },
    });
  });

  // Delete an image (owner only).
  app.delete('/images/:id', async (c) => {
    const user = c.get('user');
    await c.env.IMAGES.delete(`${user.id}/${c.req.param('id')}`);
    return c.json({ ok: true });
  });

  return app;
}
