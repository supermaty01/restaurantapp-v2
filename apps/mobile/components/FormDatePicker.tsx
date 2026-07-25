import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { View, Platform } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { FieldLabel } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

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
  const { colors } = useTheme();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        const shortcuts = [
          { label: 'Hoy', value: isoDaysAgo(0) },
          { label: 'Ayer', value: isoDaysAgo(1) },
          { label: 'Anteayer', value: isoDaysAgo(2) },
        ];

        const isShortcut = shortcuts.some((s) => s.value === value);

        return (
          <View className="gap-2">
            {label ? <FieldLabel>{label}</FieldLabel> : null}

            {/* Almost every visit is logged the same day or the next: the
                common case should not open a calendar at all. */}
            <View className="flex-row flex-wrap gap-2">
              {shortcuts.map((shortcut) => {
                const active = value === shortcut.value;
                return (
                  <PressableScale
                    key={shortcut.label}
                    accessibilityLabel={shortcut.label}
                    onPress={() => onChange(shortcut.value)}
                    scaleTo={0.94}
                    className={`rounded-pill border px-3.5 py-2 ${
                      active ? 'border-primary bg-primary/12' : 'border-line-strong bg-surface'
                    }`}
                  >
                    <Txt
                      variant="caption"
                      weight="bold"
                      serif={false}
                      tone={active ? 'primary' : 'muted'}
                    >
                      {shortcut.label}
                    </Txt>
                  </PressableScale>
                );
              })}

              <PressableScale
                accessibilityLabel="Elegir otra fecha"
                onPress={() => setShowPicker(true)}
                scaleTo={0.94}
                className={`flex-row items-center gap-1.5 rounded-pill border px-3.5 py-2 ${
                  value && !isShortcut
                    ? 'border-primary bg-primary/12'
                    : 'border-line-strong bg-surface'
                }`}
              >
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={value && !isShortcut ? colors.primary : colors.inkMuted}
                />
                <Txt
                  variant="caption"
                  weight="bold"
                  serif={false}
                  tone={value && !isShortcut ? 'primary' : 'muted'}
                >
                  {value && !isShortcut
                    ? format(parse(value, 'yyyy-MM-dd', new Date()), "d 'de' MMMM", { locale: es })
                    : 'Otra fecha'}
                </Txt>
              </PressableScale>
            </View>

            {showPicker && (
              <DateTimePicker
                value={value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date()}
                mode="date"
                // Logging a meal you have not eaten yet is always a mistake.
                maximumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (selectedDate && event.type !== 'dismissed') {
                    // date-fns `format`, not toISOString: the latter converts to
                    // UTC and files an evening meal under the following day.
                    onChange(format(selectedDate, 'yyyy-MM-dd'));
                  }
                }}
              />
            )}

            {error?.message ? (
              <Txt variant="caption" tone="danger">
                {error.message}
              </Txt>
            ) : null}
          </View>
        );
      }}
    />
  );
}

/** `yyyy-MM-dd` for N days back, in local time. */
function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return format(date, 'yyyy-MM-dd');
}

export default FormDatePicker;
