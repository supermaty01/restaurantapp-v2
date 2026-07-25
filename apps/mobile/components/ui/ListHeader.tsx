import { Ionicons } from '@expo/vector-icons';
import { Pressable, TextInput, View } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';

import { Txt } from './Txt';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface HeaderAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Draws the icon in the accent colour with a dot, for an engaged filter. */
  active?: boolean;
}

/**
 * The header every collection screen shares: title, a count, a row of round
 * icon buttons, and a search pill.
 *
 * The three lists had this copied three times with small divergences — one had
 * a bigger filter icon, another a different placeholder — which is how they
 * drifted apart in the first place.
 */
export function ListHeader({
  title,
  count,
  countLabel,
  actions = [],
  search,
}: {
  title: string;
  count?: number | undefined;
  /** Plural noun for the count: "lugares", "platos", "visitas". */
  countLabel?: string | undefined;
  actions?: HeaderAction[];
  search?:
    | {
        value: string;
        onChange: (next: string) => void;
        placeholder: string;
      }
    | undefined;
}) {
  const { colors } = useTheme();

  return (
    <View className="pt-1">
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1">
          <Txt variant="display" numberOfLines={1}>
            {title}
          </Txt>
          {count !== undefined && countLabel ? (
            <Txt variant="caption" tone="subtle" className="mt-0.5">
              {count} {count === 1 ? countLabel.replace(/s$/, '') : countLabel}
            </Txt>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ selected: action.active ?? false }}
              hitSlop={6}
              className={`h-10 w-10 items-center justify-center rounded-pill border ${
                action.active ? 'border-primary/30 bg-primary/12' : 'border-line bg-surface'
              }`}
            >
              <Ionicons
                name={action.icon}
                size={19}
                color={action.active ? colors.primary : colors.inkMuted}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {search ? (
        <View
          className="mt-4 flex-row items-center gap-2.5 rounded-pill border border-line bg-surface px-4 py-2.5"
          style={elevation.low}
        >
          <Ionicons name="search" size={17} color={colors.inkSubtle} />
          <TextInput
            className="flex-1 text-ink"
            style={{ fontSize: 15, paddingVertical: 2 }}
            placeholder={search.placeholder}
            placeholderTextColor={colors.inkSubtle}
            value={search.value}
            onChangeText={search.onChange}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.value.length > 0 ? (
            <Pressable
              onPress={() => search.onChange('')}
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.inkSubtle} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
