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

/** A profile as seen by someone else, with the relationship and the counters. */
export interface PublicProfile extends Profile {
  state: FriendshipState;
  sharedCount: number;
  friendCount: number;
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
  /** What was eaten, for a visit. Empty for the other kinds. */
  dishNames: string[];
  companionCount: number;
  /** Quiénes fueron, sin ti. Un número no contesta la pregunta que se hace uno. */
  companionNames: string[];
  /**
   * Cuántos me gusta tiene, y si uno es tuyo.
   *
   * Viajan con la tarjeta y no en una llamada aparte, y el porqué está en la
   * migración 0026: un contador que aparece medio segundo después de la tarjeta
   * se lee como que acaba de darle alguien.
   */
  likeCount: number;
  likedByMe: boolean;
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
  avatarUrl?: string | null;
}): Promise<void> {
  const supabase = client();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('No has iniciado sesión');

  const payload: Record<string, unknown> = {};
  if (changes.username !== undefined) payload['username'] = changes.username.toLowerCase();
  if (changes.displayName !== undefined) payload['display_name'] = changes.displayName;
  if (changes.bio !== undefined) payload['bio'] = changes.bio;
  if (changes.avatarUrl !== undefined) payload['avatar_url'] = changes.avatarUrl;

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

/** `feed_page` and `user_entries` return the same row shape. */
function toFeedEntry(row: Record<string, unknown>): FeedEntry {
  return {
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
    dishNames: (row['dish_names'] as string[] | null) ?? [],
    companionCount: Number(row['companion_count'] ?? 0),
    companionNames: (row['companion_names'] as string[] | null) ?? [],
    // bigint llega como cadena desde PostgREST.
    likeCount: Number(row['like_count'] ?? 0),
    likedByMe: row['liked_by_me'] === true,
  };
}

export async function fetchFeed(before?: string): Promise<FeedEntry[]> {
  const rows = await callRpc<Record<string, unknown>[]>('feed_page', {
    before: before ?? null,
    page_size: 20,
  });
  return (rows ?? []).map(toFeedEntry);
}

/** Someone else's profile page. Returns null if the user does not exist. */
export async function fetchUserProfile(userId: string): Promise<PublicProfile | null> {
  const rows = await callRpc<
    (UserRow & { state: string; shared_count: number; friend_count: number })[]
  >('user_profile', { target: userId });

  const row = rows?.[0];
  if (!row) return null;

  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio ?? null,
    state: row.state as FriendshipState,
    // The counters come back as bigint, which PostgREST sends as a string.
    sharedCount: Number(row.shared_count ?? 0),
    friendCount: Number(row.friend_count ?? 0),
  };
}

/**
 * What one person has shared, as feed entries.
 *
 * The server decides how much of it the caller may see — a stranger gets only
 * the public entries, a friend also gets the friends-only ones. The client never
 * filters this itself.
 */
export async function fetchUserEntries(userId: string, before?: string): Promise<FeedEntry[]> {
  const rows = await callRpc<Record<string, unknown>[]>('user_entries', {
    target: userId,
    before: before ?? null,
    page_size: 20,
  });
  return (rows ?? []).map(toFeedEntry);
}

// ── El perfil de alguien, por secciones ──────────────────────────────────────

/** Cuántas entradas de cada clase puede ver quien llama. Lo que decide las pestañas. */
export type UserEntryCounts = Record<FeedKind, number>;

/**
 * El recuento por clase, antes de pintar nada.
 *
 * Hace falta para no enseñar una pestaña vacía: a quien no es tu amigo y solo
 * tiene sitios públicos se le enseña **una** pestaña, no tres con dos vacías.
 * Una pestaña vacía se lee como «no ha compartido nada», y aquí significaría
 * «esto no te toca», que es otra cosa.
 *
 * El servidor devuelve siempre las tres filas, con cero donde no haya nada, así
 * que no hay que distinguir «vino un cero» de «no vino la fila».
 */
