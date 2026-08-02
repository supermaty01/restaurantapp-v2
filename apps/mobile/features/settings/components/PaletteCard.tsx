import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { PALETTES, PALETTE_IDS, type ThemeColors } from '@/lib/design/tokens';

/**
 * Elegir la paleta.
 *
 * ## Por qué se enseña como una muestra y no como una lista de nombres
 *
 * Porque «Morado» no dice de qué morado se habla, y sobre todo no dice lo que
 * de verdad cambia: un tema aquí no es el color del botón, es también el lienzo
 * y las tarjetas. Cada fila lleva la muestra de esos tres —fondo, tarjeta,
 * acción— en el esquema que se está usando ahora mismo, así que lo que se ve en
 * la fila es lo que va a pasar al tocarla.
 *
 * ## Y por qué se aplica al tocar, sin confirmar
 *
 * Un tema no destruye nada y el resultado está a la vista: la propia hoja
 * cambia de color bajo el dedo. Poner un «aplicar» sería pedir que alguien
 * confirme algo que ya está viendo. La hoja **no se cierra sola** por lo mismo:
 * la gracia de esto es probar tres o cuatro seguidas, y cerrarse tras la primera
 * obligaría a volver a entrar para comparar.
 */
export function PaletteCard() {
  const [open, setOpen] = useState(false);
  const { palette, colors } = useTheme();

  return (
    <>
      <PressableScale
        accessibilityLabel={`Paleta de colores. ${PALETTES[palette].label}`}
        onPress={() => setOpen(true)}
        scaleTo={0.99}
        className="mb-4 rounded-xl bg-surface p-4"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Ionicons name="color-palette" size={22} color={colors.primary} />
            <Txt variant="heading" weight="bold" serif={false}>
              Paleta
            </Txt>
          </View>
          <View className="flex-row items-center gap-2">
            <Swatch colors={colors} />
            <Txt variant="callout" tone="muted">
              {PALETTES[palette].label}
            </Txt>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.inkSubtle} />
          </View>
        </View>
        <Txt variant="callout" tone="muted" className="mt-1">
          El color de la app entera: el fondo, las tarjetas y el color de acción
        </Txt>
      </PressableScale>

      <PaletteSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Los tres colores que de verdad cambian, en el orden en que se ven en pantalla.
 *
 * Sin clases de NativeWind y con `style`: son colores de **otra** paleta que la
 * que está puesta, así que no hay ninguna variable CSS de la que puedan salir.
 */
function Swatch({ colors, size = 18 }: { colors: ThemeColors; size?: number }) {
  const dot = (background: string, border: string) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: background,
    borderWidth: 1,
    borderColor: border,
  });

  return (
    <View className="flex-row" style={{ gap: -size * 0.28 }}>
      <View style={dot(colors.canvas, colors.lineStrong)} />
      <View style={dot(colors.surface, colors.lineStrong)} />
      <View style={dot(colors.primary, colors.primary)} />
    </View>
  );
}

function PaletteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette, setPalette, isDarkMode, colors } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title="Paleta" maxHeightRatio={0.8}>
      <View className="gap-2.5 px-5 pb-4 pt-1">
        {PALETTE_IDS.map((id) => {
          const option = PALETTES[id];
          // La muestra va en el esquema que se está usando: en modo oscuro,
          // enseñar los colores del claro sería enseñar una app que no existe.
          const preview = isDarkMode ? option.dark : option.light;
          const active = palette === id;

          return (
            <PressableScale
              key={id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={option.label}
              onPress={() => void setPalette(id)}
              scaleTo={0.985}
              className={`flex-row items-center gap-3 rounded-xl border p-3 ${
                active ? 'border-primary bg-primary/8' : 'border-line bg-surface'
              }`}
            >
              <Swatch colors={preview} size={22} />
              <Txt variant="body" weight="semi" serif={false} className="flex-1">
                {option.label}
              </Txt>
              {active ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : null}
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}
