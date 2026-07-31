import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';
import { elevation, radius } from '@/lib/design/tokens';

import { PressableScale } from './Motion';
import { Txt } from './Txt';

import type { ComponentProps, ReactNode } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * The Clay card.
 *
 * A light surface on the warm canvas with a hairline and a soft, warm-tinted
 * shadow. The mockups are border-only, which reads clean but inert; a little
 * elevation is what makes a card sit *on* the paper rather than be drawn onto
 * it. Tappable cards yield under the finger — `active:opacity` reads as a
 * flicker, a spring reads as an object.
 */
export function Card({
  children,
  onPress,
  onLongPress,
  className = '',
  padded = true,
  raised = true,
}: {
  children: ReactNode;
  onPress?: (() => void) | undefined;
  onLongPress?: (() => void) | undefined;
  className?: string;
  padded?: boolean;
  /** Turn off where the card sits inside another surface. */
  raised?: boolean;
}) {
  const classes = `rounded-xl border border-line bg-surface ${padded ? 'p-3' : ''} ${className}`;
  const style = raised ? elevation.low : undefined;

  if (!onPress) {
    return (
      <View className={classes} style={style}>
        {children}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      className={classes}
      {...(style ? { style } : {})}
    >
      {children}
    </PressableScale>
  );
}

/** A section title with an optional action on the right ("Ver todo"). */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  className = '',
}: {
  title: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  className?: string;
}) {
  return (
    <View className={`flex-row items-baseline justify-between ${className}`}>
      <Txt variant="title">{title}</Txt>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Txt variant="caption" tone="primary" weight="bold" serif={false}>
            {actionLabel}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The small uppercase label that sits above a form field. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Txt variant="overline" tone="subtle" serif={false} uppercase>
      {children}
    </Txt>
  );
}

/**
 * Shown where a list has nothing in it.
 *
 * An empty screen with no explanation reads as a bug, so this always says what
 * would appear here. The icon sits in a tinted disc rather than floating loose,
 * which stops it looking like a rendering failure.
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
  className = '',
}: {
  icon: IconName;
  title: string;
  message?: string | undefined;
  action?: ReactNode;
  className?: string;
}) {
  const { colors } = useTheme();

  return (
    <View className={`items-center justify-center px-8 py-12 ${className}`}>
      <View className="mb-4 h-[72px] w-[72px] items-center justify-center rounded-pill bg-primary/8">
        <View className="h-14 w-14 items-center justify-center rounded-pill bg-primary/10">
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
      </View>
      <Txt variant="title" className="text-center">
        {title}
      </Txt>
      {message ? (
        <Txt variant="callout" tone="muted" className="mt-1.5 max-w-[280px] text-center">
          {message}
        </Txt>
      ) : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}

/** A pill. Used for tags, cuisines and states; `tone` picks the accent. */
export function Chip({
  label,
  tone = 'neutral',
  color,
  icon,
  onPress,
  className = '',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'sage' | 'accent';
  /** An explicit colour, for user-defined tags that carry their own. */
  color?: string | undefined;
  icon?: IconName | undefined;
  onPress?: (() => void) | undefined;
  className?: string;
}) {
  const { colors } = useTheme();

  const backgrounds: Record<string, string> = {
    neutral: 'bg-sunken',
    primary: 'bg-primary/12',
    sage: 'bg-sage/15',
    accent: 'bg-accent/15',
  };
  const inks: Record<string, string> = {
    neutral: 'text-ink-muted',
    primary: 'text-primary',
    sage: 'text-sage',
    accent: 'text-accent',
  };
  const iconColours: Record<string, string> = {
    neutral: colors.inkMuted,
    primary: colors.primary,
    sage: colors.sage,
    accent: colors.accent,
  };

  /*
   * El redondeo va en `style` y no en una clase.
   *
   * `rounded-pill` se perdía al cambiar de tono: una píldora que dejaba de estar
   * seleccionada se quedaba cuadrada hasta que la pantalla se volvía a montar.
   * Es el patrón que lo provoca —una cadena de clases que cambia de forma entre
   * renders, aquí porque `backgrounds[tone]` entra y sale— y la forma de la
   * píldora es lo último que puede depender de eso.
   */
  const body = (
    <View
      className={`flex-row items-center gap-1 px-2.5 py-1 ${color ? '' : backgrounds[tone]} ${className}`}
      style={[{ borderRadius: radius.pill }, color ? { backgroundColor: `${color}26` } : null]}
    >
      {icon ? <Ionicons name={icon} size={11} color={color ?? iconColours[tone]} /> : null}
      <Txt
        variant="overline"
        serif={false}
        weight="bold"
        numberOfLines={1}
        className={color ? '' : (inks[tone] ?? '')}
        style={[{ letterSpacing: 0.2 }, color ? { color } : null]}
      >
        {label}
      </Txt>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}

/** A hairline used to separate stacked rows inside one surface. */
export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px bg-line ${className}`} />;
}

export { elevation };