export async function fetchUserEntryCounts(userId: string): Promise<UserEntryCounts> {
  const rows = await callRpc<{ kind: string; total: number | string }[]>('user_entry_counts', {
    target: userId,
  });

  const counts: UserEntryCounts = { visit: 0, dish: 0, restaurant: 0 };
  for (const row of rows ?? []) {
    if (row.kind === 'visit' || row.kind === 'dish' || row.kind === 'restaurant') {
      // bigint llega como cadena desde PostgREST.
      counts[row.kind] = Number(row.total ?? 0);
    }
  }
  return counts;
}

export type UserEntrySort = 'date' | 'name' | 'rating';

export interface UserEntriesQuery {
  kind: FeedKind;
  sort: UserEntrySort;
  descending: boolean;
  /** Solo para platos y lugares: una visita no tiene nota propia. */
  minRating: number | null;
  offset: number;
  pageSize: number;
}

/**
 * Una página de una sección del perfil de alguien.
 *
 * Por desplazamiento y no por cursor, al revés que el feed (`usePagedResource`
 * explica por qué allí es al revés): aquí el orden lo elige quien mira, así que
 * un cursor necesitaría una clave distinta por criterio. La lista de una sección
 * es corta —lo que una persona ha compartido— y el servidor desempata siempre
 * por fecha y uuid, así que dos páginas seguidas no repiten ni se saltan nada.
 *
 * El servidor decide cuánto se ve. El cliente nunca filtra esto: hacerlo
 * significaría que el dato ya se envió.
 */
export async function fetchUserEntriesPage(
  userId: string,
  query: UserEntriesQuery,
): Promise<FeedEntry[]> {
  const rows = await callRpc<Record<string, unknown>[]>('user_entries_page', {
    target: userId,
    kind_filter: query.kind,
    sort_by: query.sort,
    descending: query.descending,
    min_rating: query.minRating,
    page_offset: query.offset,
    page_size: query.pageSize,
  });
  return (rows ?? []).map(toFeedEntry);
}

// ── Una visita compartida ────────────────────────────────────────────────────

export interface SharedDish {
  uuid: string;
  name: string;
  price: number | null;
  /** En qué moneda está `price`. Nula exactamente cuando el precio lo es. */
  currency: string | null;
  rating: number | null;
  comments: string | null;
  imageKey: string | null;
  /**
   * Si este plato tiene una pantalla propia que quien mira pueda abrir.
   *
   * Lo decide el servidor (0025) y no se deduce aquí, porque no se puede: el
   * detalle de una visita enseña platos que su dueño **no** ha compartido
   * sueltos —una comida que no dice qué se comió no comparte nada (0011)— así
   * que «está en la lista» no implica «se puede abrir». Sin este dato, la
   * pantalla ofrecería un toque que el servidor va a rechazar.
   */
  canOpen: boolean;
}

export interface SharedPerson {
  name: string;
  accountUuid: string | null;
  username: string | null;
}

export interface SharedVisit {
  uuid: string;
  visitedAt: string | null;
  comments: string | null;
  visibility: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  author: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  restaurant: {
    uuid: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    rating: number | null;
    comments: string | null;
    /** Igual que en `SharedDish`, y por el mismo motivo. */
    canOpen: boolean;
  } | null;
  dishes: SharedDish[];
  /** Photo keys, resolved through the Worker by `remoteImageUri`. */
  images: string[];
  people: SharedPerson[];
}

