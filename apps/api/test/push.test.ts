import { describe, expect, it } from 'vitest';

import {
  composeMessage,
  deliverPending,
  type DeviceToken,
  type ExpoPushMessage,
  type ExpoPushTicket,
  type PendingNotification,
  type PushSender,
  type PushStore,
} from '../src/push';

/**
 * El reparto de los avisos, sin Supabase ni red.
 *
 * Lo que se rompe en un envío de push no es la petición HTTP: es a quién se le
 * manda, qué se hace con la respuesta y —sobre todo— cuándo se marca como
 * enviado. Marcarlo antes de tener la respuesta deja avisos que no salen nunca
 * y de los que nadie se entera; marcarlo de más los manda dos veces. Los dos
 * casos se prueban aquí.
 */

function notification(id: number, userId: string): PendingNotification {
  return {
    id,
    userId,
    kind: 'tagged_in_visit',
    visitUuid: `visit-${id}`,
    actorId: 'caro-id',
    actorName: 'Caro',
    title: 'Ichiran',
  };
}

/** Uno de los que no ocurren en una comida: sin visita y sin sitio. */
function socialNotification(kind: string): PendingNotification {
  return {
    id: 1,
    userId: 'ana',
    kind,
    visitUuid: null,
    actorId: 'caro-id',
    actorName: 'Caro',
    title: null,
  };
}

function fakeStore(
  pending: PendingNotification[],
  tokens: DeviceToken[],
): PushStore & { marked: number[]; removed: string[] } {
  const marked: number[] = [];
  const removed: string[] = [];
  return {
    marked,
    removed,
    async pending(limit) {
      return pending.slice(0, limit);
    },
    async tokensFor(userIds) {
      return tokens.filter((t) => userIds.includes(t.userId));
    },
    async markPushed(ids) {
      marked.push(...ids);
    },
    async removeTokens(list) {
      removed.push(...list);
    },
  };
}

function fakeSender(
  reply: (messages: ExpoPushMessage[]) => ExpoPushTicket[],
): PushSender & { sent: ExpoPushMessage[] } {
  const sent: ExpoPushMessage[] = [];
  return {
    sent,
    async send(messages) {
      sent.push(...messages);
      return reply(messages);
    },
  };
}

const allOk = (messages: ExpoPushMessage[]): ExpoPushTicket[] =>
  messages.map(() => ({ status: 'ok' as const }));

describe('repartir avisos pendientes', () => {
  it('manda uno por dispositivo y marca el aviso', async () => {
    const store = fakeStore(
      [notification(1, 'ana')],
      [
        { userId: 'ana', token: 'ExponentPushToken[móvil]' },
        { userId: 'ana', token: 'ExponentPushToken[tablet]' },
      ],
    );
    const sender = fakeSender(allOk);

    const result = await deliverPending(store, sender);

    expect(sender.sent.map((m) => m.to)).toEqual([
      'ExponentPushToken[móvil]',
      'ExponentPushToken[tablet]',
    ]);
    // Un aviso, aunque hayan salido dos mensajes.
    expect(result.delivered).toBe(1);
    expect(store.marked).toEqual([1]);
  });

  it('no manda nada al que no es', async () => {
    const store = fakeStore(
      [notification(1, 'ana')],
      [{ userId: 'beto', token: 'ExponentPushToken[beto]' }],
    );
    const sender = fakeSender(allOk);

    const result = await deliverPending(store, sender);

    expect(sender.sent).toEqual([]);
    expect(result.withoutDevice).toBe(1);
  });

  it('marca igual a quien no tiene dispositivo, o la cola crece para siempre', async () => {
    const store = fakeStore([notification(1, 'ana')], []);
    const sender = fakeSender(allOk);

    await deliverPending(store, sender);

    // Quien no dio permiso no lo va a dar porque su aviso siga en la cola.
    expect(store.marked).toEqual([1]);
  });

  it('un fallo del servicio deja el aviso sin marcar, para reintentarlo', async () => {
    const store = fakeStore(
      [notification(1, 'ana')],
      [{ userId: 'ana', token: 'ExponentPushToken[ana]' }],
    );
    const sender: PushSender = {
      async send() {
        throw new Error('exp.host caído');
      },
    };

    const result = await deliverPending(store, sender);

    expect(result.delivered).toBe(0);
    // Lo importante: **no** se marcó. Marcarlo aquí perdería el aviso para
    // siempre, sin que nadie se entere de que se perdió.
    expect(store.marked).toEqual([]);
  });

  it('un error por mensaje tampoco lo marca', async () => {
    const store = fakeStore(
      [notification(1, 'ana'), notification(2, 'beto')],
      [
        { userId: 'ana', token: 'ExponentPushToken[ana]' },
        { userId: 'beto', token: 'ExponentPushToken[beto]' },
      ],
    );
    const sender = fakeSender((messages) =>
      messages.map((m) =>
        m.to.includes('ana')
          ? { status: 'error' as const, message: 'MessageRateExceeded' }
          : { status: 'ok' as const },
      ),
    );

    await deliverPending(store, sender);

    expect(store.marked).toEqual([2]);
  });

  it('retira la ficha de quien desinstaló, y no la reintenta', async () => {
    const store = fakeStore(
      [notification(1, 'ana')],
      [{ userId: 'ana', token: 'ExponentPushToken[muerto]' }],
    );
    const sender = fakeSender((messages) =>
      messages.map(() => ({
        status: 'error' as const,
        message: 'not registered',
        details: { error: 'DeviceNotRegistered' },
      })),
    );

    const result = await deliverPending(store, sender);

    expect(store.removed).toEqual(['ExponentPushToken[muerto]']);
    expect(result.prunedTokens).toBe(1);
    // El aviso se da por hecho: el teléfono ya no existe, y dejarlo pendiente
    // lo reintentaría en cada pasada del cron para siempre.
    expect(store.marked).toEqual([1]);
  });

  it('trocea de cien en cien, que es el tope de Expo', async () => {
    const pending = Array.from({ length: 250 }, (_, i) => notification(i + 1, `u${i}`));
    const tokens = pending.map((n) => ({ userId: n.userId, token: `t${n.id}` }));
    const store = fakeStore(pending, tokens);

    const batches: number[] = [];
    const sender: PushSender = {
      async send(messages) {
        batches.push(messages.length);
        return messages.map(() => ({ status: 'ok' as const }));
      },
    };

    await deliverPending(store, sender, 250);

    expect(batches).toEqual([100, 100, 50]);
    expect(store.marked).toHaveLength(250);
  });

  it('una avalancha no se intenta entera de una vez', async () => {
    const pending = Array.from({ length: 500 }, (_, i) => notification(i + 1, `u${i}`));
    const tokens = pending.map((n) => ({ userId: n.userId, token: `t${n.id}` }));
    const store = fakeStore(pending, tokens);
    const sender = fakeSender(allOk);

    await deliverPending(store, sender);

    // El tope por pasada existe para que el Worker no agote su tiempo y no
    // entregue nada; el cron vuelve en cinco minutos a por el resto.
    expect(store.marked).toHaveLength(200);
  });

  it('sin nada pendiente no llama a nadie', async () => {
    const store = fakeStore([], []);
    let called = false;
    const sender: PushSender = {
      async send() {
        called = true;
        return [];
      },
    };

    const result = await deliverPending(store, sender);

    expect(called).toBe(false);
    expect(result).toEqual({ delivered: 0, withoutDevice: 0, prunedTokens: 0 });
  });
});

