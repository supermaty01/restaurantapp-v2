import { collapseRegistrationSessions, type RecentEntry } from '../recentEntries';

function entry(over: Partial<RecentEntry> & Pick<RecentEntry, 'kind' | 'id' | 'createdAt'>) {
  return {
    title: `${over.kind} ${over.id}`,
    detail: null,
    imagePath: null,
    restaurantId: null,
    dishIds: [],
    ...over,
  } satisfies RecentEntry;
}

describe('una entrada por sesión de registro', () => {
  /*
   * El caso que motivó esto: registrar una comida en un sitio nuevo crea tres
   * cosas de golpe, y las tres llenaban la pantalla de inicio contando lo mismo.
   */
  it('la visita se queda con sus platos y su restaurante', () => {
    const kept = collapseRegistrationSessions(
      [
        entry({
          kind: 'visit',
          id: 1,
          createdAt: '2026-07-26T10:00:02Z',
          restaurantId: 7,
          dishIds: [4, 5],
        }),
        entry({ kind: 'dish', id: 4, createdAt: '2026-07-26T10:00:01Z', restaurantId: 7 }),
        entry({ kind: 'dish', id: 5, createdAt: '2026-07-26T10:00:01Z', restaurantId: 7 }),
        entry({ kind: 'restaurant', id: 7, createdAt: '2026-07-26T10:00:00Z' }),
      ],
      3,
    );

    expect(kept.map((e) => `${e.kind}:${e.id}`)).toEqual(['visit:1']);
  });

  it('un plato suelto se queda, y se lleva su restaurante nuevo', () => {
    const kept = collapseRegistrationSessions(
      [
        entry({ kind: 'dish', id: 9, createdAt: '2026-07-25T10:00:01Z', restaurantId: 3 }),
        entry({ kind: 'restaurant', id: 3, createdAt: '2026-07-25T10:00:00Z' }),
      ],
      3,
    );

    expect(kept.map((e) => `${e.kind}:${e.id}`)).toEqual(['dish:9']);
  });

  it('un restaurante registrado solo se queda', () => {
    const kept = collapseRegistrationSessions(
      [entry({ kind: 'restaurant', id: 2, createdAt: '2026-07-24T10:00:00Z' })],
      3,
    );

    expect(kept.map((e) => `${e.kind}:${e.id}`)).toEqual(['restaurant:2']);
  });

  /** El ejemplo exacto que pidió el autor: tres sesiones, una de cada clase. */
  it('tres sesiones distintas dan tres entradas, una por sesión', () => {
    const kept = collapseRegistrationSessions(
      [
        entry({
          kind: 'visit',
          id: 1,
          createdAt: '2026-07-26T10:00:00Z',
          restaurantId: 7,
          dishIds: [4],
        }),
        entry({ kind: 'dish', id: 4, createdAt: '2026-07-26T10:00:00Z', restaurantId: 7 }),
        entry({ kind: 'restaurant', id: 7, createdAt: '2026-07-26T10:00:00Z' }),
        entry({ kind: 'dish', id: 9, createdAt: '2026-07-25T10:00:00Z' }),
        entry({ kind: 'restaurant', id: 2, createdAt: '2026-07-24T10:00:00Z' }),
      ],
      3,
    );

    expect(kept.map((e) => `${e.kind}:${e.id}`)).toEqual(['visit:1', 'dish:9', 'restaurant:2']);
  });

  /*
   * Lo que agrupa son las relaciones, no el reloj. Dos comidas registradas una
   * detrás de otra son dos sesiones aunque caigan en el mismo minuto: una
   * ventana de tiempo las habría fundido en una.
   */
  it('dos visitas seguidas siguen siendo dos entradas', () => {
    const kept = collapseRegistrationSessions(
      [
        entry({ kind: 'visit', id: 1, createdAt: '2026-07-26T10:00:05Z', restaurantId: 7 }),
        entry({ kind: 'visit', id: 2, createdAt: '2026-07-26T10:00:04Z', restaurantId: 8 }),
      ],
      3,
    );

    expect(kept).toHaveLength(2);
  });

  /*
   * Una visita de hoy a un sitio de hace un año no puede esconder nada: ese
   * restaurante hace tiempo que no está en lo reciente. Absorber solo dentro de
   * la lista es lo que lo garantiza.
   */
  it('solo absorbe lo que también es reciente', () => {
    const kept = collapseRegistrationSessions(
      [
        entry({ kind: 'visit', id: 1, createdAt: '2026-07-26T10:00:00Z', restaurantId: 99 }),
        entry({ kind: 'dish', id: 5, createdAt: '2026-07-20T10:00:00Z' }),
      ],
      3,
    );

    expect(kept.map((e) => `${e.kind}:${e.id}`)).toEqual(['visit:1', 'dish:5']);
  });

  it('respeta el límite', () => {
    const kept = collapseRegistrationSessions(
      [
        entry({ kind: 'visit', id: 1, createdAt: '2026-07-26T10:00:00Z' }),
        entry({ kind: 'visit', id: 2, createdAt: '2026-07-25T10:00:00Z' }),
        entry({ kind: 'visit', id: 3, createdAt: '2026-07-24T10:00:00Z' }),
      ],
      2,
    );

    expect(kept).toHaveLength(2);
  });
});
