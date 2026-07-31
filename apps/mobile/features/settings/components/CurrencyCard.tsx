import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { CurrencySheet } from '@/features/dishes/components/PriceField';
import { currencyMeta } from '@/features/dishes/currency';
import { useDefaultCurrency } from '@/features/dishes/hooks/useDefaultCurrency';
import { useTheme } from '@/lib/context/ThemeContext';

/**
 * La moneda con la que empiezan los precios nuevos.
 *
 * Es lo que se cambia al aterrizar en otro país, y por eso el texto insiste en
 * lo que **no** hace: no toca lo ya escrito. Un ajuste llamado «moneda» que
 * reescribiera los precios de un diario de años sería la peor sorpresa posible
 * en una pantalla de ajustes.
 */
export default function CurrencyCard() {
  const { colors } = useTheme();
  const { value, update } = useDefaultCurrency();
  const [picking, setPicking] = useState(false);
  const meta = currencyMeta(value);

  return (
    <>
      <PressableScale
        accessibilityLabel="Moneda por defecto"
        onPress={() => setPicking(true)}
        scaleTo={0.99}
        className="gap-1 rounded-xl border border-line bg-surface p-4"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="cash-outline" size={20} color={colors.primary} />
          <Txt variant="heading" weight="bold" serif={false} className="flex-1">
            Moneda
          </Txt>
          <Txt variant="callout" tone="muted">
            {meta ? `${meta.symbol} ${meta.code}` : value}
          </Txt>
          <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
        </View>
        <Txt variant="caption" tone="muted">
          Con la que se rellenan los precios nuevos. Cada plato guarda la suya, así que cambiarla no
          toca lo que ya has escrito.
        </Txt>
      </PressableScale>

      <CurrencySheet
        visible={picking}
        selected={value}
        title="Moneda por defecto"
        subtitle="Solo para lo que escribas a partir de ahora"
        onClose={() => setPicking(false)}
        onSelect={(code) => {
          void update(code);
          setPicking(false);
        }}
      />
    </>
  );
}
