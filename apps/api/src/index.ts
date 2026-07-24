import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { verifySupabaseJwt } from './auth';
import { aiRoutes } from './routes/ai';
import { imageRoutes } from './routes/images';
import { shareRoutes } from './routes/share';

import type { AppContext } from './types';

/**
 * Worker entry (docs/05). Public routes: health, share preview/data, image
 * reads. Everything else requires a valid Supabase JWT. Kept small on purpose —
 * CRUD/sync go client→Supabase; the Worker is only for what needs a server.
 */
const app = new Hono<AppContext>();

app.use('*', cors());

app.get('/health', (c) => c.json({ ok: true }));

// Public endpoints (no auth): share resolution and image reads. Entries are
// method-aware on purpose — a path-only allowlist would silently expose any
// future write sharing the same shape (e.g. DELETE /images/:user/:id).
const PUBLIC: { method: string; pattern: RegExp }[] = [
  { method: 'GET', pattern: /^\/health$/ },
  { method: 'GET', pattern: /^\/s\/[^/]+$/ },
  { method: 'GET', pattern: /^\/share\/[^/]+\/data$/ },
  { method: 'GET', pattern: /^\/images\/[^/]+\/[^/]+$/ },
];

app.use('*', async (c, next) => {
  const isPublic = PUBLIC.some(
    ({ method, pattern }) => c.req.method === method && pattern.test(c.req.path),
  );
  if (isPublic) return next();

  const user = await verifySupabaseJwt(c.req.header('authorization'), c.env);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', user);
  return next();
});

app.route('/', shareRoutes());
app.route('/', imageRoutes());
app.route('/', aiRoutes());

export default app;
