import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import { toggleLike, type FeedKind } from '../api';

/**
 * El corazón de una entrada del feed.
 *
 * ## Optimista, y por qué eso aquí sí
 *
 * El resto de la app espera a la respuesta antes de cambiar la pantalla, que es
 * lo correcto cuando lo que se escribe es del diario: enseñar una comida
 * guardada que no se guardó es perder datos delante de alguien. Un me gusta no
 * es eso. Se toca al vuelo, mientras se baja por una lista, y esperar medio
 * segundo a que conteste el servidor convierte un gesto en un formulario — o
 * peor, invita a tocarlo dos veces.
 *
 * Así que el corazón cambia en el momento y la respuesta **manda igual**: cuando
 * llega, se aplica lo que diga el servidor. Si el toque falló —sin red, o la
 * entrada dejó de estar compartida— se vuelve solo a como estaba, sin ningún
 * aviso. Un modal de error por un me gusta es más molesto que el me gusta que no
 * llegó a darse.
 *
 * ## Y por qué el estado vive aquí
 *
 * Porque la lista es de páginas y las páginas se recargan: si el contador fuera
 * del padre, cada `reload` del feed reharía los objetos y devolvería el corazón
 * a lo que dijo el servidor **antes** del toque, apagándolo delante de quien lo
 * acaba de dar. Con el estado aquí, el `useEffect` de abajo solo lo sincroniza
 * cuando el dato de verdad cambia de valor.
 */
export function LikeButton({
  entityUuid,
  kind,
  count,
  liked,
  /** Un poco más grande en las pantallas de detalle que en una tarjeta. */
  size = 'sm',
}: {
  entityUuid: string;
  kind: FeedKind;
  count: number;
  liked: boolean;
  size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const [state, setState] = useState({ liked, count });
  const [busy, setBusy] = useState(false);

  // El servidor gana cuando trae algo distinto de lo que se está enseñando: una
  // recarga de la lista, o volver a esta pantalla más tarde.
  useEffect(() => {
    setState({ liked, count });
  }, [liked, count]);

  const press = () => {
    if (busy) return;
    const previous = state;
    const next = { liked: !previous.liked, count: previous.count + (previous.liked ? -1 : 1) };
    setState(next);
    setBusy(true);

    void toggleLike(entityUuid, kind)
      .then((result) => setState({ liked: result.liked, count: result.total }))
      // Sin ruido: se deshace y ya. Ver arriba.
      .catch(() => setState(previous))
      .finally(() => setBusy(false));
  };

  const iconSize = size === 'md' ? 21 : 17;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: state.liked }}
      accessibilityLabel={
        state.liked
          ? `Quitar me gusta. ${state.count} en total`
          : `Me gusta. ${state.count} en total`
      }
      onPress={press}
      scaleTo={0.85}
      // El relleno hace de zona de toque: `PressableScale` no acepta `hitSlop`,
      // y un icono de 17 píxeles a pelo es un objetivo que se falla.
      className="-my-1.5 -ml-1.5 flex-row items-center gap-1.5 py-1.5 pl-1.5 pr-2"
    >
      <Ionicons
        name={state.liked ? 'heart' : 'heart-outline'}
        size={iconSize}
        color={state.liked ? colors.danger : colors.inkSubtle}
      />
      {/* El cero no se pinta: un contador a cero al lado de un corazón se lee
          como «nadie», que es una información que nadie pidió. */}
      {state.count > 0 ? (
        <Txt variant="caption" weight="semi" serif={false} tone={state.liked ? 'danger' : 'subtle'}>
          {state.count}
        </Txt>
      ) : null}
    </PressableScale>
  );
}
