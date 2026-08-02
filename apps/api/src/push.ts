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
  'tagged_in_visit' | 'friend_published' | 'friend_request' | 'friend_accepted' | 'entry_liked';

/** A qué apunta un aviso que no ocurre en una visita. */
export type EntityKind = 'visit' | 'dish' | 'restaurant';

/** Un aviso pendiente, con lo necesario para redactarlo. */
export interface PendingNotification {
  id: number;
  userId: string;
  /**
   * `string`, no `NotificationKind`, y a propósito.
   *
   * Estaba escrito `NotificationKind | string`, que **es** `string`: TypeScript
   * absorbe la unión y el tipo no dice nada de lo que quería decir. La intención
   * era documentar que la lista es abierta —la migración se aplica antes que el
   * despliegue, así que hay una ventana real en la que la base emite clases que
   * este Worker no conoce—, y eso es lo que dice este comentario. Quien
   * discrimina es el `switch` de `bodyFor`, que tiene su rama por defecto.
   */
  kind: string;
  visitUuid: string | null;
  /** Quién lo provocó, para abrir su perfil cuando no hay comida que abrir. */
  actorId: string | null;
  /** Quien lo provocó, ya resuelto a un nombre legible. */
  actorName: string;
  /** Cómo se llama aquello de lo que habla. Nulo si no apunta a nada. */
  title: string | null;
  /** La entrada a la que se le dio me gusta, y de qué clase es (0027). */
  entityUuid: string | null;
  entityKind: string | null;
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
  data: {
    visitUuid: string | null;
    actorId: string | null;
    /** Qué abrir cuando no es una visita: un plato, un sitio (0027). */
    entityUuid: string | null;
    entityKind: string | null;
    notificationId: number;
  };
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
 * Qué dice cada aviso, título y cuerpo.
 *
 * El texto vive aquí y no en Postgres para que arreglar una palabra sea un
 * despliegue del Worker y no una migración: los avisos ya escritos en la tabla
 * se redactan al enviarlos, así que cambian de texto sin reescribir ninguna
 * fila.
 *
 * ## Por qué el título dejó de ser el nombre de la persona
 *
 * Lo era, y se reportó: «no tiene mucho sentido que el título sea solo el
 * nombre». Tiene razón, y el razonamiento que lo puso ahí —«en la pantalla de
 * bloqueo el título es lo único que se lee entero, y de quién es el aviso es lo
 * que decide si lo abres»— tenía media verdad y una omisión. La omisión es que
 * **Android ya pinta el nombre de la app encima**, así que un aviso titulado
 * «Mateo Álvarez» ocupa las dos líneas destacadas para decir un nombre y deja
 * lo que ha pasado en la letra pequeña. Y en la bandeja, cuatro avisos de la
 * misma persona salen como cuatro títulos idénticos.
 *
 * Ahora el título dice **qué ha pasado** —que es lo que se agrupa y lo que
 * decide si abres— y el cuerpo lleva la frase entera, con el nombre dentro.
 *
 * Una clase desconocida sale con una frase que sirve para todas. Esa rama no es
 * decorativa: la migración se aplica antes que el despliegue, así que hay una
 * ventana real en la que la base emite clases que este código no conoce, y
 * dejarlas sin enviar las perdería para siempre.
 */
export interface NotificationText {
  title: string;
  body: string;
}

/** Cómo se nombra cada clase de entrada dentro de una frase. */
const ENTITY_NOUN: Record<string, string> = {
  visit: 'tu visita',
  dish: 'tu plato',
  restaurant: 'tu sitio',
};

export function composeText(notification: PendingNotification): NotificationText {
  const who = notification.actorName;

  switch (notification.kind) {
    case 'tagged_in_visit':
      return {
        title: 'Te han etiquetado en una comida',
        body: `${who} te etiquetó en ${notification.title ?? 'una comida'}`,
      };
    case 'friend_published':
      return { title: 'Novedad de un amigo', body: `${who} ha añadido algo nuevo` };
    case 'friend_request':
      return { title: 'Nueva solicitud de amistad', body: `${who} quiere ser tu amigo` };
    case 'friend_accepted':
      return { title: 'Solicitud aceptada', body: `${who} ya es tu amigo` };
    case 'entry_liked': {
      // Sin el nombre de la entrada cuando no lo hay: «le gustó tu plato» ya
      // dice bastante, y «le gustó tu plato null» no dice nada.
      const noun = ENTITY_NOUN[notification.entityKind ?? ''] ?? 'algo tuyo';
      const what = notification.title ? `${noun} ${notification.title}` : noun;
      return { title: 'Nuevo me gusta', body: `A ${who} le gustó ${what}` };
    }
    default:
      return { title: 'Tienes una novedad', body: `${who} ha hecho algo en la app` };
  }
}

/** Cómo se lee el aviso en la pantalla de bloqueo. */
export function composeMessage(notification: PendingNotification, token: string): ExpoPushMessage {
  const text = composeText(notification);

  return {
    to: token,
    title: text.title,
    body: text.body,
    // Los tres destinos posibles, y los que sobren viajan nulos: la app abre la
    // visita si la hay, la entrada suelta si la hay, y el perfil de quien lo
    // provocó si no hay ninguna. Ver `services/push/payload.ts`.
    data: {
      visitUuid: notification.visitUuid,
      actorId: notification.actorId,
      entityUuid: notification.entityUuid,
      entityKind: notification.entityKind,
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

      const payload = await response.json<{ data?: ExpoPushTicket[] }>();
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

    const rows = await response.json<
      {
        user_id: string;
        username: string | null;
        display_name: string | null;
      }[]
    >();

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

    const rows = await response.json<
      {
        uuid: string;
        restaurant: { name: string } | null;
      }[]
    >();

    const titles = new Map<string, string>();
    for (const row of rows) {
      if (row.restaurant?.name) titles.set(row.uuid, row.restaurant.name);
    }
    return titles;
  };

  /**
   * Cómo se llama la entrada de un me gusta (0027).
   *
   * Tres consultas y no un join, por lo mismo que `titlesFor`: un aviso cuya
   * entrada se borró entre que se escribió y que se envía tiene que salir con
   * un texto genérico, no desaparecer del resultado y quedarse sin enviar para
   * siempre. Y solo se pregunta por las clases que de verdad aparecen en el
   * lote, que casi nunca son las tres.
   */
  const entityTitlesFor = async (
    entities: { uuid: string | null; kind: string | null }[],
  ): Promise<Map<string, string>> => {
    const byKind: Record<string, Set<string>> = {
      visit: new Set(),
      dish: new Set(),
      restaurant: new Set(),
    };
    for (const entity of entities) {
      if (entity.uuid && entity.kind && entity.kind in byKind) {
        byKind[entity.kind]?.add(entity.uuid);
      }
    }

    const titles = new Map<string, string>();

    // Una visita se titula por su restaurante, igual que en la lista de la app.
    const visits = [...(byKind['visit'] ?? [])];
    if (visits.length > 0) {
      for (const [uuid, name] of await titlesFor(visits)) titles.set(uuid, name);
    }

    for (const [kind, table] of [
      ['dish', 'dishes'],
      ['restaurant', 'restaurants'],
    ] as const) {
      const uuids = [...(byKind[kind] ?? [])];
      if (uuids.length === 0) continue;

      const list = uuids.map((uuid) => `"${uuid}"`).join(',');
      const response = await fetch(`${rest}/${table}?uuid=in.(${list})&select=uuid,name`, {
        headers,
      });
      if (!response.ok) continue;

      for (const row of await response.json<{ uuid: string; name: string }[]>()) {
        titles.set(row.uuid, row.name);
      }
    }

    return titles;
  };

  return {
    async pending(limit) {
      // El índice parcial `notifications_pending_push_idx` cubre exactamente
      // este filtro, así que no recorre la tabla.
      const url =
        `${rest}/notifications?pushed_at=is.null` +
        `&select=id,user_id,kind,visit_uuid,actor_id,entity_uuid,entity_kind` +
        `&order=created_at.asc&limit=${limit}`;

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`push pending: HTTP ${response.status}`);

      const rows = await response.json<
        {
          id: number;
          user_id: string;
          kind: string;
          visit_uuid: string | null;
          actor_id: string | null;
          entity_uuid: string | null;
          entity_kind: string | null;
        }[]
      >();

      // En paralelo: son búsquedas por clave sobre como mucho doscientas filas,
      // y encadenarlas solo suma latencia.
      const [names, titles, entityTitles] = await Promise.all([
        namesFor(rows.map((row) => row.actor_id)),
        titlesFor(rows.map((row) => row.visit_uuid)),
        entityTitlesFor(rows.map((row) => ({ uuid: row.entity_uuid, kind: row.entity_kind }))),
      ]);

      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        kind: row.kind,
        visitUuid: row.visit_uuid,
        actorId: row.actor_id,
        entityUuid: row.entity_uuid,
        entityKind: row.entity_kind,
        // "Alguien te etiquetó" es raro pero se entiende; no mandar el aviso
        // porque falte un perfil, no.
        actorName: (row.actor_id && names.get(row.actor_id)) || 'Alguien',
        title:
          (row.visit_uuid && titles.get(row.visit_uuid)) ||
          (row.entity_uuid && entityTitles.get(row.entity_uuid)) ||
          null,
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

      const rows = await response.json<{ user_id: string; token: string }[]>();
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
