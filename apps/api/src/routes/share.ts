import { Hono } from 'hono';
import { nanoid } from 'nanoid';

import { renderPreviewHtml, type SharePreview } from '../preview';
import { createSupabaseShareStore, isLive, type ShareStore } from '../shareStore';

import type { AppContext, Env } from '../types';

/**
 * Share links (docs/05): create a link for an entity, resolve it as a web
 * preview (no app) or as JSON (the app imports it). The store is injected so
 * this router is testable with a fake.
 */
export function shareRoutes(storeFor: (env: Env) => ShareStore = createSupabaseShareStore) {
  const app = new Hono<AppContext>();

  // Create a link (auth required — the content must belong to the caller).
  app.post('/share', async (c) => {
    const user = c.get('user');
    const body = await c.req.json<{
      type: SharePreview['type'];
      content: unknown;
      preview: Omit<SharePreview, 'id'>;
      expiresAt?: string | null;
    }>();

    if (!body?.type || !body.content || !body.preview) {
      return c.json({ error: 'invalid-body' }, 400);
    }

    const id = nanoid(10);
    const preview: SharePreview = { ...body.preview, id, type: body.type };

    await storeFor(c.env).create({
      id,
      ownerId: user.id,
      type: body.type,
      content: body.content,
      preview,
      createdAt: new Date().toISOString(),
      expiresAt: body.expiresAt ?? null,
      revoked: false,
    });

    return c.json({ id, url: `${c.env.PUBLIC_BASE_URL}/s/${id}` });
  });

  // Public web preview (unfurl + "open in app").
  app.get('/s/:id', async (c) => {
    const record = await storeFor(c.env).get(c.req.param('id'));
    if (!record || !isLive(record)) return c.text('No encontrado', 404);
    return c.html(renderPreviewHtml(record.preview, c.env.PUBLIC_BASE_URL));
  });

  // JSON payload the app imports (public: the link is the capability).
  app.get('/share/:id/data', async (c) => {
    const record = await storeFor(c.env).get(c.req.param('id'));
    if (!record || !isLive(record)) return c.json({ error: 'not-found' }, 404);
    return c.json({ type: record.type, content: record.content });
  });

  // Revoke (auth required, owner only).
  app.delete('/share/:id', async (c) => {
    const user = c.get('user');
    await storeFor(c.env).revoke(c.req.param('id'), user.id);
    return c.json({ ok: true });
  });

  return app;
}
