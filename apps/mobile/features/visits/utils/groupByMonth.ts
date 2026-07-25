const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export interface MonthSection<T> {
  /** `2026-08`, stable and sortable. */
  key: string;
  /** "Agosto" this year, "Agosto 2024" otherwise. */
  title: string;
  count: number;
  /** Items chunked into rows of `columns`, ready for a SectionList grid. */
  data: T[][];
}

/** `YYYY-MM-DD` or an ISO timestamp → `{ year, month }`, in local time. */
function parseYearMonth(value: string): { year: number; month: number } | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly) {
    return { year: Number(dateOnly[1]), month: Number(dateOnly[2]) - 1 };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getFullYear(), month: parsed.getMonth() };
}

/**
 * Groups entries into months, newest first, with each month's items chunked
 * into grid rows.
 *
 * This is the shape a photo timeline needs: a `SectionList` can pin the month
 * header while its rows scroll under it, but it only lays out one item per row,
 * so the grid has to be built by chunking here rather than by the renderer.
 *
 * Entries whose date cannot be parsed are kept in a group of their own rather
 * than dropped — losing a visit because its date is odd would be worse than
 * showing it under a vague heading.
 */
export function groupByMonth<T>(
  items: T[],
  getDate: (item: T) => string,
  columns: number,
  now: Date = new Date(),
  /** Which way the months run. The timeline has to honour the chosen order. */
  order: 'asc' | 'desc' = 'desc',
): MonthSection<T>[] {
  const buckets = new Map<string, T[]>();

  for (const item of items) {
    const parsed = parseYearMonth(getDate(item));
    const key = parsed
      ? `${parsed.year}-${String(parsed.month + 1).padStart(2, '0')}`
      : 'sin-fecha';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const sections = [...buckets.entries()].map(([key, entries]) => ({
    key,
    title: titleFor(key, now),
    count: entries.length,
    data: chunk(entries, columns),
  }));

  // Undated entries always sink to the bottom, whichever way the rest runs.
  return sections.sort((a, b) => {
    if (a.key === 'sin-fecha') return 1;
    if (b.key === 'sin-fecha') return -1;
    return order === 'desc' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key);
  });
}

function titleFor(key: string, now: Date): string {
  if (key === 'sin-fecha') return 'Sin fecha';
  const [year, month] = key.split('-').map(Number) as [number, number];
  const name = MONTHS[month - 1] ?? key;
  // The year is noise while you are still in it.
  return year === now.getFullYear() ? name : `${name} ${year}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 1) return items.map((item) => [item]);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}
