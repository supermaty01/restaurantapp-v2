import { Pressable } from 'react-native';
import Animated, {
  FadeInUp as ReanimatedFadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Quick and barely springy: felt, not watched. */
const PRESS_SPRING = { damping: 26, stiffness: 380, mass: 0.5 };

/**
 * A pressable that yields under the finger.
 *
 * `active:opacity-80` is the cheap version of this and it reads as a flicker.
 * A small scale plus a spring back is what makes a card feel like an object
 * rather than a rectangle that changes colour.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  scaleTo = 0.97,
  className = '',
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  children: ReactNode;
  onPress?: (() => void) | undefined;
  onLongPress?: (() => void) | undefined;
  disabled?: boolean | undefined;
  scaleTo?: number;
  className?: string;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none' | 'checkbox';
  /**
   * For a control that is one of a set, like a segmented tab.
   *
   * Without `selected`, a screen reader reads every option in a segmented
   * control identically and the person has no way to tell which one is on.
   *
   * `checked` es lo mismo para lo que se enciende y se apaga por su cuenta —una
   * etiqueta en un filtro, por ejemplo—, que es `checkbox` y no `radio`: elegir
   * una no descarta las demás.
   */
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean } | undefined;
}) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, scaleTo]) }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(accessibilityState ? { accessibilityState } : {})}
      disabled={disabled || !onPress}
      onPress={onPress}
      {...(onLongPress ? { onLongPress } : {})}
      onPressIn={() => {
        pressed.value = withSpring(1, PRESS_SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, PRESS_SPRING);
      }}
      className={className}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Fades and lifts its children into place.
 *
 * Used to stagger list rows and the blocks of a dashboard, so a screen arrives
 * rather than appearing. `index` spaces the delays; anything past the first
 * handful lands together, because a long list would otherwise spend a visible
 * second assembling itself.
 */
/**
 * Entrada escalonada para una pantalla.
 *
 * Declarativa (`entering`) y no un efecto que sube la opacidad desde cero. La
 * versión anterior arrancaba en `opacity: 0` y dependía de que un `useEffect`
 * lanzara la animación; cuando esa animación no llegaba a asentarse —volver a
 * una pestaña, un remonte del árbol tras importar datos— la vista se quedaba
 * invisible **ocupando su sitio**. La pantalla de inicio aparecía en blanco con
 * un hueco del tamaño exacto de su cabecera, y el diario parecía perdido.
 *
 * Reanimated gestiona las animaciones de entrada en el lado nativo y garantiza
 * el estado final, así que la visibilidad deja de depender de que se ejecute
 * nada en JS. Una animación de entrada es un adorno: no puede ser la condición
 * para que se vea el contenido.
 */
export function FadeInUp({
  children,
  index = 0,
  className = '',
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <Animated.View
      className={className}
      entering={ReanimatedFadeInUp.delay(Math.min(index, 6) * 45).duration(320)}
    >
      {children}
    </Animated.View>
  );
}
