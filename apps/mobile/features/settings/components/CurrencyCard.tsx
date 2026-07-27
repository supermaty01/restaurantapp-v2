import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import { CURRENCIES, formatPrice } from '../currency';
import { useCurrency } from '../useCurrency';

/** Un precio de ejemplo, para que se vea el símbolo y no solo el código. */
const SAMPLE = 12.5;

/**
 * En qué moneda se leen los precios del diario.
 *
 * El detalle de plato los formateaba fijos como pesos colombianos, escrito a
 * mano en la pantalla. Un diario que se lleva de viaje —que es de lo que va la
 * app— recoge precios de donde comes.
 *
 * Se dice en la propia fila que cambiarla **no convierte** lo ya escrito: sin
 * esa frase, ver de golpe todo el diario en euros se lee como que la app ha
 * hecho una conversión, y no la ha hecho. Convertir de verdad necesitaría un
 * tipo de cambio por fecha, que es una API de pago (docs/11).
 */
export function CurrencyCard() {
  const { colors } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);

  const current = CURRENCIES.find((c) => c.code === currency);

  return (
    <>
      <TouchableOpacity className="mb-4 rounded-xl bg-surface p-4" onPress={() => setOpen(true)}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="pricetag" size={24} color={colors.primary} />
            <Text className="ml-4 text-lg font-bold text-ink">Moneda</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="mr-2 text-ink-muted">{currency}</Text>
            <Ionicons name="chevron-forward-outline" size={20} color={colors.inkSubtle} />
          </View>
        </View>
        <Text className="mt-1 text-ink-muted">
          {current ? `${current.label} · ` : ''}
          {formatPrice(SAMPLE, currency)}. Cambiarla no convierte los precios ya escritos.
        </Text>
      </TouchableOpacity>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Moneda"
        subtitle="Con la que se enseñan los precios de tus platos"
      >
        <ScrollView
          className="px-5"
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ paddingBottom: 12, paddingTop: 4 }}
        >
          {CURRENCIES.map((option) => {
            const selected = option.code === currency;
            return (
              <TouchableOpacity
                key={option.code}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  void setCurrency(option.code);
                  setOpen(false);
                }}
                className={`mb-2 flex-row items-center justify-between rounded-xl border p-3.5 ${
                  selected ? 'border-primary bg-primary/8' : 'border-line bg-surface'
                }`}
              >
                <View className="min-w-0 flex-1">
                  <Txt variant="body" weight="semi" serif={false} numberOfLines={1}>
                    {option.label}
                  </Txt>
                  <Txt variant="caption" tone="subtle">
                    {option.code} · {formatPrice(SAMPLE, option.code)}
                  </Txt>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}
