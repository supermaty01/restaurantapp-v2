import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { imageRoutes, sniffImageType } from '../src/routes/images';

import type { Env } from '../src/types';

/**
 * Lo que se puede guardar en R2 y cómo se sirve.
 *
 * El agujero: el Worker guardaba el `content-type` que mandara quien subía y el
 * `GET` —que es **público**— lo devolvía tal cual, con `immutable` a un año.
 * Subir `text/html` daba una página ejecutándose en el mismo origen que sirve
 * las previsualizaciones de `/s/:id`, sin forma de invalidarla.
 */

/** R2 de mentira: un Map, que es todo lo que estas rutas necesitan de él. */
function fakeBucket() {
  const objects = new Map<string, { body: ArrayBuffer; contentType?: string | undefined }>();
  return {
    objects,
    async put(
      key: string,
      body: ArrayBuffer,
      options?: { httpMetadata?: { contentType?: string } },
    ) {
      objects.set(key, { body, contentType: options?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const found = objects.get(key);
      if (!found) return null;
      return {
        body: found.body,
        httpMetadata: { contentType: found.contentType },
        httpEtag: '"x"',
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const HTML = new TextEncoder().encode('<script>alert(1)</script>          ');

function request(
  bucket: ReturnType<typeof fakeBucket>,
  method: string,
  path: string,
  body?: BodyInit,
) {
  const outer = new Hono<{ Bindings: Env; Variables: { user: { id: string } } }>();
  outer.use('*', async (c, next) => {
    c.set('user', { id: 'user-1' });
    return next();
  });
  outer.route('/', imageRoutes());
  const env = { IMAGES: bucket } as unknown as Env;
  return outer.request(path, { method, ...(body ? { body } : {}) }, env);
}

describe('sniffImageType', () => {
  it('reconoce los formatos que la app produce', () => {
    expect(sniffImageType(JPEG)).toBe('image/jpeg');
    expect(sniffImageType(PNG)).toBe('image/png');
  });

  it('no se deja engañar por HTML', () => {
    expect(sniffImageType(HTML)).toBeNull();
  });

  it('no confunde un MP4 con una foto', () => {
    // `ftyp` es la caja inicial de HEIC **y** de MP4. Aceptar cualquier `ftyp`
    // dejaría entrar vídeo por la puerta de las fotos.
    const mp4 = new Uint8Array([
      0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0,
    ]);
    expect(sniffImageType(mp4)).toBeNull();

    const heic = new Uint8Array([
      0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0,
    ]);
    expect(sniffImageType(heic)).toBe('image/heic');
  });
});

describe('PUT /images/:id', () => {
  it('acepta una foto', async () => {
    const bucket = fakeBucket();
    const res = await request(bucket, 'PUT', '/images/abc', JPEG);
    expect(res.status).toBe(200);
    expect(bucket.objects.get('user-1/abc')?.contentType).toBe('image/jpeg');
  });

  it('rechaza HTML disfrazado de foto', async () => {
    const bucket = fakeBucket();
    const res = await request(bucket, 'PUT', '/images/malo', HTML);
    expect(res.status).toBe(415);
    expect(bucket.objects.size).toBe(0);
  });

  it('guarda el tipo real, no el que diga la cabecera', async () => {
    // La app sube todo como `image/jpeg` esté en el formato que esté; el PNG se
    // guardaba mintiendo sobre lo que era.
    const bucket = fakeBucket();
    await request(bucket, 'PUT', '/images/png', PNG);
    expect(bucket.objects.get('user-1/png')?.contentType).toBe('image/png');
  });

  it('rechaza un cuerpo vacío', async () => {
    const res = await request(fakeBucket(), 'PUT', '/images/vacio', new Uint8Array());
    expect(res.status).toBe(400);
  });

  it('rechaza lo que no cabe', async () => {
    const bucket = fakeBucket();
    const huge = new Uint8Array(16 * 1024 * 1024);
    huge.set(JPEG.slice(0, 3));
    const res = await request(bucket, 'PUT', '/images/enorme', huge);
    expect(res.status).toBe(413);
  });
});

describe('GET /images/:userId/:id', () => {
  it('sirve la foto sin dejar que el navegador adivine el tipo', async () => {
    const bucket = fakeBucket();
    await request(bucket, 'PUT', '/images/abc', JPEG);

    const res = await request(bucket, 'GET', '/images/user-1/abc');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('sirve como descarga lo que se subió antes de la lista de tipos', async () => {
    // Los objetos que ya están en R2 pueden llevar cualquier content-type: se
    // subieron cuando nadie lo comprobaba. No se pueden reescribir, pero sí
    // servir de forma que el navegador no los ejecute.
    const bucket = fakeBucket();
    bucket.objects.set('user-1/viejo', {
      body: HTML.buffer,
      contentType: 'text/html',
    });

    const res = await request(bucket, 'GET', '/images/user-1/viejo');
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toBe('attachment');
  });

  it('devuelve 404 cuando no está', async () => {
    const res = await request(fakeBucket(), 'GET', '/images/user-1/nada');
    expect(res.status).toBe(404);
  });
});
