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

export function isLive(record: ShareRecord): boolean {
  if (record.revoked) return false;
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) return false;
  return true;
}

/** Supabase REST-backed store (service role, bypasses RLS for public reads). */
export function createSupabaseShareStore(env: Env): ShareStore {
  const base = `${env.SUPABASE_URL}/rest/v1/share_links`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
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
      const rows = (await res.json()) as Record<string, unknown>[];
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

    async revoke(id, ownerId) {
      await fetch(`${base}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${ownerId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ revoked: true }),
      });
    },
  };
}
