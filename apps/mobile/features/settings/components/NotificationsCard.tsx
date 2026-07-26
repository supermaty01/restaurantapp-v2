import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { pushPermissionGranted, requestPushPermission } from '@/services/push/push';

/**
 * Encender los avisos desde Ajustes.
 *
 * El sitio donde se piden es justo después de etiquetar a alguien, que es
 * cuando la pregunta se entiende. Pero esa pregunta se hace **una sola vez**, y
 * sin esta fila quien contestara "ahora no" se quedaba sin push para siempre
 * sin ninguna forma de cambiar de idea dentro de la app.
 *
 * También dice cuándo el sistema ya no va a preguntar. En Android 13+ un "no"
 * es definitivo: `requestPermissionsAsync` vuelve a decir que no sin enseñar
 * nada, y un botón que no hace nada visible es peor que no tener botón. En ese
 * caso la fila manda a los ajustes del teléfono, que es el único sitio donde
 * eso se puede deshacer.
 */
export default function NotificationsCard() {
  const { colors } = useTheme();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setGranted(await pushPermissionGranted());
    } catch {
      // Sin el módulo nativo —un cliente de desarrollo viejo— la fila se queda
      // sin estado en vez de tumbar Ajustes.
      setGranted(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      const ok = await requestPushPermission();
      setGranted(ok);
      // Si el sistema ya lo tenía denegado no ha enseñado nada, así que el
      // único sitio donde se puede cambiar es la ficha de la app.
      if (!ok) await Linking.openSettings();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3 rounded-xl bg-surface p-4">
      <View className="flex-row items-center gap-2.5">
        <Ionicons
          name={granted ? 'notifications' : 'notifications-off-outline'}
          size={20}
          color={granted ? colors.sage : colors.inkSubtle}
        />
        <Txt variant="body" weight="semi" serif={false} className="flex-1">
          Avisos
        </Txt>
        <Txt variant="caption" tone={granted ? 'muted' : 'subtle'}>
          {granted === null ? 'Sin comprobar' : granted ? 'Activados' : 'Desactivados'}
        </Txt>
      </View>

      <Txt variant="caption" tone="subtle">
        {granted
          ? 'Te llegará un aviso cuando alguien te etiquete, aunque no tengas la app abierta.'
          : 'Sin esto seguirás viendo quién te etiqueta en Novedades, pero solo al abrir la app.'}
      </Txt>

      {granted ? null : (
        <Button
          label="Activar los avisos"
          variant="secondary"
          size="sm"
          disabled={busy}
          onPress={() => void enable()}
        />
      )}
    </View>
  );
}
