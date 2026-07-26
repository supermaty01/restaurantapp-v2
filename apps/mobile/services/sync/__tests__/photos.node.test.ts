/* eslint-disable import/first --
 * Los imports van después de los `jest.mock` a propósito. Babel sube las
 * llamadas a `jest.mock` por encima de todo, pero **no** las constantes que
 * usan sus fábricas: con los imports arriba, cargar `photos.ts` dispara la
 * fábrica de `expo-file-system` antes de que exista `mockFiles` y el suite se
 * cae con un error de zona muerta que no se parece en nada a su causa. */
import { eq } from 'drizzle-orm';

/**
 * Las fotos, hasta el final y en la dirección correcta.
 *
 * Los dos fallos que se prueban aquí se vieron en un móvil recién estrenado
 * iniciando sesión:
 *
 * 1. **Paraba cada quince.** Había un tope por pasada. La sincronización se
 *    daba por buena con novecientas fotos aún en el servidor y no volvía sola:
 *    había que salir y entrar de la app, una vez por tanda.
 * 2. **Decía que subía mientras bajaba.** Subida y bajada compartían el mismo
 *    reporte de progreso y la etiqueta la ponía la pantalla, así que restaurar
 *    un diario se anunciaba como "Subiendo fotos".
 *
 * El módulo habla con el sistema de ficheros y con Supabase; los dos están
 * simulados. La base de datos no: es SQLite de verdad, porque lo que hay que
 * comprobar es que la clave remota acaba escrita en la fila.
 */

const mockFiles = new Map<string, string>();
const mockUploaded: string[] = [];
const mockDownloaded: string[] = [];
let mockUploadStatus = 200;
let mockDownloadStatus = 200;

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  FileSystemUploadType: { BINARY_CONTENT: 1 },
  makeDirectoryAsync: jest.fn(async () => undefined),
  readDirectoryAsync: jest.fn(async (dir: string) => {
    const names = [...mockFiles.keys()]
      .filter((path) => path.startsWith(dir))
      .map((path) => path.slice(dir.length));
    return names;
  }),
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFiles.has(uri) })),
  uploadAsync: jest.fn(async (url: string) => {
    mockUploaded.push(url);
    return { status: mockUploadStatus, body: '' };
  }),
  downloadAsync: jest.fn(async (url: string, target: string) => {
    mockDownloaded.push(url);
    if (mockDownloadStatus >= 200 && mockDownloadStatus < 300) mockFiles.set(target, 'jpeg');
    return { status: mockDownloadStatus };
  }),
  deleteAsync: jest.fn(async (target: string) => {
    mockFiles.delete(target);
  }),
}));

jest.mock('@/services/supabase/client', () => ({
  getSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
  }),
}));

import { IMAGES_DIR } from '@/lib/helpers/fs-paths';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import {
  downloadMissingPhotos,
  uploadPendingPhotos,
  type PhotoProgress,
} from '@/services/sync/photos';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

/** Más que el tope de quince que había, para que la diferencia se note. */
const MANY = 40;

function uuidFor(index: number): string {
  return `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`;
}

async function addPhotos(
  db: AppDatabase,
  count: number,
  options: { remoteKey?: boolean; onDisk?: boolean },
) {
  for (let index = 0; index < count; index++) {
    const uuid = uuidFor(index);
    const path = `${uuid}.jpg`;
    await db.insert(schema.images).values({
      uuid,
      path,
      ...(options.remoteKey ? { remoteKey: uuid } : {}),
    });
    if (options.onDisk) mockFiles.set(`${IMAGES_DIR}${path}`, 'jpeg');
  }
}

beforeEach(() => {
  mockFiles.clear();
  mockUploaded.length = 0;
  mockDownloaded.length = 0;
  mockUploadStatus = 200;
  mockDownloadStatus = 200;
});

