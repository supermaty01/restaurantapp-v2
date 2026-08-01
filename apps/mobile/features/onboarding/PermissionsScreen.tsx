import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { setSetting } from '@/services/db/settings-repository';
import { PUSH_PROMPT_ASKED_KEY, requestPushPermission } from '@/services/push/push';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Los permisos que la app pide **cuando** hacen falta, y para qué. */
const IN_CONTEXT: { icon: IconName; what: string; when: string }[] = [
  {
    icon: 'camera-outline',
    what: 'La cámara y tus fotos',
    when: 'al añadir una foto a una comida',
  },
  { icon: 'location-outline', what: 'Tu ubicación', when: 'al situar un restaurante en el mapa' },
];

/**
 * El segundo paso: qué permisos usa la app, y el único que se pide ahora.
 *
 * ## Por qué los avisos sí y los demás no
 *
 * `usePushPrompt` argumenta —con razón— que pedir el permiso al arrancar es
 * mala idea: la respuesta rápida es «no», y en Android 13+ un no cierra la
 * puerta hasta que alguien vaya a los ajustes del sistema. Ese argumento sigue
 * en pie y esta pantalla no lo contradice, porque **la pregunta de aquí no es
 * la del sistema**. Es la nuestra, que se puede repetir; la del sistema solo
 * sale si esta se contesta que sí. Es el mismo patrón de dos preguntas que
 * `usePushPrompt` ya usa, movido a un sitio donde además hay contexto: se acaba
 * de leer qué es la app.
 *
 * Lo que sí faltaba es lo que le pasa a los avisos y a ningún otro permiso:
 * **no tienen un momento en que el usuario los necesite**. La cámara la pides
 * cuando vas a hacer una foto; los avisos hacen falta cuando **otra persona**
 * te etiqueta o te manda una solicitud, y eso no lo desencadena nadie desde
 * aquí. El único disparador que había era «acabas de etiquetar a alguien», que
 * deja fuera justo a quien nunca etiqueta y solo recibe.
 *
 * Los otros dos permisos se **explican** y no se piden. Fuera de contexto,
 * «¿por qué un diario de comidas quiere mi cámara?» se contesta que no, y ese
 * no cuesta el permiso que sí habrías dado al pulsar «añadir foto». Explicarlos
 * da la transparencia sin pagar ese precio.
 */
export function PermissionsScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const [asking, setAsking] = useState(false);

  const enable = async () => {
    setAsking(true);
    try {
      // Antes de salir a preguntar, no después: si la app muere con el diálogo
      // del sistema abierto, el intento se ha gastado igual y volver a
      // ofrecerlo sería ofrecer algo que ya no puede pasar.
      await setSetting(db, PUSH_PROMPT_ASKED_KEY, 'true');
      await requestPushPermission();
    } catch {
      // Quedarse sin avisos no es una avería: la campana y Novedades siguen
      // enteras, y desde luego no puede impedir entrar en la app.
    } finally {
      onDone();
    }
  };

  return (
    <View
      className="flex-1 justify-between bg-canvas px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }}
    >
      <View>
        <FadeInUp index={0}>
          <View className="h-12 w-12 items-center justify-center rounded-pill bg-primary/12">
            <Ionicons name="notifications-outline" size={24} color={colors.primary} />
          </View>
          <Txt variant="hero" className="mt-6">
            {'¿Te avisamos\ncuando pase algo?'}
          </Txt>
          <Txt variant="body" tone="muted" className="mt-3">
            Si alguien te etiqueta en una comida o te manda una solicitud, te lo decimos aunque no
            tengas la app abierta.
          </Txt>
        </FadeInUp>

        <FadeInUp index={1}>
          {/* La única razón por la que esto se pregunta ahora y no más tarde, y
              conviene que se lea: lo que avisa no lo provocas tú. */}
          <Txt variant="caption" tone="subtle" className="mt-4">
            Es el único permiso que no depende de ti: lo demás lo activas cuando lo usas. Sin avisos
            no se pierde nada, lo verás igual en Novedades.
          </Txt>
        </FadeInUp>

        <View className="mt-9 gap-5">
          {IN_CONTEXT.map((permission, index) => (
            <FadeInUp key={permission.what} index={index + 2}>
              <View className="flex-row items-start gap-3.5">
                <View className="h-9 w-9 items-center justify-center rounded-pill bg-sunken">
                  <Ionicons name={permission.icon} size={17} color={colors.inkSubtle} />
                </View>
                <View className="min-w-0 flex-1">
                  <Txt variant="callout" weight="bold" serif={false}>
                    {permission.what}
                  </Txt>
                  <Txt variant="caption" tone="subtle" className="mt-0.5">
                    Se pide {permission.when}, no ahora.
                  </Txt>
                </View>
              </View>
            </FadeInUp>
          ))}
        </View>
      </View>

      <FadeInUp index={4}>
        <View className="gap-2.5">
          <Button
            label="Activar avisos"
            size="lg"
            block
            loading={asking}
            onPress={() => void enable()}
          />
          {/* «Ahora no» no marca nada: la pregunta de arriba es nuestra y se
              puede repetir. El momento de después —cuando etiquetas a alguien—
              sigue teniendo su oportunidad. */}
          <Button
            label="Ahora no"
            variant="secondary"
            size="lg"
            block
            disabled={asking}
            onPress={onDone}
          />
        </View>
      </FadeInUp>
    </View>
  );
}
