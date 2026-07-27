import { useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation } from '@/lib/design/tokens';

import { Button } from './Button';
import { Txt } from './Txt';

import type { ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * The frame every create/edit screen shares.
 *
 * v1 put the whole form in one card and left Guardar at the bottom of the
 * scroll, so on a long form you had to scroll back down to find it and there
 * was no sign of whether anything was wrong until you did. The action now sits
 * in a fixed footer, always reachable and always able to say what it is doing.
 *
 * ## Por qué el teclado no lo maneja React Native
 *
 * Aquí había un `KeyboardAvoidingView` del core con
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`, y **en Android eso
 * no hace absolutamente nada**: sin `behavior` el componente pinta un `View` y
 * ya está (ver su `render`, caso `default`). Delegaba en que la ventana se
 * encogiera sola con `adjustResize` — que es lo que Android hacía **antes** de
 * edge-to-edge. Desde SDK 57 edge-to-edge es obligatorio (`edgeToEdgeEnabled`
 * ya no existe en la config de Expo), la ventana ocupa la pantalla entera y el
 * teclado llega como un *inset*, no como un cambio de tamaño. Resultado: el
 * teclado se sentaba encima del último campo, no había nada que encoger y por
 * tanto tampoco se podía hacer scroll para sacarlo de debajo.
 *
 * Por eso el primer intento de arreglar «el teclado tapa Sobre ti» —pasar
 * `profile-edit` por este scaffold— no cambió nada: el problema nunca fue que
 * la pantalla estuviera fuera del scaffold, era que el scaffold tampoco lo
 * resolvía en Android.
 *
 * Se descartó `useAnimatedKeyboard` de reanimated, que sí lee los insets de la
 * IME y ya estaba instalado: está **deprecado** en la 4.5 y su propio aviso
 * remite a esta librería. `react-native-keyboard-controller` va además en los
 * `bundledNativeModules` de Expo SDK 57, así que la versión está fijada por el
 * SDK y no por nosotros.
 *
 * Es un módulo nativo: **hace falta un APK nuevo**, no basta con recargar el
 * JavaScript.
 */
export function FormScaffold({
  children,
  submitLabel,
  onSubmit,
  loading = false,
  disabled = false,
  /** Shown next to the action, e.g. "Falta el nombre". */
  hint,
  secondary,
}: {
  children: ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  hint?: string | undefined;
  secondary?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  /*
   * El pie tapa la parte baja del scroll cuando sube con el teclado, así que
   * `bottomOffset` tiene que ser su altura real: con un número fijo, el campo
   * enfocado queda justo detrás del botón en cuanto aparece el `hint` y el pie
   * crece una línea.
   */
  const [footerHeight, setFooterHeight] = useState(0);
  const measureFooter = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setFooterHeight((current) => (Math.abs(current - height) < 1 ? current : height));
  };

  return (
    <View className="flex-1 bg-canvas">
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        // Deja el campo enfocado por encima del pie, no solo por encima del
        // teclado. Los 16 son aire para que no quede pegado al borde.
        bottomOffset={footerHeight + 16}
      >
        {/* Las clases van en un View normal: NativeWind solo entiende
            `className` en los componentes del core, y este es de terceros. */}
        <View className="gap-6 px-5 pb-8 pt-1">{children}</View>
      </KeyboardAwareScrollView>

      {/*
       * El pie viaja pegado al borde del teclado. `opened: insets.bottom`
       * cancela el hueco de la barra de navegación mientras el teclado está
       * abierto: ahí abajo ya no hay barra que esquivar, la tapa el teclado.
       */}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View
          className="border-t border-line bg-surface-alt px-5 pt-3"
          style={[elevation.medium, { paddingBottom: insets.bottom + 12 }]}
          onLayout={measureFooter}
        >
          {hint ? (
            <Txt variant="caption" tone="danger" className="mb-2">
              {hint}
            </Txt>
          ) : null}
          <View className="flex-row gap-2.5">
            {secondary ? <View className="flex-1">{secondary}</View> : null}
            <View className={secondary ? 'flex-[1.6]' : 'flex-1'}>
              <Button
                label={submitLabel}
                block
                size="lg"
                loading={loading}
                disabled={disabled}
                onPress={onSubmit}
              />
            </View>
          </View>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

/**
 * A titled group of fields.
 *
 * Forms read as a wall of inputs otherwise; grouping is what lets you skip the
 * parts you do not care about, which on an optional-heavy form is most of it.
 */
export function FormSection({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Txt variant="heading" weight="bold" serif={false}>
            {title}
          </Txt>
          {hint ? (
            <Txt variant="caption" tone="subtle" className="mt-0.5">
              {hint}
            </Txt>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