describe('subir fotos', () => {
  it('sube todas las que faltan, no una tanda', async () => {
    const { db } = makeTestDb();
    await addPhotos(db, MANY, { onDisk: true });

    const result = await uploadPendingPhotos(db);

    expect(result.moved).toBe(MANY);
    expect(result.failed).toBe(0);
    expect(mockUploaded).toHaveLength(MANY);

    // Y queda escrito: sin la clave en la fila, la foto está en R2 y nadie la
    // encuentra.
    const rows = await db.select().from(schema.images);
    expect(rows.every((row) => row.remoteKey !== null)).toBe(true);
  });

  it('avisa del progreso como subida, y llega hasta el total', async () => {
    const { db } = makeTestDb();
    await addPhotos(db, 3, { onDisk: true });

    const seen: PhotoProgress[] = [];
    await uploadPendingPhotos(db, (progress) => seen.push(progress));

    expect(seen.every((p) => p.phase === 'upload')).toBe(true);
    expect(seen.at(-1)).toEqual({ phase: 'upload', done: 3, total: 3 });
  });

  it('una foto que no está en disco no impide subir las demás', async () => {
    const { db } = makeTestDb();
    await addPhotos(db, 3, { onDisk: true });
    mockFiles.delete(`${IMAGES_DIR}${uuidFor(1)}.jpg`);

    const result = await uploadPendingPhotos(db);

    expect(result.moved).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.reasons).toHaveLength(1);
  });

  it('un rechazo del Worker deja la fila sin clave, para reintentarla', async () => {
    const { db } = makeTestDb();
    await addPhotos(db, 2, { onDisk: true });
    mockUploadStatus = 401;

    const result = await uploadPendingPhotos(db);

    expect(result.moved).toBe(0);
    expect(result.failed).toBe(2);
    const rows = await db.select().from(schema.images);
    expect(rows.every((row) => row.remoteKey === null)).toBe(true);
  });
});

describe('bajar fotos', () => {
  it('baja todas las que faltan, no una tanda', async () => {
    const { db } = makeTestDb();
    await addPhotos(db, MANY, { remoteKey: true, onDisk: false });

    const result = await downloadMissingPhotos(db, ACCOUNT);

    expect(result.moved).toBe(MANY);
    expect(mockDownloaded).toHaveLength(MANY);
    // La cuenta va en la URL: la lectura es pública y el segmento del dueño
    // *es* la capacidad.
    expect(mockDownloaded[0]).toContain(`/images/${ACCOUNT}/`);
  });

  it('avisa del progreso como bajada — no como subida', async () => {
    const { db } = makeTestDb();
    await addPhotos(db, 3, { remoteKey: true, onDisk: false });

    const seen: PhotoProgress[] = [];
    await downloadMissingPhotos(db, ACCOUNT, (progress) => seen.push(progress));

    expect(seen.every((p) => p.phase === 'download')).toBe(true);
    expect(seen.at(-1)).toEqual({ phase: 'download', done: 3, total: 3 });
  });

  it('no vuelve a bajar lo que ya está en disco', async () => {
    const { db } = makeTestDb();
    await addPhotos(db, 3, { remoteKey: true, onDisk: true });

    const result = await downloadMissingPhotos(db, ACCOUNT);

    expect(result.moved).toBe(0);
    expect(mockDownloaded).toHaveLength(0);
  });

  it('un error borra el fichero, para que no quede un cuerpo de error como foto', async () => {
    const { db } = makeTestDb();
    await addPhotos(db, 1, { remoteKey: true, onDisk: false });
    mockDownloadStatus = 404;

    const result = await downloadMissingPhotos(db, ACCOUNT);

    expect(result.failed).toBe(1);
    expect(mockFiles.has(`${IMAGES_DIR}${uuidFor(0)}.jpg`)).toBe(false);
  });

  it('deja la ruta local apuntando al fichero recién bajado', async () => {
    const { db } = makeTestDb();
    const uuid = uuidFor(0);
    // Una ruta heredada de otro teléfono: aquí no existe ese sitio.
    await db.insert(schema.images).values({ uuid, path: 'viejo/otra-cosa.jpg', remoteKey: uuid });

    await downloadMissingPhotos(db, ACCOUNT);

    const [row] = await db.select().from(schema.images).where(eq(schema.images.uuid, uuid));
    expect(row?.path).toBe(`${uuid}.jpg`);
  });
});
