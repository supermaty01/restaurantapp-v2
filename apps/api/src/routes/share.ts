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

/**
 * Tope del payload de un enlace.
 *
 * Generoso a propósito —una visita con fotos en base64 ocupa— pero finito: el
 * contenido lo escribe quien llama y se guarda sin mirar, así que sin tope
 * cualquier cuenta puede llenar la base de datos del proyecto.
 */
const MAX_CONTENT_BYTES = 2_000_000;

const TYPES = new Set<SharePreview['type']>(['restaurant', 'dish', 'visit']);

export function shareRoutes(storeFor: (env: Env) => ShareStore = createSupabaseShareStore) {
  const app = new Hono<AppContext>();

  // Create a link (auth required — the content must belong to the caller).
  app.post('/share', async (c) => {
    const user = c.get('user');

    // El contenido lo elige quien llama y se guarda tal cual, así que sin tope
    // esto es alojamiento de JSON gratis con la cuota de otro. Se mide antes de
    // deserializar: `json()` sobre cien megas ya es el problema.
    const declared = Number(c.req.header('content-length') ?? '0');
    if (declared > MAX_CONTENT_BYTES) return c.json({ error: 'too-large' }, 413);

    const raw = await c.req.text();
    if (raw.length > MAX_CONTENT_BYTES) return c.json({ error: 'too-large' }, 413);

    let body: {
      type: SharePreview['type'];
      content: unknown;
      preview: Omit<SharePreview, 'id'>;
      expiresAt?: string | null;
    };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return c.json({ error: 'invalid-body' }, 400);
    }

    if (!body?.type || !body.content || !body.preview) {
      return c.json({ error: 'invalid-body' }, 400);
    }
    if (!TYPES.has(body.type)) return c.json({ error: 'invalid-type' }, 400);

    // Una caducidad que no se entiende se rechaza aquí en vez de guardarse.
    // Guardada, `isLive` la trataba como un enlace que no caduca nunca — el
    // fallo justo al revés del que uno quiere.
    if (body.expiresAt != null && !Number.isFinite(new Date(body.expiresAt).getTime())) {
      return c.json({ error: 'invalid-expiry' }, 400);
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
    try {
      await storeFor(c.env).revoke(c.req.param('id'), user.id);
    } catch {
      // Un enlace que sigue vivo no puede contestar que se retiró. Sin esto la
      // app enseñaba «revocado» y el contenido seguía publicado.
      return c.json({ error: 'revoke-failed' }, 502);
    }
    return c.json({ ok: true });
  });

  return app;
}
