import { clsx } from 'clsx';
import { Controller } from 'react-hook-form';
import { View, Text, TextInput } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

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
  containerClassName?: string | undefined;
  inputClassName?: string | undefined;
}

/**
 * Generic over the form shape so `name` is checked against the actual fields.
 * v1 typed this as `Control<any>`, which silently accepted any field name.
 */
function FormInput<TFieldValues extends FieldValues, TTransformed = TFieldValues>({
  control,
  name,
  label,
  containerClassName,
  inputClassName,
  keyboardType,
  ...rest
}: FormInputProps<TFieldValues, TTransformed>) {
  const { isDarkMode } = useTheme();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View className={clsx('mb-4', containerClassName)}>
          {label && (
            <Text
              className={clsx(
                'text-base mb-2 text-gray-800 dark:text-gray-200',
                error ? 'text-red-600 dark:text-red-400' : '',
              )}
            >
              {label}
            </Text>
          )}
          <TextInput
            onBlur={onBlur}
            onChangeText={onChange}
            value={keyboardType === 'numeric' ? String(value ?? '') : (value ?? '')}
            className={clsx(
              'w-full min-h-12 px-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-card text-gray-800 dark:text-gray-200',
              inputClassName,
            )}
            placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
            keyboardType={keyboardType}
            accessibilityLabel={label ?? rest.placeholder}
            {...rest}
          />
          {error && <Text className="text-red-600 dark:text-red-400 mt-1">{error.message}</Text>}
        </View>
      )}
    />
  );
}

export default FormInput;
