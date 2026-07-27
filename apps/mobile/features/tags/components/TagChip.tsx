import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { onColor, readableInk, withAlpha } from '@/lib/design/colour';

import type { TagDTO } from '../types/tag-dto';

/**
 * Una etiqueta como interruptor.
 *
 * Elegida se lee como relleno en su propio color; sin elegir, como su contorno.
 * El estado lo lleva el relleno y no una marca: un checkbox al lado de una
 * pastilla de color son dos señales compitiendo por decir un solo bit.
 *
 * Vivía dentro de `TagField` y salió de ahí porque el panel de filtros pedía lo
 * mismo y se lo había montado por su cuenta: un `Tag` con un
 * `checkmark-circle` / `ellipse-outline` al lado y `accessibilityRole="radio"`
 * — literalmente un radio button, para algo que no es excluyente. Eran dos
 * diseños distintos para la misma pregunta («¿esta etiqueta sí o no?»), y el
 * bueno ya estaba escrito.
 *
 * `accessibilityRole` es `checkbox` a propósito, que es lo que de verdad es: la
 * versión de `TagField` no lo declaraba y quien navegue con lector de pantalla
 * oía un botón sin estado.
 */
export function TagChip({
  tag,
  selected,
  onPress,
}: {
  tag: TagDTO;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const ink = readableInk(tag.color, colors.surface);

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={tag.name}
      onPress={onPress}
      scaleTo={0.94}
      className="flex-row items-center gap-1.5 rounded-pill px-3 py-1.5"
      style={{
        backgroundColor: selected ? withAlpha(tag.color, 0.9) : withAlpha(tag.color, 0.14),
        borderWidth: 1,
        borderColor: selected ? 'transparent' : withAlpha(tag.color, 0.35),
      }}
    >
      <Txt
        variant="caption"
        weight="bold"
        serif={false}
        numberOfLines={1}
        style={{ color: selected ? onColor(tag.color) : ink }}
      >
        {tag.name}
      </Txt>
      {selected ? <Ionicons name="close" size={12} color={onColor(tag.color)} /> : null}
    </PressableScale>
  );
}
