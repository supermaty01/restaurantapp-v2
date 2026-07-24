import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Renders a spinner and blocks presses; keeps the button's width. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretches to the full width of the parent. */
  block?: boolean;
  className?: string;
}

const container: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:bg-primary-pressed',
  secondary: 'bg-surface border border-line-strong active:bg-sunken',
  ghost: 'bg-transparent active:bg-sunken',
  danger: 'bg-danger active:opacity-90',
};

const label: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-ink',
  ghost: 'text-primary',
  danger: 'text-white',
};

const sizing: Record<ButtonSize, { box: string; text: string; icon: number }> = {
  sm: { box: 'px-3 py-2 rounded-md', text: 'text-[13px]', icon: 15 },
  md: { box: 'px-4 py-3 rounded-lg', text: 'text-[15px]', icon: 17 },
  lg: { box: 'px-5 py-4 rounded-xl', text: 'text-[16px]', icon: 19 },
};

/**
 * The one button in the app.
 *
 * Colours resolve through the theme variables, so a single set of classes is
 * correct in both schemes; the icon needs a literal colour, which is the only
 * reason this reads from `useTheme`.
 */
export function Button({
  label: text,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  block = false,
  className = '',
}: ButtonProps) {
  const { colors } = useTheme();
  const inert = disabled || loading;
  const { box, text: textSize, icon: iconSize } = sizing[size];

  const iconColor =
    variant === 'primary' || variant === 'danger'
      ? colors.onPrimary
      : variant === 'ghost'
        ? colors.primary
        : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      onPress={onPress}
      disabled={inert}
      className={`flex-row items-center justify-center gap-2 ${box} ${container[variant]} ${
        block ? 'w-full' : ''
      } ${inert ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : icon ? (
        <Ionicons name={icon} size={iconSize} color={iconColor} />
      ) : null}
      <Text className={`font-semi ${textSize} ${label[variant]}`} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

/** A circular icon-only button, for headers and card corners. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'ghost',
  size = 38,
  className = '',
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: ButtonVariant;
  size?: number;
  className?: string;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{ width: size, height: size }}
      className={`items-center justify-center rounded-pill ${container[variant]} ${className}`}
    >
      <View>
        <Ionicons
          name={icon}
          size={Math.round(size * 0.5)}
          color={variant === 'primary' || variant === 'danger' ? colors.onPrimary : colors.ink}
        />
      </View>
    </Pressable>
  );
}
