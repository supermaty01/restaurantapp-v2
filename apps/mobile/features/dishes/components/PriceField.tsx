import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { ScrollView, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { FieldLabel } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { type as scale } from '@/lib/design/tokens';

import { CURRENCIES, currencyMeta } from '../currency';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';

/**
 * El precio y su moneda, como un solo campo.
 *
 * Juntos y no en dos secciones distintas porque son un solo dato: un número sin
 * unidad no dice nada, y elegir la moneda en otro sitio de la pantalla invita a
 * escribir el precio y olvidarse de ella. El selector va pegado al número, del
 * tamaño de lo que hace —cambia de moneda, no es la decisión principal.
 *
 * La moneda arranca en la del ajuste general, que es lo que cambias al aterrizar
 * en otro país; a partir de ahí, este plato se queda con la que se guardó.
 */
export function PriceField({
  price,
  currency,
  onChangePrice,
  onChangeCurrency,
  label = 'Precio',
  error,
}: {
  price: string;
  currency: string;
  onChangePrice: (next: string) => void;
  onChangeCurrency: (next: string) => void;
  label?: string;
  error?: string | undefined;
}) {
  const { colors } = useTheme();
  const [picking, setPicking] = useState(false);
  const meta = currencyMeta(currency);

  return (
    <View className="gap-2">
      <FieldLabel>{label}</FieldLabel>

      <View className="flex-row items-stretch gap-2">
        <TextInput
          value={price}
          onChangeText={onChangePrice}
          placeholder="0"
          placeholderTextColor={colors.inkSubtle}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          className={`min-h-12 flex-1 rounded-lg border bg-surface px-4 py-3 text-ink ${
            error ? 'border-danger' : 'border-line-strong'
          }`}
          style={scale.body}
        />

        <PressableScale
          accessibilityLabel={`Moneda: ${meta?.label ?? currency}`}
          onPress={() => setPicking(true)}
          scaleTo={0.96}
          className="min-h-12 flex-row items-center gap-1.5 rounded-lg border border-line-strong bg-sunken px-3.5"
        >
          <Txt variant="body" weight="bold" serif={false}>
            {meta?.symbol ?? currency}
          </Txt>
          <Txt variant="caption" tone="subtle" serif={false}>
            {currency}
          </Txt>
          <Ionicons name="chevron-down" size={14} color={colors.inkSubtle} />
        </PressableScale>
      </View>

      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : (
        <Txt variant="caption" tone="subtle">
          Se guarda con este plato: cambiar la moneda por defecto no toca lo ya escrito.
        </Txt>
      )}

      <CurrencySheet
        visible={picking}
        selected={currency}
        onClose={() => setPicking(false)}
        onSelect={(code) => {
          onChangeCurrency(code);
          setPicking(false);
        }}
      />
    </View>
  );
}

/**
 * `PriceField` atado al formulario.
 *
 * Los dos campos van juntos también aquí: si se editaran por separado, el
 * formulario podría enviar un precio sin moneda, que es la fila a medias que
 * esta función existe para impedir.
 */
export function FormPriceField<TFieldValues extends FieldValues, TTransformed = TFieldValues>({
  control,
  priceName,
  currencyName,
  fallbackCurrency,
}: {
  control: Control<TFieldValues, unknown, TTransformed>;
  priceName: FieldPath<TFieldValues>;
  currencyName: FieldPath<TFieldValues>;
  /**
   * Qué enseñar mientras el campo esté vacío: el ajuste general.
   *
   * Se enseña en vez de escribirse en el formulario porque el ajuste se lee del
   * disco y puede llegar después del primer render; sembrarlo entonces pisaría
   * la moneda que el usuario acabara de elegir. Lo que se guarda lo decide
   * `pairPriceAndCurrency` al enviar, con este mismo valor de reserva.
   */
  fallbackCurrency: string;
}) {
  return (
    <Controller
      control={control}
      name={priceName}
      render={({ field: price, fieldState: { error } }) => (
        <Controller
          control={control}
          name={currencyName}
          render={({ field: currency }) => (
            <PriceField
              price={price.value === undefined || price.value === null ? '' : String(price.value)}
              currency={String(currency.value ?? '') || fallbackCurrency}
              // Borrar el número deja el campo sin precio, no con un cero:
              // `z.coerce` convierte '' en 0 y el formulario rechazaría el caso
              // normal —un plato sin precio— con "El valor debe ser positivo".
              onChangePrice={(next) => price.onChange(next === '' ? undefined : next)}
              onChangeCurrency={currency.onChange}
              {...(error?.message ? { error: error.message } : {})}
            />
          )}
        />
      )}
    />
  );
}

/** La lista de monedas, compartida por el formulario y por Ajustes. */
export function CurrencySheet({
  visible,
  selected,
  onClose,
  onSelect,
  title = 'Moneda',
  subtitle,
}: {
  visible: boolean;
  selected: string;
  onClose: () => void;
  onSelect: (code: string) => void;
  title?: string;
  subtitle?: string | undefined;
}) {
  const { colors } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={title} {...(subtitle ? { subtitle } : {})}>
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingBottom: 12, paddingTop: 4, gap: 8 }}
      >
        {CURRENCIES.map((option) => {
          const active = option.code === selected;
          return (
            <PressableScale
              key={option.code}
              accessibilityLabel={option.label}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(option.code)}
              scaleTo={0.985}
              className={`flex-row items-center gap-3 rounded-xl border p-3 ${
                active ? 'border-primary bg-primary/8' : 'border-line bg-surface'
              }`}
            >
              <View className="h-9 w-9 items-center justify-center rounded-pill bg-sunken">
                <Txt variant="body" weight="bold" serif={false}>
                  {option.symbol}
                </Txt>
              </View>
              <View className="min-w-0 flex-1">
                <Txt variant="body" weight="semi" serif={false} numberOfLines={1}>
                  {option.label}
                </Txt>
                <Txt variant="caption" tone="subtle">
                  {option.code}
                </Txt>
              </View>
              {active ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : null}
            </PressableScale>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}
