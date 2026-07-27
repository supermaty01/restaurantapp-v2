import { Hono } from 'hono';

import type { AppContext } from '../types';

/**
 * Image storage on R2 (docs/05): photos live here, not in Supabase Storage
 * (10 GB free, no egress). Uploads are proxied through the Worker (R2 bindings
 * don't presign), namespaced by user so one account can't touch another's keys.
 *
 * Needs the R2 binding to run (verify per docs/13).
 */

/**
 * Lo único que se acepta subir.
 *
 * Antes se guardaba el `content-type` que mandara el cliente y el `GET` público
 * lo devolvía tal cual. Subiendo `text/html` se obtenía una página ejecutándose
 * **en el mismo origen** que sirve las previsualizaciones de `/s/:id`, cacheada
 * un año por el `immutable` y sin forma de invalidarla desde aquí. Es una app de
 * fotos: la lista de tipos que tiene sentido aceptar es corta y cerrada.
 */
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

/** 15 MB. Una foto de móvil cabe de sobra; un vídeo no. */
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Las firmas de los formatos que se aceptan.
 *
 * Mirando los bytes y no la cabecera, porque la cabecera la escribe quien sube:
 * decir `image/jpeg` y mandar HTML es exactamente lo que hay que impedir, y el
 * `content-type` no demuestra nada sobre el contenido.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const at = (index: number) => bytes[index];
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => at(index) === byte);
  const ascii = (from: number, length: number) => {
    const codes: number[] = [];
    for (let i = from; i < from + length; i++) {
      const code = at(i);
      if (code === undefined) return null;
      codes.push(code);
    }
    return String.fromCharCode(...codes);
  };

  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (startsWith(0x52, 0x49, 0x46, 0x46) && ascii(8, 4) === 'WEBP') return 'image/webp';

  // HEIC/HEIF, que es lo que hace un iPhone. Hay que mirar la marca además de
  // la caja `ftyp`: un MP4 empieza exactamente igual, y aceptar cualquier
  // `ftyp` sería dejar pasar vídeo por la puerta de las fotos.
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (brand !== null && ['heic', 'heix', 'hevc', 'heim', 'mif1', 'msf1'].includes(brand)) {
      return 'image/heic';
    }
  }

  return null;
}

export function imageRoutes() {
  const app = new Hono<AppContext>();

  // Upload (or replace) an image. Body is the raw bytes.
  app.put('/images/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');

    // Antes de leer el cuerpo: sin esto, rechazar por tamaño obliga a haber
    // recibido antes el tamaño entero.
    const declared = Number(c.req.header('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      return c.json({ error: 'too-large' }, 413);
    }

    const body = await c.req.arrayBuffer();
    if (body.byteLength === 0) return c.json({ error: 'empty' }, 400);
    if (body.byteLength > MAX_BYTES) return c.json({ error: 'too-large' }, 413);

    // El tipo lo decide el contenido, no la cabecera.
    const detected = sniffImageType(new Uint8Array(body.slice(0, 16)));
    if (detected === null || !ALLOWED_TYPES.has(detected)) {
      return c.json({ error: 'unsupported-type' }, 415);
    }

    const key = `${user.id}/${id}`;
    await c.env.IMAGES.put(key, body, { httpMetadata: { contentType: detected } });
    return c.json({ key });
  });

  // Read an image. Keys are `${userId}/${imageId}`; the owner segment is the
  // capability, so this is unauthenticated to allow share-link previews.
  app.get('/images/:userId/:id', async (c) => {
    const key = `${c.req.param('userId')}/${c.req.param('id')}`;
    const object = await c.env.IMAGES.get(key);
    if (!object) return c.text('No encontrado', 404);

    // El tipo guardado, pero solo si sigue en la lista: los objetos subidos
    // antes de que existiera esta comprobación pueden llevar cualquier cosa, y
    // ésos se sirven como descarga en lugar de como documento.
    const stored = object.httpMetadata?.contentType;
    const safe = stored !== undefined && ALLOWED_TYPES.has(stored);

    return new Response(object.body, {
      headers: {
        'content-type': safe ? stored : 'application/octet-stream',
        // Que el navegador no adivine el tipo por el contenido: adivinarlo es
        // lo que convierte un fichero servido como binario en una página.
        'x-content-type-options': 'nosniff',
        ...(safe ? {} : { 'content-disposition': 'attachment' }),
        // Cinturón sobre los tirantes: aunque algo llegara a interpretarse como
        // documento, aquí dentro no se ejecuta nada.
        'content-security-policy': "default-src 'none'; sandbox",
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
