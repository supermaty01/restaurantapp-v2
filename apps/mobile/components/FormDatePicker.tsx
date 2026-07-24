import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parse } from 'date-fns';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { View, Text, TouchableOpacity, Platform } from 'react-native';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';

interface FormDatePickerProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string | undefined;
}

function FormDatePicker<TFieldValues extends FieldValues>({
  control,
  name,
  label,
}: FormDatePickerProps<TFieldValues>) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        const formattedDate = value
          ? format(parse(value, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')
          : 'Selecciona una fecha';

        return (
          <View className="mb-4">
            {label && <Text className="text-base mb-2 text-ink">{label}</Text>}

            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              className="w-full min-h-12 px-4 border border-line rounded-lg bg-surface flex justify-center"
            >
              <Text className="text-ink">{formattedDate}</Text>
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (selectedDate && event.type !== 'dismissed') {
                    // Usar format de date-fns para evitar problemas de zona horaria
                    onChange(format(selectedDate, 'yyyy-MM-dd'));
                  }
                }}
              />
            )}

            {error && <Text className="text-danger dark:text-red-400 mt-1">{error.message}</Text>}
          </View>
        );
      }}
    />
  );
}

export default FormDatePicker;
