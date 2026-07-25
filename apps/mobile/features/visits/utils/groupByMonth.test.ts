import { groupByMonth } from './groupByMonth';

interface Entry {
  id: number;
  date: string;
}

const NOW = new Date(2026, 6, 25); // 25 July 2026

function group(entries: Entry[], columns = 3) {
  return groupByMonth(entries, (e) => e.date, columns, NOW);
}

describe('groupByMonth', () => {
  it('puts the newest month first', () => {
    const sections = group([
      { id: 1, date: '2026-05-02' },
      { id: 2, date: '2026-07-14' },
      { id: 3, date: '2026-06-30' },
    ]);

    expect(sections.map((s) => s.key)).toEqual(['2026-07', '2026-06', '2026-05']);
  });

  it('drops the year while you are still in it, and shows it otherwise', () => {
    const sections = group([
      { id: 1, date: '2026-08-01' },
      { id: 2, date: '2024-08-01' },
    ]);

    expect(sections.map((s) => s.title)).toEqual(['Agosto', 'Agosto 2024']);
  });

  it('counts the entries, not the rows', () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({ id: i, date: '2026-07-01' }));
    const [section] = group(entries);

    expect(section?.count).toBe(7);
    expect(section?.data).toHaveLength(3); // 3 + 3 + 1
  });

  it('chunks into rows of the requested width, last row short', () => {
    const entries = Array.from({ length: 4 }, (_, i) => ({ id: i, date: '2026-07-01' }));
    const [section] = group(entries, 3);

    expect(section?.data.map((row) => row.length)).toEqual([3, 1]);
  });

  it('gives one item per row when asked for a single column', () => {
    const entries = Array.from({ length: 3 }, (_, i) => ({ id: i, date: '2026-07-01' }));
    const [section] = group(entries, 1);

    expect(section?.data.map((row) => row.length)).toEqual([1, 1, 1]);
  });

  it('reads plain dates as local, not UTC', () => {
    // A naive `new Date('2026-01-01')` parses as UTC midnight, which in any
    // negative-offset timezone lands in December and files the visit under the
    // wrong month.
    const [section] = group([{ id: 1, date: '2026-01-01' }]);
    expect(section?.key).toBe('2026-01');
  });

  it('handles ISO timestamps as well as plain dates', () => {
    const sections = group([
      { id: 1, date: '2026-03-04' },
      { id: 2, date: '2026-03-09T21:30:00.000Z' },
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.count).toBe(2);
  });

  it('keeps entries with an unreadable date instead of dropping them', () => {
    const sections = group([
      { id: 1, date: '2026-07-01' },
      { id: 2, date: 'cuando sea' },
    ]);

    expect(sections.map((s) => s.title)).toEqual(['Julio', 'Sin fecha']);
    // A visit lost because its date is odd would be worse than a vague heading.
    expect(sections.reduce((total, s) => total + s.count, 0)).toBe(2);
  });

  it('sinks the undated group below every real month', () => {
    const sections = group([
      { id: 1, date: 'ni idea' },
      { id: 2, date: '2020-01-01' },
    ]);

    expect(sections[sections.length - 1]?.key).toBe('sin-fecha');
  });

  it('returns nothing for no entries', () => {
    expect(group([])).toEqual([]);
  });
});
