import { byNewestFirst } from './order';

const visit = (id: number, visited_at: string | null) => ({ id, visited_at });

describe('el historial de un sitio', () => {
  it('empieza por la última vez que fuiste', () => {
    const rows = [visit(1, '2024-01-05'), visit(2, '2026-07-30'), visit(3, '2025-03-12')].sort(
      byNewestFirst,
    );

    expect(rows.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  // «Sin fecha» no es «hace un momento»: las importadas de la v1 no pueden
  // encabezar la lista solo por no saberse cuándo fueron.
  it('deja al final las visitas sin fecha', () => {
    const rows = [visit(1, null), visit(2, '2020-01-01'), visit(3, null)].sort(byNewestFirst);

    expect(rows.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('entre dos sin fecha manda el orden en que se escribieron', () => {
    const rows = [visit(7, null), visit(9, null)].sort(byNewestFirst);
    expect(rows.map((r) => r.id)).toEqual([9, 7]);
  });
});
