// In-memory stand-in for expo-file-system, so the zip round-trip can run in node.
const mockFiles = new Map<string, string>(); // uri -> base64 contents

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  readAsStringAsync: async (uri: string) => {
    const data = mockFiles.get(uri);
    if (data === undefined) throw new Error(`ENOENT: ${uri}`);
    return data;
  },
  writeAsStringAsync: async (uri: string, contents: string) => {
    mockFiles.set(uri, contents);
  },
  makeDirectoryAsync: async () => {},
}));

import { createZip, extractZip } from './zip';

const b64 = (text: string) => Buffer.from(text, 'utf-8').toString('base64');

/**
 * The backup format is the user's safety net (docs/09): if the archive can't be
 * read back, a restore silently fails. This pins the round-trip.
 */
describe('backup zip', () => {
  beforeEach(() => mockFiles.clear());

  it('round-trips files through a zip', async () => {
    mockFiles.set('file:///db.sqlite', b64('DATABASE-CONTENTS'));
    mockFiles.set('file:///img/a.jpg', b64('IMAGE-A'));

    await createZip(
      [
        { name: 'database.db', uri: 'file:///db.sqlite' },
        { name: 'images/a.jpg', uri: 'file:///img/a.jpg' },
      ],
      'file:///out.zip',
    );
    expect(mockFiles.has('file:///out.zip')).toBe(true);

    const written = await extractZip('file:///out.zip', 'file:///restore/');

    expect(written.sort()).toEqual(['database.db', 'images/a.jpg']);
    expect(Buffer.from(mockFiles.get('file:///restore/database.db')!, 'base64').toString()).toBe(
      'DATABASE-CONTENTS',
    );
    expect(Buffer.from(mockFiles.get('file:///restore/images/a.jpg')!, 'base64').toString()).toBe(
      'IMAGE-A',
    );
  });

  it('preserves binary content exactly', async () => {
    // Byte values that would break if anything treated the payload as text.
    const bytes = Buffer.from([0x00, 0xff, 0x1a, 0x7f, 0x80, 0xc3, 0x28]);
    mockFiles.set('file:///bin', bytes.toString('base64'));

    await createZip([{ name: 'blob.bin', uri: 'file:///bin' }], 'file:///out.zip');
    await extractZip('file:///out.zip', 'file:///restore/');

    expect(Buffer.from(mockFiles.get('file:///restore/blob.bin')!, 'base64')).toEqual(bytes);
  });

  it('reports progress across entries', async () => {
    mockFiles.set('file:///a', b64('A'));
    mockFiles.set('file:///b', b64('B'));
    const seen: number[] = [];

    await createZip(
      [
        { name: 'a', uri: 'file:///a' },
        { name: 'b', uri: 'file:///b' },
      ],
      'file:///out.zip',
      (fraction) => seen.push(fraction),
    );

    expect(seen).toEqual([0.5, 1]);
  });

  it('rejects a file that is not a zip (what a bad import looks like)', async () => {
    mockFiles.set('file:///not-a-zip', b64('just some text, definitely not a zip'));

    await expect(extractZip('file:///not-a-zip', 'file:///restore/')).rejects.toThrow();
  });
});
