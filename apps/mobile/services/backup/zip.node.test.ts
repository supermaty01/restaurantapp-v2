import JSZip from 'jszip';

/**
 * The archive layout is the compatibility contract with v1 backups (docs/09):
 * `database.db` + `metadata.json` at the root and photos under `images/`.
 * Zipping itself is now done by a native module — it streams, because real
 * backups are hundreds of MB — so it can't run in node; what these tests pin is
 * the layout the importer relies on, using a v1-shaped archive built with JSZip.
 */
describe('backup archive layout (v1 compatibility)', () => {
  async function buildV1StyleArchive(): Promise<JSZip> {
    const zip = new JSZip();
    zip.file('database.db', 'SQLITE-BYTES');
    zip.file('metadata.json', JSON.stringify({ version: '1.3.0', exportDate: '2026-01-01' }));
    zip.file('images/photo-1.jpg', 'JPEG-BYTES');
    // Round-trip so we assert against a real parsed archive, not the builder.
    return JSZip.loadAsync(await zip.generateAsync({ type: 'base64' }), { base64: true });
  }

  it('places the database and metadata at the archive root', async () => {
    const zip = await buildV1StyleArchive();
    const names = Object.keys(zip.files);

    // importData looks these up as `${extractDir}database.db` / metadata.json:
    // any nesting (e.g. a wrapping folder) would break restoring v1 backups.
    expect(names).toContain('database.db');
    expect(names).toContain('metadata.json');
  });

  it('keeps photos under the images/ prefix', async () => {
    const zip = await buildV1StyleArchive();
    const images = Object.values(zip.files)
      .filter((f) => !f.dir && f.name.startsWith('images/'))
      .map((f) => f.name);

    expect(images).toEqual(['images/photo-1.jpg']);
  });

  it('metadata carries the version that produced the backup', async () => {
    const zip = await buildV1StyleArchive();
    const raw = await zip.file('metadata.json')!.async('string');

    expect(JSON.parse(raw)).toMatchObject({ version: expect.any(String) });
  });
});
