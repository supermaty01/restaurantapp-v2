import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

import { Txt } from './Txt';

import type { ComponentProps, ReactNode } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface DetailAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  busy?: boolean;
  /** Destructive actions get the danger tone, never a filled red circle. */
  danger?: boolean;
}

/**
 * The frame every detail screen shares: photos, a title block, a row of
 * actions, and the tabbed body.
 *
 * v1 wrote this three times, with the actions as filled circles in blue,
 * terracotta and red — three saturated buttons competing with the photo above
 * them, and the loudest of the three was Delete. Here they are quiet icon
 * buttons on the surface, and destructive intent is carried by colour on the
 * glyph rather than by a red disc.
 */
export function DetailScaffold({
  media,
  title,
  subtitle,
  meta,
  actions,
  notices,
  children,
}: {
  /** The image carousel, or whatever heads the screen. */
  media?: ReactNode;
  title: string;
  subtitle?: string | undefined;
  /** Rating, tags, price — whatever situates the entity. */
  meta?: ReactNode;
  actions: DetailAction[];
  /** Warning strips, e.g. "this restaurant has been deleted". */
  notices?: string[] | undefined;
  children: ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View className="flex-1 bg-canvas">
      {media}

      <View className="px-5 pt-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Txt variant="display" numberOfLines={2}>
              {title}
            </Txt>
            {subtitle ? (
              <Txt variant="callout" tone="subtle" numberOfLines={1} className="mt-1">
                {subtitle}
              </Txt>
            ) : null}
          </View>

          <View className="flex-row gap-2">
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{ busy: action.busy ?? false }}
                onPress={action.onPress}
                disabled={action.busy ?? false}
                hitSlop={4}
                className={`h-10 w-10 items-center justify-center rounded-pill border bg-surface active:opacity-70 ${
                  action.danger ? 'border-danger/25' : 'border-line'
                }`}
              >
                {action.busy ? (
                  <ActivityIndicator size="small" color={colors.inkMuted} />
                ) : (
                  <Ionicons
                    name={action.icon}
                    size={18}
                    color={action.danger ? colors.danger : colors.inkMuted}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {meta ? <View className="mt-3">{meta}</View> : null}

        {notices?.map((notice) => (
          <View
            key={notice}
            className="mt-3 flex-row items-center gap-2 rounded-lg border border-danger/25 bg-danger/8 px-3 py-2.5"
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Txt variant="caption" tone="danger" className="flex-1">
              {notice}
            </Txt>
          </View>
        ))}
      </View>

      <View className="mt-2 flex-1">{children}</View>
    </View>
  );
}

/** Shown while an entity is being looked up, or when it is not there. */
export function DetailMissing({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-canvas p-6">
      <Txt variant="title" className="text-center">
        {message}
      </Txt>
    </View>
  );
}

/**
 * A labelled block inside a detail body.
 *
 * The detail screens were built from repeated `<Text className="font-bold">`
 * headings followed by either a value or an italic "Sin comentarios". Absence
 * is now rendered as absence: `empty` is only shown where the missing value is
 * itself worth stating.
 */
export function DetailField({
  label,
  value,
  empty,
  children,
}: {
  label: string;
  value?: string | null | undefined;
  /** Text for when there is no value. Omit to hide the field entirely. */
  empty?: string;
  children?: ReactNode;
}) {
  if (!children && !value && !empty) return null;

  return (
    <View className="gap-1.5">
      <Txt variant="overline" tone="subtle" serif={false} uppercase>
        {label}
      </Txt>
      {children ?? (
        <Txt variant="body" tone={value ? 'ink' : 'subtle'}>
          {value || empty}
        </Txt>
      )}
    </View>
  );
}
