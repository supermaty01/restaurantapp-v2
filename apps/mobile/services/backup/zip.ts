import { zip as zipNative, unzip as unzipNative } from 'react-native-zip-archive';

/**
 * Zip helpers for backups, backed by the native `react-native-zip-archive`.
 *
 * **Why native and not a JS zip (revised decision, see docs/11).** The first
 * implementation used JSZip: pure JS, no native dependency, no upgrade risk.
 * It was functionally wrong at real sizes — it reads the whole archive into a
 * base64 string and decompresses in memory, so a 207 MB backup (never mind the
 * multi-GB target) blows up the JS heap and surfaces as a bogus "invalid
 * format". The native module streams to disk, and it is also what v1 wrote
 * existing backups with, so restoring them keeps working.
 *
 * Paths may be `file://` URIs: the library normalises them.
 */

/** Zips a whole directory; entries are relative to `sourceDir`. */
export async function createZipFromDirectory(
  sourceDir: string,
  targetPath: string,
): Promise<string> {
  return zipNative(sourceDir, targetPath);
}

/** Extracts an archive into `destinationDir`, streaming to disk. */
export async function extractZipToDirectory(
  zipPath: string,
  destinationDir: string,
): Promise<string> {
  return unzipNative(zipPath, destinationDir);
}
