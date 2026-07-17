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

function parseDateOnlyAsLocal(dateValue: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function formatVisitDate(dateValue: string): string {
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
