import clsx from 'clsx';
import { FC } from 'react';
import { Controller, Control } from 'react-hook-form';
import { View, Text, TextInput, TextInputProps } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

interface FormInputProps extends TextInputProps {
  control: Control<any>;
  name: string;
  label?: string;
  containerClassName?: string;
  inputClassName?: string;
}

const FormInput: FC<FormInputProps> = ({
  control,
  name,
  label,
  containerClassName,
  inputClassName,
  keyboardType,
  ...rest
}) => {
  const { isDarkMode } = useTheme();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View className={clsx("mb-4", containerClassName)}>
          {label && <Text className={clsx("text-base mb-2 text-gray-800 dark:text-gray-200", error ? "text-red-600 dark:text-red-400" : "")}>{label}</Text>}
          <TextInput
            onBlur={onBlur}
            onChangeText={onChange}
            value={keyboardType === "numeric" ? value?.toString() : value}
            className={clsx("w-full min-h-12 px-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-card text-gray-800 dark:text-gray-200", inputClassName)}
            placeholderTextColor={isDarkMode ? "#9ca3af" : "#6b7280"}
            keyboardType={keyboardType}
            {...rest}
          />
          {error && <Text className="text-red-600 dark:text-red-400 mt-1">{error.message}</Text>}
        </View>
      )}
    />
  );
};

export default FormInput;
