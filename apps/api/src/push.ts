import type { Env } from './types';

/**
 * Reparte los avisos pendientes como notificaciones push.
 *
 * El trigger de la migración 0016 escribe una fila en `notifications` cuando
 * alguien te etiqueta, y la app ya la enseña en Novedades. Esto es la mitad que
 * hace que te enteres **sin abrir la app**.
 *
 * Vive en el Worker y no en Postgres porque hace falta salir a internet
 * (`exp.host`) y reintentar, y montar un webhook desde la base de datos sería
 * una pieza más que mantener para ganar los dos minutos que tarda un cron. Un
 * push que llega en dos minutos sigue siendo un push.
 *
 * Se manda por **Expo Push** y no por FCM directo: es gratis, ya estamos en EAS
 * y evita meter el SDK de Firebase en la app. La restricción de que todo quepa
 * en capas gratuitas (docs/00) descarta las alternativas de pago sin más
 * discusión.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Cuántos avisos se recogen por pasada.
 *
 * Un tope, no una tanda que corta el trabajo: el cron vuelve en unos minutos y
 * lo que quede sale entonces. Existe para que una avalancha —alguien etiqueta a
 * cuarenta personas— no haga que una sola ejecución agote el tiempo del Worker y
 * no entregue nada.
 */
const MAX_PER_RUN = 200;

/** Expo acepta hasta cien mensajes por petición. */
const CHUNK = 100;

/**
 * Las clases que emite el servidor (0016, 0019).
 *
 * Como unión abierta con `string`: un aviso de una clase que este Worker
 * todavía no conoce —porque la migración va por delante del despliegue— tiene
 * que salir con un texto genérico, no quedarse sin enviar para siempre.
 */
export type NotificationKind =
  'tagged_in_visit' | 'friend_published' | 'friend_request' | 'friend_accepted';

/** Un aviso pendiente, con lo necesario para redactarlo. */
export interface PendingNotification {
  id: number;
  userId: string;
  kind: NotificationKind | string;
  visitUuid: string | null;
  /** Quién lo provocó, para abrir su perfil cuando no hay comida que abrir. */
  actorId: string | null;
  /** Quien lo provocó, ya resuelto a un nombre legible. */
  actorName: string;
  /** Dónde se comió. Nulo en los avisos que no ocurren en un restaurante. */
  title: string | null;
}

export interface DeviceToken {
  userId: string;
  token: string;
}

/** Un mensaje tal y como lo espera el servicio de Expo. */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: { visitUuid: string | null; actorId: string | null; notificationId: number };
  channelId: string;
  sound: string | null;
}

/**
 * Lo que responde Expo, por mensaje y en el mismo orden que se mandaron.
 *
 * `DeviceNotRegistered` es el que importa: llega cuando alguien desinstala la
 * app, y si no se borra la fila ese token se reintenta en cada pasada para
 * siempre.
 */
export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Lo que el envío necesita del mundo exterior.
 *
 * Como interfaz para poder probar el reparto entero —agrupar por destinatario,
 * trocear, marcar, retirar tokens muertos— sin Supabase ni red. Lo que falla en
 * un envío de push no es la petición HTTP: es a quién se le manda y qué se hace
 * con la respuesta.
 */
export interface PushStore {
  pending(limit: number): Promise<PendingNotification[]>;
  tokensFor(userIds: string[]): Promise<DeviceToken[]>;
  markPushed(ids: number[]): Promise<void>;
  removeTokens(tokens: string[]): Promise<void>;
}

export interface PushSender {
  send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]>;
}

export interface PushRunResult {
  /** Avisos con al menos un dispositivo al que mandarlos. */
  delivered: number;
  /** Avisos de gente sin ningún dispositivo registrado. */
  withoutDevice: number;
  /** Tokens retirados por estar muertos. */
  prunedTokens: number;
}

/**
 * Qué dice el cuerpo de cada clase.
 *
 * El texto vive aquí y no en Postgres para que arreglar una palabra sea un
 * despliegue del Worker y no una migración: los avisos ya escritos en la tabla
 * se redactan al enviarlos, así que cambian de texto sin reescribir ninguna
 * fila.
 *
 * Una clase desconocida sale con una frase que sirve para todas. Esa rama no es
 * decorativa: la migración se aplica antes que el despliegue, así que hay una
 * ventana real en la que la base emite clases que este código no conoce, y
 * dejarlas sin enviar las perdería para siempre.
 */
function bodyFor(notification: PendingNotification): string {
  switch (notification.kind) {
    case 'tagged_in_visit':
      return `Te etiquetó en ${notification.title ?? 'una comida'}`;
    case 'friend_published':
      return 'Ha añadido algo nuevo';
    case 'friend_request':
      return 'Quiere ser tu amigo';
    case 'friend_accepted':
      return 'Aceptó tu solicitud de amistad';
    default:
      return 'Tienes una novedad';
  }
}

