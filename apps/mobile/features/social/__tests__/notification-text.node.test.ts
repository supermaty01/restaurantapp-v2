import { describeNotification } from '../notification-text';

import type { NotificationKind } from '../api';

/**
 * Que la frase que se ve y la que se escucha digan lo mismo.
 *
 * La fila de Novedades pinta el nombre en negrita, así que la frase llega
 * partida en tres trozos; un lector de pantalla no puede leer eso —ve una lista
 * de fragmentos con formato— y por eso hay una segunda versión de corrido.
 * **Dos textos que dicen lo mismo escritos por separado se separan**, y cuando
 * se separan nadie lo nota: el que se va es el que casi nadie lee.
 *
 * Y de paso se fija que ninguna clase se quede sin frase, que es lo que pasaría
 * al añadir la sexta.
 */
const KINDS: NotificationKind[] = [
  'tagged_in_visit',
  'friend_published',
  'friend_request',
  'friend_accepted',
  'entry_liked',
];

/** Lo que la fila pinta, pegado: prefijo + nombre + verbo + lo nombrado. */
function asRendered(
  sentence: { prefix: string; verb: string; place: string | null },
  actor: string,
): string {
  return `${sentence.prefix}${actor}${sentence.verb}${sentence.place ?? ''}`;
}

describe('describeNotification', () => {
  it.each(KINDS)('%s: lo que se ve y lo que se escucha coinciden', (kind) => {
    const sentence = describeNotification({ kind, title: 'Ichiran', entityKind: 'dish' }, 'Caro');
    expect(asRendered(sentence, 'Caro')).toBe(sentence.plain);
  });

  it.each(KINDS)('%s: y también cuando no hay nada que nombrar', (kind) => {
    const sentence = describeNotification({ kind, title: null, entityKind: null }, 'Caro');
    expect(asRendered(sentence, 'Caro')).toBe(sentence.plain);
  });

  it.each(KINDS)('%s: dice de quién es', (kind) => {
    const sentence = describeNotification({ kind, title: 'Ichiran', entityKind: 'visit' }, 'Caro');
    // Un aviso que no nombra a nadie obliga a abrirlo para saber de quién es.
    expect(sentence.plain).toContain('Caro');
  });
});

describe('el me gusta', () => {
  const like = (entityKind: 'visit' | 'dish' | 'restaurant' | null, title: string | null) =>
    describeNotification({ kind: 'entry_liked', title, entityKind }, 'Caro');

  it('nombra la entrada y de qué clase es', () => {
    expect(like('dish', 'Tonkotsu').plain).toBe('A Caro le gustó tu plato Tonkotsu');
    expect(like('restaurant', 'Ichiran').plain).toBe('A Caro le gustó tu sitio Ichiran');
    expect(like('visit', 'Ichiran').plain).toBe('A Caro le gustó tu visita a Ichiran');
  });

  it('lleva la preposición delante del nombre', () => {
    // Es la única de las cinco que no empieza por el nombre. Sin el prefijo la
    // fila decía «Caro le gustó tu plato», que se lee mal justo en el aviso más
    // frecuente.
    expect(like('dish', 'Tonkotsu').prefix).toBe('A ');
  });

  it('sin nombre de entrada, la frase no se queda colgando', () => {
    // Pasa cuando la entrada se borró entre el aviso y la lectura.
    expect(like('dish', null).plain).toBe('A Caro le gustó tu plato');
    expect(like('dish', null).plain).not.toContain('null');
    expect(like('dish', null).plain.endsWith(' ')).toBe(false);
  });

  it('con una clase de entrada desconocida tampoco miente', () => {
    // La migración puede ir por delante de esta versión de la app.
    expect(like(null, null).plain).toBe('A Caro le gustó algo tuyo');
  });
});
