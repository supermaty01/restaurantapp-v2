import {
  EXPORT_PREFIX as EXPORT,
  SAFETY_PREFIX as SAFETY,
  archivesToPrune,
} from '@/services/backup/prune';

/**
 * Qué copias se barren y cuáles no.
 *
 * El fallo que arregla: cada exportación escribía un zip con la hora en el
 * nombre, en el directorio de documentos, y **nadie lo borraba nunca**. Un zip
 * pesa casi lo que la carpeta de imágenes entera —un zip no comprime JPEG— así
 * que cinco o diez exportaciones son el giga o dos que se veía en el móvil.
 *
 * Se prueba la decisión y no el borrado: lo que puede volver a romperse es qué
 * ficheros entran en la lista, no la llamada a `deleteAsync`.
 */
describe('qué copias sobran', () => {
  it('se lleva las exportaciones anteriores', () => {
    const names = [
      'restaurantapp_backup_2026-07-01T10-00-00-000Z.zip',
      'restaurantapp_backup_2026-07-15T11-30-00-000Z.zip',
    ];

    expect(archivesToPrune(names, EXPORT)).toEqual(names);
  });

  it('no toca nada que no sea una copia', () => {
    // El mismo directorio guarda la base de datos y las imágenes. Un barrido
    // que se pase de listo aquí no gasta disco: borra el diario.
    const names = ['SQLite', 'images', 'metadata.json', 'database.db', 'profileInstalled'];

    expect(archivesToPrune(names, EXPORT)).toEqual([]);
  });

  it('distingue la copia de seguridad de la exportación', () => {
    // Compartían nombre, y por eso no se podía barrer una sin llevarse la otra.
    // La de `sync-choice` es la red de la única pantalla que borra un diario
    // entero: no puede caer en el barrido de una exportación de Ajustes.
    const names = [
      'restaurantapp_backup_2026-07-01T10-00-00-000Z.zip',
      'restaurantapp_safety_2026-07-20T09-00-00-000Z.zip',
    ];

    expect(archivesToPrune(names, EXPORT)).toEqual([names[0]]);
    expect(archivesToPrune(names, SAFETY)).toEqual([names[1]]);
  });

  it('exige la extensión, no solo el prefijo', () => {
    // Un `.zip.tmp` a medio escribir es de una exportación que se cortó, y
    // borrarlo mientras se escribe es justo lo contrario de lo que se busca.
    const names = [
      'restaurantapp_backup_2026-07-01T10-00-00-000Z.zip.tmp',
      'restaurantapp_backup_parcial',
    ];

    expect(archivesToPrune(names, EXPORT)).toEqual([]);
  });

  it('aguanta un directorio vacío', () => {
    expect(archivesToPrune([], EXPORT)).toEqual([]);
  });
});
