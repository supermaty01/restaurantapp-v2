export interface ImageDTO {
  id: number;
  uri: string;
  /**
   * Clave en R2, si la foto ya está subida.
   *
   * Viaja hasta el componente porque `uri` es un `file://` que puede no
   * existir todavía: la fila se escribe al sincronizar y el fichero llega
   * después. `Photo` la usa como reserva. Ver `components/ui/Photo.tsx`.
   */
  remoteKey?: string | null | undefined;
}
