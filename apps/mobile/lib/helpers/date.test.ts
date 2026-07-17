import { formatVisitDate, getTodayLocalDateString } from './date';

describe('date helpers', () => {
  it('formats visit dates in Spanish with capitalized month', () => {
    expect(formatVisitDate('2025-06-16')).toBe('16 de Junio, 2025');
  });

  it('returns the original value when the visit date is invalid', () => {
    expect(formatVisitDate('16/06/2025')).toBe('16/06/2025');
  });

  it('returns the current local date in yyyy-mm-dd format', () => {
    const today = getTodayLocalDateString();

    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
