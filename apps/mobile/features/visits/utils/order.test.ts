import { byNewestFirst } from './order';

type Row = { id: number; visited_at: string | null };

const sorted = (rows: Row[]) => [...rows].sort(byNewestFirst).map((row) => row.id);

describe('el orden de las visitas de un restaurante', () => {
  it('pone la más reciente primero', () => {
    expect(
      sorted([
        { id: 1, visited_at: '2024-01-05' },
        { id: 2, visited_at: '2026-07-30' },
        { id: 3, visited_at: '2025-03-12' },
      ]),
    ).toEqual([2, 3, 1]);
  });

  it('manda al final las que no tienen fecha, no al principio', () => {
    // Vienen de la v1, donde la fecha era opcional (docs/09). «Sin fecha» no es
    // «hace un momento»: arriba dejarían lo que menos se sabe del sitio.
    //
    // Entre las dos sin fecha manda el id más alto, que es lo mismo que hace el
    // resto de la lista: lo último escrito, primero. `''` y `null` cuentan igual
    // — el mapeador devuelve cadena vacía, la columna admite null.
    expect(
      sorted([
        { id: 1, visited_at: '' },
        { id: 2, visited_at: '2026-07-30' },
        { id: 3, visited_at: null },
      ]),
    ).toEqual([2, 3, 1]);
  });

  it('entre dos del mismo día decide el orden en que se escribieron', () => {
    expect(
      sorted([
        { id: 7, visited_at: '2026-07-30' },
        { id: 9, visited_at: '2026-07-30' },
      ]),
    ).toEqual([9, 7]);
  });
});
