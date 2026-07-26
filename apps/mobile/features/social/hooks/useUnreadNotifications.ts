import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchUnreadCount } from '../api';

/**
 * Cuántas novedades sin leer, para el punto.
 *
 * Se relee al enfocar la pantalla en vez de con un intervalo: el momento en el
 * que importa que el número esté al día es cuando vuelves de mirarlas, y un
 * temporizador de fondo gastaría batería y peticiones para acertar el resto del
 * tiempo, que es cuando nadie lo está mirando.
 *
 * Un fallo devuelve cero en vez de propagar. Este número decora una pantalla que
 * ya tiene su propio manejo de errores; hacer que Feed enseñe un error porque no
 * se pudo contar un punto sería cambiar algo prescindible por algo que no lo es.
 */
export function useUnreadNotifications(enabled: boolean): {
  count: number;
  refresh: () => void;
} {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    fetchUnreadCount()
      .then(setCount)
      .catch(() => setCount(0));
  }, [enabled]);

  useFocusEffect(refresh);

  return { count, refresh };
}
