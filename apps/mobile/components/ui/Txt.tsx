import { Text } from 'react-native';

import { DISPLAY_VARIANTS as SERIF_VARIANTS, fonts, type as scale } from '@/lib/design/tokens';

import type { TextProps } from 'react-native';

export type TxtVariant =
  /** Screen-owning statement. One per screen, at most. */
  | 'hero'
  /** Section-owning statement, screen titles. */
  | 'display'
  /** Card titles, section headers. */
  | 'title'
  /** Row titles, form group labels. */
  | 'heading'
  /** Default reading size. */
  | 'body'
  /** Slightly smaller body, for supporting copy. */
  | 'callout'
  /** Metadata: dates, counts, helper text. */
  | 'caption'
  /** Small uppercase label above a field or group. */
  | 'overline';

export type TxtTone = 'ink' | 'muted' | 'subtle' | 'primary' | 'danger' | 'onPrimary' | 'onInverse';

type Weight = 'regular' | 'medium' | 'semi' | 'bold';

/**
 * Text with the type scale applied.
 *
 * Before this, sizes were written inline as `text-[15px]` and the two families
 * were picked per element, which is how a screen ends up with four sizes that
 * are nearly the same and a serif heading next to a sans one for no reason.
 *
 * The serif (Fraunces) carries anything editorial — headings, counts, the
 * things you want to feel printed. The sans (Manrope) carries everything you
 * read rather than glance at. `serif` overrides that default where a specific
 * composition wants the other one.
 */
const DISPLAY_VARIANTS = new Set<TxtVariant>(SERIF_VARIANTS);

const WEIGHT_FONT: Record<Weight, string> = {
  regular: fonts.body,
  medium: fonts.bodyMedium,
  semi: fonts.bodySemi,
  bold: fonts.bodyBold,
};

const TONE_CLASS: Record<TxtTone, string> = {
  ink: 'text-ink',
  muted: 'text-ink-muted',
  subtle: 'text-ink-subtle',
  primary: 'text-primary',
  danger: 'text-danger',
  onPrimary: 'text-on-primary',
  onInverse: 'text-on-inverse',
};

interface TxtProps extends Omit<TextProps, 'className'> {
  variant?: TxtVariant;
  tone?: TxtTone;
  weight?: Weight;
  /** Forces the serif on or off, overriding the variant's default. */
  serif?: boolean;
  uppercase?: boolean;
  className?: string | undefined;
}

export function Txt({
  variant = 'body',
  tone = 'ink',
  weight,
  serif,
  uppercase = false,
  className = '',
  style,
  children,
  ...rest
}: TxtProps) {
  const useSerif = serif ?? DISPLAY_VARIANTS.has(variant);
  const resolvedWeight: Weight = weight ?? (variant === 'overline' ? 'bold' : 'regular');

  const fontFamily = useSerif
    ? resolvedWeight === 'bold' || resolvedWeight === 'semi'
      ? fonts.displaySemi
      : fonts.display
    : WEIGHT_FONT[resolvedWeight];

  return (
    <Text
      className={`${TONE_CLASS[tone]} ${className}`}
      style={[
        scale[variant],
        { fontFamily },
        uppercase ? { textTransform: 'uppercase' } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
