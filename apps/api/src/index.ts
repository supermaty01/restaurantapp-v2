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

// Public paths (no auth): share resolution and image reads.
const PUBLIC = [/^\/health$/, /^\/s\//, /^\/share\/[^/]+\/data$/, /^\/images\/[^/]+\/[^/]+$/];

app.use('*', async (c, next) => {
  if (PUBLIC.some((re) => re.test(c.req.path))) return next();

  const user = await verifySupabaseJwt(c.req.header('authorization'), c.env.SUPABASE_JWT_SECRET);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', user);
  return next();
});

app.route('/', shareRoutes());
app.route('/', imageRoutes());
app.route('/', aiRoutes());

export default app;
