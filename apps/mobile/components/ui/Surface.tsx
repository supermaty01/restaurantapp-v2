import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

import type { ComponentProps, ReactNode } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * The Clay card: a light surface on the warm canvas, hairline border, no
 * shadow. Depth comes from the border and the background contrast rather than
 * elevation, which is what keeps the paper feel.
 */
export function Card({
  children,
  onPress,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  onPress?: (() => void) | undefined;
  className?: string;
  padded?: boolean;
}) {
  const classes = `bg-surface border border-line rounded-xl ${padded ? 'p-3' : ''} ${className}`;

  if (!onPress) return <View className={classes}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`${classes} active:opacity-80`}
    >
      {children}
    </Pressable>
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
      <Text className="font-display text-[20px] text-ink">{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text className="font-semi text-[13px] text-primary">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The small uppercase label that sits above a form field. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="font-bold text-[12px] uppercase tracking-wider text-ink-subtle">
      {children}
    </Text>
  );
}

/**
 * Shown where a list has nothing in it. An empty screen with no explanation
 * reads as a bug, so this always says what would appear here.
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
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-pill bg-sunken">
        <Ionicons name={icon} size={28} color={colors.inkSubtle} />
      </View>
      <Text className="text-center font-display text-[20px] text-ink">{title}</Text>
      {message ? (
        <Text className="mt-1.5 text-center text-[14px] leading-5 text-ink-muted">{message}</Text>
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
  onPress,
  className = '',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'sage' | 'accent';
  /** An explicit colour, for user-defined tags that carry their own. */
  color?: string | undefined;
  onPress?: (() => void) | undefined;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-sunken',
    primary: 'bg-primary/10',
    sage: 'bg-sage/15',
    accent: 'bg-accent/15',
  };
  const text: Record<string, string> = {
    neutral: 'text-ink-muted',
    primary: 'text-primary',
    sage: 'text-sage',
    accent: 'text-accent',
  };

  const body = (
    <View
      className={`rounded-pill px-2.5 py-1 ${color ? '' : tones[tone]} ${className}`}
      style={color ? { backgroundColor: `${color}26` } : undefined}
    >
      <Text
        className={`font-bold text-[11px] ${color ? '' : text[tone]}`}
        style={color ? { color } : undefined}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}
