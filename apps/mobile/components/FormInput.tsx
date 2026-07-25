import { clsx } from 'clsx';
import { Controller } from 'react-hook-form';
import { TextInput, View } from 'react-native';

import { FieldLabel } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { type as scale } from '@/lib/design/tokens';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import type { TextInputProps } from 'react-native';

interface FormInputProps<
  TFieldValues extends FieldValues,
  TTransformed = TFieldValues,
> extends TextInputProps {
  // Three params: with a zod resolver the parsed output type differs from the
  // form input type (e.g. z.coerce), so it must be threaded through.
  control: Control<TFieldValues, unknown, TTransformed>;
  name: FieldPath<TFieldValues>;
  label?: string | undefined;
  /** Sits under the field, replaced by the error when there is one. */
  hint?: string | undefined;
  containerClassName?: string | undefined;
  inputClassName?: string | undefined;
}

/**
 * A labelled text field (docs/14).
 *
 * Generic over the form shape so `name` is checked against the actual fields —
 * v1 typed this as `Control<any>`, which silently accepted any field name.
 *
 * The invalid state is carried by the field's own border rather than only by
 * the message below it: a red line under a paragraph of text is easy to miss,
 * and the thing that is wrong is the input.
 */
function FormInput<TFieldValues extends FieldValues, TTransformed = TFieldValues>({
  control,
  name,
  label,
  hint,
  containerClassName,
  inputClassName,
  keyboardType,
  multiline,
  ...rest
}: FormInputProps<TFieldValues, TTransformed>) {
  const { colors } = useTheme();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View className={clsx('gap-2', containerClassName)}>
          {label ? <FieldLabel>{label}</FieldLabel> : null}

          <TextInput
            onBlur={onBlur}
            onChangeText={onChange}
            value={keyboardType === 'numeric' ? String(value ?? '') : (value ?? '')}
            className={clsx(
              'w-full rounded-lg border bg-surface px-4 text-ink',
              multiline ? 'min-h-24 py-3.5' : 'min-h-12 py-3',
              error ? 'border-danger' : 'border-line-strong',
              inputClassName,
            )}
            style={scale.body}
            placeholderTextColor={colors.inkSubtle}
            keyboardType={keyboardType}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            accessibilityLabel={label ?? rest.placeholder}
            {...rest}
          />

          {error?.message ? (
            <Txt variant="caption" tone="danger">
              {error.message}
            </Txt>
          ) : hint ? (
            <Txt variant="caption" tone="subtle">
              {hint}
            </Txt>
          ) : null}
        </View>
      )}
    />
  );
}

export default FormInput;
