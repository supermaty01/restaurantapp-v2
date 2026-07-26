import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { verifySupabaseJwt } from './auth';
import { createSupabasePushStore, deliverPending, expoSender } from './push';
import { aiRoutes } from './routes/ai';
import { imageRoutes } from './routes/images';
import { shareRoutes } from './routes/share';

import type { AppContext, Env } from './types';

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

/**
 * Las rutas, por separado del manejador.
 *
 * `app.request()` es el ayudante de Hono para probar rutas sin levantar nada, y
 * el export por defecto ya no es la app sino el objeto con `fetch` y
 * `scheduled`. Sin esta salida, los tests del límite de autenticación tendrían
 * que reconstruir una petición a mano.
 */
export { app };

/**
 * El Worker es dos cosas: las rutas y el cron.
 *
 * `export default app` a secas exporta solo `fetch`, así que el `[triggers]` de
 * `wrangler.toml` se disparaba contra un Worker sin `scheduled` y no hacía
 * nada — sin error, porque no hay a quién dárselo. Cualquier cosa periódica
 * tiene que entrar por aquí.
 */
export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // `waitUntil` y no `await` a secas: Cloudflare corta la ejecución cuando el
    // manejador vuelve, y una entrega a medias dejaría avisos mandados y sin
    // marcar, que es exactamente como se manda un push dos veces.
    ctx.waitUntil(
      deliverPending(createSupabasePushStore(env), expoSender())
        .then((result) => {
          // Solo cuando pasó algo: un log que aparece cada pasada del cron es
          // un log que se deja de leer.
          if (result.delivered > 0 || result.prunedTokens > 0) {
            console.log(
              `[push] ${result.delivered} entregados, ` +
                `${result.withoutDevice} sin dispositivo, ` +
                `${result.prunedTokens} fichas retiradas`,
            );
          }
        })
        .catch((error: unknown) => {
          // Nunca relanza: un fallo aquí deja los avisos sin marcar y la
          // siguiente pasada los recoge. Tumbar el cron los perdería.
          console.error('[push] no se pudo repartir:', error);
        }),
    );
  },
};
