const SPANISH_MONTHS = [
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

function parseDateOnlyAsLocal(dateValue: string | null | undefined): Date | null {
  if (!dateValue) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function formatVisitDate(dateValue: string | null | undefined): string {
  // Imported v1 diaries contain visits with no date (docs/09). Saying so beats
  // every caller guarding, and beats printing "null".
  if (!dateValue) return 'Sin fecha';
  const parsedDate = parseDateOnlyAsLocal(dateValue);
  if (!parsedDate) {
    return dateValue;
  }

  const day = parsedDate.getDate();
  const month = SPANISH_MONTHS[parsedDate.getMonth()];
  const year = parsedDate.getFullYear();

  return `${day} de ${month}, ${year}`;
}

export function getTodayLocalDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, '0');
  const day = `${today.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

const SPANISH_MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/**
 * Compact date for cards and list rows: "12 ago", or "12 ago 2024" once the
 * year stops being obvious. Accepts both the `YYYY-MM-DD` the local database
 * stores and the ISO timestamps the server returns.
 */
export function formatDate(dateValue: string | null | undefined, now: Date = new Date()): string {
  if (!dateValue) return 'Sin fecha';
  const parsed = parseDateOnlyAsLocal(dateValue) ?? new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  const day = parsed.getDate();
  const month = SPANISH_MONTHS_SHORT[parsed.getMonth()];
  return parsed.getFullYear() === now.getFullYear()
    ? `${day} ${month}`
    : `${day} ${month} ${parsed.getFullYear()}`;
}

/**
 * How long ago something happened, for the feed. Falls back to an absolute date
 * after a week, where "hace 23 días" stops being easier to read than "3 jul".
 */
export function formatRelativeDate(
  dateValue: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!dateValue) return 'Sin fecha';
  const parsed = parseDateOnlyAsLocal(dateValue) ?? new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  const minutes = Math.floor((now.getTime() - parsed.getTime()) / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;

  return formatDate(dateValue, now);
}
