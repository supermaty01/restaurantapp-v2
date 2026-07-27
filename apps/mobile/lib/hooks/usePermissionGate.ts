import * as Linking from 'expo-linking';
import { useCallback } from 'react';

import { useDialog } from '@/components/ui/Dialog';

/**
 * Qué hacer cuando el sistema dice que no.
 *
 * Un permiso denegado no es un error, y tratarlo como tal —«Error: permiso
 * denegado»— deja a la persona sin saber qué hacer con esa información. Es una
 * decisión suya que puede cambiar, y el único sitio donde se cambia son los
 * ajustes del teléfono. Así que esto pregunta y lleva ahí.
 *
 * Existe como hook porque el mismo diálogo estaba copiado en tres sitios
 * (galería, cámara y ubicación, en dos ficheros distintos) con tres textos
 * ligeramente distintos y un `Alert` nativo cada uno. Tres copias es donde
 * empiezan a divergir.
 *
 * En Android un «no» a la segunda vez es definitivo y el sistema ya no vuelve a
 * preguntar, así que esta es la única salida que le queda a la app.
 */
export function usePermissionGate(): (what: string) => Promise<void> {
  const { ask, tell } = useDialog();

  return useCallback(
    async (what: string) => {
      const go = await ask({
        title: `Sin acceso a ${what}`,
        message: `RestaurantApp necesita tu permiso para ${what}. Puedes dárselo desde los ajustes del teléfono.`,
        icon: 'lock-closed-outline',
        confirmLabel: 'Abrir ajustes',
        cancelLabel: 'Ahora no',
      });
      if (!go) return;

      try {
        await Linking.openSettings();
      } catch {
        // Raro, pero pasa en algunas capas de fabricante. Decirlo es mejor que
        // que el botón no haga nada.
        await tell({
          title: 'No se pudo abrir la configuración',
          message: 'Ábrela a mano desde los ajustes del teléfono.',
          icon: 'alert-circle-outline',
          destructive: true,
        });
      }
    },
    [ask, tell],
  );
}
