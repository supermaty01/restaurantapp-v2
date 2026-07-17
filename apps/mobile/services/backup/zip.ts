import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';

/**
 * Zip helpers backed by JSZip (pure JS) instead of a native archive module.
 *
 * Rationale (docs/11-dependencias.md): native modules are what break on every
 * Expo SDK upgrade. JSZip costs some memory but never blocks an upgrade.
 *
 * Files are streamed through base64 because that is the only encoding
 * expo-file-system can read and write for binary data.
 */

export interface ZipEntry {
  /** Path inside the archive, e.g. `images/photo.jpg`. */
  name: string;
  /** Absolute file:// URI of the source file. */
  uri: string;
}

export async function createZip(
  entries: ZipEntry[],
  destinationUri: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const zip = new JSZip();

  for (const [index, entry] of entries.entries()) {
    const base64 = await FileSystem.readAsStringAsync(entry.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    zip.file(entry.name, base64, { base64: true });
    onProgress?.((index + 1) / entries.length);
  }

  const content = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  await FileSystem.writeAsStringAsync(destinationUri, content, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function extractZip(
  zipUri: string,
  destinationDir: string,
  onProgress?: (fraction: number) => void,
): Promise<string[]> {
  const base64 = await FileSystem.readAsStringAsync(zipUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const zip = await JSZip.loadAsync(base64, { base64: true });
  const files = Object.values(zip.files).filter((file) => !file.dir);
  const written: string[] = [];

  for (const [index, file] of files.entries()) {
    const targetUri = `${destinationDir}${file.name}`;

    // Recreate the archive's directory structure before writing the file.
    const lastSlash = targetUri.lastIndexOf('/');
    if (lastSlash > -1) {
      await FileSystem.makeDirectoryAsync(targetUri.slice(0, lastSlash), {
        intermediates: true,
      });
    }

    const content = await file.async('base64');
    await FileSystem.writeAsStringAsync(targetUri, content, {
      encoding: FileSystem.EncodingType.Base64,
    });

    written.push(file.name);
    onProgress?.((index + 1) / files.length);
  }

  return written;
}