describe('cómo se lee el aviso', () => {
  it('el nombre en el título y el sitio en el cuerpo', () => {
    const message = composeMessage(notification(7, 'ana'), 'ExponentPushToken[x]');

    // En la pantalla de bloqueo el título es lo único que se lee entero, y
    // quién te etiquetó es lo que decide si lo abres ahora.
    expect(message.title).toBe('Caro');
    expect(message.body).toBe('Te etiquetó en Ichiran');
  });

  it('lleva la visita, que es lo que la app abre al tocarlo', () => {
    const message = composeMessage(notification(7, 'ana'), 'ExponentPushToken[x]');
    expect(message.data).toEqual({
      visitUuid: 'visit-7',
      actorId: 'caro-id',
      notificationId: 7,
    });
  });

  it('va por el canal que la app crea al arrancar', () => {
    // Sin canal, Android 8+ descarta la notificación en silencio.
    expect(composeMessage(notification(1, 'ana'), 't').channelId).toBe('default');
  });

  it('cada clase se lee distinta', () => {
    const body = (kind: string) => composeMessage(socialNotification(kind), 't').body;

    expect(body('friend_request')).toBe('Quiere ser tu amigo');
    expect(body('friend_accepted')).toBe('Aceptó tu solicitud de amistad');
    expect(body('friend_published')).toBe('Ha añadido algo nuevo');
  });

  it('las que no ocurren en una comida llevan a quien las provocó', () => {
    // Sin esto la app abre la pantalla de inicio, que desde fuera es igual que
    // un aviso que no lleva a ningún sitio.
    const message = composeMessage(socialNotification('friend_request'), 't');
    expect(message.data).toEqual({ visitUuid: null, actorId: 'caro-id', notificationId: 1 });
  });

  it('una clase que este Worker no conoce sale igual', () => {
    // La migración se aplica antes que el despliegue, así que hay una ventana
    // real en la que la base emite clases que este código no conoce. Sin una
    // rama por defecto se quedarían sin enviar para siempre: `deliverPending`
    // solo marca `pushed_at` de lo que sale.
    const message = composeMessage(socialNotification('algo_que_vendra'), 't');
    expect(message.title).toBe('Caro');
    expect(message.body).toBe('Tienes una novedad');
  });

  it('un aviso de etiqueta sin sitio no dice "undefined"', () => {
    // `titlesFor` devuelve null si la visita se borró entre que se escribió el
    // aviso y que salió.
    const orphan = { ...notification(3, 'ana'), title: null };
    expect(composeMessage(orphan, 't').body).toBe('Te etiquetó en una comida');
  });
});
