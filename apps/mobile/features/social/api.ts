import { getSupabase } from '@/services/supabase/client';

/**
 * Thin wrappers over the social RPCs (supabase/migrations/0006).
 *
 * Every relationship change goes through a database function rather than a
 * table write: friendships are stored one row per pair in canonical order, and
 * having the client reproduce that rule would spread a storage detail across
 * the app. The functions also enforce who is allowed to answer a request.
 *
 * These are the only calls in the app that read other people's rows.
 */

export type FriendshipState = 'none' | 'request_sent' | 'request_received' | 'friends' | 'self';

export interface UserSummary {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  state: FriendshipState;
}

export interface Profile {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export type FeedKind = 'visit' | 'dish' | 'restaurant';

export interface FeedEntry {
  kind: FeedKind;
  entityUuid: string;
  authorId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  occurredAt: string;
  title: string;
  place: string | null;
  rating: number | null;
  comments: string | null;
  imageKey: string | null;
}

/** Rows come back snake_case from PostgREST; the app speaks camelCase. */
interface UserRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  state?: string;
  bio?: string | null;
}

function toUserSummary(row: UserRow): UserSummary {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    state: (row.state ?? 'none') as FriendshipState,
  };
}

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('La cuenta no está configurada');
  return supabase;
}

/** Postgres error codes that deserve a message a person can act on. */
const FRIENDLY_ERRORS: Record<string, string> = {
  '23505': 'Ese nombre de usuario ya está cogido',
  '23514': 'Usa entre 3 y 30 caracteres: letras, números, punto o guion bajo',
};

interface RpcError {
  message: string;
  code?: string;
}

/**
 * Calls an RPC and returns its rows typed.
 *
 * supabase-js types `rpc()` as `any` because the function signatures live in
 * the database, so every call site would otherwise silently lose type safety
 * (and trip no-unsafe-assignment). Narrowing happens here, once.
 */
async function callRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = (await client().rpc(name, args)) as {
    data: T | null;
    error: RpcError | null;
  };
  if (error) {
    throw new Error(FRIENDLY_ERRORS[error.code ?? ''] ?? error.message, { cause: error });
  }
  return data as T;
}

/** Fetches the caller's profile, creating it if signup never did (docs/06). */
export async function fetchMyProfile(): Promise<Profile> {
  // The function returns a `profiles` row; PostgREST may wrap it in an array.
  const data = await callRpc<UserRow | UserRow[]>('ensure_profile');
  const row = Array.isArray(data) ? (data[0] as UserRow) : data;
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio ?? null,
  };
}

export async function updateMyProfile(changes: {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
}): Promise<void> {
  const supabase = client();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('No has iniciado sesión');

  const payload: Record<string, unknown> = {};
  if (changes.username !== undefined) payload['username'] = changes.username.toLowerCase();
  if (changes.displayName !== undefined) payload['display_name'] = changes.displayName;
  if (changes.bio !== undefined) payload['bio'] = changes.bio;

  const { error } = (await supabase
    .from('profiles')
    .update(payload)
    .eq('user_id', auth.user.id)) as { error: RpcError | null };

  if (error) {
    // The unique index is the only thing that can reject a well-formed name.
    throw new Error(FRIENDLY_ERRORS[error.code ?? ''] ?? error.message, { cause: error });
  }
}

export async function searchUsers(query: string): Promise<UserSummary[]> {
  const rows = await callRpc<UserRow[]>('search_users', { q: query });
  return (rows ?? []).map(toUserSummary);
}

export async function listFriendships(): Promise<UserSummary[]> {
  const rows = await callRpc<UserRow[]>('list_friendships');
  return (rows ?? []).map(toUserSummary);
}

export async function sendFriendRequest(target: string): Promise<FriendshipState> {
  return callRpc<FriendshipState>('send_friend_request', { target });
}

export async function respondFriendRequest(
  other: string,
  accept: boolean,
): Promise<FriendshipState> {
  return callRpc<FriendshipState>('respond_friend_request', { other, accept });
}

export async function removeFriend(other: string): Promise<FriendshipState> {
  return callRpc<FriendshipState>('remove_friend', { other });
}

export async function fetchFeed(before?: string): Promise<FeedEntry[]> {
  const rows = await callRpc<Record<string, unknown>[]>('feed_page', {
    before: before ?? null,
    page_size: 20,
  });

  return (rows ?? []).map((row) => ({
    kind: row['kind'] as FeedKind,
    entityUuid: row['entity_uuid'] as string,
    authorId: row['author_id'] as string,
    username: row['username'] as string,
    displayName: (row['display_name'] as string | null) ?? null,
    avatarUrl: (row['avatar_url'] as string | null) ?? null,
    occurredAt: row['occurred_at'] as string,
    title: row['title'] as string,
    place: (row['place'] as string | null) ?? null,
    rating: (row['rating'] as number | null) ?? null,
    comments: (row['comments'] as string | null) ?? null,
    imageKey: (row['image_key'] as string | null) ?? null,
  }));
}
