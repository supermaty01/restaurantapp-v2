import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useController } from 'react-hook-form';
import { View, TouchableOpacity, Text } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form';

// Either controlled (control + name, pointing at a numeric field) or plain
// display (value). TName is constrained so a non-numeric field cannot be bound.
interface RatingStarsProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPathByValue<TFieldValues, number | null | undefined> = FieldPathByValue<
    TFieldValues,
    number | null | undefined
  >,
  TTransformed = TFieldValues,
> {
  control?: Control<TFieldValues, unknown, TTransformed> | undefined;
  name?: TName | undefined;
  value?: number | null | undefined;
  readOnly?: boolean | undefined;
  size?: number | undefined;
  gap?: number | undefined;
}

interface RatingStarsDisplayProps {
  ratingValue: number;
  onChange: (value: number) => void;
  value?: number | null | undefined;
  readOnly: boolean;
  size: number;
  gap: number;
}

const NOOP = () => {};

const RatingStarsDisplay = React.memo<RatingStarsDisplayProps>(
  ({ ratingValue, onChange, value, readOnly, size, gap }) => {
    const { colors } = useTheme();

    const handlePress = (starIndex: number) => {
      if (readOnly) return;
      onChange(starIndex);
    };

    return value === null ? (
      <Text className="text-[14px] italic text-ink-subtle">Sin calificación</Text>
    ) : (
      <View className="flex-row items-center" style={{ gap }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => handlePress(star)} disabled={readOnly}>
            <Ionicons
              // Solid in both states, tinted rather than outlined: mixing a
              // filled star with a hairline one makes the empty half read as a
              // different shape instead of the same one turned off.
              name="star"
              size={size}
              color={star <= ratingValue ? colors.accent : colors.lineStrong}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  },
);

RatingStarsDisplay.displayName = 'RatingStarsDisplay';

function ControlledRatingStars<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, number | null | undefined>,
  TTransformed = TFieldValues,
>({
  control,
  name,
  readOnly,
  size,
  gap,
}: RatingStarsProps<TFieldValues, TName, TTransformed> & {
  control: Control<TFieldValues, unknown, TTransformed>;
  name: TName;
}) {
  const {
    field: { onChange, value },
  } = useController({ control, name });

  return (
    <RatingStarsDisplay
      ratingValue={value || 0}
      onChange={onChange}
      value={value}
      readOnly={readOnly ?? false}
      size={size ?? 24}
      gap={gap ?? 4}
    />
  );
}

export default function RatingStars<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, number | null | undefined>,
  TTransformed = TFieldValues,
>({
  control,
  name,
  value,
  readOnly = false,
  size = 24,
  gap = 4,
}: RatingStarsProps<TFieldValues, TName, TTransformed>) {
  if (control && name) {
    return (
      <ControlledRatingStars
        control={control}
        name={name}
        readOnly={readOnly}
        size={size}
        gap={gap}
      />
    );
  }

  return (
    <RatingStarsDisplay
      ratingValue={value || 0}
      onChange={NOOP}
      value={value}
      readOnly={readOnly}
      size={size}
      gap={gap}
    />
  );
}
