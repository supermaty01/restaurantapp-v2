import { formatBytes, formatDate } from './formatters';

describe('formatters', () => {
  it('formats byte sizes into readable strings', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
  });

  it('formats nullable dates safely', () => {
    expect(formatDate(null)).toBe('Nunca');
    expect(formatDate(new Date('2026-03-09T10:00:00.000Z'))).toContain('2026');
  });
});