/** Shape returned by `visit_detail`, before it is renamed to camelCase. */
interface SharedVisitRow {
  uuid: string;
  visited_at: string | null;
  comments: string | null;
  visibility: string;
  created_at: string;
  like_count: number | string;
  liked_by_me: boolean;
  author: {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  restaurant: {
    uuid: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    rating: number | null;
    comments: string | null;
    can_open: boolean;
  } | null;
  dishes: {
    uuid: string;
    name: string;
    price: string | number | null;
    currency: string | null;
    rating: number | null;
    comments: string | null;
    image_key: string | null;
    can_open: boolean;
  }[];
  images: string[];
  people: { name: string; account_uuid: string | null; username: string | null }[];
}

/**
 * One shared visit, whole.
 *
 * The server decides whether the caller may see it and returns null otherwise —
 * deliberately not distinguishing "does not exist" from "not for you", because
 * a diary that answers the difference tells strangers what you have written.
 *
 * The restaurant and the dishes come back even when their own visibility is
 * private: sharing a meal without saying where it was or what was eaten shares
 * nothing (0011).
 */
export async function fetchSharedVisit(visitUuid: string): Promise<SharedVisit | null> {
  const row = await callRpc<SharedVisitRow | null>('visit_detail', { target: visitUuid });
  if (!row) return null;

  return {
    uuid: row.uuid,
    visitedAt: row.visited_at,
    comments: row.comments,
    visibility: row.visibility,
    createdAt: row.created_at,
    likeCount: Number(row.like_count ?? 0),
    likedByMe: row.liked_by_me === true,
    author: {
      userId: row.author.user_id,
      username: row.author.username,
      displayName: row.author.display_name,
      avatarUrl: row.author.avatar_url,
    },
    restaurant: row.restaurant
      ? {
          uuid: row.restaurant.uuid,
          name: row.restaurant.name,
          latitude: row.restaurant.latitude,
          longitude: row.restaurant.longitude,
          rating: row.restaurant.rating,
          comments: row.restaurant.comments,
          canOpen: row.restaurant.can_open === true,
        }
      : null,
    dishes: (row.dishes ?? []).map((dish) => ({
      uuid: dish.uuid,
      name: dish.name,
      // numeric comes back as a string from PostgREST; the UI wants a number.
      price: dish.price === null || dish.price === undefined ? null : Number(dish.price),
      currency: dish.currency ?? null,
      rating: dish.rating,
      comments: dish.comments,
      imageKey: dish.image_key,
      canOpen: dish.can_open === true,
    })),
    images: row.images ?? [],
    people: (row.people ?? []).map((person) => ({
      name: person.name,
      accountUuid: person.account_uuid,
      username: person.username,
    })),
  };
}

// ── Un plato y un sitio compartidos ──────────────────────────────────────────

/** Quién publicó algo. La misma forma en las tres pantallas compartidas. */
export interface SharedAuthor {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface AuthorRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

function toAuthor(row: AuthorRow): SharedAuthor {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

export interface SharedDishDetail {
  uuid: string;
  name: string;
  price: number | null;
  currency: string | null;
  rating: number | null;
  comments: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  author: SharedAuthor;
  /** Dónde se comió, si lo hay. `canOpen` dice si además se puede abrir. */
  restaurant: { uuid: string; name: string; canOpen: boolean } | null;
  images: string[];
}

export interface SharedRestaurantDetail {
  uuid: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  comments: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  author: SharedAuthor;
  images: string[];
}

interface SharedDishRow {
  uuid: string;
  name: string;
  price: string | number | null;
  currency: string | null;
  rating: number | null;
  comments: string | null;
  created_at: string;
  like_count: number | string;
  liked_by_me: boolean;
  author: AuthorRow;
  restaurant: { uuid: string; name: string; can_open: boolean } | null;
  images: string[];
}

interface SharedRestaurantRow {
  uuid: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  comments: string | null;
  created_at: string;
  like_count: number | string;
  liked_by_me: boolean;
  author: AuthorRow;
  images: string[];
}

/**
 * Un plato de otra persona, entero.
 *
 * Mismo trato que `fetchSharedVisit`: el servidor decide si se puede ver y
 * contesta null si no, sin distinguir «no existe» de «no es para ti».
 *
 * **No devuelve las visitas en las que se comió**, y no es un olvido: poder ver
 * un plato no da acceso al diario de nadie (0011). Lo único que sale hacia
 * arriba es el restaurante, y solo su nombre.
 */
export async function fetchSharedDish(dishUuid: string): Promise<SharedDishDetail | null> {
  const row = await callRpc<SharedDishRow | null>('dish_detail', { target: dishUuid });
  if (!row) return null;

  return {
    uuid: row.uuid,
    name: row.name,
    // numeric llega como cadena desde PostgREST.
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    currency: row.currency,
    rating: row.rating,
    comments: row.comments,
    createdAt: row.created_at,
    likeCount: Number(row.like_count ?? 0),
    likedByMe: row.liked_by_me === true,
    author: toAuthor(row.author),
    restaurant: row.restaurant
      ? {
          uuid: row.restaurant.uuid,
          name: row.restaurant.name,
          canOpen: row.restaurant.can_open === true,
        }
      : null,
    images: row.images ?? [],
  };
}

/** Un sitio de otra persona. Sin su historial, por el mismo motivo que arriba. */
export async function fetchSharedRestaurant(
  restaurantUuid: string,
): Promise<SharedRestaurantDetail | null> {
  const row = await callRpc<SharedRestaurantRow | null>('restaurant_detail', {
    target: restaurantUuid,
  });
  if (!row) return null;

  return {
    uuid: row.uuid,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    rating: row.rating,
    comments: row.comments,
    createdAt: row.created_at,
    likeCount: Number(row.like_count ?? 0),
    likedByMe: row.liked_by_me === true,
    author: toAuthor(row.author),
    images: row.images ?? [],
  };
}

export interface TaggedVisit {
  entityUuid: string;
  authorId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  occurredAt: string;
  visitedAt: string | null;
  title: string;
  comments: string | null;
  imageKey: string | null;
  companionCount: number;
  /** Quiénes fueron, sin ti. Un número no contesta la pregunta que se hace uno. */
  companionNames: string[];
  likeCount: number;
  likedByMe: boolean;
}

/**
 * Visits other people tagged you in.
 *
 * A tray of its own, never merged into the diary. Someone else's visit is about
 * their restaurants and their dishes; folding it into yours would fill your
 * lists with rows you cannot edit and your statistics with meals you did not
 * record.
 */
export async function fetchTaggedVisits(before?: string): Promise<TaggedVisit[]> {
  const rows = await callRpc<Record<string, unknown>[]>('tagged_visits', {
    before: before ?? null,
    page_size: 20,
  });

  return (rows ?? []).map((row) => ({
    entityUuid: row['entity_uuid'] as string,
    authorId: row['author_id'] as string,
    username: row['username'] as string,
    displayName: (row['display_name'] as string | null) ?? null,
    avatarUrl: (row['avatar_url'] as string | null) ?? null,
    occurredAt: row['occurred_at'] as string,
    visitedAt: (row['visited_at'] as string | null) ?? null,
    title: row['title'] as string,
    comments: (row['comments'] as string | null) ?? null,
    imageKey: (row['image_key'] as string | null) ?? null,
    companionCount: Number(row['companion_count'] ?? 0),
    companionNames: (row['companion_names'] as string[] | null) ?? [],
    likeCount: Number(row['like_count'] ?? 0),
    likedByMe: row['liked_by_me'] === true,
  }));
}

// ── Me gusta ─────────────────────────────────────────────────────────────────

/** Cómo queda una entrada después de tocar el corazón. */
export interface LikeState {
  liked: boolean;
  total: number;
}

/**
 * Da o quita el me gusta. Un solo verbo, porque es un solo botón.
 *
 * Dos llamadas («dar» y «quitar») obligarían a la pantalla a saber el estado
 * actual antes de llamar, y el estado actual es justo lo que puede estar
 * desactualizado: con dos verbos, un doble toque rápido acaba contestando «ya
 * existe» o «no existe» según el orden en que lleguen.
 *
 * Devuelve el estado resultante para que la pantalla no lo adivine — si el
 * optimismo del cliente se equivocó, esto lo corrige.
 */
export async function toggleLike(entityUuid: string, kind: FeedKind): Promise<LikeState> {
  const row = await callRpc<{ liked: boolean; total: number | string } | null>('toggle_like', {
    target: entityUuid,
    kind,
  });
  return { liked: row?.liked === true, total: Number(row?.total ?? 0) };
}

/**
 * Removes yourself from someone else's visit.
 *
 * Nothing is deleted from their diary: the tag stays where they wrote it, and
 * stops granting you access or showing up for you. Asking permission before
 * tagging would turn "I had dinner with Caro" into a negotiation, so the
 * consent is after the fact — which only works if withdrawing it is real.
 *
 * Recorded as a row of your own (0013). Marking their participant row would
 * last exactly until their phone next synced, because a device pushes the
 * complete set of a visit's participants every time.
 */
export async function rejectTag(visitUuid: string): Promise<void> {
  await callRpc<null>('reject_tag', { visit: visitUuid });
}

/** Undoes `rejectTag`. Withdrawing is not blocking. */
export async function restoreTag(visitUuid: string): Promise<void> {
  await callRpc<null>('restore_tag', { visit: visitUuid });
}

/**
 * Las clases de aviso que emite el servidor (0016, 0019).
 *
 * `friend_published` resume una ráfaga: registrar una comida escribe el sitio,
 * la visita y los platos, y de ahí sale un aviso y no tres. Por eso llega sin
 * visita a la que apuntar — la ráfaga no tiene una fila que la represente— y se
 * abre en el perfil de quien publicó, que es donde están las tres.
 *
 * `entry_liked` es la primera que **no ocurre en una visita**: se le puede dar
 * me gusta a un plato o a un sitio sueltos. Por eso llega con `entityUuid` y
 * `entityKind` en vez de con `visitUuid` (0027).
 */
export type NotificationKind =
  'tagged_in_visit' | 'friend_published' | 'friend_request' | 'friend_accepted' | 'entry_liked';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  createdAt: string;
  readAt: string | null;
  visitUuid: string | null;
  actorId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Cómo se llama aquello de lo que habla. Nulo si no apunta a nada. */
  title: string | null;
  imageKey: string | null;
  /** La entrada de un me gusta, y de qué clase es. Decide qué pantalla abre. */
  entityUuid: string | null;
  entityKind: FeedKind | null;
}

/**
 * Novedades: lo que ha pasado mientras no mirabas.
 *
 * El servidor ya descarta los avisos de etiquetas que rechazaste o de visitas
 * borradas (0016), así que lo que llega aquí se puede pintar tal cual. Un aviso
 * que abre algo que ya no existe es peor que no avisar.
 */
export async function fetchNotifications(before?: string): Promise<AppNotification[]> {
  const rows = await callRpc<Record<string, unknown>[]>('notifications_page', {
    before: before ?? null,
    page_size: 30,
  });

  return (rows ?? []).map((row) => ({
    id: Number(row['id']),
    kind: row['kind'] as NotificationKind,
    createdAt: row['created_at'] as string,
    readAt: (row['read_at'] as string | null) ?? null,
    visitUuid: (row['visit_uuid'] as string | null) ?? null,
    actorId: (row['actor_id'] as string | null) ?? null,
    username: (row['username'] as string | null) ?? null,
    displayName: (row['display_name'] as string | null) ?? null,
    avatarUrl: (row['avatar_url'] as string | null) ?? null,
    title: (row['title'] as string | null) ?? null,
    imageKey: (row['image_key'] as string | null) ?? null,
    entityUuid: (row['entity_uuid'] as string | null) ?? null,
    entityKind: (row['entity_kind'] as FeedKind | null) ?? null,
  }));
}

/** Cuántas novedades sin leer. Lo que pinta el punto. */
export async function fetchUnreadCount(): Promise<number> {
  const count = await callRpc<number>('unread_notifications', {});
  return Number(count ?? 0);
}

/**
 * Marca todo como leído de una vez.
 *
 * De uno en uno convertiría una lista de avisos en una lista de tareas: nadie
 * quiere descartar catorce cosas para que se apague un punto.
 */
export async function markNotificationsRead(): Promise<void> {
  await callRpc<null>('mark_notifications_read', {});
}

/**
 * Publishes the account's general visibility settings.
 *
 * They have to live on the server too: it is the server that decides whether
 * your friend may read a row, and an entry stored as `default` has nothing to
 * resolve against if the preference only exists on your phone. The rows
 * themselves never carry a copy — that was the bug (0014).
 *
 * Sent as one call because it is one decision by the user; three separate
 * writes only create a window where the server holds half of it.
 */
export async function pushVisibilityDefaults(defaults: {
  restaurant: string;
  dish: string;
  visit: string;
}): Promise<void> {
  await callRpc<null>('set_visibility_defaults', defaults);
}
