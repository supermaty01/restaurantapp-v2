import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/Motion';
import { useTheme } from '@/lib/context/ThemeContext';

import type { ReactNode } from 'react';

/**
 * El marco de las pantallas de la primera ejecución.
 *
 * Existe por dos cosas que faltaban y que solo se notan usándolo:
 *
 * - **Cuántas pantallas quedan.** Sin ninguna señal, dos pasos se viven como
 *   «esto no se acaba nunca»: nadie sabe si detrás del segundo hay un tercero.
 *   Dos puntos cuestan nada y responden la pregunta antes de que se haga.
 * - **Poder volver.** Del paso de avisos no se salía hacia atrás, así que
 *   elegir «ya tengo cuenta» sin querer era irreversible hasta acabar el
 *   onboarding entero. El primer paso no lleva flecha porque detrás no hay nada.
 *
 * Los dos son la misma clase de arreglo: un onboarding tiene que dejar claro
 * dónde estás y que puedes deshacer, o se contesta a todo sin leer para salir.
 */
export function StepFrame({
  step,
  steps,
  onBack,
  children,
  footer,
}: {
  /** Empezando en 1. */
  step: number;
  steps: number;
  onBack?: (() => void) | undefined;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 justify-between bg-canvas px-6"
      style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
    >
      <View className="flex-1">
        <View className="h-9 flex-row items-center justify-between">
          {onBack ? (
            <PressableScale
              accessibilityLabel="Volver"
              onPress={onBack}
              scaleTo={0.9}
              className="h-9 w-9 items-center justify-center rounded-pill bg-sunken"
            >
              <Ionicons name="chevron-back" size={19} color={colors.ink} />
            </PressableScale>
          ) : (
            // Un hueco del mismo tamaño: sin él, los puntos saltan de sitio
            // entre un paso y el siguiente.
            <View className="h-9 w-9" />
          )}

          <View className="flex-row gap-1.5">
            {Array.from({ length: steps }, (_, index) => (
              <View
                key={index}
                className={`h-1.5 rounded-pill ${
                  index === step - 1 ? 'w-5 bg-primary' : 'w-1.5 bg-line-strong'
                }`}
              />
            ))}
          </View>

          <View className="h-9 w-9" />
        </View>

        <View className="mt-6 flex-1">{children}</View>
      </View>

      {footer}
    </View>
  );
}
