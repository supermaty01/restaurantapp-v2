import { Ionicons } from '@expo/vector-icons';
import { colorScheme } from 'nativewind';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];
type ThemeMode = 'light' | 'dark' | 'system';

const OPTIONS: { mode: ThemeMode; label: string; description: string; icon: IconName }[] = [
  { mode: 'light', label: 'Claro', description: 'Siempre en claro', icon: 'sunny' },
  { mode: 'dark', label: 'Oscuro', description: 'Siempre en oscuro', icon: 'moon' },
  {
    mode: 'system',
    label: 'Como el sistema',
    description: 'Sigue lo que tenga el teléfono',
    icon: 'phone-portrait',
  },
];

/**
 * Elegir el tema.
 *
 * Era el último panel con su propio `Modal` a mano: `animationType="slide"`
 * nativo, su propia esquina redondeada, su propio fondo oscuro y una fila de
 * opciones que no se parecía a ninguna otra de la app. Además arrastraba una
 * clase rota de la migración a tokens —`bg-primary/20/20`, que Tailwind no
 * genera—, así que la opción marcada llevaba meses sin fondo y no se
 * distinguía de las otras dos.
 *
 * Ahora es un `Sheet` como los demás, con el mismo gesto para cerrarlo y las
 * mismas filas que el resto de selectores.
 */
export default function ThemeSelectionModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { themeMode, setThemeMode, colors } = useTheme();

  const choose = (mode: ThemeMode) => {
    void setThemeMode(mode);
    colorScheme.set(mode);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Tema" maxHeightRatio={0.6}>
      <View className="gap-2.5 px-5 pb-4 pt-1">
        {OPTIONS.map((option) => {
          const active = themeMode === option.mode;

          return (
            <PressableScale
              key={option.mode}
              accessibilityLabel={`${option.label}. ${option.description}`}
              onPress={() => choose(option.mode)}
              scaleTo={0.985}
              className={`flex-row items-center gap-3 rounded-xl border p-3 ${
                active ? 'border-primary bg-primary/8' : 'border-line bg-surface'
              }`}
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-pill ${
                  active ? 'bg-primary' : 'bg-sunken'
                }`}
              >
                <Ionicons
                  name={option.icon}
                  size={17}
                  color={active ? colors.onPrimary : colors.inkMuted}
                />
              </View>

              <View className="min-w-0 flex-1">
                <Txt variant="body" weight="semi" serif={false}>
                  {option.label}
                </Txt>
                <Txt variant="caption" tone="subtle">
                  {option.description}
                </Txt>
              </View>

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
