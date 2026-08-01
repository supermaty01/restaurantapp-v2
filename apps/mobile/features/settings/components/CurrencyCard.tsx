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
 * En qué moneda nacen los platos nuevos.
 *
 * Ya no es «la moneda del diario»: desde 0013 cada plato guarda la suya, porque
 * un diario que se lleva de viaje mezcla platos de Bogotá y de Madrid en la
 * misma lista y con una sola moneda la mitad de los números decían otra cosa de
 * la que costaron.
 *
 * Lo que queda aquí es el **punto de partida**, y ese matiz es lo que la fila
 * tiene que decir: estando en Europa se deja en euros y lo que se apunte nace en
 * euros; al volver a Colombia se cambia y lo nuevo nace en pesos. Cambiarla no
 * toca ni un plato ya escrito, ni siquiera el símbolo con el que se pinta.
 *
 * Ojo con la analogía fácil: **no funciona como la visibilidad por defecto**.
 * Aquella se resuelve en vivo —cambiar el ajuste mueve todo lo que estaba en
 * `default`— y ésta se copia al crear. Son dos comportamientos distintos a
 * propósito: mover una visibilidad es reversible, reinterpretar un precio en
 * otra moneda es inventárselo.
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
            <Text className="ml-4 text-lg font-bold text-ink">Moneda por defecto</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="mr-2 text-ink-muted">{currency}</Text>
            <Ionicons name="chevron-forward-outline" size={20} color={colors.inkSubtle} />
          </View>
        </View>
        <Text className="mt-1 text-ink-muted">
          {current ? `${current.label} · ` : ''}
          {formatPrice(SAMPLE, currency)}. Con la que nacen los platos nuevos; cada plato guarda la
          suya y esto no cambia ninguno.
        </Text>
      </TouchableOpacity>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Moneda por defecto"
        subtitle="La que se propone al apuntar un plato nuevo"
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
