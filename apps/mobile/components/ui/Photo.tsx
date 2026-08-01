import { Image } from 'expo-image';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/context/AuthContext';
import { remoteImageUri } from '@/lib/helpers/remote-image';

import type { ComponentProps } from 'react';

type ImageProps = ComponentProps<typeof Image>;

/**
 * Una foto del diario, con la copia de R2 como reserva.
 *
 * El problema que resuelve: **la fila dice que hay un fichero antes de que lo
 * haya.** Cuando una foto llega por sync, `localDefaults` en `tables.ts` le
 * pone `path = '{uuid}.jpg'` en el momento de insertar la fila;
 * `downloadMissingPhotos` va después y puede tardar, quedarse a medias o
 * fallar. Mientras tanto `imagePathToUri` devuelve un `file://` que no existe y
 * `expo-image` pinta un hueco — para siempre si la descarga falló, porque nada
 * lo vuelve a intentar al mirar la pantalla.
 *
 * La reserva se elige por fallo y no por adelantado: comprobar el disco antes
 * de pintar cuesta un salto al hilo nativo **por foto y por render**, y en una
 * lista con scroll eso es exactamente lo que la ronda 3 quitó de la descarga.
 * `onError` es gratis y solo cuesta cuando de verdad falta el fichero.
 *
 * `remoteKey` es la clave en R2 de **mi propia** foto; la cuenta la pone este
 * componente. Para una foto ajena la URL ya viene hecha en `uri` (el dueño es
 * otro), así que ahí no hay reserva que buscar.
 */
export function Photo({
  uri,
  remoteKey,
  ...props
}: Omit<ImageProps, 'source'> & {
  uri: string | null | undefined;
  /** Clave en R2 de esta foto, si ya está subida. */
  remoteKey?: string | null | undefined;
}) {
  const { accountUuid } = useAuth();
  const fallback = remoteImageUri(accountUuid, remoteKey);

  const [failed, setFailed] = useState(false);

  // Una lista recicla vistas: sin esto, la fila que heredó el `failed` de la
  // anterior enseñaría la reserva de una foto que sí está en disco.
  useEffect(() => setFailed(false), [uri]);

  const source = failed ? fallback : (uri ?? undefined);
  if (!source) return null;

  return (
    <Image
      {...props}
      source={source}
      onError={(event) => {
        // Solo una vez: si la reserva también falla, insistir sería un bucle.
        if (!failed && fallback) setFailed(true);
        props.onError?.(event);
      }}
    />
  );
}
