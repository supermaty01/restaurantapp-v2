import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FadeInUp, PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { useOnboarding } from '@/features/onboarding/useOnboarding';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useDatabase } from '@/lib/hooks/useDatabase';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

// tsc no resuelve módulos de imagen a través del alias; expo-image acepta el id
// numérico del empaquetador, que es lo que devuelve require.
const appIcon = require('@/assets/burger-logo.png') as number;

/**
 * La primera pantalla, una sola vez.
 *
 * No es un tutorial. Contesta las tres preguntas que se hace cualquiera al abrir
 * esto por primera vez —qué es, dónde acaban mis datos, y tengo que
 * registrarme— y se aparta. Un carrusel de cinco pantallas explicando botones se
 * salta entero y deja peor sabor que no tener ninguna.
 *
 * **Empezar lleva al diario, no a un formulario.** Ese es el punto: la app es
 * local primero (docs/00) y la cuenta es una capa opcional encima. Un registro
 * como primera pantalla contradiría eso y, peor, pediría confianza antes de
 * haber dado nada a cambio.
 *
 * La otra salida —«ya tengo cuenta»— existe porque el caso de estrenar móvil es
 * justo el que más prisa tiene: quien restaura su diario no quiere leer nada.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { isConfigured } = useAuth();
  const { complete } = useOnboarding(db);

  const finish = async (next: '/(main)/(tabs)' | '/(main)/account') => {
    await complete();
    router.replace(next);
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerClassName="flex-grow px-6 pb-10 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp index={0}>
          <View className="items-center gap-4 pb-2 pt-6">
            <Image
              source={appIcon}
              style={{ width: 84, height: 84 }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
            <Txt variant="hero" className="text-center">
              Tu diario de{'\n'}comidas
            </Txt>
            <Txt variant="callout" tone="muted" className="max-w-[300px] text-center">
              Apunta dónde comiste, qué pediste y qué te pareció. Para acordarte tú, no para que lo
              vea nadie.
            </Txt>
          </View>
        </FadeInUp>

        <View className="mt-8 gap-4">
          <FadeInUp index={1}>
            <Point
              icon="phone-portrait-outline"
              title="Vive en este móvil"
              body="Todo lo que escribes se guarda aquí. Funciona sin conexión y sin cuenta, desde el primer día."
            />
          </FadeInUp>
          <FadeInUp index={2}>
            <Point
              icon="lock-closed-outline"
              title="Privado mientras no digas otra cosa"
              body="Nada se comparte solo. Cada entrada tiene su ajuste, y el general empieza en «solo yo»."
            />
          </FadeInUp>
          <FadeInUp index={3}>
            <Point
              icon="cloud-upload-outline"
              title="La cuenta es opcional"
              body={
                isConfigured
                  ? 'Sirve para tenerlo en más de un móvil, no perderlo si pierdes este, y compartir con amigos. Puedes crearla cuando quieras, sin perder lo escrito.'
                  : 'Esta copia funciona íntegramente en local: no hay nube que configurar.'
              }
            />
          </FadeInUp>
        </View>

        <View className="flex-1" />

        <FadeInUp index={4}>
          <View className="mt-9 gap-2.5">
            <Button
              label="Empezar"
              icon="arrow-forward"
              block
              onPress={() => void finish('/(main)/(tabs)')}
            />
            {isConfigured ? (
              <PressableScale
                accessibilityLabel="Ya tengo cuenta"
                onPress={() => void finish('/(main)/account')}
                scaleTo={0.97}
                className="items-center py-3"
              >
                <Txt variant="callout" tone="primary" weight="semi" serif={false}>
                  Ya tengo cuenta
                </Txt>
              </PressableScale>
            ) : null}
          </View>
        </FadeInUp>
      </ScrollView>
    </Screen>
  );
}

function Point({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { colors } = useTheme();

  return (
    <View className="flex-row items-start gap-3.5">
      <View className="h-10 w-10 items-center justify-center rounded-pill bg-primary/10">
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Txt variant="heading" weight="bold" serif={false}>
          {title}
        </Txt>
        <Txt variant="caption" tone="muted">
          {body}
        </Txt>
      </View>
    </View>
  );
}
