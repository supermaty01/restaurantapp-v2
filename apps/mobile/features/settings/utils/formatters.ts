/**
 * Formatea un tamaño en bytes a una representación legible
 * @param bytes Tamaño en bytes
 * @param decimals Número de decimales a mostrar
 * @returns Cadena formateada (ej: "1.5 MB")
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Formatea una fecha a una representación legible
 * @param date Fecha a formatear
 * @returns Cadena formateada (ej: "01/01/2023, 12:00:00")
 */
export const formatDate = (date: Date | null | undefined): string => {
  if (!date) return 'Nunca';
  return new Date(date).toLocaleString();
};
