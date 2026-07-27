import type { SharePreview } from './preview';
import type { Env } from './types';

/**
 * Persistence for share links (docs/05). Stored in Supabase (share_links). The
 * store is an interface so routes can be tested against an in-memory fake; the
 * Supabase implementation needs a live project (verify per docs/13).
 */

export interface ShareRecord {
  id: string;
  ownerId: string;
  type: SharePreview['type'];
  /** The full shareable payload the app imports (packages/shared schema). */
  content: unknown;
  preview: SharePreview;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
}

export interface ShareStore {
  create(record: ShareRecord): Promise<void>;
  get(id: string): Promise<ShareRecord | null>;
  revoke(id: string, ownerId: string): Promise<void>;
}

/**
 * Retira los enlaces que ya no sirven a nadie.
 *
 * `wrangler.toml` declara un cron de madrugada para esto desde el principio y
 * **no había nada que lo atendiera**: `scheduled` no miraba qué cron lo había
 * disparado, así que a las 3:00 se repartían push otra vez y los enlaces
 * caducados se quedaban en la tabla para siempre.
 *
 * Borra en vez de marcar: un enlace caducado no tiene historia que conservar, y
 * su `content` es el payload entero de una visita con sus fotos en base64.
 * Guardarlos es pagar almacenamiento por filas que ya devuelven 404.
 */
export async function purgeExpiredShares(env: Env): Promise<number> {
  const cutoff = new Date().toISOString();
  const url =
    `${env.SUPABASE_URL}/rest/v1/share_links` +
    `?or=(and(expires_at.not.is.null,expires_at.lt.${encodeURIComponent(cutoff)}),revoked.is.true)`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
  });

  if (!res.ok) throw new Error(`share purge failed: ${String(res.status)}`);
  const rows = await res.json<unknown[]>();
  return rows.length;
}

/**
 * ¿Sigue sirviendo este enlace?
 *
 * Una fecha de caducidad que no se entiende cuenta como **caducada**, no como
 * eterna. `new Date('mañana').getTime()` es `NaN`, y `NaN < Date.now()` es
 * `false`: con la comprobación escrita al derecho, cualquier cadena que no fuera
 * una fecha producía un enlace que no caducaba nunca. El fallo seguro es el
 * contrario — un enlace de menos se vuelve a crear; uno de más sigue publicado.
 */
export function isLive(record: ShareRecord): boolean {
  if (record.revoked) return false;

  if (record.expiresAt) {
    const expiry = new Date(record.expiresAt).getTime();
    if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  }

  return true;
}

/**
 * Supabase REST-backed store, using the server-side secret key so public link
 * resolution can bypass RLS.
 *
 * The modern `sb_secret_…` key is not a JWT, so it must travel in the `apikey`
 * header only — sending it as `Authorization: Bearer` gets rejected (that
 * worked with the legacy service_role JWT).
 */
export function createSupabaseShareStore(env: Env): ShareStore {
  const base = `${env.SUPABASE_URL}/rest/v1/share_links`;
  const headers = {
    apikey: env.SUPABASE_SECRET_KEY,
    'content-type': 'application/json',
  };

  return {
    async create(record) {
      const res = await fetch(base, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: record.id,
          owner_id: record.ownerId,
          entity_type: record.type,
          content: record.content,
          preview: record.preview,
          created_at: record.createdAt,
          expires_at: record.expiresAt,
          revoked: record.revoked,
        }),
      });
      if (!res.ok) throw new Error(`share create failed: ${res.status}`);
    },

    async get(id) {
      const res = await fetch(`${base}?id=eq.${encodeURIComponent(id)}&select=*`, { headers });
      if (!res.ok) return null;
      const rows = await res.json<Record<string, unknown>[]>();
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id as string,
        ownerId: row.owner_id as string,
        type: row.entity_type as SharePreview['type'],
        content: row.content,
        preview: row.preview as SharePreview,
        createdAt: row.created_at as string,
        expiresAt: (row.expires_at as string | null) ?? null,
        revoked: Boolean(row.revoked),
      };
    },

    /**
     * Retira un enlace.
     *
     * Comprueba la respuesta, que es lo que no hacía: el `fetch` salía, se
     * descartaba el resultado y la ruta contestaba `{ok:true}` pasara lo que
     * pasara. Un 4xx de Supabase —clave caducada, tabla movida— se veía en la
     * app como «enlace revocado» mientras el enlace seguía sirviendo el
     * contenido. Revocar es justo donde un fallo silencioso no vale.
     *
     * `owner_id` también va escapado. Hoy viene del `sub` de un JWT y es un
     * uuid, pero el que se escapaba y el que no estaban en la misma línea, y esa
     * asimetría es lo que hace que un día alguien meta ahí otra cosa.
     */
    async revoke(id, ownerId) {
      const res = await fetch(
        `${base}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
        {
          method: 'PATCH',
          headers: { ...headers, prefer: 'return=representation' },
          body: JSON.stringify({ revoked: true }),
        },
      );

      if (!res.ok) throw new Error(`share revoke failed: ${String(res.status)}`);

      // PostgREST devuelve 200 con una lista vacía cuando el filtro no encuentra
      // nada. Sin esto, revocar el enlace de otra persona —o uno que ya no
      // existe— se reportaría como hecho.
      const rows = await res.json<unknown[]>();
      if (rows.length === 0) throw new Error('share revoke: no existe o no es tuyo');
    },
  };
}
