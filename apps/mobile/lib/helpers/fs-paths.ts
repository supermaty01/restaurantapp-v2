import * as FileSystem from 'expo-file-system/legacy';

/**
 * Directorio raíz de la app (expo-file-system)
 */
export const DOCUMENT_DIR = FileSystem.documentDirectory!;

/**
 * Todas las imágenes de la app van aquí
 */
export const IMAGES_DIR = `${DOCUMENT_DIR}images/`;

/**
 * Aquí almacenamos la base de datos SQLite
 */
export const SQLITE_DIR = `${DOCUMENT_DIR}SQLite/`;
