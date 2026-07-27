import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

// tsc no resuelve módulos de imagen a través del alias; expo-image acepta
// directamente el id numérico del empaquetador, que es lo que da `require`.
const appIcon = require('@/assets/burger-logo.png') as number;

const POINTS: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: 'phone-portrait-outline',
    title: 'Tu diario vive en tu móvil',
    detail: 'Funciona entero sin conexión y sin cuenta. Siempre.',
  },
  {
    icon: 'cloud-outline',
    title: 'La nube, si te apetece',
    detail: 'Una cuenta añade copia, otro dispositivo y compartir con quien quieras.',
  },
];

/**
 * La primera pantalla, y solo la primera vez.
 *
 * **No es una puerta de login, y el diseño lo tiene que decir sin leerlo.** El
 * principio de docs/00 y docs/04 —la cuenta es una capa opcional, nunca una
 * barrera de entrada— se rompe con un botón grande arriba y un enlace pequeño
 * debajo, aunque las dos opciones existan. Por eso los dos botones son del
 * mismo tamaño y «Empezar sin cuenta» va **primero**: es lo que la app hace por
 * defecto, y ponerlo segundo lo convertiría en la salida de emergencia.
 *
 * Y es el sitio natural para decir qué pasa si más adelante creas una cuenta,
 * porque es la única pregunta cuya respuesta no se puede deducir mirando: lo
 * que hayas guardado hasta entonces se asocia a ella. Enterarse el día que se
 * crea la cuenta es enterarse tarde.
 */
export function WelcomeScreen({
  onContinue,
  onSignIn,
}: {
  onContinue: () => void;
  onSignIn: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 justify-between bg-canvas px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }}
    >
      <View>
        <FadeInUp index={0}>
          <Image
            source={appIcon}
            style={{ width: 64, height: 64 }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
          <Txt variant="hero" className="mt-6">
            {'Lo que comes,\napuntado.'}
          </Txt>
          <Txt variant="body" tone="muted" className="mt-3">
            Dónde fuiste, qué pediste y qué tal estuvo. Para acordarte, y para saber dónde volver.
          </Txt>
        </FadeInUp>

        <View className="mt-10 gap-5">
          {POINTS.map((point, index) => (
            <FadeInUp key={point.title} index={index + 1}>
              <View className="flex-row items-start gap-3.5">
                <View className="h-9 w-9 items-center justify-center rounded-pill bg-primary/12">
                  <Ionicons name={point.icon} size={17} color={colors.primary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Txt variant="callout" weight="bold" serif={false}>
                    {point.title}
                  </Txt>
                  <Txt variant="caption" tone="subtle" className="mt-0.5">
                    {point.detail}
                  </Txt>
                </View>
              </View>
            </FadeInUp>
          ))}
        </View>
      </View>

      <FadeInUp index={3}>
        <View className="gap-2.5">
          <Button label="Empezar sin cuenta" size="lg" block onPress={onContinue} />
          <Button
            label="Ya tengo cuenta, o quiero una"
            variant="secondary"
            size="lg"
            block
            onPress={onSignIn}
          />
          <Txt variant="caption" tone="subtle" className="mt-1 text-center">
            Si creas una cuenta más adelante, lo que hayas guardado hasta entonces se asocia a ella.
          </Txt>
        </View>
      </FadeInUp>
    </View>
  );
}