/** Cómo se lee el aviso en la pantalla de bloqueo. */
export function composeMessage(notification: PendingNotification, token: string): ExpoPushMessage {
  return {
    to: token,
    // El nombre en el título y qué ha pasado en el cuerpo: en la pantalla de
    // bloqueo el título es lo único que se lee entero, y de quién es el aviso es
    // lo que decide si lo abres ahora o luego.
    title: notification.actorName,
    body: bodyFor(notification),
    // Los dos, y el que sobre viaja nulo: la app abre la visita si la hay y el
    // perfil de quien lo provocó si no. Ver `services/push/payload.ts`.
    data: {
      visitUuid: notification.visitUuid,
      actorId: notification.actorId,
      notificationId: notification.id,
    },
    channelId: 'default',
    sound: 'default',
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Una pasada de reparto.
 *
 * El orden no es negociable: se marca `pushed_at` **con la respuesta del
 * servicio en la mano**, nunca antes. Marcarlo antes y que la petición falle
 * deja un aviso que no se envía nunca y del que nadie se entera — el peor de
 * los dos fallos posibles, porque el otro (mandarlo dos veces) se nota y se
 * arregla solo.
 */
export async function deliverPending(
  store: PushStore,
  sender: PushSender,
  limit = MAX_PER_RUN,
): Promise<PushRunResult> {
  const pending = await store.pending(limit);
  if (pending.length === 0) {
    return { delivered: 0, withoutDevice: 0, prunedTokens: 0 };
  }

  const recipients = [...new Set(pending.map((n) => n.userId))];
  const tokens = await store.tokensFor(recipients);

  const byUser = new Map<string, string[]>();
  for (const { userId, token } of tokens) {
    const list = byUser.get(userId);
    if (list) list.push(token);
    else byUser.set(userId, [token]);
  }

  const messages: ExpoPushMessage[] = [];
  /** Qué aviso produjo cada mensaje, para saber cuál se llegó a mandar. */
  const origin: number[] = [];
  const delivered = new Set<number>();
  const withoutDevice: number[] = [];

  for (const notification of pending) {
    const devices = byUser.get(notification.userId) ?? [];
    if (devices.length === 0) {
      // Sin dispositivo no hay nada que entregar, pero tampoco nada que
      // reintentar: quien no ha dado permiso no lo va a dar por que su aviso
      // siga en la cola. Se marca igual, o la consulta de pendientes crece sin
      // parar con avisos que nunca saldrán.
      withoutDevice.push(notification.id);
      continue;
    }
    for (const token of devices) {
      messages.push(composeMessage(notification, token));
      origin.push(notification.id);
    }
  }

  const dead: string[] = [];
  let offset = 0;

  for (const batch of chunk(messages, CHUNK)) {
    let tickets: ExpoPushTicket[] = [];
    try {
      tickets = await sender.send(batch);
    } catch {
      // La tanda entera se queda sin marcar y vuelve en la siguiente pasada.
      offset += batch.length;
      continue;
    }

    batch.forEach((message, index) => {
      const ticket = tickets[index];
      const notificationId = origin[offset + index];
      if (notificationId === undefined) return;

      if (!ticket || ticket.status === 'ok') {
        // Sin ticket se cuenta como entregado a propósito: Expo aceptó la
        // petición, y reintentar a ciegas manda el aviso dos veces.
        delivered.add(notificationId);
        return;
      }

      if (ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(message.to);
        // El aviso se da por hecho para este dispositivo: el teléfono ya no
        // existe. Si la persona tiene otro, ese ticket vendrá aparte.
        delivered.add(notificationId);
      }
      // Cualquier otro error deja el aviso sin marcar, y vuelve en la siguiente
      // pasada.
    });

    offset += batch.length;
  }

  const toMark = [...delivered, ...withoutDevice];
  if (toMark.length > 0) await store.markPushed(toMark);
  if (dead.length > 0) await store.removeTokens([...new Set(dead)]);

  return {
    delivered: delivered.size,
    withoutDevice: withoutDevice.length,
    prunedTokens: new Set(dead).size,
  };
}

/** El servicio de Expo de verdad. */
export function expoSender(): PushSender {
  return {
    async send(messages) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          // Expo comprime la respuesta si se lo pides, y son cien tickets.
          'accept-encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        throw new Error(`expo push: HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { data?: ExpoPushTicket[] };
      return payload.data ?? [];
    },
  };
}

/**
 * Los avisos y los tokens, en Supabase.
 *
 * Con la clave de servidor (`sb_secret_…`), que **no es un JWT**: viaja en
 * `apikey` y nunca en `Authorization: Bearer` — eso funcionaba con la
 * `service_role` antigua y hoy lo rechaza (ver `shareStore`).
 */
export function createSupabasePushStore(env: Env): PushStore {
  const rest = `${env.SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_SECRET_KEY,
    'content-type': 'application/json',
  };

  /**
   * Cómo se llama quien etiquetó, por id de cuenta.
   *
   * Una consulta aparte y no un `select` encadenado, porque **PostgREST no
   * puede**: `notifications.actor_id` apunta a `auth.users`, igual que
   * `profiles.user_id`, y entre las dos tablas no hay ninguna clave ajena
   * directa que embeber. Un `profiles(...)` dentro del select de los avisos
   * devuelve un 400 con un mensaje sobre relaciones, no un nombre vacío.
   */
  const namesFor = async (actorIds: (string | null)[]): Promise<Map<string, string>> => {
    const ids = [...new Set(actorIds.filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();

    const list = ids.map((id) => `"${id}"`).join(',');
    const response = await fetch(
      `${rest}/profiles?user_id=in.(${list})&select=user_id,username,display_name`,
      { headers },
    );
    if (!response.ok) return new Map();

    const rows = (await response.json()) as {
      user_id: string;
      username: string | null;
      display_name: string | null;
    }[];

    const names = new Map<string, string>();
    for (const row of rows) {
      const name = row.display_name ?? row.username;
      if (name) names.set(row.user_id, name);
    }
    return names;
  };

  /**
   * Dónde se comió, por uuid de visita.
   *
   * Aparte y no encadenado al `select` de los avisos: en PostgREST un join a
   * través de una visita borrada saca la fila entera del resultado, y ese aviso
   * se quedaría sin enviar para siempre en vez de salir con un nombre genérico.
   */
  const titlesFor = async (visitUuids: (string | null)[]): Promise<Map<string, string>> => {
    const uuids = [...new Set(visitUuids.filter((uuid): uuid is string => uuid !== null))];
    if (uuids.length === 0) return new Map();

    const list = uuids.map((uuid) => `"${uuid}"`).join(',');
    const response = await fetch(
      `${rest}/visits?uuid=in.(${list})&select=uuid,restaurant:restaurants(name)`,
      { headers },
    );
    if (!response.ok) return new Map();

    const rows = (await response.json()) as {
      uuid: string;
      restaurant: { name: string } | null;
    }[];

    const titles = new Map<string, string>();
    for (const row of rows) {
      if (row.restaurant?.name) titles.set(row.uuid, row.restaurant.name);
    }
    return titles;
  };

  return {
    async pending(limit) {
      // El índice parcial `notifications_pending_push_idx` cubre exactamente
      // este filtro, así que no recorre la tabla.
      const url =
        `${rest}/notifications?pushed_at=is.null` +
        `&select=id,user_id,kind,visit_uuid,actor_id` +
        `&order=created_at.asc&limit=${limit}`;

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`push pending: HTTP ${response.status}`);

      const rows = (await response.json()) as {
        id: number;
        user_id: string;
        kind: string;
        visit_uuid: string | null;
        actor_id: string | null;
      }[];

      // En paralelo: son dos búsquedas por clave sobre como mucho doscientas
      // filas, y encadenarlas solo suma latencia.
      const [names, titles] = await Promise.all([
        namesFor(rows.map((row) => row.actor_id)),
        titlesFor(rows.map((row) => row.visit_uuid)),
      ]);

      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        kind: row.kind,
        visitUuid: row.visit_uuid,
        actorId: row.actor_id,
        // "Alguien te etiquetó" es raro pero se entiende; no mandar el aviso
        // porque falte un perfil, no.
        actorName: (row.actor_id && names.get(row.actor_id)) || 'Alguien',
        title: (row.visit_uuid && titles.get(row.visit_uuid)) || null,
      }));
    },

    async tokensFor(userIds) {
      if (userIds.length === 0) return [];
      const list = userIds.map((id) => `"${id}"`).join(',');
      const response = await fetch(
        `${rest}/device_push_tokens?user_id=in.(${list})&select=user_id,token`,
        { headers },
      );
      if (!response.ok) throw new Error(`push tokens: HTTP ${response.status}`);

      const rows = (await response.json()) as { user_id: string; token: string }[];
      return rows.map((row) => ({ userId: row.user_id, token: row.token }));
    },

    async markPushed(ids) {
      if (ids.length === 0) return;
      const response = await fetch(`${rest}/notifications?id=in.(${ids.join(',')})`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ pushed_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(`push mark: HTTP ${response.status}`);
    },

    async removeTokens(tokens) {
      if (tokens.length === 0) return;
      const list = tokens.map((token) => `"${token}"`).join(',');
      const response = await fetch(`${rest}/device_push_tokens?token=in.(${list})`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) throw new Error(`push prune: HTTP ${response.status}`);
    },
  };
}
