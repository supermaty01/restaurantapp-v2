import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { verifySupabaseJwt } from './auth';
import { createSupabasePushStore, deliverPending, expoSender } from './push';
import { aiRoutes } from './routes/ai';
import { imageRoutes } from './routes/images';
import { shareRoutes } from './routes/share';
import { purgeExpiredShares } from './shareStore';

import type { AppContext, Env } from './types';

/**
 * Worker entry (docs/05). Public routes: health, share preview/data, image
 * reads. Everything else requires a valid Supabase JWT. Kept small on purpose —
 * CRUD/sync go client→Supabase; the Worker is only for what needs a server.
 */
const app = new Hono<AppContext>();

/**
 * CORS, y solo donde hace falta.
 *
 * Estaba como `cors()` en `*`, que es `Access-Control-Allow-Origin: *` sobre
 * todas las rutas, incluidas las autenticadas. Con Bearer y sin cookies el daño
 * es limitado, pero la app es nativa: **no hay ningún navegador que necesite
 * llamar a las rutas privadas**. Lo único que un navegador tiene que poder
 * pedir es la previsualización pública de un enlace y la imagen que la
 * acompaña, y para eso basta con GET.
 */
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['content-type'],
    maxAge: 86_400,
  }),
);

/**
 * Cabeceras que no cuestan nada y cierran clases enteras de problema.
 *
 * `nosniff` sobre todo lo que sirve el Worker, y una CSP severa en la página de
 * previsualización: es HTML generado por nosotros con datos que escribió otra
 * persona, así que lo que no necesita —scripts, iframes, formularios— se apaga
 * en vez de confiar en el escapado. El escapado sigue estando; esto es la
 * segunda línea.
 */
app.use('*', async (c, next) => {
  await next();
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'no-referrer');
  if (c.res.headers.get('content-type')?.includes('text/html')) {
    c.header(
      'content-security-policy',
      "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  }
});

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
/** El cron de madrugada, tal y como está escrito en wrangler.toml. */
const NIGHTLY_CRON = '0 3 * * *';

export default {
  fetch: app.fetch,

  /**
   * Los dos crones, distinguidos por `event.cron`.
   *
   * El parámetro se llamaba `_event` y no se miraba, así que **las dos
   * programaciones hacían lo mismo**: repartir push. El barrido de madrugada que
   * `wrangler.toml` documenta —enlaces caducados, objetos huérfanos de R2— no
   * existía en ninguna parte, y R2 llevaba acumulando desde el principio.
   */
  // Sin `async`: aquí no se espera nada, se encolan dos trabajos con
  // `waitUntil` y se vuelve. Declararlo `async` sugería lo contrario.
  scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): void {
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

    if (event.cron === NIGHTLY_CRON) {
      ctx.waitUntil(
        purgeExpiredShares(env)
          .then((removed) => {
            if (removed > 0) console.log(`[purga] ${removed} enlaces caducados retirados`);
          })
          .catch((error: unknown) => {
            console.error('[purga] no se pudo limpiar:', error);
          }),
      );
    }
  },
};
