import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { FieldLabel } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { CURRENCIES, formatPrice } from '@/features/settings/currency';
import { useTheme } from '@/lib/context/ThemeContext';
import { type as scale } from '@/lib/design/tokens';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';

/**
 * Cuánto costó, y en qué.
 *
 * Un campo y no dos, pegados en la misma caja, porque **son un solo dato**: un
 * número sin unidad no significa nada, y una unidad sin número tampoco. Con dos
 * campos separados se puede rellenar uno y dejar el otro, que es justo el estado
 * que la app no debe poder llegar a tener (ver `dish-schema.ts`).
 *
 * La moneda se elige desde el propio campo y arranca en la de Ajustes, que a
 * partir de aquí significa «la del sitio donde estoy ahora»: estando en Europa
 * se deja en euros y todo lo nuevo nace en euros; al volver a Colombia se cambia
 * y lo nuevo nace en pesos. Lo ya escrito no se mueve, que es lo que antes no se
 * podía prometer con una sola moneda para el diario entero.
 *
 * Se descartó ofrecer la lista siempre desplegada: son doce monedas y en el 99%
 * de las comidas la buena ya está puesta. Un botón con el código dentro del
 * campo dice cuál es sin ocupar sitio, y solo cuesta un toque cambiarla.
 */
export function PriceField<TFieldValues extends FieldValues, TTransformed = TFieldValues>({
  control,
  priceName,
  currency,
  onCurrencyChange,
  label = 'Precio',
}: {
  control: Control<TFieldValues, unknown, TTransformed>;
  priceName: FieldPath<TFieldValues>;
  /** La moneda vive fuera del formulario, como la visibilidad: es una elección, no un texto. */
  currency: string;
  onCurrencyChange: (next: string) => void;
  label?: string;
}) {
  const { colors } = useTheme();
  const [picking, setPicking] = useState(false);

  return (
    <Controller
      control={control}
      name={priceName}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View className="gap-2">
          <FieldLabel>{label}</FieldLabel>

          <View
            className={`flex-row items-center rounded-lg border bg-surface ${
              error ? 'border-danger' : 'border-line-strong'
            }`}
          >
            <TextInput
              value={String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0"
              placeholderTextColor={colors.inkSubtle}
              keyboardType="numeric"
              accessibilityLabel={label}
              className="min-h-12 flex-1 px-4 text-ink"
              style={scale.body}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Moneda: ${currency}. Tocar para cambiarla`}
              onPress={() => setPicking(true)}
              className="h-12 flex-row items-center gap-1 border-l border-line px-3.5"
            >
              <Txt variant="callout" weight="bold" serif={false} tone="muted">
                {currency}
              </Txt>
              <Ionicons name="chevron-down" size={13} color={colors.inkSubtle} />
            </Pressable>
          </View>

          {error?.message ? (
            <Txt variant="caption" tone="danger">
              {error.message}
            </Txt>
          ) : (
            <Txt variant="caption" tone="subtle">
              La moneda se guarda con el plato. La de partida sale de Ajustes.
            </Txt>
          )}

          <Sheet
            visible={picking}
            onClose={() => setPicking(false)}
            title="Moneda de este plato"
            subtitle="Solo cambia este plato, no el resto del diario"
          >
            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
              <View className="gap-2 pb-4">
                {CURRENCIES.map((option) => {
                  const selected = option.code === currency;
                  return (
                    <PressableScale
                      key={option.code}
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected }}
                      scaleTo={0.98}
                      onPress={() => {
                        onCurrencyChange(option.code);
                        setPicking(false);
                      }}
                      className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${
                        selected ? 'border-primary bg-primary/8' : 'border-line bg-surface'
                      }`}
                    >
                      <View className="min-w-0 flex-1">
                        <Txt variant="body" weight="semi" serif={false}>
                          {option.label}
                        </Txt>
                        {/* Un ejemplo con el símbolo puesto: «COP» no dice nada
                            a quien no lo tenga memorizado, «$ 38.000» sí. */}
                        <Txt variant="caption" tone="subtle">
                          {option.code} · {formatPrice(EXAMPLE_AMOUNT, option.code)}
                        </Txt>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : null}
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>
          </Sheet>
        </View>
      )}
    />
  );
}

/** Lo bastante grande para que se vea el separador de miles del peso. */
const EXAMPLE_AMOUNT = 12000;
